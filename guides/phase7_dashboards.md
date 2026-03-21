# Phase 7 — Dashboards & Analytics

## 🎯 What You'll Build
- A **stats API endpoint** that returns aggregated analytics per role
- **Admin Dashboard**: total employees, role distribution, recent activity
- **HR Dashboard**: attendance rate, pending leaves, headcount by department
- **Payroll Officer Dashboard**: payroll status, monthly disbursement trend
- **Employee Dashboard**: attendance summary, leave balance, latest payslip
- Charts using **Recharts** (BarChart, PieChart, LineChart)

---

## 📚 Theory

### What is Recharts?
Recharts is a React charting library built on top of D3.js. It uses a declarative component API that fits naturally with React:

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#667eea" />
  </BarChart>
</ResponsiveContainer>
```

Key components:
| Component | Purpose |
|---|---|
| `ResponsiveContainer` | Makes chart fill its parent's width |
| `BarChart / PieChart / LineChart` | The chart type |
| `Bar / Pie / Line` | The data series |
| `XAxis / YAxis` | Axis configuration |
| `Tooltip` | Hover tooltip |
| `Legend` | Series labels |
| `CartesianGrid` | Background grid lines |

### Dashboard Data Strategy
Instead of making 10 separate API calls on page load (slow), create a **single dashboard stats endpoint** per role that returns everything at once using MongoDB aggregation:

```
GET /api/dashboard/admin    → Total employees, role counts, etc.
GET /api/dashboard/hr       → Attendance rate, pending leaves, etc.
GET /api/dashboard/payroll  → Salary totals, payroll status etc.
GET /api/dashboard/employee → Own stats
```

---

## 🗂️ Files

```
backend/
├── controllers/dashboardController.js
├── routes/dashboardRoutes.js

frontend/src/
├── pages/
│   ├── AdminDashboard.jsx
│   ├── HRDashboard.jsx
│   ├── PayrollDashboard.jsx
│   └── EmployeeDashboard.jsx
├── components/
│   └── StatCard.jsx
├── services/
│   └── dashboardService.js
```

---

## 🔧 Implementation

### Step 1 — Dashboard Controller

📁 `backend/controllers/dashboardController.js`
```javascript
const Employee   = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Payroll    = require('../models/Payroll');
const User       = require('../models/User');
const mongoose   = require('mongoose');
const { asyncHandler } = require('../middleware/errorMiddleware');

// ─── Admin Dashboard ──────────────────────────────────────────
// GET /api/dashboard/admin
const getAdminStats = asyncHandler(async (req, res) => {
  const [
    totalEmployees,
    activeEmployees,
    totalUsers,
    roleDistribution,
    deptDistribution,
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.countDocuments({ isActive: true }),
    User.countDocuments(),
    // Role breakdown
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { name: '$_id', value: '$count', _id: 0 } },
    ]),
    // Department headcount
    Employee.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      { $project: { name: '$dept.name', value: '$count', _id: 0 } },
    ]),
  ]);

  res.json({
    success: true,
    stats: { totalEmployees, activeEmployees, totalUsers },
    roleDistribution,
    deptDistribution,
  });
});

