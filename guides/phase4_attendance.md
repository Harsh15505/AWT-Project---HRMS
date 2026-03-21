# Phase 4 — Attendance Tracking

## 🎯 What You'll Build in This Phase
- **Attendance schema** with daily status per employee
- API to **mark attendance** (single and bulk)
- API to **fetch attendance** by employee and date range
- **Monthly summary** (days present, absent, late, etc.) using MongoDB Aggregation
- React **Attendance Calendar** view
- React **HR panel** to mark attendance for all employees

---

## 📚 Theory

### What is MongoDB Aggregation?
The aggregation pipeline is MongoDB's way to **process and transform data** through multiple stages, like an assembly line.

```
Collection → $match (filter) → $group (aggregate) → $project (reshape) → Result
```

Common stages:
| Stage | Purpose |
|---|---|
| `$match` | Filter documents (like WHERE in SQL) |
| `$group` | Group and compute aggregates (like GROUP BY + COUNT/SUM) |
| `$project` | Select/reshape fields |
| `$sort` | Sort results |
| `$lookup` | Join with another collection |

Example: count attendance statuses for an employee in April:
```javascript
Attendance.aggregate([
  { $match: { employee: empId, month: 4, year: 2025 } },
  { $group: { _id: '$status', count: { $sum: 1 } } }
])
// Result: [{ _id: 'Present', count: 20 }, { _id: 'Absent', count: 2 }, ...]
```

### What is a Compound Index?
A compound index on multiple fields together makes queries involving those fields extremely fast and can enforce uniqueness across a combination of fields.

```javascript
// Ensure one attendance record per employee per date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
```

This means: the same employee cannot have two records for the same date.

### Date Handling in MongoDB
MongoDB stores dates as UTC. When querying by date, use **start of day** and **end of day** boundaries:
```javascript
const start = new Date('2025-04-01T00:00:00.000Z');
const end   = new Date('2025-04-01T23:59:59.999Z');
Attendance.find({ date: { $gte: start, $lte: end } });
```

---

## 🗂️ Files You'll Create

```
backend/
├── models/
│   └── Attendance.js
├── controllers/
│   └── attendanceController.js
├── routes/
│   └── attendanceRoutes.js

frontend/src/
├── pages/
│   ├── AttendanceCalendar.jsx   ← Employee's own view
│   └── MarkAttendance.jsx       ← HR marks attendance
├── services/
│   └── attendanceService.js
```

---

## 🔧 Step-by-Step Implementation

### Step 1 — Attendance Model

📁 `backend/models/Attendance.js`
```javascript
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday'],
      required: true,
    },
    checkIn:  { type: String }, // "09:05 AM" — stored as string for simplicity
    checkOut: { type: String }, // "06:00 PM"
    notes:    { type: String, trim: true },

    // Track who marked this (HR/Admin)
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Convenience fields for fast aggregation queries (avoid date math every time)
    month: { type: Number, required: true }, // 1–12
    year:  { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound unique index — one record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Index for fast monthly queries
attendanceSchema.index({ employee: 1, month: 1, year: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
```

> 📝 **Code Breakdown:**
> - `type: mongoose.Schema.Types.ObjectId, ref: 'Employee'` — links the attendance record to a specific employee
> - `enum: ['Present', ...]` — restricts the `status` field to exactly these predetermined values
> - `markedBy: { ref: 'User' }` — tracks accountability (which HR/Admin recorded this attendance)
> - `month` and `year` — we store these explicitly to make searching incredibly fast (e.g., "Give me all records for month 4"). If we didn't, we'd have to parse the full ISO string for every row during every query
> - `attendanceSchema.index({ employee: 1, date: 1 }, { unique: true })` — creates a **compound index**. It guarantees that the database will instantly reject any attempt to save a second attendance record for the same employee on the same date
> - `attendanceSchema.index({ employee: 1, month: 1, year: 1 })` — an optimization index. When HR runs the "Monthly Summary" report, MongoDB uses this index to find the relevant rows instantly instead of scanning the whole collection

---

