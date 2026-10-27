# Forge Gym — Local Member Manager

A beginner-friendly Gym Management System built with HTML, CSS, and vanilla JavaScript. Member records are saved in this browser using LocalStorage. This folder is the standalone browser version; it does not require PHP, MySQL, XAMPP, Node.js, or a backend.

## Open in Visual Studio Code

1. Open Visual Studio Code.
2. Choose **File → Open Folder…**.
3. Select this `gym-management-system-html` folder and choose **Open**.
4. To run it, right-click `index.html` in the VS Code file list and select **Open with Live Server**. If you do not see that option, install the **Live Server** extension from the Extensions view, then try again.
5. The app opens in your browser. Its records remain in the same browser after refresh.

You can also open `index.html` directly in a browser, but Live Server is recommended for a consistent local origin and LocalStorage behavior.

## Features

- Dashboard showing total members and counts by plan.
- Registration with generated unique member ID and registration date.
- Required-field, age, phone, email, and duplicate-email validation.
- Member directory with search by name, phone number, or email.
- Edit member details while keeping the original ID and registration date.
- Delete a selected member after confirmation.
- Membership options: Monthly (₹1,000), Quarterly (₹2,500), and Yearly (₹8,000).
- Responsive layout for desktop, tablet, and mobile screens.

## Simple feature check

1. Choose **Register member**, enter a test member, choose a plan, and save.
2. Open **Members** and search for that member by name, phone, and email. Clear the search to show every member.
3. Choose **Edit**, change a detail, and save.
4. Choose **Delete** and confirm to remove that one record. Cancel to keep it.
5. Refresh the browser and confirm the remaining records still appear.
6. Open **Dashboard** to see the total and plan counts update.

## How the app works

- `index.html` defines the page, form, dashboard, directory, and confirmation dialog.
- `style.css` supplies the colors, layout, and responsive styling.
- `script.js` validates form data, generates IDs, updates the dashboard and table, and handles searching, editing, and deleting.
- LocalStorage stores the member list in this browser under the key `forgeGymMembers_v1`. It is local to this browser profile and is not synced to another device.

## Files

```text
gym-management-system-html/
├── index.html
├── style.css
├── script.js
└── README.md
```
