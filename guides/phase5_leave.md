# Phase 5 — Leave Management

## 🎯 What You'll Build in This Phase
- **Leave** schema: applications, types, and approval status
- **Leave Balance** tracking per employee
- API for employees to **apply for leave**
- API for HR/Admin to **approve or reject** leaves
- React **Leave Application** form for employees
- React **Leave Management Panel** for HR
- React **Leave Balance** display

---

## 📚 Theory

### Types of Leave
| Leave Type | Meaning |
|---|---|
| **Casual Leave (CL)** | Short-term personal matters (usually 12/year) |
| **Sick Leave (SL)** | Medical/health reasons |
| **Annual Leave / Earned Leave** | Accumulated over time based on working days |
| **Loss of Pay (LOP)** | Employee has exhausted balance — deducted from salary |

### Leave Workflow (State Machine)
A leave application goes through the following states:

```
Employee applies
      ↓
  [Pending]
      ↓
HR reviews
  ↙       ↘
[Approved]  [Rejected]
```

Once a leave is **Approved**, it reduces the employee's leave balance. If **Rejected**, the balance is unchanged.

### Optimistic vs. Pessimistic Balance Locking
- **Pessimistic**: Deduct balance the moment an employee applies (block the days immediately). If rejected, restore the balance. 
- **Optimistic**: Only deduct when approved.

For this HRMS we use the **optimistic approach** — balance is only deducted upon approval.

### Calculating Business Days Between Dates
Weekends should typically not count toward leave days unless the company policy says otherwise. For simplicity in this guide, we'll count all calendar days. You can add weekend exclusion in Phase 9 (Polish).

---

## 🗂️ Files You'll Create

```
backend/
├── models/
│   ├── Leave.js
│   └── LeaveBalance.js
├── controllers/
│   └── leaveController.js
├── routes/
│   └── leaveRoutes.js

frontend/src/
├── pages/
│   ├── ApplyLeave.jsx
│   ├── MyLeaves.jsx
│   └── LeaveManagement.jsx   ← HR Panel
├── services/
│   └── leaveService.js
```

---

## 🔧 Step-by-Step Implementation

### Step 1 — Leave Balance Model

📁 `backend/models/LeaveBalance.js`
```javascript
const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    casual:  { allocated: { type: Number, default: 12 }, used: { type: Number, default: 0 } },
    sick:    { allocated: { type: Number, default: 10 }, used: { type: Number, default: 0 } },
    annual:  { allocated: { type: Number, default: 15 }, used: { type: Number, default: 0 } },
  },
  { timestamps: true }
);

// Compound unique: one balance record per employee per year
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });

// Virtual: remaining for each type
leaveBalanceSchema.virtual('remaining').get(function () {
  return {
    casual: this.casual.allocated - this.casual.used,
    sick:   this.sick.allocated   - this.sick.used,
    annual: this.annual.allocated - this.annual.used,
  };
});

leaveBalanceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
```

> 📝 **Code Breakdown:**
> - `casual: { allocated: { type: Number, default: 12 }, used: { type: Number, default: 0 } }` — groups the default allocation and the current usage for a specific leave type under one object
> - `leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true })` — guarantees that an employee can only have one balance sheet per year. Attempting to create a second one for 2025 will throw an error
> - `leaveBalanceSchema.virtual('remaining')` — calculates the remaining balance dynamically (allocated minus used) for all three leave types. It does this in memory without saving the result to the DB
> - `leaveBalanceSchema.set('toJSON', { virtuals: true })` — essential for making virtuals visible when the API sends the document to the frontend via `res.json()`

---

### Step 2 — Leave Application Model

📁 `backend/models/Leave.js`
```javascript
const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['Casual', 'Sick', 'Annual', 'LOP'],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate:   { type: Date, required: true },
    numberOfDays: { type: Number, required: true, min: 0.5 },
    reason:   { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approverRemarks: { type: String, trim: true },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for fast lookups
leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
```

> 📝 **Code Breakdown:**
> - `enum: ['Casual', 'Sick', 'Annual', 'LOP']` — LOP (Loss of Pay) is included as a type even though it doesn't draw from a balance, because HR still needs a record of why the employee was absent
> - `numberOfDays: { type: Number, required: true, min: 0.5 }` — explicitly calculates and stores the duration. The `min: 0.5` allows for half-day leave applications
> - `approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }` — tracks accountability (which specific HR manager clicked "Approve")
> - `approverRemarks` — allows HR to leave a comment (e.g., "Approved, but please finish project X first")
> - `leaveSchema.index({ employee: 1, status: 1 })` — optimizes queries like "Get all Pending leaves for Alice"