### Step 2 — Validation Rules (Attendance)

Add attendance rules to `validators.js`:

📁 `backend/middleware/validators.js` (append these lines)
```javascript
const attendanceRules = [
  body('employeeId').isMongoId().withMessage('Valid Employee ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('status').isIn(['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday']).withMessage('Invalid status'),
];

// module.exports = { ..., attendanceRules };
```

---

### Step 3 — Attendance Controller

📁 `backend/controllers/attendanceController.js`
```javascript
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Helper: normalise a date to midnight UTC (strips time component)
const toDateOnly = (d) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

// ─── Mark / Upsert Attendance ──────────────────────────────────
// @route  POST /api/attendance
// @access Admin, HR Officer
const markAttendance = asyncHandler(async (req, res) => {
  const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

  const parsedDate = toDateOnly(date);
  const month = parsedDate.getUTCMonth() + 1;
  const year  = parsedDate.getUTCFullYear();

  // Upsert: update if exists, create if not
  const record = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: parsedDate },
    {
      employee: employeeId,
      date: parsedDate,
      status, checkIn, checkOut, notes,
      month, year,
      markedBy: req.user.userId,
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.status(200).json({ success: true, attendance: record });
});

// ─── Bulk Mark Attendance (entire team for one day) ───────────
// @route  POST /api/attendance/bulk
// @access Admin, HR Officer
const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  // records = [{ employeeId, status, checkIn, checkOut }]

  const parsedDate = toDateOnly(date);
  const month = parsedDate.getUTCMonth() + 1;
  const year  = parsedDate.getUTCFullYear();

  const operations = records.map((r) => ({
    updateOne: {
      filter: { employee: r.employeeId, date: parsedDate },
      update: {
        $set: {
          employee: r.employeeId,
          date: parsedDate,
          status: r.status || 'Absent',
          checkIn: r.checkIn, checkOut: r.checkOut,
          month, year,
          markedBy: req.user.userId,
        },
      },
      upsert: true,
    },
  }));

  const result = await Attendance.bulkWrite(operations);

  res.json({
    success: true,
    message: `Attendance recorded for ${records.length} employees`,
    result,
  });
});

// ─── Get Attendance for an Employee (date range) ───────────────
// @route  GET /api/attendance/employee/:employeeId
// @access Admin, HR Officer, Payroll Officer, Employee (own only)
const getAttendanceByEmployee = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { startDate, endDate, month, year } = req.query;

  // If Employee role, ensure they can only view their own
  if (req.user.role === 'Employee') {
    const emp = await Employee.findOne({ user: req.user.userId });
    if (!emp || emp._id.toString() !== employeeId) {
      res.status(403);
      throw new Error('Access denied');
    }
  }

  const filter = { employee: employeeId };

  if (month && year) {
    filter.month = Number(month);
    filter.year  = Number(year);
  } else if (startDate && endDate) {
    filter.date = { $gte: toDateOnly(startDate), $lte: toDateOnly(endDate) };
  }

  const records = await Attendance.find(filter).sort({ date: 1 });

  res.json({ success: true, count: records.length, records });
});

// ─── Monthly Summary for One Employee ─────────────────────────
// @route  GET /api/attendance/summary/:employeeId?month=4&year=2025
// @access Admin, HR Officer, Payroll Officer, Employee (own)
const getMonthlySummary = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const month = Number(req.query.month);
  const year  = Number(req.query.year);

  const summary = await Attendance.aggregate([
    {
      $match: {
        employee: new require('mongoose').Types.ObjectId(employeeId),
        month,
        year,
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Convert array to a readable object
  const result = {
    Present: 0, Absent: 0, Late: 0,
    'Half-Day': 0, 'On-Leave': 0, Holiday: 0,
  };
  summary.forEach((s) => { result[s._id] = s.count; });

  // Working days count (exclude weekends for that month)
  const totalDays   = new Date(year, month, 0).getDate(); // days in month
  const totalRecords = Object.values(result).reduce((a, b) => a + b, 0);

  res.json({
    success: true,
    month,
    year,
    summary: result,
    totalRecorded: totalRecords,
    totalDaysInMonth: totalDays,
  });
});

// ─── Get Attendance for a Specific Date (HR view) ─────────────
// @route  GET /api/attendance/date/:date
// @access Admin, HR Officer
const getAttendanceByDate = asyncHandler(async (req, res) => {
  const parsedDate = toDateOnly(req.params.date);

  const records = await Attendance.find({ date: parsedDate })
    .populate('employee', 'firstName lastName employeeId department')
    .sort({ 'employee.firstName': 1 });

  res.json({ success: true, date: parsedDate, count: records.length, records });
});

module.exports = {
  markAttendance, bulkMarkAttendance,
  getAttendanceByEmployee, getMonthlySummary, getAttendanceByDate,
};
```

