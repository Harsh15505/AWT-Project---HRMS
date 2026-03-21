# Phase 6 — Payroll & Payslip Generation

## 🎯 What You'll Build
- **Payroll schema** for monthly salary records
- **Salary calculation logic** (attendance + LOP deductions)
- API: generate payroll for one or all employees
- API: fetch payslips and salary reports
- React **printable Payslip** component
- React **Salary Report** page (Payroll Officer)

---

## 📚 Theory

### Payroll Calculation Formula
```
Working Days        = Mon–Fri count in the month
Per Day Salary      = Base Salary / Working Days
Days Worked         = Present + Late + (Half-Day × 0.5)
Gross Salary        = Per Day Salary × Days Worked
PF Deduction        = Gross Salary × 12%
LOP Deduction       = LOP Days × Per Day Salary
Net Salary          = Gross Salary - PF - LOP Deduction
```

### Idempotency
Running payroll twice for the same month should update, not duplicate records. We use `upsert: true` in `findOneAndUpdate` to ensure this.

### Why Not Promise.all for Bulk?
Running 100+ DB operations in parallel can overwhelm MongoDB. Use a sequential `for...of` loop for bulk payroll generation — slower, but safe.

---

## 🗂️ Files

```
backend/
├── models/Payroll.js
├── controllers/payrollController.js
├── routes/payrollRoutes.js
├── utils/payrollCalculator.js

frontend/src/
├── pages/Payslip.jsx
├── pages/SalaryReport.jsx
├── services/payrollService.js
```

---

## 🔧 Implementation

### Step 1 — Payroll Model

📁 `backend/models/Payroll.js`
```javascript
const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month:         { type: Number, required: true },
  year:          { type: Number, required: true },
  baseSalary:    { type: Number, required: true },
  perDaySalary:  { type: Number, required: true },
  workingDays:   { type: Number, required: true },
  daysPresent:   { type: Number, default: 0 },
  halfDays:      { type: Number, default: 0 },
  lopDays:       { type: Number, default: 0 },
  grossSalary:   { type: Number, required: true },
  pfDeduction:   { type: Number, default: 0 },
  taxDeduction:  { type: Number, default: 0 },
  lopDeduction:  { type: Number, default: 0 },
  bonuses:       { type: Number, default: 0 },
  netSalary:     { type: Number, required: true },
  status:        { type: String, enum: ['Generated', 'Paid'], default: 'Generated' },
  generatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt:        { type: Date },
}, { timestamps: true });

// One payroll record per employee per month/year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
```

> 📝 **Code Breakdown:**
> - `month` and `year` — storing these directly makes it much easier to query payroll runs without doing complex date parsing
> - `baseSalary`, `perDaySalary`, etc. — we save snapshot values here. Even if an employee gets a raise next year, this historical payslip will correctly reflect exactly what they were paid at the time
> - `grossSalary`, `netSalary`, `pfDeduction`, etc. — explicitly storing the calculated components of the final pay for easy reporting and payslip generation
> - `status: { enum: ['Generated', 'Paid'] }` — acts as a workflow tracker. "Generated" means the numbers are calculated, but the money hasn't left the bank yet
> - `payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true })` — guarantees that an employee can't accidentally get two separate payroll records for the exact same month

---

### Step 2 — Payroll Calculator Utility

📁 `backend/utils/payrollCalculator.js`
```javascript
// Count Mon–Fri days in a month
const getWorkingDays = (month, year) => {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

const calculatePayroll = (employee, attendance, leaves, month, year) => {
  const workingDays  = getWorkingDays(month, year);
  const perDaySalary = employee.baseSalary / workingDays;

  let daysPresent = 0, halfDays = 0, lopDays = 0;

  attendance.forEach((rec) => {
    if (rec.status === 'Present' || rec.status === 'Late') daysPresent++;
    if (rec.status === 'Half-Day') halfDays++;
  });

  leaves.forEach((leave) => {
    if (leave.leaveType === 'LOP' && leave.status === 'Approved') {
      lopDays += leave.numberOfDays;
    }
  });

  const effectiveDays = daysPresent + halfDays * 0.5;
  const grossSalary   = Math.round(perDaySalary * effectiveDays);
  const pfDeduction   = Math.round(grossSalary * 0.12);
  const lopDeduction  = Math.round(lopDays * perDaySalary);
  const netSalary     = Math.max(0, grossSalary - pfDeduction - lopDeduction);

  return {
    baseSalary: employee.baseSalary,
    perDaySalary: Math.round(perDaySalary),
    workingDays, daysPresent, halfDays, lopDays,
    grossSalary, pfDeduction, taxDeduction: 0,
    lopDeduction, bonuses: 0, netSalary,
  };
};

module.exports = { calculatePayroll, getWorkingDays };
```