---

### Step 3 — Validation Rules (Leave)

📁 `backend/middleware/validators.js` (append these lines)
```javascript
const leaveRules = [
  body('leaveType').isIn(['Casual', 'Sick', 'Annual', 'LOP']).withMessage('Invalid leave type'),
  body('fromDate').isISO8601().withMessage('Valid start date is required'),
  body('toDate').isISO8601().withMessage('Valid end date is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
];

// module.exports = { ..., leaveRules };
```

---

### Step 4 — Leave Controller

📁 `backend/controllers/leaveController.js`
```javascript
const Leave        = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Employee     = require('../models/Employee');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Calculate number of days between two dates (inclusive)
const calcDays = (from, to) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(to) - new Date(from)) / msPerDay) + 1;
};

// Get or create leave balance for an employee for a given year
const getOrCreateBalance = async (employeeId, year) => {
  let balance = await LeaveBalance.findOne({ employee: employeeId, year });
  if (!balance) {
    balance = await LeaveBalance.create({ employee: employeeId, year });
  }
  return balance;
};

// ─── Apply for Leave ───────────────────────────────────────────
// @route POST /api/leaves
// @access Employee, HR Officer, Admin
const applyLeave = asyncHandler(async (req, res) => {
  const { leaveType, fromDate, toDate, reason } = req.body;

  // Get the employee profile from the logged-in user
  const employee = await Employee.findOne({ user: req.user.userId });
  if (!employee) {
    res.status(404);
    throw new Error('Employee profile not found');
  }

  const from = new Date(fromDate);
  const to   = new Date(toDate);

  if (from > to) {
    res.status(400);
    throw new Error('From date cannot be after To date');
  }

  if (from < new Date(new Date().setHours(0,0,0,0))) {
    res.status(400);
    throw new Error('Cannot apply for past dates');
  }

  const numberOfDays = calcDays(from, to);

  // Check for overlapping leave applications
  const overlapping = await Leave.findOne({
    employee: employee._id,
    status: { $in: ['Pending', 'Approved'] },
    $or: [
      { fromDate: { $lte: to   }, toDate: { $gte: from } },
    ],
  });
  if (overlapping) {
    res.status(400);
    throw new Error(`You already have a ${overlapping.status} leave that overlaps with these dates`);
  }

  // Check leave balance (only for non-LOP types)
  if (leaveType !== 'LOP') {
    const year    = from.getFullYear();
    const balance = await getOrCreateBalance(employee._id, year);
    const typeKey = leaveType.toLowerCase(); // 'casual', 'sick', 'annual'
    const available = balance[typeKey].allocated - balance[typeKey].used;

    if (available < numberOfDays) {
      res.status(400);
      throw new Error(`Insufficient ${leaveType} leave balance. Available: ${available} days, Requested: ${numberOfDays} days`);
    }
  }

  const leave = await Leave.create({
    employee: employee._id,
    leaveType, fromDate: from, toDate: to,
    numberOfDays, reason,
  });

  res.status(201).json({ success: true, leave });
});

// ─── Approve / Reject Leave ────────────────────────────────────
// @route PUT /api/leaves/:id/status
// @access HR Officer, Admin
const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, approverRemarks } = req.body;

  if (!['Approved', 'Rejected'].includes(status)) {
    res.status(400);
    throw new Error('Status must be Approved or Rejected');
  }

  const leave = await Leave.findById(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave request not found');
  }

  if (leave.status !== 'Pending') {
    res.status(400);
    throw new Error(`Leave has already been ${leave.status}. Cannot update.`);
  }

  // If approving: deduct balance
  if (status === 'Approved' && leave.leaveType !== 'LOP') {
    const year    = leave.fromDate.getFullYear();
    const balance = await getOrCreateBalance(leave.employee, year);
    const typeKey = leave.leaveType.toLowerCase();

    await LeaveBalance.findOneAndUpdate(
      { employee: leave.employee, year },
      { $inc: { [`${typeKey}.used`]: leave.numberOfDays } }
    );
  }

  leave.status         = status;
  leave.approvedBy     = req.user.userId;
  leave.approverRemarks = approverRemarks || '';
  leave.approvedAt     = new Date();
  await leave.save();

  // If approved, update attendance records for those days to "On-Leave"
  // (We'll wire this up in the payroll phase, kept simple here)

  res.json({ success: true, leave });
});

// ─── Get My Leaves ─────────────────────────────────────────────
// @route GET /api/leaves/my
// @access Employee
const getMyLeaves = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user.userId });
  if (!employee) {
    res.status(404);
    throw new Error('Profile not found');
  }

  const leaves = await Leave.find({ employee: employee._id }).sort({ createdAt: -1 });
  res.json({ success: true, leaves });
});

// ─── Get All Leaves (HR) ───────────────────────────────────────
// @route GET /api/leaves
// @access HR Officer, Admin
const getAllLeaves = asyncHandler(async (req, res) => {
  const { status, employeeId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (employeeId) filter.employee = employeeId;

  const leaves = await Leave.find(filter)
    .populate('employee', 'firstName lastName employeeId department')
    .populate('approvedBy', 'name')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: leaves.length, leaves });
});

// ─── Get Leave Balance ─────────────────────────────────────────
// @route GET /api/leaves/balance/:employeeId?year=2025
// @access All (employees see own only)
const getLeaveBalance = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const year = Number(req.query.year) || new Date().getFullYear();

  const balance = await getOrCreateBalance(employeeId, year);
  res.json({ success: true, balance });
});

// ─── Cancel Leave (by Employee) ───────────────────────────────
// @route PUT /api/leaves/:id/cancel
// @access Employee
const cancelLeave = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user.userId });
  const leave    = await Leave.findById(req.params.id);

  if (!leave) {
    res.status(404);
    throw new Error('Leave not found');
  }
  if (leave.employee.toString() !== employee._id.toString()) {
    res.status(403);
    throw new Error('Not your leave application');
  }
  if (leave.status !== 'Pending') {
    res.status(400);
    throw new Error('Only Pending leaves can be cancelled');
  }

  leave.status = 'Cancelled';
  await leave.save();
  res.json({ success: true, message: 'Leave cancelled' });
});

module.exports = { applyLeave, updateLeaveStatus, getMyLeaves, getAllLeaves, getLeaveBalance, cancelLeave };
```

