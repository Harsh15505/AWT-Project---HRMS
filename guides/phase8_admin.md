# Phase 8 — Admin Controls

## 🎯 What You'll Build
- **User Management**: view all users, activate/deactivate, change roles
- **Department Management**: create, edit, deactivate departments
- **System Settings**: company name, leave quotas per type
- React **Admin User Management** page
- React **Admin Settings** page

---

## 📚 Theory

### Why Keep Admin Controls Separate?
Admin operations are high-risk — changing a user's role or deactivating an account can lock people out. By isolating them in their own controller/routes/page, you:
- Apply strict `authorizeRoles('Admin')` guards in one place
- Make the codebase easier to audit
- Avoid accidentally exposing admin operations to other roles

### System Settings Pattern
Instead of hardcoding values like leave quotas or company name, store them in a MongoDB collection as key-value pairs. You can then change them without redeploying the app.

```json
{ key: "casual_leave_quota", value: 12 }
{ key: "company_name",       value: "HRMS Corp" }
```

---

## 🗂️ Files

```
backend/
├── models/SystemSetting.js
├── controllers/adminController.js
├── routes/adminRoutes.js

frontend/src/
├── pages/
│   ├── UserManagement.jsx
│   └── AdminSettings.jsx
├── services/
│   └── adminService.js
```

---

## 🔧 Implementation

### Step 1 — System Settings Model

📁 `backend/models/SystemSetting.js`
```javascript
const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  label: { type: String }, // Human-readable label
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
```

Seed default settings (run once):
```javascript
// backend/scripts/seedSettings.js
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const SystemSetting = require('../models/SystemSetting');

const defaults = [
  { key: 'company_name',       value: 'HRMS Corporation',      label: 'Company Name' },
  { key: 'casual_leave_quota', value: 12,                       label: 'Casual Leave Quota / Year' },
  { key: 'sick_leave_quota',   value: 10,                       label: 'Sick Leave Quota / Year' },
  { key: 'annual_leave_quota', value: 15,                       label: 'Annual Leave Quota / Year' },
  { key: 'working_days_week',  value: 5,                        label: 'Working Days per Week' },
  { key: 'pf_percentage',      value: 12,                       label: 'PF Deduction %' },
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  for (const s of defaults) {
    await SystemSetting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  console.log('✅ System settings seeded');
  process.exit(0);
});
```

> 📝 **Code Breakdown:**
> - `value: { type: mongoose.Schema.Types.Mixed }` — most Mongoose schemas are strict (a String must be a String). `Mixed` allows us to store numbers (12), strings ("HRMS Corp"), or booleans inside the same `value` column depending on what the specific setting needs
> - `findOneAndUpdate({ key: s.key }, s, { upsert: true })` — the seed script loops through our default settings array and inserts them into the DB. The `upsert` ensures that if we run the script twice, it won't create duplicate "company_name" settings
> - `process.exit(0)` — explicitly shuts down the Node instance after the script finishes. Without this, the Mongoose connection would keep the script hanging forever in the terminal

---

### Step 2 — Validation Rules (Admin)

📁 `backend/middleware/validators.js` (append these lines)
```javascript
const updateUserRoleRules = [
  body('role').isIn(['Admin', 'HR Officer', 'Payroll Officer', 'Employee']).withMessage('Invalid role'),
];

const resetPasswordRules = [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const updateSettingsRules = [
  body('settings').isObject().withMessage('Settings must be an object'),
];

// module.exports = { ..., updateUserRoleRules, resetPasswordRules, updateSettingsRules };
```

---

### Step 3 — Admin Controller

📁 `backend/controllers/adminController.js`
```javascript
const User          = require('../models/User');
const Employee      = require('../models/Employee');
const SystemSetting = require('../models/SystemSetting');
const { asyncHandler } = require('../middleware/errorMiddleware');

// ─── User Management ──────────────────────────────────────────

// GET /api/admin/users
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, users });
});

// PUT /api/admin/users/:id/role
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  // Prevent admin from changing their own role (safety)
  if (req.params.id === req.user.userId) {
    res.status(400);
    throw new Error('Cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({ success: true, user });
});

// PUT /api/admin/users/:id/toggle-status
const toggleUserStatus = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.userId) {
    res.status(400);
    throw new Error('Cannot deactivate yourself');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.isActive = !user.isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    user,
  });
});

// PUT /api/admin/users/:id/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.password = newPassword; // Pre-save hook will hash it
  await user.save();

  res.json({ success: true, message: 'Password reset successfully' });
});

// ─── System Settings ──────────────────────────────────────────

// GET /api/admin/settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSetting.find();
  // Convert array to object for easier frontend use
  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.key] = { value: s.value, label: s.label }; });
  res.json({ success: true, settings: settingsMap, raw: settings });
});

// PUT /api/admin/settings
const updateSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body; // { key: value, key: value, ... }

  const updates = Object.entries(settings).map(([key, value]) =>
    SystemSetting.findOneAndUpdate({ key }, { value }, { new: true })
  );
  await Promise.all(updates);

  res.json({ success: true, message: 'Settings updated successfully' });
});

module.exports = { getAllUsers, updateUserRole, toggleUserStatus, resetPassword, getSettings, updateSettings };
```