> 📝 **Code Breakdown:**
> - `getWorkingDays` — loops through every day of the requested month. `new Date().getDay()` returns 0 for Sunday and 6 for Saturday. It tallies up all days that aren't 0 or 6
> - `effectiveDays = daysPresent + halfDays * 0.5` — calculates how much of their base salary they actually earned by working
> - `Math.round(perDaySalary * effectiveDays)` — we round to avoid fractional currency issues (e.g., `₹100.33`)
> - `pfDeduction = Math.round(grossSalary * 0.12)` — standard 12% Provident Fund deduction calculation
> - `Math.max(0, ...)` — ensures that even if deductions somehow exceed earnings (e.g., massive LOP penalty), the net salary doesn't output as a negative number
> - Returns an object containing the full breakdown — this matches exactly what the `Payroll` schema expects to save

---

### Step 3 — Validation Rules (Payroll)

📁 `backend/middleware/validators.js` (append these lines)
```javascript
const generatePayrollRules = [
  body('employeeId').isMongoId().withMessage('Valid Employee ID is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2000 }).withMessage('Valid year is required'),
];

const bulkPayrollRules = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2000 }).withMessage('Valid year is required'),
];

// module.exports = { ..., generatePayrollRules, bulkPayrollRules };
```

---

### Step 4 — Payroll Controller

📁 `backend/controllers/payrollController.js`
```javascript
const Payroll    = require('../models/Payroll');
const Employee   = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const { calculatePayroll } = require('../utils/payrollCalculator');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Helper: fetch attendance and leaves for an employee for a month
const fetchData = async (employeeId, month, year) => {
  const [attendance, leaves] = await Promise.all([
    Attendance.find({ employee: employeeId, month: Number(month), year: Number(year) }),
    Leave.find({
      employee: employeeId, status: 'Approved',
      fromDate: { $lte: new Date(year, month - 1, 31) },
      toDate:   { $gte: new Date(year, month - 1, 1) },
    }),
  ]);
  return { attendance, leaves };
};

// POST /api/payroll/generate
const generatePayrollForEmployee = asyncHandler(async (req, res) => {
  const { employeeId, month, year } = req.body;
  const employee = await Employee.findById(employeeId);
  if (!employee || !employee.isActive) {
    res.status(404);
    throw new Error('Active employee not found');
  }

  const { attendance, leaves } = await fetchData(employeeId, month, year);
  const calc = calculatePayroll(employee, attendance, leaves, Number(month), Number(year));

  const payroll = await Payroll.findOneAndUpdate(
    { employee: employeeId, month: Number(month), year: Number(year) },
    { ...calc, employee: employeeId, month, year, generatedBy: req.user.userId },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ success: true, payroll });
});

// POST /api/payroll/generate/bulk
const generateBulkPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const employees = await Employee.find({ isActive: true });
  const results = [], errors = [];

  for (const employee of employees) {
    try {
      const { attendance, leaves } = await fetchData(employee._id, month, year);
      const calc = calculatePayroll(employee, attendance, leaves, Number(month), Number(year));
      const p = await Payroll.findOneAndUpdate(
        { employee: employee._id, month: Number(month), year: Number(year) },
        { ...calc, employee: employee._id, month, year, generatedBy: req.user.userId },
        { upsert: true, new: true }
      );
      results.push(p);
    } catch (e) {
      errors.push({ employee: employee.employeeId, error: e.message });
    }
  }

  res.json({ success: true, message: `Generated payroll for ${results.length} employees`, errors });
});

// GET /api/payroll/payslip/:employeeId?month=4&year=2025
const getPayslip = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { month, year } = req.query;
  const payroll = await Payroll.findOne({ employee: employeeId, month: Number(month), year: Number(year) })
    .populate('employee').populate('generatedBy', 'name');
  if (!payroll) {
    res.status(404);
    throw new Error('Payslip not found');
  }
  res.json({ success: true, payroll });
});

// GET /api/payroll/report?month=4&year=2025
const getSalaryReport = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const report = await Payroll.find({ month: Number(month), year: Number(year) })
    .populate('employee', 'firstName lastName employeeId designation');
  const totalSalary = report.reduce((sum, r) => sum + r.netSalary, 0);
  res.json({ success: true, count: report.length, totalSalary, report });
});

// PUT /api/payroll/:id/paid
const markAsPaid = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findByIdAndUpdate(
    req.params.id,
    { status: 'Paid', paidAt: new Date() },
    { new: true }
  );
  if (!payroll) {
    res.status(404);
    throw new Error('Payroll not found');
  }
  res.json({ success: true, payroll });
});

module.exports = { generatePayrollForEmployee, generateBulkPayroll, getPayslip, getSalaryReport, markAsPaid };
```