> 📝 **Code Breakdown:**
> - `const calcDays = (from, to) => ...` — a helper function that subtracts the start date from the end date. Dividing by `msPerDay` converts the resulting milliseconds into whole days. `+ 1` makes it inclusive (e.g., Monday to Monday is 1 day, not 0)
> - `const getOrCreateBalance = async ...` — a utility function. If it's January 1st and the employee doesn't have a 2025 balance record yet, this creates it on the fly with the default allocations
> - `$or: [{ fromDate: { $lte: to }, toDate: { $gte: from } }]` — the classic overlap formula. If Request A starts before Request B ends, AND Request A ends after Request B starts, they overlap. This prevents double-booking leaves
> - `if (available < numberOfDays)` — enforces business logic. If you only have 2 Casual leaves left, you can't apply for 3
> - `$inc: { [\`${typeKey}.used\`]: leave.numberOfDays }` — the most important line in `updateLeaveStatus`. It tells MongoDB to increment the `used` counter by the number of days taken. It happens atomically during approval
> - `employee.user.toString() !== req.user.userId` — security check in `cancelLeave` to ensure users can't cancel each other's leaves by guessing IDs

---

### Step 5 — Leave Routes

📁 `backend/routes/leaveRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const {
  applyLeave, updateLeaveStatus, getMyLeaves,
  getAllLeaves, getLeaveBalance, cancelLeave,
} = require('../controllers/leaveController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { leaveRules, validate } = require('../middleware/validators');

router.use(protect);

router.get('/my',                    getMyLeaves);
router.post('/',                     leaveRules, validate, applyLeave);
router.put('/:id/cancel',            cancelLeave);
router.put('/:id/status',            authorizeRoles('Admin', 'HR Officer'), updateLeaveStatus);
router.get('/',                      authorizeRoles('Admin', 'HR Officer'), getAllLeaves);
router.get('/balance/:employeeId',   getLeaveBalance);

module.exports = router;
```

Register in `app.js`:
```javascript
const leaveRoutes = require('./routes/leaveRoutes');
app.use('/api/leaves', leaveRoutes);
```

---

### Step 6 — Frontend Leave Service