> 📝 **Code Breakdown:**
> - `if (req.params.id === req.user.userId)` — a critical safety check. An admin cannot downgrade their own role or deactivate their own account. If they did, they'd be permanently locked out with no one else who has the power to fix it
> - `user.password = newPassword; await user.save();` — we don't need to import `bcrypt` here manually. Because we are using `.save()`, the `pre('save')` hook we wrote back in Phase 2 on the User model will automatically intercept this and hash the password before it reaches the DB
> - `settings.forEach(s => { settingsMap[s.key] = ... })` — the database stores settings as an array of documents `[ {key: 'pf', value: 12} ]`. This loop transforms it into a Javascript Object `{ pf: { value: 12 } }`. This makes it infinitely easier for the frontend to read specific values without having to write `.find()` loops in React
> - `Object.entries(settings).map(...)` — when the frontend sends back the updated object, we turn the keys and values back into array elements and fire off a batch of Mongoose update promises concurrently

---

### Step 4 — Admin Routes

📁 `backend/routes/adminRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const {
  getAllUsers, updateUserRole, toggleUserStatus,
  resetPassword, getSettings, updateSettings,
} = require('../controllers/adminController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { updateUserRoleRules, resetPasswordRules, updateSettingsRules, validate } = require('../middleware/validators');

// All admin routes require Admin role
router.use(protect, authorizeRoles('Admin'));

router.get('/users',                      getAllUsers);
router.put('/users/:id/role',             updateUserRoleRules, validate, updateUserRole);
router.put('/users/:id/toggle-status',    toggleUserStatus);
router.put('/users/:id/reset-password',   resetPasswordRules, validate, resetPassword);
router.get('/settings',                   getSettings);
router.put('/settings',                   updateSettingsRules, validate, updateSettings);

module.exports = router;
```

Add to `app.js`:
```javascript
app.use('/api/admin', require('./routes/adminRoutes'));
```

---

### Step 5 — Admin Service

📁 `frontend/src/services/adminService.js`
```javascript
import API from './api';
export const getAllUsers       = ()       => API.get('/admin/users');
export const updateUserRole   = (id, r)  => API.put(`/admin/users/${id}/role`, { role: r });
export const toggleUserStatus = (id)     => API.put(`/admin/users/${id}/toggle-status`);
export const resetPassword    = (id, p)  => API.put(`/admin/users/${id}/reset-password`, { newPassword: p });
export const getSettings      = ()       => API.get('/admin/settings');
export const updateSettings   = (data)   => API.put('/admin/settings', { settings: data });
```

---

### Step 6 — User Management Page

📁 `frontend/src/pages/UserManagement.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getAllUsers, updateUserRole, toggleUserStatus, resetPassword } from '../services/adminService';

const ROLES = ['Admin','HR Officer','Payroll Officer','Employee'];

const UserManagement = () => {
  const [users, setUsers]     = useState([]);
  const [newPass, setNewPass] = useState({});
  const [msg, setMsg]         = useState('');

  const load = () => getAllUsers().then(({ data }) => setUsers(data.users));
  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleRole = async (id, role) => {
    try { await updateUserRole(id, role); load(); flash('✅ Role updated'); }
    catch (e) { flash('❌ ' + e.response?.data?.message); }
  };

  const handleToggle = async (id) => {
    try { await toggleUserStatus(id); load(); flash('✅ Status toggled'); }
    catch (e) { flash('❌ ' + e.response?.data?.message); }
  };

  const handleReset = async (id) => {
    const pwd = newPass[id];
    if (!pwd || pwd.length < 6) return flash('❌ Password must be 6+ characters');
    try { await resetPassword(id, pwd); setNewPass({ ...newPass, [id]: '' }); flash('✅ Password reset'); }
    catch (e) { flash('❌ ' + e.response?.data?.message); }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>User Management</h1>
      {msg && <p style={{ color: msg.startsWith('✅') ? 'green' : 'red', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {users.map((u) => (
          <div key={u._id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '180px' }}>
              <div style={{ fontWeight: 700 }}>{u.name}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{u.email}</div>
            </div>

            {/* Role Selector */}
            <select value={u.role} onChange={(e) => handleRole(u._id, e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Active / Inactive Badge */}
            <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
              background: u.isActive ? '#dcfce7' : '#fee2e2',
              color: u.isActive ? '#166534' : '#991b1b' }}>
              {u.isActive ? 'Active' : 'Inactive'}
            </span>

            {/* Toggle Status */}
            <button onClick={() => handleToggle(u._id)}
              style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', background: '#f8fafc' }}>
              {u.isActive ? '🔒 Deactivate' : '🔓 Activate'}
            </button>

            {/* Reset Password */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="password" placeholder="New password"
                value={newPass[u._id] || ''}
                onChange={(e) => setNewPass({ ...newPass, [u._id]: e.target.value })}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #ddd', width: '130px' }} />
              <button onClick={() => handleReset(u._id)}
                style={{ padding: '0.45rem 1rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserManagement;
```