> 📝 **Code Breakdown:**
> - `date.setUTCHours(0, 0, 0, 0)` — standardizes the time to midnight UTC. Without this, timezone differences between the browser and the server could cause April 1st in India to register as March 31st in MongoDB
> - `findOneAndUpdate(..., { upsert: true, new: true })` — **Upsert** means "Update if found, Insert if not found". It prevents duplicates in a single atomic operation
> - `Attendance.bulkWrite(operations)` — instead of looping and doing 100 `await updateOne()` calls (which is slow), we batch all 100 instructions into an array and send them to MongoDB in one go
> - `filter.date = { $gte: ..., $lte: ... }` — MongoDB date querying: "Give me records where the date is Greater Than or Equal to the start, and Less Than or Equal to the end"
> - `Attendance.aggregate([ ... ])` — begins an aggregation pipeline
> - `$match` — stage 1: filter down to just the requested employee's records for the requested month/year
> - `$group: { _id: '$status', count: { $sum: 1 } }` — stage 2: group the filtered records by their `status` field. For every row found in that group, add 1 to the `count`
> - `Object.values(result).reduce((a, b) => a + b, 0)` — standard JavaScript trick to sum up all the numbers in an object

---

### Step 4 — Attendance Routes

📁 `backend/routes/attendanceRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const {
  markAttendance, bulkMarkAttendance,
  getAttendanceByEmployee, getMonthlySummary, getAttendanceByDate,
} = require('../controllers/attendanceController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { attendanceRules, validate } = require('../middleware/validators');

router.use(protect);

router.post('/',      authorizeRoles('Admin', 'HR Officer'), attendanceRules, validate, markAttendance);
router.post('/bulk',  authorizeRoles('Admin', 'HR Officer'), bulkMarkAttendance);

router.get('/date/:date',             authorizeRoles('Admin', 'HR Officer'), getAttendanceByDate);
router.get('/employee/:employeeId',   getAttendanceByEmployee);  // inner check by role
router.get('/summary/:employeeId',    getMonthlySummary);

module.exports = router;
```

Register in `app.js`:
```javascript
const attendanceRoutes = require('./routes/attendanceRoutes');
app.use('/api/attendance', attendanceRoutes);
```

---

### Step 5 — Frontend: Attendance Service

📁 `frontend/src/services/attendanceService.js`
```javascript
import API from './api';

export const markAttendance    = (data)       => API.post('/attendance', data);
export const bulkMark          = (data)       => API.post('/attendance/bulk', data);
export const getByEmployee     = (id, params) => API.get(`/attendance/employee/${id}`, { params });
export const getMonthlySummary = (id, params) => API.get(`/attendance/summary/${id}`, { params });
export const getByDate         = (date)       => API.get(`/attendance/date/${date}`);
```

---

### Step 6 — Attendance Calendar (Employee View)

