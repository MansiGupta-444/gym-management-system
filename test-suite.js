/* Isolated Automated Test Suite Runner for Forge Gym. No real LocalStorage records are read or changed. */
(() => {
  'use strict';

  const core = window.ForgeGymCore;
  const $ = (selector) => document.querySelector(selector);
  const FIXED_DATE = '2026-05-18';
  const CSV_COLUMNS = ['Test Case ID', 'Test Type', 'Test Scenario', 'Input or Test Setup', 'Expected Output', 'Actual Output', 'Status', 'Error Details'];
  let results = [];
  let isRunning = false;
  let runStartedAt = 0;

  function stringify(value) {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    try { return JSON.stringify(value); } catch { return String(value); }
  }

  function assertEqual(actual, expected, note = '') {
    if (stringify(actual) !== stringify(expected)) {
      const error = new Error(note || 'The actual value did not match the expected value.');
      error.isAssertionFailure = true;
      error.expected = expected;
      error.actual = actual;
      throw error;
    }
    return actual;
  }

  function assertTrue(actual, note = '') {
    if (!actual) {
      const error = new Error(note || 'Expected the condition to be true.');
      error.isAssertionFailure = true;
      error.expected = true;
      error.actual = actual;
      throw error;
    }
    return actual;
  }

  function memoryStorage(rawValue = null) {
    const values = new Map();
    if (rawValue !== null) values.set(core.storageKey, rawValue);
    return {
      failWrites: false,
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) {
        if (this.failWrites) throw new Error('Synthetic storage quota failure');
        values.set(key, String(value));
      },
      peek(key = core.storageKey) { return values.has(key) ? values.get(key) : null; }
    };
  }

  function validMember(overrides = {}) {
    return {
      name: 'Samira Patel', age: '22', gender: 'Female', phone: '98765 43210',
      email: 'samira@example.com', plan: 'Monthly', ...overrides
    };
  }

  function featureHarness(rawValue = null) {
    const storage = memoryStorage(rawValue);
    let members = core.readMembers(storage);
    return {
      storage,
      list() { return members; },
      register(data, date = FIXED_DATE) {
        const outcome = core.registerMember(data, members, date);
        if (!outcome.ok) return outcome;
        const saved = core.saveMembers(storage, outcome.members);
        if (!saved.ok) return { ...outcome, ok: false, error: saved.error, member: null };
        members = outcome.members;
        return outcome;
      },
      update(id, data) {
        const outcome = core.updateMember(data, members, id);
        if (!outcome.ok) return outcome;
        const saved = core.saveMembers(storage, outcome.members);
        if (!saved.ok) return { ...outcome, ok: false, error: saved.error, member: null };
        members = outcome.members;
        return outcome;
      },
      search(query) { return core.searchMembers(members, query); },
      remove(id) {
        const outcome = core.deleteMember(members, id);
        if (!outcome.removed) return outcome;
        const saved = core.saveMembers(storage, outcome.members);
        if (!saved.ok) return { removed: false, members, error: saved.error };
        members = outcome.members;
        return outcome;
      },
      reload() { members = core.readMembers(storage); return members; }
    };
  }

  function silenceExpectedConsoleError(callback) {
    const oldError = console.error;
    console.error = () => {};
    try { return callback(); } finally { console.error = oldError; }
  }

  function define(id, type, scenario, input, expected, run) {
    return { id, type, scenario, input, expected, run };
  }

  const blackBoxTests = [
    define('BB-01', 'Black-box', 'A fresh application has an empty member list', 'New isolated storage key', '0 members', () => {
      const actual = featureHarness().list().length; return assertEqual(actual, 0);
    }),
    define('BB-02', 'Black-box', 'Valid registration adds one member with an ID', 'Complete valid member form', '1 saved member with an FG- ID', () => {
      const env = featureHarness(); const out = env.register(validMember());
      const actual = { ok: out.ok, count: env.list().length, idPrefix: out.member?.id.startsWith('FG-') };
      return assertEqual(actual, { ok: true, count: 1, idPrefix: true });
    }),
    define('BB-03', 'Black-box', 'Two registrations receive different IDs', 'Register two valid members', 'IDs are distinct', () => {
      const env = featureHarness(); const first = env.register(validMember()).member; const second = env.register(validMember({ email: 'second@example.com' })).member;
      return assertTrue(first.id !== second.id, `First ${first.id}; second ${second.id}`);
    }),
    define('BB-04', 'Black-box', 'Blank required values are rejected', 'All form fields blank', 'Registration rejected; list stays empty', () => {
      const env = featureHarness(); const out = env.register(validMember({ name: '', age: '', gender: '', phone: '', email: '', plan: '' }));
      return assertEqual({ ok: out.ok, count: env.list().length, message: out.error }, { ok: false, count: 0, message: 'Please complete all required fields.' });
    }),
    define('BB-05', 'Black-box', 'Minimum permitted age is accepted', 'Age 12', 'Registration succeeds', () => {
      const out = featureHarness().register(validMember({ age: '12' })); return assertTrue(out.ok, out.error);
    }),
    define('BB-06', 'Black-box', 'Age below the permitted range is rejected', 'Age 11', 'Registration is rejected', () => {
      const out = featureHarness().register(validMember({ age: '11' })); return assertTrue(!out.ok && out.error.includes('Age'), out.error);
    }),
    define('BB-07', 'Black-box', 'Maximum permitted age is accepted', 'Age 100', 'Registration succeeds', () => {
      const out = featureHarness().register(validMember({ age: '100' })); return assertTrue(out.ok, out.error);
    }),
    define('BB-08', 'Black-box', 'Age above the permitted range is rejected', 'Age 101', 'Registration is rejected', () => {
      const out = featureHarness().register(validMember({ age: '101' })); return assertTrue(!out.ok && out.error.includes('Age'), out.error);
    }),
    define('BB-09', 'Black-box', 'Fractional age is rejected', 'Age 22.5', 'Registration is rejected', () => {
      const out = featureHarness().register(validMember({ age: '22.5' })); return assertTrue(!out.ok && out.error.includes('whole number'), out.error);
    }),
    define('BB-10', 'Black-box', 'Formatted phone number is accepted', '98765 43210', 'Registration succeeds', () => {
      const out = featureHarness().register(validMember()); return assertTrue(out.ok, out.error);
    }),
    define('BB-11', 'Black-box', 'Phone shorter than 7 digits is rejected', '123456', 'Registration is rejected', () => {
      const out = featureHarness().register(validMember({ phone: '123456' })); return assertTrue(!out.ok && out.error.includes('phone'), out.error);
    }),
    define('BB-12', 'Black-box', 'Phone longer than 15 digits is rejected', '1234567890123456', 'Registration is rejected', () => {
      const out = featureHarness().register(validMember({ phone: '1234567890123456' })); return assertTrue(!out.ok && out.error.includes('phone'), out.error);
    }),
    define('BB-13', 'Black-box', 'Malformed email is rejected', 'samira-at-example', 'Registration is rejected', () => {
      const out = featureHarness().register(validMember({ email: 'samira-at-example' })); return assertTrue(!out.ok && out.error.includes('email'), out.error);
    }),
    define('BB-14', 'Black-box', 'Duplicate email is rejected without case sensitivity', 'Existing Samira@Example.com; add samira@example.com', 'Second registration is rejected', () => {
      const env = featureHarness(); env.register(validMember({ email: 'Samira@Example.com' })); const out = env.register(validMember({ email: 'samira@example.com' }));
      return assertTrue(!out.ok && env.list().length === 1, out.error);
    }),
    define('BB-15', 'Black-box', 'Each available plan can be selected', 'Monthly, Quarterly, Yearly', 'All three registrations succeed', () => {
      const env = featureHarness(); const plans = core.plans.map((plan, index) => env.register(validMember({ name: `Member ${index}`, email: `member${index}@example.com`, plan: plan.name })).ok);
      return assertEqual(plans, [true, true, true]);
    }),
    define('BB-16', 'Black-box', 'Monthly fee is displayed in the dashboard plan card', 'Read rendered Monthly card', '₹1,000 is present', () => {
      const actual = $('#plan-cards').textContent; return assertTrue(actual.includes('₹1,000'), actual);
    }),
    define('BB-17', 'Black-box', 'Quarterly fee is displayed in the dashboard plan card', 'Read rendered Quarterly card', '₹2,500 is present', () => {
      const actual = $('#plan-cards').textContent; return assertTrue(actual.includes('₹2,500'), actual);
    }),
    define('BB-18', 'Black-box', 'Yearly fee is displayed in the dashboard plan card', 'Read rendered Yearly card', '₹8,000 is present', () => {
      const actual = $('#plan-cards').textContent; return assertTrue(actual.includes('₹8,000'), actual);
    }),
    define('BB-19', 'Black-box', 'Member listing contains newly registered records', 'Register a member and reload isolated storage', 'Member appears in the list', () => {
      const env = featureHarness(); env.register(validMember()); env.reload(); const actual = env.list().map((member) => member.name);
      return assertEqual(actual, ['Samira Patel']);
    }),
    define('BB-20', 'Black-box', 'Name search ignores letter casing', 'Search samira PATEL', 'Samira Patel is returned', () => {
      const env = featureHarness(); env.register(validMember()); const actual = env.search('sAmIrA pAtEl').map((member) => member.name);
      return assertEqual(actual, ['Samira Patel']);
    }),
    define('BB-21', 'Black-box', 'Phone search accepts digits without formatting', 'Search 9876543210', 'Matching member is returned', () => {
      const env = featureHarness(); env.register(validMember()); const actual = env.search('9876543210').length;
      return assertEqual(actual, 1);
    }),
    define('BB-22', 'Black-box', 'Email search ignores letter casing', 'Search SAMIRA@EXAMPLE.COM', 'Matching member is returned', () => {
      const env = featureHarness(); env.register(validMember()); const actual = env.search('SAMIRA@EXAMPLE.COM').length;
      return assertEqual(actual, 1);
    }),
    define('BB-23', 'Black-box', 'Search for a missing member returns no records', 'Search nobody@nowhere.invalid', '0 matches', () => {
      const env = featureHarness(); env.register(validMember()); const actual = env.search('nobody@nowhere.invalid').length;
      return assertEqual(actual, 0);
    }),
    define('BB-24', 'Black-box', 'Editing updates details but preserves ID and join date', 'Edit phone and name', 'Details change; ID/date remain', () => {
      const env = featureHarness(); const original = env.register(validMember()).member; const out = env.update(original.id, validMember({ name: 'Samira Updated', phone: '9123456789' }));
      return assertEqual({ ok: out.ok, name: out.member.name, phone: out.member.phone, id: out.member.id, date: out.member.registeredAt }, { ok: true, name: 'Samira Updated', phone: '9123456789', id: original.id, date: original.registeredAt });
    }),
    define('BB-25', 'Black-box', 'Deleting one selected member preserves another member', 'Create two records; delete the first ID', 'Only the second ID remains', () => {
      const env = featureHarness(); const first = env.register(validMember()).member; const second = env.register(validMember({ email: 'second@example.com' })).member; env.remove(first.id);
      return assertEqual(env.list().map((member) => member.id), [second.id]);
    }),
    define('BB-26', 'Black-box', 'Deleting a nonexistent ID does not change the list', 'One record; remove missing ID', 'Record remains unchanged', () => {
      const env = featureHarness(); const member = env.register(validMember()).member; const out = env.remove('missing-id');
      return assertEqual({ removed: out.removed, ids: env.list().map((item) => item.id) }, { removed: false, ids: [member.id] });
    }),
    define('BB-27', 'Black-box', 'Clearing search displays all members', 'Two members; empty query', '2 records returned', () => {
      const env = featureHarness(); env.register(validMember()); env.register(validMember({ email: 'other@example.com' }));
      return assertEqual(env.search('').length, 2);
    }),
    define('BB-28', 'Black-box', 'Saved members remain after a reload', 'Save one record and reload the isolated store', 'The record is restored', () => {
      const env = featureHarness(); env.register(validMember()); const actual = env.reload().map((member) => member.email);
      return assertEqual(actual, ['samira@example.com']);
    }),
    define('BB-29', 'Black-box', 'Malformed stored JSON is handled safely', 'Storage contains {bad json', 'Empty member list; no crash', () => {
      const actual = silenceExpectedConsoleError(() => featureHarness('{bad json').list().length); return assertEqual(actual, 0);
    }),
    define('BB-30', 'Black-box', 'Unknown membership plan is rejected', 'Plan = Premium', 'Registration rejected', () => {
      const out = featureHarness().register(validMember({ plan: 'Premium' })); return assertTrue(!out.ok && out.error.includes('available membership plan'), out.error);
    })
  ];

  const whiteBoxTests = [
    define('WB-01', 'White-box', 'readMembers handles a missing storage value', 'getItem returns null', 'Empty array', () => assertEqual(core.readMembers(memoryStorage()), [])),
    define('WB-02', 'White-box', 'readMembers parses a valid JSON array', 'One valid JSON member', 'One normalized record', () => {
      const actual = core.readMembers(memoryStorage(JSON.stringify([{ id: 'A1', name: 'A', age: 20, gender: 'Female', phone: '1234567', email: 'a@b.co', plan: 'Monthly', registeredAt: FIXED_DATE }])));
      return assertEqual({ count: actual.length, ageType: typeof actual[0].age }, { count: 1, ageType: 'string' });
    }),
    define('WB-03', 'White-box', 'readMembers rejects non-array JSON', 'Stored JSON object {}', 'Empty array', () => assertEqual(core.readMembers(memoryStorage('{}')), [])),
    define('WB-04', 'White-box', 'JSON parse failure follows the catch branch', 'Stored JSON is invalid', 'Empty array returned', () => {
      const actual = silenceExpectedConsoleError(() => core.readMembers(memoryStorage('not-json'))); return assertEqual(actual.length, 0);
    }),
    define('WB-05', 'White-box', 'Records without string IDs are filtered', 'One null item and one missing ID', 'No accepted records', () => assertEqual(core.readMembers(memoryStorage('[null,{"name":"No ID"}]')).length, 0)),
    define('WB-06', 'White-box', 'Missing properties are normalized to empty strings', 'Record with ID only', 'String values for all member fields', () => {
      const item = core.readMembers(memoryStorage('[{"id":"A1"}]'))[0]; return assertEqual([item.name, item.age, item.email, item.phone], ['', '', '', '']);
    }),
    define('WB-07', 'White-box', 'Duplicate stored IDs are made unique', 'Two records have ID X', 'IDs X and X-2', () => {
      const actual = core.readMembers(memoryStorage('[{"id":"X"},{"id":"X"}]')).map((member) => member.id); return assertEqual(actual, ['X', 'X-2']);
    }),
    define('WB-08', 'White-box', 'saveMembers serializes to the shared key', 'Save one record to memory storage', 'Success and valid JSON under core.storageKey', () => {
      const storage = memoryStorage(); const outcome = core.saveMembers(storage, [{ id: 'A1' }]);
      return assertEqual({ ok: outcome.ok, value: storage.peek() }, { ok: true, value: '[{"id":"A1"}]' });
    }),
    define('WB-09', 'White-box', 'saveMembers reports storage write errors', 'Storage adapter throws', 'ok false with error details', () => {
      const storage = memoryStorage(); storage.failWrites = true; const outcome = silenceExpectedConsoleError(() => core.saveMembers(storage, []));
      return assertTrue(!outcome.ok && outcome.error.includes('quota'), stringify(outcome));
    }),
    define('WB-10', 'White-box', 'Required-field condition is reached for a blank name', 'Valid object except name empty', 'Required-fields message', () => assertEqual(core.validateMember(validMember({ name: '' }), []), 'Please complete all required fields.')),
    define('WB-11', 'White-box', 'Name length guard rejects more than 80 characters', '81-character name', 'Name length message', () => assertEqual(core.validateMember(validMember({ name: 'N'.repeat(81) }), []), 'Name must be 80 characters or fewer.')),
    define('WB-12', 'White-box', 'Age integer check rejects fractional values', 'Age 20.2', 'Age range message', () => assertTrue(core.validateMember(validMember({ age: '20.2' }), []).includes('whole number'))),
    define('WB-13', 'White-box', 'Age lower bound accepts 12', 'Age = 12', 'No validation error', () => assertEqual(core.validateMember(validMember({ age: '12' }), []), '')),
    define('WB-14', 'White-box', 'Age upper bound accepts 100', 'Age = 100', 'No validation error', () => assertEqual(core.validateMember(validMember({ age: '100' }), []), '')),
    define('WB-15', 'White-box', 'Age lower bound rejects 11', 'Age = 11', 'Age range message', () => assertTrue(core.validateMember(validMember({ age: '11' }), []).includes('between 12 and 100'))),
    define('WB-16', 'White-box', 'Phone character regex rejects letters', 'Phone = 987ABC6543', 'Phone message', () => assertTrue(core.validateMember(validMember({ phone: '987ABC6543' }), []).includes('phone number'))),
    define('WB-17', 'White-box', 'Phone digit-count lower branch rejects 6 digits', 'Phone = 123456', 'Phone message', () => assertTrue(core.validateMember(validMember({ phone: '123456' }), []).includes('phone number'))),
    define('WB-18', 'White-box', 'Phone digit-count upper branch rejects 16 digits', 'Phone = 1234567890123456', 'Phone message', () => assertTrue(core.validateMember(validMember({ phone: '1234567890123456' }), []).includes('phone number'))),
    define('WB-19', 'White-box', 'Email pattern rejects a missing domain suffix', 'Email = samira@example', 'Email message', () => assertTrue(core.validateMember(validMember({ email: 'samira@example' }), []).includes('email address'))),
    define('WB-20', 'White-box', 'Email pattern accepts a valid address', 'Email = samira@example.com', 'No validation error', () => assertEqual(core.validateMember(validMember(), []), '')),
    define('WB-21', 'White-box', 'Duplicate-email branch compares case-insensitively', 'Existing SAMIRA@example.com', 'Duplicate message', () => {
      const list = [{ id: 'A1', email: 'SAMIRA@example.com' }]; return assertTrue(core.validateMember(validMember(), list).includes('already registered'));
    }),
    define('WB-22', 'White-box', 'Editing can keep the current member email', 'Editing ID A1; same email', 'No duplicate error', () => {
      const list = [{ id: 'A1', email: 'samira@example.com' }]; return assertEqual(core.validateMember(validMember(), list, 'A1'), '');
    }),
    define('WB-23', 'White-box', 'Plan lookup branch rejects unavailable plans', 'Plan = Premium', 'Plan validation message', () => assertTrue(core.validateMember(validMember({ plan: 'Premium' }), []).includes('available membership plan'))),
    define('WB-24', 'White-box', 'Plan lookup branch accepts a listed plan', 'Plan = Quarterly', 'No validation error', () => assertEqual(core.validateMember(validMember({ plan: 'Quarterly' }), []), '')),
    define('WB-25', 'White-box', 'ID generator uses the expected prefix', 'Generate ID from empty list', 'ID begins FG-', () => assertTrue(core.generateMemberId([]).startsWith('FG-'))),
    define('WB-26', 'White-box', 'ID generator retries a collision', 'First candidate already exists', 'New candidate is distinct', () => {
      const oldNow = Date.now; const oldRandom = Math.random; let call = 0; const fixedNow = 1700000000000;
      try {
        Date.now = () => fixedNow; Math.random = () => (++call === 1 ? 0.123456 : 0.654321);
        const firstRandom = (0.123456).toString(36).slice(2, 6).toUpperCase();
        const collision = `FG-${fixedNow.toString(36).toUpperCase().slice(-5)}${firstRandom}`;
        const actual = core.generateMemberId([{ id: collision }]);
        return assertTrue(actual !== collision && call === 2, `id=${actual}; attempts=${call}`);
      } finally { Date.now = oldNow; Math.random = oldRandom; }
    }),
    define('WB-27', 'White-box', 'Empty search query returns a shallow copy of all records', 'Two records; query spaces', 'Both records returned', () => {
      const list = [{ name: 'A' }, { name: 'B' }]; const actual = core.searchMembers(list, '   ');
      return assertTrue(actual.length === 2 && actual !== list, `count=${actual.length}; newArray=${actual !== list}`);
    }),
    define('WB-28', 'White-box', 'Name search uses normalized lowercase values', 'Member Samira; query SAMIRA', 'One result', () => assertEqual(core.searchMembers([{ name: 'Samira Patel', email: '', phone: '' }], 'SAMIRA').length, 1)),
    define('WB-29', 'White-box', 'Phone search strips non-digit query characters', 'Stored phone has spaces; query has punctuation', 'One result', () => assertEqual(core.searchMembers([{ name: '', email: '', phone: '+91 (98765) 43210' }], '+91-98765-43210').length, 1)),
    define('WB-30', 'White-box', 'deleteMember removes only exact matching IDs', 'A1, A2; remove A1', 'A2 remains', () => {
      const out = core.deleteMember([{ id: 'A1' }, { id: 'A2' }], 'A1'); return assertEqual({ removed: out.removed, ids: out.members.map((member) => member.id) }, { removed: true, ids: ['A2'] });
    }),
    define('WB-31', 'White-box', 'deleteMember missing-ID branch leaves the array unchanged', 'One row; remove absent ID', 'removed false; row remains', () => {
      const rows = [{ id: 'A1' }]; const out = core.deleteMember(rows, 'missing'); return assertTrue(!out.removed && out.members.length === 1 && out.members[0] === rows[0]);
    }),
    define('WB-32', 'White-box', 'updateMember missing-ID branch reports not found', 'Update ID absent from list', 'Not-found error; same list returned', () => {
      const rows = []; const out = core.updateMember(validMember(), rows, 'missing'); return assertEqual({ ok: out.ok, error: out.error, same: out.members === rows }, { ok: false, error: 'Member was not found.', same: true });
    }),
    define('WB-33', 'White-box', 'Rejected registration does not mutate source list', 'Invalid age', 'Same empty list returned', () => {
      const rows = []; const out = core.registerMember(validMember({ age: '5' }), rows, FIXED_DATE); return assertTrue(!out.ok && out.members === rows && rows.length === 0);
    }),
    define('WB-34', 'White-box', 'Successful update preserves immutable ID and registration date', 'Update an existing member', 'Original ID and date retained', () => {
      const rows = [{ ...validMember(), id: 'KEEP', registeredAt: FIXED_DATE }]; const out = core.updateMember(validMember({ name: 'Updated' }), rows, 'KEEP');
      return assertEqual({ ok: out.ok, id: out.member.id, date: out.member.registeredAt, name: out.member.name }, { ok: true, id: 'KEEP', date: FIXED_DATE, name: 'Updated' });
    }),
    define('WB-35', 'White-box', 'CSV export uses the required header and escapes commas', 'One result whose scenario includes a comma', 'Required header and quoted field', () => {
      const csv = buildCsv([{ id: 'BB-TEST', type: 'Black-box', scenario: 'Name, phone', input: 'a', expected: 'b', actual: 'b', status: 'PASS', error: '' }]);
      return assertTrue(csv.includes(CSV_COLUMNS.map(csvCell).join(',')) && csv.includes('"Name, phone"'), csv);
    })
  ];

  function csvCell(value) {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildCsv(rows) {
    const headings = CSV_COLUMNS.map(csvCell).join(',');
    const body = rows.map((row) => [row.id, row.type, row.scenario, row.input, row.expected, row.actual, row.status, row.error].map(csvCell).join(','));
    return `\uFEFF${[headings, ...body].join('\r\n')}`;
  }

  const allTests = [...blackBoxTests, ...whiteBoxTests];
  let counts = { total: allTests.length, passed: 0, failed: 0, errors: 0, running: 0 };
  $('#suite-total').textContent = counts.total;

  function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function setButtonsDisabled(disabled) {
    ['#run-all-tests', '#run-black-tests', '#run-white-tests', '#clear-test-results', '#export-test-results'].forEach((selector) => { $(selector).disabled = disabled; });
  }

  function renderCounts() {
    $('#suite-total').textContent = counts.total;
    $('#suite-passed').textContent = counts.passed;
    $('#suite-failed').textContent = counts.failed;
    $('#suite-running').textContent = counts.running;
    $('#suite-progress-bar').style.width = `${counts.total ? Math.round((results.length / counts.total) * 100) : 0}%`;
    $('#console-count').textContent = results.length ? `${results.length} / ${counts.total} cases completed` : 'No results yet';
    $('#suite-duration').textContent = isRunning ? `${Math.round(performance.now() - runStartedAt)} ms` : results.length ? 'COMPLETE' : 'READY';
    $('#export-test-results').disabled = isRunning || results.length === 0;
  }

  function renderResult(result) {
    const statusClass = result.status === 'PASS' ? 'pass' : result.status === 'FAIL' ? 'fail' : 'error';
    const details = result.status === 'PASS'
      ? `<div class="test-detail pass-detail">Actual: ${safeText(result.actual)}</div>`
      : `<div class="test-detail">Expected: ${safeText(result.expected)}\nActual: ${safeText(result.actual)}${result.error ? `\nDetails: ${safeText(result.error)}` : ''}</div>`;
    const row = document.createElement('article');
    row.className = 'test-result';
    row.innerHTML = `<span class="test-id">${safeText(result.id)}</span><div class="test-copy"><strong>${safeText(result.scenario)}</strong><p>${safeText(result.input)}</p><div class="test-meta"><span class="test-tag">${safeText(result.type.toUpperCase())}</span></div></div><span class="test-status ${statusClass}">${safeText(result.status)}</span>${details}`;
    $('#suite-results').append(row);
  }

  function renderFinalSummary() {
    const passed = results.filter((result) => result.status === 'PASS').length;
    const failed = results.filter((result) => result.status === 'FAIL').length;
    const errors = results.filter((result) => result.status === 'ERROR').length;
    counts = { total: results.length, passed, failed, errors, running: 0 };
    $('#suite-status').textContent = errors ? 'Completed with execution errors' : failed ? 'Completed with failing assertions' : 'All selected assertions passed';
    $('#suite-final').hidden = false;
    $('#suite-final').classList.toggle('has-failures', failed > 0 || errors > 0);
    $('#suite-final').innerHTML = `<strong>${passed} passed</strong> · ${failed} failed · ${errors} could not run · ${results.length} total`;
    renderCounts();
  }

  function nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame ? window.requestAnimationFrame(resolve) : window.setTimeout(resolve, 0));
  }

  async function runTests(filter = 'all') {
    if (isRunning) return;
    const selected = allTests.filter((test) => filter === 'all' || test.type === (filter === 'black' ? 'Black-box' : 'White-box'));
    isRunning = true;
    runStartedAt = performance.now();
    results = [];
    counts = { total: selected.length, passed: 0, failed: 0, errors: 0, running: 0 };
    $('#suite-results').replaceChildren();
    $('#suite-final').hidden = true;
    $('#suite-status').textContent = `Running ${selected.length} ${filter === 'all' ? '' : `${filter}-box `}test cases`;
    setButtonsDisabled(true);
    renderCounts();
    await nextFrame();

    for (const test of selected) {
      counts.running = 1;
      renderCounts();
      await nextFrame();
      try {
        const actual = await test.run();
        results.push({ ...test, actual: stringify(actual), status: 'PASS', error: '' });
        counts.passed += 1;
      } catch (error) {
        const status = error.isAssertionFailure ? 'FAIL' : 'ERROR';
        const actual = Object.prototype.hasOwnProperty.call(error, 'actual') ? stringify(error.actual) : `${error.name}: ${error.message}`;
        results.push({ ...test, actual, status, error: error.message || 'Test execution failed.' });
        if (status === 'FAIL') counts.failed += 1; else counts.errors += 1;
      }
      counts.running = 0;
      renderResult(results[results.length - 1]);
      renderCounts();
      await nextFrame();
    }

    isRunning = false;
    setButtonsDisabled(false);
    renderFinalSummary();
  }

  function clearResults() {
    if (isRunning) return;
    results = [];
    counts = { total: allTests.length, passed: 0, failed: 0, errors: 0, running: 0 };
    $('#suite-results').innerHTML = '<div class="suite-empty"><span>⌁</span><strong>No test run yet</strong><p>Choose a run option above to execute the isolated test suite.</p></div>';
    $('#suite-final').hidden = true;
    $('#suite-status').textContent = 'Ready to run';
    $('#suite-duration').textContent = 'READY';
    $('#suite-progress-bar').style.width = '0%';
    $('#console-count').textContent = 'No results yet';
    $('#export-test-results').disabled = true;
    renderCounts();
  }

  function exportResults() {
    if (isRunning || results.length === 0) return;
    const blob = new Blob([buildCsv(results)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forge-gym-test-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    $('#export-feedback').textContent = `CSV download started: ${link.download}`;
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  $('#run-all-tests').addEventListener('click', () => runTests('all'));
  $('#run-black-tests').addEventListener('click', () => runTests('black'));
  $('#run-white-tests').addEventListener('click', () => runTests('white'));
  $('#clear-test-results').addEventListener('click', clearResults);
  $('#export-test-results').addEventListener('click', exportResults);

  window.ForgeGymTestRunner = { allTests, blackBoxTests, whiteBoxTests, buildCsv };
  renderCounts();
})();