> 📝 **Code Breakdown:**
> - `Promise.all([ Attendance.find(...), Leave.find(...) ])` — fetches both the daily attendance records and the approved leaves for the month simultaneously to save time
> - `{ $lte: new Date(year, month - 1, 31), $gte: ... }` — leave queries use the start and end of the month to catch any leave that touches the current payroll period
> - `findOneAndUpdate(..., { upsert: true, new: true })` — this makes our payroll script **idempotent**. If the Payroll Officer clicks "Run Payroll" five times, it won't create five records; it will just recalculate and overwrite the single record 5 times
> - `for (const employee of employees)` — a sequential `for...of` loop. Doing this via `Promise.all` for 500 employees would overwhelm the database. Sequential is much safer for bulk cron jobs
> - `report.reduce((sum, r) => sum + r.netSalary, 0)` — tallies up the `netSalary` of every employee in the report to find out exactly how much money the company is spending this month

---

### Step 5 — Routes

📁 `backend/routes/payrollRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const {
  generatePayrollForEmployee, generateBulkPayroll,
  getPayslip, getSalaryReport, markAsPaid,
} = require('../controllers/payrollController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { generatePayrollRules, bulkPayrollRules, validate } = require('../middleware/validators');

router.use(protect);
router.post('/generate',       authorizeRoles('Admin', 'Payroll Officer'), generatePayrollRules, validate, generatePayrollForEmployee);
router.post('/generate/bulk',  authorizeRoles('Admin', 'Payroll Officer'), bulkPayrollRules, validate, generateBulkPayroll);
router.get('/report',          authorizeRoles('Admin', 'Payroll Officer'), getSalaryReport);
router.get('/payslip/:employeeId', getPayslip);
router.put('/:id/paid',        authorizeRoles('Admin'), markAsPaid);

module.exports = router;
```

Add to `app.js`:
```javascript
app.use('/api/payroll', require('./routes/payrollRoutes'));
```

---

### Step 6 — Frontend Service

📁 `frontend/src/services/payrollService.js`
```javascript
import API from './api';
export const generatePayroll     = (data)   => API.post('/payroll/generate', data);
export const generateBulkPayroll = (data)   => API.post('/payroll/generate/bulk', data);
export const getPayslip          = (id, p)  => API.get(`/payroll/payslip/${id}`, { params: p });
export const getSalaryReport     = (params) => API.get('/payroll/report', { params });
export const markAsPaid          = (id)     => API.put(`/payroll/${id}/paid`);
```

---

### Step 7 — Payslip Component