// ─── HR Dashboard ─────────────────────────────────────────────
// GET /api/dashboard/hr
const getHRStats = asyncHandler(async (req, res) => {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const [
    pendingLeaves,
    totalActive,
    attendanceSummary,
    monthlyHeadcount,
  ] = await Promise.all([
    Leave.countDocuments({ status: 'Pending' }),
    Employee.countDocuments({ isActive: true }),
    // Attendance breakdown for this month
    Attendance.aggregate([
      { $match: { month, year } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { name: '$_id', value: '$count', _id: 0 } },
    ]),
    // Employees joined per month this year (line chart)
    Employee.aggregate([
      { $match: { dateOfJoining: { $gte: new Date(`${year}-01-01`) } } },
      { $group: { _id: { $month: '$dateOfJoining' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } },
    ]),
  ]);

  res.json({ success: true, pendingLeaves, totalActive, attendanceSummary, monthlyHeadcount });
});

// ─── Payroll Dashboard ────────────────────────────────────────
// GET /api/dashboard/payroll
const getPayrollStats = asyncHandler(async (req, res) => {
  const now  = new Date();
  const year = now.getFullYear();

  const [
    currentMonthStats,
    monthlyTrend,
    paymentStatus,
  ] = await Promise.all([
    // Current month total
    Payroll.aggregate([
      { $match: { month: now.getMonth() + 1, year } },
      { $group: { _id: null, total: { $sum: '$netSalary' }, count: { $sum: 1 } } },
    ]),
    // Net salary per month this year
    Payroll.aggregate([
      { $match: { year } },
      { $group: { _id: '$month', total: { $sum: '$netSalary' } } },
      { $sort: { '_id': 1 } },
      { $project: { month: '$_id', total: 1, _id: 0 } },
    ]),
    // Generated vs Paid this month
    Payroll.aggregate([
      { $match: { month: now.getMonth() + 1, year } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { name: '$_id', value: '$count', _id: 0 } },
    ]),
  ]);

  res.json({
    success: true,
    currentMonth: currentMonthStats[0] || { total: 0, count: 0 },
    monthlyTrend,
    paymentStatus,
  });
});

// ─── Employee Dashboard ───────────────────────────────────────
// GET /api/dashboard/employee
const getEmployeeStats = asyncHandler(async (req, res) => {
  const emp = await require('../models/Employee').findOne({ user: req.user.userId });
  if (!emp) {
    res.status(404);
    throw new Error('Profile not found');
  }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const [attSummary, leaveBalance, latestPayslip] = await Promise.all([
    Attendance.aggregate([
      { $match: { employee: emp._id, month, year } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { name: '$_id', value: '$count', _id: 0 } },
    ]),
    require('../models/LeaveBalance').findOne({ employee: emp._id, year }),
    Payroll.findOne({ employee: emp._id, month, year }),
  ]);

  res.json({ success: true, employee: emp, attSummary, leaveBalance, latestPayslip });
});

module.exports = { getAdminStats, getHRStats, getPayrollStats, getEmployeeStats };
```

> 📝 **Code Breakdown:**
> - `Promise.all([...])` — runs all the heavy aggregation queries concurrently. If one query takes 200ms and another 300ms, the total time is ~300ms instead of 500ms
> - `User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])` — groups the entire User collection by their `role` string, essentially asking MongoDB: "Count how many people have each role"
> - `{ $project: { name: '$_id', value: '$count', _id: 0 } }` — cleanly renames the output fields to `name` and `value`. This matches exactly what the `recharts` library expects, saving us from having to write a frontend mapping loop
> - `$lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' }` — MongoDB's version of a SQL `JOIN`. After grouping employees by department ID, it fetches the actual department name string from the departments collection
> - `$unwind` — `$lookup` returns an array (since one ID could technically match many rows), but we know it's a 1-to-1 relationship here. `$unwind` flattens the array down to just the object itself

---

### Step 2 — Dashboard Routes

📁 `backend/routes/dashboardRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const { getAdminStats, getHRStats, getPayrollStats, getEmployeeStats } = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/admin',    authorizeRoles('Admin'), getAdminStats);
router.get('/hr',       authorizeRoles('Admin', 'HR Officer'), getHRStats);
router.get('/payroll',  authorizeRoles('Admin', 'Payroll Officer'), getPayrollStats);
router.get('/employee', getEmployeeStats);

module.exports = router;
```

Add to `app.js`:
```javascript
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
```

---

### Step 3 — Reusable StatCard Component

📁 `frontend/src/components/StatCard.jsx`
```jsx
import React from 'react';

const StatCard = ({ title, value, subtitle, color = '#667eea', icon }) => (
  <div style={{
    background: '#fff', borderRadius: '12px', padding: '1.5rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}`,
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600 }}>{title}</span>
      {icon && <span style={{ fontSize: '1.5rem' }}>{icon}</span>}
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
    {subtitle && <div style={{ color: '#aaa', fontSize: '0.8rem' }}>{subtitle}</div>}
  </div>
);