> 📝 **Code Breakdown:**
> - `const [newPass, setNewPass] = useState({})` — since there are multiple users on the screen, if we only had one `password` state string, typing in user A's box would also type in user B's box. We use an object initialized to `{}` to isolate the text inputs using the varying user IDs as keys `[u._id]`
> - `const flash = (m) => ...` — a lightweight helper function that sets the success/error message and automatically wipes it away after 3 seconds using `setTimeout`, creating a clean UX
> - `<select value={u.role}>` — we embed the `<select>` directly into the table row. Changing the dropdown instantly triggers the `handleRole` function and API call, which is a much faster UX for admins than clicking "Edit User", going to a dedicated form, and clicking "Save"

---

### Step 7 — Admin Settings Page

📁 `frontend/src/pages/AdminSettings.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../services/adminService';

const AdminSettings = () => {
  const [settings, setSettings] = useState({});
  const [values,   setValues]   = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getSettings().then(({ data }) => {
      setSettings(data.settings);
      const initial = {};
      Object.entries(data.settings).forEach(([k, v]) => { initial[k] = v.value; });
      setValues(initial);
    });
  }, []);

  const handleChange = (key, val) => setValues({ ...values, [key]: val });

  const handleSave = async () => {
    try {
      await updateSettings(values);
      setMsg('✅ Settings saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed'));
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>System Settings ⚙️</h1>
      {msg && <p style={{ color: msg.startsWith('✅') ? 'green' : 'red', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {Object.entries(settings).map(([key, { label }]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</label>
            <input
              type={typeof values[key] === 'number' ? 'number' : 'text'}
              value={values[key] ?? ''}
              onChange={(e) => handleChange(key, typeof values[key] === 'number' ? Number(e.target.value) : e.target.value)}
              style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
            />
          </div>
        ))}

        <button onClick={handleSave}
          style={{ padding: '0.85rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
```

> 📝 **Code Breakdown:**
> - `Object.entries(data.settings).forEach(...)` — when the component loads, we take the complex nested object from the backend `{ pf: { value: 12, label: 'PF' } }` and flatten it into a simple `{ pf: 12 }` state called `values` that is easier to bind our HTML inputs to
> - `type={typeof values[key] === 'number' ? 'number' : 'text'}` — because our settings can be mixed types, the React input dynamically decides whether to be a Number field or a Text field based on the JS type of the existing database value
> - `Number(e.target.value) : e.target.value` — HTML Number inputs technically return strings (e.g., `"12"`). If we don't cast it back to `Number(...)` before saving to state, we might inadvertently overwrite the DB's integer `12` with a string `"12"`, which could break payroll math later

---

## ⚠️ Edge Cases & Gotchas

### 1. Prevent Admin from deactivating themselves
Always check: `if (req.params.id === req.user.userId)` before toggling status or changing role. An admin who locks themselves out would need direct DB access to fix it.

### 2. Password reset re-uses the pre-save hook
Because the `pre('save')` hook on the User model hashes the password automatically, we just assign the plain text password and call `.save()` — no manual bcrypt call needed.

### 3. `mongoose.Schema.Types.Mixed` for settings values
The `Mixed` type allows any value (string, number, boolean, array). This is intentional for settings — but it means Mongoose won't auto-cast types. Always validate on the frontend before saving.

### 4. Settings as a map vs array
The controller converts the settings array to a key-value map for the frontend:
```javascript
// Array (DB)          → Map (response)
[{ key: 'pf', value: 12 }] → { pf: { value: 12, label: '...' } }
```
This makes reading settings easier: `settings.pf_percentage.value` vs searching an array.

---

## ✅ Phase 8 Checklist
- [ ] `models/SystemSetting.js` created
- [ ] Default settings seeded (`node scripts/seedSettings.js`)
- [ ] `controllers/adminController.js` — user + settings management
- [ ] `routes/adminRoutes.js` with Admin-only guard
- [ ] Routes registered in `app.js`
- [ ] `services/adminService.js` created
- [ ] `pages/UserManagement.jsx` — role, status, password reset
- [ ] `pages/AdminSettings.jsx` — editable system settings
- [ ] Both pages added to `App.jsx` under Admin-protected routes

---

## 🔗 What's Next?
**Phase 9** — Security polish, input validation, error handling, and end-to-end testing.