📁 `frontend/src/pages/Payslip.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getPayslip } from '../services/payrollService';
import { useParams, useSearchParams } from 'react-router-dom';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

const Row = ({ label, value, bold }) => (
  <tr>
    <td style={{ padding: '0.4rem 0', color: '#666' }}>{label}</td>
    <td style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: bold ? 700 : 500 }}>{value}</td>
  </tr>
);

const Payslip = () => {
  const { employeeId } = useParams();
  const [sp] = useSearchParams();
  const [payroll, setPayroll] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPayslip(employeeId, { month: sp.get('month'), year: sp.get('year') })
      .then(({ data }) => setPayroll(data.payroll))
      .catch((err) => setError(err.response?.data?.message || 'Not found'));
  }, []);

  if (error) return <p style={{ padding: '2rem', color: 'red' }}>{error}</p>;
  if (!payroll) return <p style={{ padding: '2rem' }}>Loading...</p>;
  const emp = payroll.employee;

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto' }}>
      <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
        <button onClick={() => window.print()}
          style={{ padding: '0.6rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          🖨️ Print PDF
        </button>
      </div>

      <div id="payslip" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', padding: '1.5rem 2rem' }}>
          <h1 style={{ margin: 0 }}>🏢 HRMS Company</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.85 }}>Payslip — {MONTHS[payroll.month]} {payroll.year}</p>
        </div>

        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div><strong>Name:</strong> {emp.firstName} {emp.lastName}</div>
          <div><strong>ID:</strong> {emp.employeeId}</div>
          <div><strong>Designation:</strong> {emp.designation}</div>
          <div><strong>Status:</strong> <span style={{ color: payroll.status === 'Paid' ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{payroll.status}</span></div>
        </div>

        <div style={{ padding: '1rem 2rem', background: '#f8fafc', borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', textAlign: 'center' }}>
          {[['Working Days', payroll.workingDays], ['Present', payroll.daysPresent], ['Half Days', payroll.halfDays], ['LOP Days', payroll.lopDays]].map(([l, v]) => (
            <div key={l} style={{ background: '#fff', borderRadius: '8px', padding: '0.75rem', border: '1px solid #eee' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#667eea' }}>{v}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <h3 style={{ color: '#22c55e' }}>Earnings</h3>
            <table style={{ width: '100%' }}><tbody>
              <Row label="Base Salary"   value={`₹${payroll.baseSalary.toLocaleString()}`} />
              <Row label="Gross Salary"  value={`₹${payroll.grossSalary.toLocaleString()}`} bold />
              <Row label="Bonuses"       value={`₹${payroll.bonuses}`} />
            </tbody></table>
          </div>
          <div>
            <h3 style={{ color: '#ef4444' }}>Deductions</h3>
            <table style={{ width: '100%' }}><tbody>
              <Row label="PF (12%)"      value={`₹${payroll.pfDeduction.toLocaleString()}`} />
              <Row label="LOP Deduction" value={`₹${payroll.lopDeduction.toLocaleString()}`} />
              <Row label="Income Tax"    value={`₹${payroll.taxDeduction}`} />
            </tbody></table>
          </div>
        </div>

        <div style={{ margin: '0 2rem 2rem', padding: '1.25rem 1.5rem', background: '#f0f4ff', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Net Salary (Take Home)</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#667eea' }}>₹{payroll.netSalary.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Payslip;
```

> 📝 **Code Breakdown:**
> - `const [sp] = useSearchParams()` — grabs query parameters from the URL (e.g., `?month=4&year=2025`)
> - `getPayslip(employeeId, { month: sp.get('month'), year: sp.get('year') })` — fetches the specific payroll record generated for this exact month
> - `const Row = ({ label, value, bold }) => ...` — a mini, inline React component. Extracted specifically to keep the giant table HTML clean and repetitive code to a minimum
> - `window.print()` — native browser API. When the user clicks the button, it immediately opens the browser's Print/Save-as-PDF dialog
> - `value.toLocaleString()` — formats numbers into standard currency presentation (e.g., `150000` -> `1,50,000` or `150,000` depending on the browser locale setting)

---

### Step 8 — Salary Report Page