export default StatCard;
```

---

### Step 4 — Dashboard Service

📁 `frontend/src/services/dashboardService.js`
```javascript
import API from './api';
export const getAdminStats    = () => API.get('/dashboard/admin');
export const getHRStats       = () => API.get('/dashboard/hr');
export const getPayrollStats  = () => API.get('/dashboard/payroll');
export const getEmployeeStats = () => API.get('/dashboard/employee');
```

---

### Step 5 — Admin Dashboard

📁 `frontend/src/pages/AdminDashboard.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getAdminStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS = ['#667eea', '#764ba2', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

const AdminDashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    getAdminStats().then(({ data }) => setData(data));
  }, []);

  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Admin Dashboard 🛡️</h1>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Total Employees"  value={data.stats.totalEmployees}  icon="👥" color="#667eea" />
        <StatCard title="Active Employees" value={data.stats.activeEmployees}  icon="✅" color="#22c55e" />
        <StatCard title="System Users"     value={data.stats.totalUsers}       icon="🔑" color="#f59e0b" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Role Distribution Pie */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Role Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.roleDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {data.roleDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Dept Headcount Bar */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Headcount by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.deptDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#667eea" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
```

> 📝 **Code Breakdown:**
> - `<ResponsiveContainer width="100%" height={250}>` — makes the chart fluid so it shrinks or grows perfectly if the user resizes their browser window or views on a phone
> - `<Pie data={data.roleDistribution} ...>` — hands Recharts the exact array of `{ name, value }` objects we cleverly pre-formatted in the backend controller
> - `data.roleDistribution.map((_, i) => <Cell key={i} fill={COLORS[...]} />)` — loops through the segments of the pie chart and individually assigns them a color from our `COLORS` array using the modulo (`%`) operator so we never run out of colors
> - `<Bar dataKey="value" fill="#667eea" radius={[4,4,0,0]} />` — draws the actual vertical columns. `radius` subtly rounds off only the top-left and top-right corners of the bars for a premium UI feel

---

### Step 6 — HR Dashboard

📁 `frontend/src/pages/HRDashboard.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getHRStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#22c55e','#ef4444','#f59e0b','#3b82f6','#8b5cf6','#ec4899'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const HRDashboard = () => {
  const [data, setData] = useState(null);
  useEffect(() => { getHRStats().then(({ data }) => setData(data)); }, []);
  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const headcountFormatted = data.monthlyHeadcount.map(d => ({
    month: MONTH_LABELS[d.month - 1], count: d.count,
  }));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>HR Dashboard 👔</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Active Employees"  value={data.totalActive}   icon="👥" color="#667eea" />
        <StatCard title="Pending Leaves"    value={data.pendingLeaves} icon="📋" color="#f59e0b" subtitle="Awaiting approval" />
        <StatCard title="Current Month"     value={new Date().toLocaleString('default',{month:'long'})} icon="📅" color="#22c55e" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Attendance This Month</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.attendanceSummary} dataKey="value" nameKey="name" outerRadius={80} label>
                {data.attendanceSummary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>New Joiners This Year</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={headcountFormatted}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
```

---

### Step 7 — Payroll Dashboard

📁 `frontend/src/pages/PayrollDashboard.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getPayrollStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#667eea','#22c55e'];

const PayrollDashboard = () => {
  const [data, setData] = useState(null);
  useEffect(() => { getPayrollStats().then(({ data }) => setData(data)); }, []);
  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const trendData = data.monthlyTrend.map(d => ({
    month: MONTH_LABELS[d.month - 1],
    total: d.total,
  }));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Payroll Dashboard 💰</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="This Month — Total Disbursed" value={`₹${data.currentMonth.total.toLocaleString()}`} icon="💵" color="#667eea" />
        <StatCard title="Payrolls Generated"           value={data.currentMonth.count} icon="📄" color="#22c55e" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Monthly Salary Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="total" stroke="#667eea" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Payment Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.paymentStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                {data.paymentStatus.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PayrollDashboard;
```

---

### Step 8 — Employee Dashboard

📁 `frontend/src/pages/EmployeeDashboard.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getEmployeeStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import { useNavigate } from 'react-router-dom';

const EmployeeDashboard = () => {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { getEmployeeStats().then(({ data }) => setData(data)); }, []);
  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const { employee, attSummary, leaveBalance, latestPayslip } = data;
  const present = attSummary.find(a => a.name === 'Present')?.value || 0;
  const absent  = attSummary.find(a => a.name === 'Absent')?.value || 0;

  const remaining = leaveBalance ? {
    Casual: leaveBalance.casual.allocated - leaveBalance.casual.used,
    Sick:   leaveBalance.sick.allocated   - leaveBalance.sick.used,
    Annual: leaveBalance.annual.allocated - leaveBalance.annual.used,
  } : {};

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Welcome, {employee.firstName}! 👋</h1>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>{employee.designation}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Days Present This Month" value={present} icon="✅" color="#22c55e" />
        <StatCard title="Days Absent"             value={absent}  icon="❌" color="#ef4444" />
        <StatCard title="Casual Leave Left"  value={remaining.Casual ?? '-'} icon="🌴" color="#667eea" />
        <StatCard title="Sick Leave Left"    value={remaining.Sick   ?? '-'} icon="🏥" color="#f59e0b" />
      </div>

      {latestPayslip && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', maxWidth: '500px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Latest Payslip</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>Net Salary</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#667eea' }}>
                ₹{latestPayslip.netSalary.toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => navigate(`/payslip/${employee._id}?month=${latestPayslip.month}&year=${latestPayslip.year}`)}
              style={{ padding: '0.6rem 1.25rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              View Payslip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
```

> 📝 **Code Breakdown:**
> - `attSummary.find(a => a.name === 'Present')?.value || 0` — searches the backend's attendance breakdown array to grab just the 'Present' count. The `?.` (optional chaining) ensures it doesn't crash if 'Present' wasn't returned, and `|| 0` defaults it to 0
> - `leaveBalance ? { Casual: ... } : {}` — gracefully handles the edge case where a new employee hasn't had their automated leave balance record generated yet
> - `navigate(\`/payslip/\${employee._id}...\`)` — allows the employee to jump straight from their dashboard widget into a dedicated, printable PDF view of their most recent paycheck

---

## ⚠️ Edge Cases & Gotchas

### 1. `$lookup` requires exact collection names
MongoDB collection names are the **lowercase plural** of your model name:
- `mongoose.model('Employee', ...)` → collection `employees`
- `mongoose.model('Department', ...)` → collection `departments`

```javascript
{ $lookup: { from: 'departments', ... } } // ✅ lowercase plural
{ $lookup: { from: 'Department', ... } }  // ❌ wrong, won't find anything
```

### 2. `ResponsiveContainer` needs a parent with defined height
```jsx
// ✅ Correct
<div style={{ height: '300px' }}>
  <ResponsiveContainer width="100%" height="100%">
    ...
  </ResponsiveContainer>
</div>

// Also fine — set height on ResponsiveContainer directly
<ResponsiveContainer width="100%" height={300}>
```

### 3. Empty Pie Chart crashes
If `data.roleDistribution` is empty, Recharts may render nothing or throw. Always provide a fallback:
```jsx
const safeData = data.roleDistribution.length > 0 ? data.roleDistribution : [{ name: 'No Data', value: 1 }];
```

### 4. Promise.all for parallel DB queries
All dashboard queries are independent. Use `Promise.all` so they run in parallel instead of sequentially:
```javascript
// ✅ Parallel — all run at same time (faster)
const [a, b, c] = await Promise.all([queryA(), queryB(), queryC()]);

// ❌ Sequential — each waits for the previous (3× slower)
const a = await queryA();
const b = await queryB();
const c = await queryC();
```

---

## ✅ Phase 7 Checklist
- [ ] `controllers/dashboardController.js` — 4 role-specific stats functions
- [ ] `routes/dashboardRoutes.js` with role guards
- [ ] Routes registered in `app.js`
- [ ] `components/StatCard.jsx` created
- [ ] `services/dashboardService.js` created
- [ ] `pages/AdminDashboard.jsx` with Pie + Bar charts
- [ ] `pages/HRDashboard.jsx` with attendance Pie + joiners Bar
- [ ] `pages/PayrollDashboard.jsx` with Line + Pie charts
- [ ] `pages/EmployeeDashboard.jsx` with stat cards + payslip preview
- [ ] All dashboards wired up in `App.jsx`

---

## 🔗 What's Next?
**Phase 8** — Admin Controls: user management, role assignment, system settings.