📁 `frontend/src/pages/AttendanceCalendar.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getByEmployee, getMonthlySummary } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';

// Simple map from status to colour
const STATUS_COLOR = {
  Present:   '#22c55e',
  Absent:    '#ef4444',
  Late:      '#f59e0b',
  'Half-Day':'#3b82f6',
  'On-Leave':'#8b5cf6',
  Holiday:   '#ec4899',
};

const AttendanceCalendar = ({ employeeId }) => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [records, setRecords] = useState({});
  const [summary, setSummary] = useState({});

  useEffect(() => {
    if (!employeeId) return;

    // Fetch records and summary in parallel
    Promise.all([
      getByEmployee(employeeId, { month, year }),
      getMonthlySummary(employeeId, { month, year }),
    ]).then(([attRes, sumRes]) => {
      // Convert array to date-keyed map for O(1) lookup
      const map = {};
      attRes.data.records.forEach((r) => {
        const key = new Date(r.date).getUTCDate();
        map[key] = r;
      });
      setRecords(map);
      setSummary(sumRes.data.summary);
    }).catch(console.error);
  }, [employeeId, month, year]);

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const cells = [];

  // Empty cells for days before 1st
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={{ padding: '2rem' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={prevMonth}>◀</button>
        <h2 style={{ minWidth: '140px', textAlign: 'center' }}>{MONTH_NAMES[month]} {year}</h2>
        <button onClick={nextMonth}>▶</button>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {Object.entries(summary).map(([status, count]) => (
          <span key={status} style={{ padding: '0.4rem 0.9rem', background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status], borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem' }}>
            {status}: {count}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#888', padding: '0.5rem', fontSize: '0.8rem' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const rec = day ? records[day] : null;
          return (
            <div key={i} style={{
              aspectRatio: '1',
              borderRadius: '8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: rec ? STATUS_COLOR[rec.status] + '22' : day ? '#f9fafb' : 'transparent',
              border: day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear() ? '2px solid #667eea' : '1px solid #eee',
              fontSize: '0.85rem',
            }}>
              {day && (
                <>
                  <span style={{ fontWeight: 600 }}>{day}</span>
                  {rec && <span style={{ fontSize: '0.6rem', color: STATUS_COLOR[rec.status], fontWeight: 700 }}>{rec.status}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
```

> 📝 **Code Breakdown:**
> - `Promise.all([ ... ])` — fires off both API requests (daily records + summary) simultaneously instead of waiting for one to finish before starting the other. It's much faster
> - `const map = {}; ... map[key] = r;` — converts the array of records into a dictionary keyed by the day of the month (1-31). This enables `O(1)` ultra-fast lookups when rendering the grid later
> - `new Date(year, month, 0).getDate()` — a clever JS trick. Day `0` of any month is actually the last day of the *previous* month. So asking for day `0` of month `m` gives you the total number of days in month `m-1`
> - `for (let i = 0; i < firstDay; i++) cells.push(null)` — before day 1, we push `null` values into the array to shift the calendar padding so the 1st falls on the correct day of the week (e.g., if the 1st is a Tuesday, we need 2 empty slots for Sun/Mon)
> - `gridTemplateColumns: 'repeat(7, 1fr)'` — CSS Grid layout that perfectly divides the container into 7 equal columns for the days of the week

---

### Step 7 — Mark Attendance (HR Panel)

📁 `frontend/src/pages/MarkAttendance.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getAllEmployees } from '../services/employeeService';
import { bulkMark } from '../services/attendanceService';

const STATUSES = ['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday'];

const MarkAttendance = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getAllEmployees({ isActive: true }).then(({ data }) => {
      setEmployees(data.employees);
      // Default everyone to Absent
      const defaults = {};
      data.employees.forEach((e) => { defaults[e._id] = 'Absent'; });
      setRecords(defaults);
    });
  }, []);

  const handleStatusChange = (empId, status) => {
    setRecords((prev) => ({ ...prev, [empId]: status }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = employees.map((e) => ({
        employeeId: e._id,
        status: records[e._id] || 'Absent',
      }));
      await bulkMark({ date, records: payload });
      setMessage('✅ Attendance saved successfully!');
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'Error saving attendance'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Mark Attendance</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
        <label><strong>Date:</strong></label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd' }} />
      </div>

      {message && <div style={{ marginBottom: '1rem', color: message.startsWith('✅') ? 'green' : 'red' }}>{message}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px' }}>
        <thead>
          <tr style={{ background: '#f5f7fa' }}>
            <th style={th}>ID</th><th style={th}>Name</th><th style={th}>Department</th><th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp._id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={td}>{emp.employeeId}</td>
              <td style={td}>{emp.fullName}</td>
              <td style={td}>{emp.department?.name}</td>
              <td style={td}>
                <select
                  value={records[emp._id] || 'Absent'}
                  onChange={(e) => handleStatusChange(emp._id, e.target.value)}
                  style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #ddd' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={handleSubmit} disabled={saving}
        style={{ marginTop: '1.5rem', padding: '0.8rem 2rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
        {saving ? 'Saving...' : 'Save Attendance'}
      </button>
    </div>
  );
};

const th = { padding: '1rem', textAlign: 'left', fontWeight: 700 };
const td = { padding: '0.75rem 1rem' };

export default MarkAttendance;
```