📁 `frontend/src/pages/SalaryReport.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getSalaryReport, generateBulkPayroll, markAsPaid } from '../services/payrollService';

const SalaryReport = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [report, setReport] = useState([]);
  const [total, setTotal]   = useState(0);
  const [msg, setMsg] = useState('');

  const load = () =>
    getSalaryReport({ month, year }).then(({ data }) => { setReport(data.report); setTotal(data.totalSalary); });

  useEffect(() => { load(); }, [month, year]);

  const runPayroll = async () => {
    try {
      await generateBulkPayroll({ month, year });
      setMsg('✅ Payroll generated!'); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed'));
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1>Salary Report</h1>
        <button onClick={runPayroll}
          style={{ padding: '0.7rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          ⚙️ Run Payroll
        </button>
      </div>

      {msg && <p style={{ color: msg.startsWith('✅') ? 'green' : 'red', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}>
          {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', width: '90px' }} />
      </div>

      <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Total Disbursed</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{total.toLocaleString()}</div>
        </div>
        <div style={{ opacity: 0.9, alignSelf: 'center' }}>{report.length} Employees</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
        <thead><tr style={{ background: '#f5f7fa' }}>
          {['Employee','Designation','Working Days','Present','LOP','Net Salary','Status',''].map(h => (
            <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {report.map((r) => (
            <tr key={r._id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.85rem 1rem' }}>{r.employee?.firstName} {r.employee?.lastName}</td>
              <td style={{ padding: '0.85rem 1rem', color: '#777', fontSize: '0.9rem' }}>{r.employee?.designation}</td>
              <td style={{ padding: '0.85rem 1rem' }}>{r.workingDays}</td>
              <td style={{ padding: '0.85rem 1rem' }}>{r.daysPresent}</td>
              <td style={{ padding: '0.85rem 1rem', color: r.lopDays > 0 ? '#ef4444' : '#333' }}>{r.lopDays}</td>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>₹{r.netSalary.toLocaleString()}</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                  background: r.status === 'Paid' ? '#dcfce7' : '#fef9c3',
                  color: r.status === 'Paid' ? '#166534' : '#854d0e' }}>
                  {r.status}
                </span>
              </td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {r.status === 'Generated' && (
                  <button onClick={() => markAsPaid(r._id).then(load)}
                    style={{ padding: '0.3rem 0.9rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Mark Paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalaryReport;
```

> 📝 **Code Breakdown:**
> - `useEffect(() => { load(); }, [month, year])` — automatically re-fetches the salary report data whenever the user changes the month dropdown or types a new year
> - `[...Array(12)].map((_, i) => ...)` — a quick JS hack to generate an array of numbers `[0, 1, 2... 11]`. We use this to stamp out the 12 `<option>` elements for the month dropdown
> - `new Date(0, i).toLocaleString('default', { month: 'long' })` — an elegant trick to get localized month names ("January", "February") natively from JS without hardcoding an array of strings
> - `r.status === 'Generated' && (<button onClick...>)` — conditional rendering. The "Mark Paid" button ONLY physically exists on the screen if the payroll hasn't been paid yet

---

## ⚠️ Edge Cases & Gotchas

### 1. Working days = 0 → divide by zero
```javascript
if (workingDays === 0) return { ...defaults, netSalary: 0 };
```

### 2. Net salary never negative
```javascript
const netSalary = Math.max(0, grossSalary - pfDeduction - lopDeduction);
```

### 3. Always `Math.round` money values
Floating point: `12345 / 22 * 20 = 11222.727...` — always round before storing.

### 4. Upsert makes re-runs safe
Using `upsert: true` means re-running payroll for the same month overwrites rather than duplicates.

### 5. Print CSS for payslip
```css
@media print {
  button { display: none !important; }
  body   { background: white; }
}
```

---

## ✅ Phase 6 Checklist
- [ ] `models/Payroll.js` with compound unique index
- [ ] `utils/payrollCalculator.js` — working days + salary formula
- [ ] `controllers/payrollController.js` — generate, bulk, payslip, report, mark paid
- [ ] `routes/payrollRoutes.js` registered in `app.js`
- [ ] Bulk payroll tested in Postman
- [ ] `services/payrollService.js` created
- [ ] `pages/Payslip.jsx` — printable payslip
- [ ] `pages/SalaryReport.jsx` — payroll officer dashboard
- [ ] Print CSS added to `index.css`

---

## 🔗 What's Next?
**Phase 7** — Dashboards with role-specific analytics using Recharts.