📁 `frontend/src/services/leaveService.js`
```javascript
import API from './api';

export const applyLeave       = (data)       => API.post('/leaves', data);
export const getMyLeaves      = ()           => API.get('/leaves/my');
export const getAllLeaves      = (params)    => API.get('/leaves', { params });
export const updateLeaveStatus = (id, data) => API.put(`/leaves/${id}/status`, data);
export const cancelLeave      = (id)        => API.put(`/leaves/${id}/cancel`);
export const getLeaveBalance  = (id, year)  => API.get(`/leaves/balance/${id}`, { params: { year } });
```

---

### Step 7 — Apply Leave Page (Employee)

📁 `frontend/src/pages/ApplyLeave.jsx`
```jsx
import React, { useState } from 'react';
import { applyLeave } from '../services/leaveService';
import { useNavigate } from 'react-router-dom';

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual', 'LOP'];

const ApplyLeave = () => {
  const [form, setForm] = useState({
    leaveType: 'Casual', fromDate: '', toDate: '', reason: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Calculate days for display
  const days = form.fromDate && form.toDate
    ? Math.round((new Date(form.toDate) - new Date(form.fromDate)) / 86400000) + 1
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (days < 1) return setError('To date must be on or after From date');
    setLoading(true);
    try {
      await applyLeave(form);
      setSuccess('✅ Leave application submitted successfully!');
      setTimeout(() => navigate('/employee/leaves'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply for leave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '560px' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Apply for Leave</h1>

      {error   && <div style={{ color: 'red',   marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: '1rem' }}>{success}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Leave Type</label>
          <select name="leaveType" value={form.leaveType} onChange={handleChange} style={inputStyle}>
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>From Date</label>
            <input type="date" name="fromDate" value={form.fromDate} onChange={handleChange} style={inputStyle} required />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>To Date</label>
            <input type="date" name="toDate" value={form.toDate} onChange={handleChange} style={inputStyle} required />
          </div>
        </div>

        {days > 0 && (
          <div style={{ background: '#f0f4ff', padding: '0.75rem 1rem', borderRadius: '8px', color: '#667eea', fontWeight: 600 }}>
            📅 Duration: {days} day{days > 1 ? 's' : ''}
          </div>
        )}

        <div>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Reason</label>
          <textarea name="reason" value={form.reason} onChange={handleChange}
            rows={3} style={{ ...inputStyle, resize: 'vertical' }} required />
        </div>

        <button type="submit" disabled={loading}
          style={{ padding: '0.85rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

const inputStyle = {
  width: '100%', padding: '0.7rem 1rem', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '1rem', marginTop: '0.4rem',
};

export default ApplyLeave;
```

> 📝 **Code Breakdown:**
> - `const days = form.fromDate && form.toDate ? ... : 0` — this runs on every render. As soon as the user selects both dates, it instantly calculates the duration and displays it in the blue preview box below the inputs
> - `if (days < 1) return setError(...)` — frontend validation to prevent submitting illogical dates (like ending a leave before it starts)
> - `setTimeout(() => navigate('/employee/leaves'), 1500)` — a UX touch. Instead of instantly bouncing the user away immediately upon success, we pause for 1.5 seconds so they can actually read the "✅ submitted successfully" message, then route them to their leave history

---

### Step 8 — HR Leave Management Panel