> 📝 **Code Breakdown:**
> - `const defaults = {}; data.employees.forEach(...)` — when the page loads, we instantly construct an object where every employee ID is set to `'Absent'` by default
> - `handleStatusChange(empId, status)` — dynamically updates just one employee's status in the big `records` dictionary without affecting anyone else's dropdown
> - `const payload = employees.map(...)` — right before clicking save, we take our dict and build the exact `[{ employeeId, status }, ...]` array format the backend `bulkWrite` controller is expecting
> - `e.target.value` passed to `setDate` — standard HTML5 `<input type="date">` naturally outputs the string format `"YYYY-MM-DD"`, which is exactly what our backend controller expects
> - `employees.map((emp) => (...))` — renders a giant table where every row is an employee, and the last cell contains a dropdown (`<select>`) that reads its value from our `records` state dictionary

---

## ⚠️ Edge Cases & Gotchas

### 1. Upsert prevents duplicates
Using `findOneAndUpdate` with `upsert: true` means: if a record exists for that employee + date, update it; if not, create it. This is safer than checking first and then inserting.

### 2. Date timezone issues
If a user sends `2025-04-01` from a browser in IST (+5:30), JavaScript's `new Date("2025-04-01")` parses it as midnight UTC — which is 5:30 AM IST, but still April 1. Always normalize using `setUTCHours(0,0,0,0)` on the server so dates are consistent regardless of the client's timezone.

### 3. `new require('mongoose').Types.ObjectId(employeeId)` in aggregation
In aggregation `$match`, string IDs aren't automatically cast to ObjectIds (unlike regular queries). You must wrap them:
```javascript
{ employee: new mongoose.Types.ObjectId(employeeId) }
```

### 4. `bulkWrite` is much faster than multiple `.save()` calls
For marking attendance for 100 employees at once, running 100 separate DB operations would be slow. `bulkWrite` sends one request to MongoDB and handles all operations server-side.

### 5. Weekend handling
The current system doesn't automatically mark weekends as holidays. For production, you'd add logic to auto-mark Saturday and Sunday as "Holiday" or simply skip them. This can be added in Phase 9 (polish).

### 6. Future dates
Add a check on the server to prevent marking attendance for future dates:
```javascript
if (parsedDate > new Date()) {
  return res.status(400).json({ success: false, message: 'Cannot mark attendance for future dates' });
}
```

---

## ✅ Phase 4 Checklist
- [ ] `models/Attendance.js` — compound unique index
- [ ] `controllers/attendanceController.js` — mark, bulk, summary, by date
- [ ] `routes/attendanceRoutes.js` — with role restrictions
- [ ] Routes registered in `app.js`
- [ ] Monthly summary aggregation tested in Postman
- [ ] `services/attendanceService.js` — frontend helpers
- [ ] `pages/AttendanceCalendar.jsx` — month grid with colors
- [ ] `pages/MarkAttendance.jsx` — HR bulk attendance panel
- [ ] Routes added to `App.jsx`

---

## 🔗 What's Next?
**Phase 5** — Leave management: employees apply for leave, HR approves or rejects, and leave balances update automatically.
