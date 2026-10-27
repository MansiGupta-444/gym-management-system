/* Forge Gym: all member data lives in this browser's LocalStorage. */
(() => {
  'use strict';

  const STORAGE_KEY = 'forgeGymMembers_v1';
  const PLANS = [
    { name: 'Monthly', price: 1000, duration: '1 month', detail: 'A flexible way to get started' },
    { name: 'Quarterly', price: 2500, duration: '3 months', detail: 'A steady routine, better value', featured: true },
    { name: 'Yearly', price: 8000, duration: '12 months', detail: 'The best value for the long run' }
  ];

  // Shared application logic. The runner passes isolated storage objects to these functions.
  const GymCore = {
    storageKey: STORAGE_KEY,
    plans: PLANS,
    readMembers(storage) {
      try {
        const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(value)) return [];
        const usedIds = new Set();
        return value.filter((item) => item && typeof item.id === 'string').map((item) => {
          let id = item.id;
          let suffix = 2;
          while (usedIds.has(id)) id = `${item.id}-${suffix++}`;
          usedIds.add(id);
          return {
            ...item,
            id,
            name: String(item.name ?? ''),
            age: String(item.age ?? ''),
            gender: String(item.gender ?? ''),
            phone: String(item.phone ?? ''),
            email: String(item.email ?? ''),
            plan: String(item.plan ?? ''),
            registeredAt: String(item.registeredAt ?? '')
          };
        });
      } catch (error) {
        console.error('Could not read member records from LocalStorage.', error);
        return [];
      }
    },
    saveMembers(storage, members) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(members));
        return { ok: true, error: '' };
      } catch (error) {
        console.error('Could not save member records to LocalStorage.', error);
        return { ok: false, error: error.message || 'Storage write failed.' };
      }
    },
    generateMemberId(members) {
      let id;
      do {
        const timePart = Date.now().toString(36).toUpperCase().slice(-5);
        const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
        id = `FG-${timePart}${randomPart}`;
      } while (members.some((member) => member.id === id));
      return id;
    },
    validateMember(data, members, editingId = '') {
      const clean = Object.fromEntries(['name', 'age', 'gender', 'phone', 'email', 'plan'].map((key) => [key, String(data?.[key] ?? '').trim()]));
      if (!clean.name || !clean.age || !clean.gender || !clean.phone || !clean.email || !clean.plan) return 'Please complete all required fields.';
      if (clean.name.length > 80) return 'Name must be 80 characters or fewer.';
      if (!Number.isInteger(Number(clean.age)) || Number(clean.age) < 12 || Number(clean.age) > 100) return 'Age must be a whole number between 12 and 100.';
      const digits = clean.phone.replace(/\D/g, '');
      if (!/^[+]?[-()\s\d.]+$/.test(clean.phone) || digits.length < 7 || digits.length > 15) return 'Enter a valid phone number with 7 to 15 digits.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email)) return 'Enter a valid email address.';
      if (members.some((member) => String(member.email ?? '').toLowerCase() === clean.email.toLowerCase() && member.id !== editingId)) return 'A member with this email address is already registered.';
      if (!PLANS.some((plan) => plan.name === clean.plan)) return 'Choose one of the available membership plans.';
      return '';
    },
    registerMember(data, members, registeredAt) {
      const error = this.validateMember(data, members);
      if (error) return { ok: false, error, member: null, members };
      const clean = Object.fromEntries(['name', 'age', 'gender', 'phone', 'email', 'plan'].map((key) => [key, String(data[key]).trim()]));
      const member = { ...clean, id: this.generateMemberId(members), registeredAt };
      return { ok: true, error: '', member, members: [...members, member] };
    },
    updateMember(data, members, id) {
      const existing = members.find((member) => member.id === id);
      if (!existing) return { ok: false, error: 'Member was not found.', member: null, members };
      const error = this.validateMember(data, members, id);
      if (error) return { ok: false, error, member: null, members };
      const clean = Object.fromEntries(['name', 'age', 'gender', 'phone', 'email', 'plan'].map((key) => [key, String(data[key]).trim()]));
      const member = { ...clean, id: existing.id, registeredAt: existing.registeredAt };
      return { ok: true, error: '', member, members: members.map((item) => item.id === id ? member : item) };
    },
    searchMembers(members, query) {
      const normalizedQuery = String(query ?? '').trim().toLocaleLowerCase();
      const phoneQuery = normalizedQuery.replace(/\D/g, '');
      return members.filter((member) => {
        const name = String(member.name ?? '').toLocaleLowerCase();
        const email = String(member.email ?? '').toLocaleLowerCase();
        const phoneDigits = String(member.phone ?? '').replace(/\D/g, '');
        return !normalizedQuery || name.includes(normalizedQuery) || email.includes(normalizedQuery) || Boolean(phoneQuery && phoneDigits.includes(phoneQuery));
      });
    },
    deleteMember(members, id) {
      const nextMembers = members.filter((member) => member.id !== id);
      return { removed: nextMembers.length !== members.length, members: nextMembers };
    }
  };
  window.ForgeGymCore = GymCore;

  const $ = (selector) => document.querySelector(selector);
  const form = $('#member-form');
  const search = $('#member-search');
  const dialog = $('#confirm-dialog');
  let members = readMembers();
  let pendingDeleteId = null;

  // Read stored records safely; malformed or unavailable storage should not crash the app.
  function readMembers() {
    return GymCore.readMembers(localStorage);
  }

  // Save the full member list so it remains available after refresh in this browser.
  function saveMembers() {
    const result = GymCore.saveMembers(localStorage, members);
    if (!result.ok) showMessage(`This browser could not save the record: ${result.error}`);
    return result.ok;
  }

  // Generate a readable ID and check against existing data to guarantee uniqueness.
  function generateMemberId() {
    return GymCore.generateMemberId(members);
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function currency(value) {
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }

  function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function todayLocal() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }

  function fillPlans() {
    $('#plan').insertAdjacentHTML('beforeend', PLANS.map((plan) => `<option value="${plan.name}">${plan.name} · ${currency(plan.price)} / ${plan.duration}</option>`).join(''));
    $('#plan-cards').innerHTML = PLANS.map((plan) => `<article class="plan-card ${plan.featured ? 'featured' : ''}">${plan.featured ? '<span class="recommended">POPULAR</span>' : ''}<div class="plan-name">${plan.name.toUpperCase()} MEMBERSHIP</div><div class="plan-price">${currency(plan.price)}</div><div class="plan-term">per ${plan.duration}</div><div class="plan-detail">${plan.detail}</div></article>`).join('');
  }

  function renderDashboard() {
    $('#total-members').textContent = members.length;
    const counts = Object.fromEntries(PLANS.map((plan) => [plan.name, members.filter((member) => member.plan === plan.name).length]));
    $('#monthly-count').textContent = counts.Monthly;
    $('#quarterly-count').textContent = counts.Quarterly;
    $('#yearly-count').textContent = counts.Yearly;
    const recent = [...members].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 5);
    $('#recent-members').innerHTML = recent.length ? memberTable(recent, false) : `<div class="empty-state"><div class="empty-icon">♙</div><h3>Your member list starts here</h3><p>Register your first member to see them on this dashboard.</p><button class="button button-dark" type="button" data-go="register">Register first member</button></div>`;
  }

  function memberTable(rows, actions) {
    return `<div class="table-wrap"><table><thead><tr><th>MEMBER</th><th>AGE / GENDER</th><th>PHONE</th><th>EMAIL</th><th>PLAN</th><th>JOINED</th>${actions ? '<th>ACTIONS</th>' : ''}</tr></thead><tbody>${rows.map((member) => `<tr><td><div class="member-cell"><span class="avatar">${escapeHTML(member.name.trim().charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.id)}</small></div></div></td><td>${escapeHTML(member.age)} · ${escapeHTML(member.gender)}</td><td>${escapeHTML(member.phone)}</td><td>${escapeHTML(member.email)}</td><td><span class="badge">${escapeHTML(member.plan)}</span></td><td>${escapeHTML(formatDate(member.registeredAt))}</td>${actions ? `<td><div class="row-actions"><button class="icon-button" type="button" data-edit="${escapeHTML(member.id)}" aria-label="Edit ${escapeHTML(member.name)}">Edit</button><button class="icon-button delete" type="button" data-delete="${escapeHTML(member.id)}" aria-label="Delete ${escapeHTML(member.name)}">Delete</button></div></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderDirectory() {
    const matching = GymCore.searchMembers(members, search.value);
    $('#directory-count').textContent = `${members.length} ${members.length === 1 ? 'member' : 'members'}`;
    $('#members-table').innerHTML = matching.length ? memberTable(matching, true) : '<div class="no-results">No members found.</div>';
  }

  function render() {
    renderDashboard();
    renderDirectory();
  }

  function showMessage(message, success = false) {
    const box = $('#form-message');
    box.textContent = message;
    box.classList.toggle('success', success);
    box.hidden = false;
  }

  function clearMessage() {
    const box = $('#form-message');
    box.hidden = true;
    box.textContent = '';
    box.classList.remove('success');
  }

  function validateMember(data, editingId) {
    return GymCore.validateMember(data, members, editingId);
  }

  function resetForm() {
    form.reset();
    $('#edit-id').value = '';
    $('#form-title').textContent = 'Register a member';
    $('#form-eyebrow').textContent = 'NEW MEMBER';
    $('#submit-button').innerHTML = 'Save member <span>→</span>';
    $('#cancel-edit').hidden = true;
    clearMessage();
  }

  function startEdit(id) {
    const member = members.find((item) => item.id === id);
    if (!member) return;
    $('#edit-id').value = member.id;
    $('#name').value = member.name;
    $('#age').value = member.age;
    $('#gender').value = member.gender;
    $('#phone').value = member.phone;
    $('#email').value = member.email;
    $('#plan').value = member.plan;
    $('#form-title').textContent = 'Edit member details';
    $('#form-eyebrow').textContent = `EDITING ${member.id}`;
    $('#submit-button').innerHTML = 'Save changes <span>→</span>';
    $('#cancel-edit').hidden = false;
    clearMessage();
    navigate('register');
    $('#name').focus();
  }

  // Switch views without a page reload, including when a navigation link is used.
  function navigate(page) {
    const validPage = ['dashboard', 'members', 'register', 'test-suite'].includes(page) ? page : 'dashboard';
    document.querySelectorAll('.page').forEach((section) => section.classList.toggle('active', section.id === `${validPage}-page`));
    document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.page === validPage));
    $('#page-title').textContent = validPage === 'register' ? ($('#edit-id').value ? 'Edit member' : 'Register member') : validPage === 'members' ? 'Members' : validPage === 'test-suite' ? 'Test Suite Runner' : 'Dashboard';
    if (location.hash !== `#${validPage}`) history.replaceState(null, '', `#${validPage}`);
    if (validPage === 'members') renderDirectory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearMessage();
    const editingId = $('#edit-id').value;
    const data = {
      name: $('#name').value.trim(), age: $('#age').value.trim(), gender: $('#gender').value,
      phone: $('#phone').value.trim(), email: $('#email').value.trim(), plan: $('#plan').value
    };
    const result = editingId
      ? GymCore.updateMember(data, members, editingId)
      : GymCore.registerMember(data, members, todayLocal());
    if (!result.ok) { showMessage(result.error); return; }
    const record = result.member;
    const existing = editingId ? members.find((member) => member.id === editingId) : null;
    const previousMembers = members;
    members = result.members;
    if (!saveMembers()) { members = previousMembers; return; }
    render();
    resetForm();
    showDirectoryMessage(existing ? 'Member details updated successfully.' : `Member registered successfully. Member ID: ${record.id}`);
    navigate('members');
  });

  function showDirectoryMessage(message) {
    const box = $('#directory-message');
    box.textContent = message;
    box.hidden = false;
  }

  search.addEventListener('input', renderDirectory);
  $('#cancel-edit').addEventListener('click', () => { resetForm(); navigate('members'); });
  $('#members-table').addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit]');
    const deleteButton = event.target.closest('[data-delete]');
    if (editButton) startEdit(editButton.dataset.edit);
    if (deleteButton) {
      pendingDeleteId = deleteButton.dataset.delete;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (window.confirm('Delete this member? This action cannot be undone.')) deleteMember();
    }
  });

  function deleteMember() {
    if (!pendingDeleteId) return;
    const previousMembers = members;
    const result = GymCore.deleteMember(members, pendingDeleteId);
    members = result.members;
    if (saveMembers()) render();
    else members = previousMembers;
    pendingDeleteId = null;
  }

  $('#confirm-delete').addEventListener('click', (event) => {
    event.preventDefault();
    deleteMember();
    dialog.close();
  });
  dialog.addEventListener('close', () => { pendingDeleteId = null; });

  document.addEventListener('click', (event) => {
    const goButton = event.target.closest('[data-go]');
    const navLink = event.target.closest('[data-page]');
    if (goButton) { resetForm(); navigate(goButton.dataset.go); }
    if (navLink) { event.preventDefault(); resetForm(); navigate(navLink.dataset.page); }
  });
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));

  fillPlans();
  render();
  navigate(location.hash.slice(1));
})();