📁 `frontend/src/pages/LeaveManagement.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getAllLeaves, updateLeaveStatus } from '../services/leaveService';

const STATUS_COLOR = {
  Pending: '#f59e0b', Approved: '#22c55e', Rejected: '#ef4444', Cancelled: '#94a3b8',
};

const LeaveManagement = () => {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [remarks, setRemarks] = useState({});

  const load = async (status) => {
    const { data } = await getAllLeaves({ status });
    setLeaves(data.leaves);
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleAction = async (id, status) => {
    try {
      await updateLeaveStatus(id, { status, approverRemarks: remarks[id] || '' });
      load(filter);
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Leave Management</h1>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['Pending','Approved','Rejected','Cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: filter === s ? STATUS_COLOR[s] : '#f1f5f9',
              color: filter === s ? '#fff' : '#64748b', fontWeight: 600 }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {leaves.length === 0 && <p style={{ color: '#888' }}>No {filter.toLowerCase()} leaves.</p>}

        {leaves.map((leave) => (
          <div key={leave._id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>{leave.employee?.firstName} {leave.employee?.lastName}
                  <span style={{ color: '#888', fontWeight: 400, fontSize: '0.9rem' }}> — {leave.employee?.employeeId}</span>
                </h3>
                <p style={{ margin: '0.4rem 0', color: '#555' }}>
                  <strong>{leave.leaveType}</strong> · {leave.numberOfDays} day(s) ·{' '}
                  {new Date(leave.fromDate).toLocaleDateString()} → {new Date(leave.toDate).toLocaleDateString()}
                </p>
                <p style={{ color: '#777', fontSize: '0.9rem' }}>Reason: {leave.reason}</p>
              </div>
              <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', background: STATUS_COLOR[leave.status] + '22', color: STATUS_COLOR[leave.status], fontWeight: 700, fontSize: '0.85rem' }}>
                {leave.status}
              </span>
            </div>

            {leave.status === 'Pending' && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input placeholder="Remarks (optional)"
                  value={remarks[leave._id] || ''}
                  onChange={(e) => setRemarks({ ...remarks, [leave._id]: e.target.value })}
                  style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                <button onClick={() => handleAction(leave._id, 'Approved')}
                  style={{ padding: '0.5rem 1.25rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  Approve
                </button>
                <button onClick={() => handleAction(leave._id, 'Rejected')}
                  style={{ padding: '0.5rem 1.25rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeaveManagement;
```

> 📝 **Code Breakdown:**
> - `{['Pending','Approved',...].map(s => <button ...>)}` — dynamically generates the four filter tabs. Whichever tab matches the `filter` state gets the colored background; the rest get gray
> - `[remarks[leave._id] || '']` — since there are many leave cards on the screen, we can't use a single `remark` string state. We use an object where the keys are the specific Leave IDs, ensuring typing in one card's box doesn't type into another's
> - `await updateLeaveStatus(id, { status, approverRemarks })` — fires the backend PUT request. If the HR clicks "Approve", we send the status `'Approved'` along with any typed remarks
> - `load(filter)` — immediately after a successful action (approve/reject), we re-fetch the data from the server, which naturally causes the processed card to disappear from the "Pending" tab

---

## ⚠️ Edge Cases & Gotchas

### 1. Overlapping Leave Check
Without the overlap check, an employee can apply for two leaves that cover the same date. The `$or` query with date range intersection:
```javascript
{ fromDate: { $lte: to }, toDate: { $gte: from } }
```
This catches any leave that starts before your end AND ends after your start — the definition of overlapping ranges.

### 2. Restore Balance on Rejection?
In our implementation, balance is **only deducted on approval**, so rejection doesn't need to restore anything. If you use a pessimistic approach, you'd need to `$inc: { used: -numberOfDays }` on rejection.

### 3. Don't allow editing approved leaves
Once a leave is Approved, changing the dates would invalidate the balance deduction. Always check `leave.status === 'Pending'` before allowing changes.

### 4. `$inc` operator for atomic updates
Using `$inc` to update leave balance is **atomic** — MongoDB ensures no race condition even if two requests come in simultaneously:
```javascript
// ✅ Atomic — safe
await LeaveBalance.findOneAndUpdate(
  { employee, year },
  { $inc: { 'casual.used': 5 } }
);

// ❌ Not atomic — race condition possible
balance.casual.used += 5;
await balance.save();
```

### 5. LOP (Loss of Pay) doesn't need a balance
LOP is applied when an employee has no balance left. It should still create a Leave record for payroll to deduct salary, but skips the balance check.

### 6. Half-day leave
For half-day leave, set `numberOfDays: 0.5`. The overlap check using full dates may flag a conflict even for half days on the same date. For production, add a `session` field (`Morning`/`Afternoon`) and refine the overlap check.

---

## ✅ Phase 5 Checklist
- [ ] `models/LeaveBalance.js` with virtual remaining
- [ ] `models/Leave.js` created
- [ ] `controllers/leaveController.js` — apply, approve/reject, balance, cancel
- [ ] `routes/leaveRoutes.js` with role guards
- [ ] Routes added to `app.js`
- [ ] Tested full leave cycle in Postman (apply → approve → balance reduced)
- [ ] `services/leaveService.js` created
- [ ] `pages/ApplyLeave.jsx` with duration preview
- [ ] `pages/LeaveManagement.jsx` (HR approve/reject panel)
- [ ] Routes added to `App.jsx`

---

## 🔗 What's Next?
**Phase 6** — Payroll: calculate salaries from attendance and approved leaves, generate payslips, and produce salary reports.
