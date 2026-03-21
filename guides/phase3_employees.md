# Phase 3 — Employee Profile Management

## 🎯 What You'll Build in This Phase
- **Department** schema and CRUD
- **Employee** profile schema linked to a User account
- API endpoints: create, read, update, deactivate employees
- React **Employee List** page with search and filter
- React **Add Employee** form (HR / Admin)
- React **Employee Detail** and **Edit** page

---

## 📚 Theory

### Relationships in MongoDB (References vs Embedding)
Unlike SQL (which uses foreign keys), MongoDB can model relationships in two ways:

#### 1. Embedding (denormalization)
Store related data directly inside the document:
```json
{
  "name": "Alice",
  "address": { "city": "Mumbai", "pin": "400001" }
}
```
✅ Fast reads — everything is in one document  
❌ Duplication — if address changes, every document with it must be updated

#### 2. Referencing (normalization)
Store only the ID of the related document:
```json
{ "name": "Alice", "department": "64abc123..." }
```
✅ Clean and normalized — no duplication  
❌ Requires an extra query (or `populate`) to get the full data

For the HRMS, we use **referencing** for departments and users (because they're separate entities) and **embedding** for simple sub-documents like emergency contacts.

### What is `populate()`?
Mongoose's `.populate()` replaces a reference ID with the actual document it points to:

```javascript
// Without populate: { employee: "64abc...", department: "64xyz..." }
// With populate:    { employee: { name: "Alice", ... }, department: { name: "Engineering" } }

const employee = await Employee.findById(id)
  .populate('department', 'name code')  // only return name and code fields
  .populate('user', 'email role');
```

### What is a "Soft Delete"?
Instead of permanently deleting an employee record (which would break attendance and payroll history), you set `isActive: false`. The data is still there, but filtered out of normal views. This is called a **soft delete**.

---

## 🗂️ Files You'll Create

```
backend/
├── models/
│   ├── Department.js
│   └── Employee.js
├── controllers/
│   ├── departmentController.js
│   └── employeeController.js
├── routes/
│   ├── departmentRoutes.js
│   └── employeeRoutes.js

frontend/src/
├── pages/
│   ├── EmployeeList.jsx
│   ├── EmployeeDetail.jsx
│   └── AddEmployee.jsx
├── services/
│   └── employeeService.js
```

---

## 🔧 Step-by-Step Implementation

### Step 1 — Department Model

📁 `backend/models/Department.js`
```javascript
const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true, // e.g., "ENG", "HR", "FIN"
    },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
```

---

### Step 2 — Employee Model

📁 `backend/models/Employee.js`
```javascript
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    // Unique employee ID like "EMP001"
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Linked User account (for login)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true, // Allows null (some employees may not have a login yet)
    },

    // Personal Info
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    gender:      { type: String, enum: ['Male', 'Female', 'Other'] },
    dateOfBirth: { type: Date },
    phone:       { type: String, trim: true },
    address:     { type: String, trim: true },

    // Professional Info
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    designation: { type: String, required: true, trim: true }, // e.g., "Software Engineer"
    dateOfJoining: { type: Date, default: Date.now },
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
      default: 'Full-Time',
    },

    // Salary (base, used by payroll)
    baseSalary: { type: Number, required: true, min: 0 },

    // Status
    isActive: { type: Boolean, default: true },

    // Emergency contact (embedded — doesn't need its own collection)
    emergencyContact: {
      name:         { type: String },
      relationship: { type: String },
      phone:        { type: String },
    },
  },
  {
    timestamps: true,
    // Virtual field: combines firstName + lastName
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: fullName (not stored in DB, computed on the fly)
employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Auto-increment-style ID generation helper (simple version)
employeeSchema.statics.generateEmployeeId = async function () {
  const last = await this.findOne().sort({ createdAt: -1 }).select('employeeId');
  if (!last) return 'EMP001';
  const num = parseInt(last.employeeId.replace('EMP', ''), 10) + 1;
  return `EMP${String(num).padStart(3, '0')}`;
};

module.exports = mongoose.model('Employee', employeeSchema);
```

> 📝 **Code Breakdown:**
> - `type: mongoose.Schema.Types.ObjectId, ref: 'User'` — links this employee to a document in the `users` collection. This is how MongoDB implements relationships
> - `sparse: true` — tells MongoDB's unique index to ignore documents where `user` is null. Without this, you couldn't have two employees without user accounts (MongoDB complains about duplicate nulls)
> - `enum: [...]` — validation: only allows these exact string values to be saved
> - `emergencyContact: { ... }` — an embedded sub-document. It doesn't need its own separate collection because an emergency contact only matters within the context of an employee
> - `toJSON: { virtuals: true }` — forces Mongoose to include virtual fields when converting the document to JSON (e.g., when sending it via `res.json()`)
> - `employeeSchema.virtual('fullName')` — defines a field that is computed on-the-fly when requested, but never actually saved in the database. Saves storage space
> - `employeeSchema.statics.generateEmployeeId` — defines a static helper function on the model. It finds the highest existing ID, strips "EMP", adds 1, and pads it with zeroes

---

### Step 3 — Validation Rules (Employee & Department)

Add validation chains to `validators.js`:

📁 `backend/middleware/validators.js` (append these lines)
```javascript
const departmentRules = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').trim().notEmpty().withMessage('Department code is required'),
];

const employeeRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('department').isMongoId().withMessage('Valid Department ID is required'),
  body('baseSalary').isNumeric().withMessage('Base salary must be a number'),
];

// Don't forget to export them!
// module.exports = { ..., departmentRules, employeeRules };
```

---

### Step 4 — Department Controller

📁 `backend/controllers/departmentController.js`
```javascript
const Department = require('../models/Department');
const { asyncHandler } = require('../middleware/errorMiddleware');

const getAllDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, departments });
});

const createDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  res.status(201).json({ success: true, department: dept });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!dept) {
    res.status(404);
    throw new Error('Department not found');
  }
  res.json({ success: true, department: dept });
});

module.exports = { getAllDepartments, createDepartment, updateDepartment };
```

---

### Step 4 — Employee Controller

📁 `backend/controllers/employeeController.js`
```javascript
const Employee   = require('../models/Employee');
const User       = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');

// ─── Get All Employees ─────────────────────────────────────────
// @route GET /api/employees
const getAllEmployees = asyncHandler(async (req, res) => {
  const { department, isActive, search } = req.query;
  const filter = {};

  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (department) filter.department = department;
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName:  { $regex: search, $options: 'i' } },
      { employeeId:{ $regex: search, $options: 'i' } },
    ];
  }

  const employees = await Employee.find(filter)
    .populate('department', 'name code')
    .populate('user', 'email role')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: employees.length, employees });
});

// ─── Get Single Employee ───────────────────────────────────────
// @route GET /api/employees/:id
const getEmployee = asyncHandler(async (req, res) => {
  // Employees can only view their own profile
  if (req.user.role === 'Employee') {
    const emp = await Employee.findOne({ user: req.user.userId });
    if (!emp || emp._id.toString() !== req.params.id) {
      res.status(403);
      throw new Error('Access denied');
    }
  }

  const employee = await Employee.findById(req.params.id)
    .populate('department', 'name code')
    .populate('user', 'email role isActive');

  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }

  res.json({ success: true, employee });
});

// ─── Create Employee ───────────────────────────────────────────
// @route POST /api/employees
const createEmployee = asyncHandler(async (req, res) => {
  const {
    firstName, lastName, gender, dateOfBirth, phone, address,
    department, designation, employmentType, baseSalary,
    dateOfJoining, emergencyContact,
    // User account details (optional)
    createUserAccount, email, password, role,
  } = req.body;

  const employeeId = await Employee.generateEmployeeId();

  let userId = null;

  // Optionally create a User account at the same time
  if (createUserAccount && email && password) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400);
      throw new Error('A user with this email already exists');
    }
    const newUser = await User.create({
      name: `${firstName} ${lastName}`,
      email, password,
      role: role || 'Employee',
    });
    userId = newUser._id;
  }

  const employee = await Employee.create({
    employeeId, user: userId,
    firstName, lastName, gender, dateOfBirth, phone, address,
    department, designation, employmentType, baseSalary,
    dateOfJoining, emergencyContact,
  });

  const populated = await Employee.findById(employee._id)
    .populate('department', 'name code')
    .populate('user', 'email role');

  res.status(201).json({ success: true, employee: populated });
});

// ─── Update Employee ───────────────────────────────────────────
// @route PUT /api/employees/:id
const updateEmployee = asyncHandler(async (req, res) => {
  // Prevent changing employeeId and user reference via this endpoint
  const { employeeId, user, ...updates } = req.body;

  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).populate('department', 'name code');

  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }

  res.json({ success: true, employee });
});

// ─── Soft Delete Employee ──────────────────────────────────────
// @route DELETE /api/employees/:id
const deactivateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }

  // Also deactivate their user account
  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: false });
  }

  res.json({ success: true, message: 'Employee deactivated successfully' });
});

// ─── Get My Profile (Employee logs in and views own details) ──
// @route GET /api/employees/me
const getMyProfile = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user.userId })
    .populate('department', 'name code')
    .populate('user', 'email role');

  if (!employee) {
    res.status(404);
    throw new Error('Profile not found');
  }

  res.json({ success: true, employee });
});

module.exports = { getAllEmployees, getEmployee, createEmployee, updateEmployee, deactivateEmployee, getMyProfile };
```

> 📝 **Code Breakdown:**
> - `const { department, isActive, search } = req.query` — extracts query parameters from the URL (e.g., `/api/employees?isActive=true&search=Alice`)
> - `filter.$or = [...]` — a MongoDB query operator that says "Find documents where AT LEAST ONE of these conditions is true"
> - `{ $regex: search, $options: 'i' }` — performs a partial text match ("contains"), and `i` makes it case-insensitive
> - `.populate('department', 'name code')` — tells Mongoose to take the `department` ObjectId, fetch the actual department document, and inject its `name` and `code` fields right into the results
> - `if (req.user.role === 'Employee') { ... }` — role-based security check. If a regular employee tries to view profile 'B' while logged in as 'A', we block them with a 403 Forbidden
> - `{ new: true, runValidators: true }` — options passed to `findByIdAndUpdate`. `new: true` returns the updated document instead of the old one. `runValidators: true` ensures the update respects the schema rules

---

### Step 6 — Employee & Department Routes

📁 `backend/routes/departmentRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const { getAllDepartments, createDepartment, updateDepartment } = require('../controllers/departmentController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { departmentRules, validate } = require('../middleware/validators');

router.use(protect);
router.get('/',     getAllDepartments);
router.post('/',    authorizeRoles('Admin'), departmentRules, validate, createDepartment);
router.put('/:id',  authorizeRoles('Admin'), departmentRules, validate, updateDepartment);

module.exports = router;
```

📁 `backend/routes/employeeRoutes.js`
```javascript
const express = require('express');
const router  = express.Router();
const {
  getAllEmployees, getEmployee, createEmployee,
  updateEmployee, deactivateEmployee, getMyProfile,
} = require('../controllers/employeeController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { employeeRules, validate } = require('../middleware/validators');

router.use(protect);

router.get('/me', getMyProfile); // Must be before /:id

router.get('/',     authorizeRoles('Admin', 'HR Officer', 'Payroll Officer'), getAllEmployees);
router.post('/',    authorizeRoles('Admin', 'HR Officer'), employeeRules, validate, createEmployee);
router.get('/:id',  getEmployee);
router.put('/:id',  authorizeRoles('Admin', 'HR Officer'), employeeRules, validate, updateEmployee);
router.delete('/:id', authorizeRoles('Admin'), deactivateEmployee);

module.exports = router;
```

Register in `app.js`:
```javascript
const employeeRoutes   = require('./routes/employeeRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
app.use('/api/employees',   employeeRoutes);
app.use('/api/departments', departmentRoutes);
```

---

### Step 7 — Frontend Service

📁 `frontend/src/services/employeeService.js`
```javascript
import API from './api';

export const getAllEmployees = (params) => API.get('/employees', { params });
export const getEmployee    = (id)     => API.get(`/employees/${id}`);
export const getMyProfile   = ()       => API.get('/employees/me');
export const createEmployee = (data)   => API.post('/employees', data);
export const updateEmployee = (id, data) => API.put(`/employees/${id}`, data);
export const deactivateEmployee = (id) => API.delete(`/employees/${id}`);
export const getDepartments = ()       => API.get('/departments');
```

---

### Step 8 — Employee List Page

📁 `frontend/src/pages/EmployeeList.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { getAllEmployees } from '../services/employeeService';
import { useNavigate } from 'react-router-dom';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async (searchTerm = '') => {
    setLoading(true);
    try {
      const { data } = await getAllEmployees({ isActive: true, search: searchTerm });
      setEmployees(data.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    fetchEmployees(e.target.value);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Employees</h1>
        <button onClick={() => navigate('/hr/employees/new')}
          style={{ padding: '0.7rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          + Add Employee
        </button>
      </div>

      <input
        type="text" value={search} onChange={handleSearch}
        placeholder="Search by name or ID..."
        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1rem', fontSize: '1rem' }}
      />

      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#f5f7fa' }}>
              {['ID','Name','Department','Designation','Type','Action'].map(h => (
                <th key={h} style={{ padding: '1rem', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.85rem 1rem' }}>{emp.employeeId}</td>
                <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{emp.fullName}</td>
                <td style={{ padding: '0.85rem 1rem' }}>{emp.department?.name}</td>
                <td style={{ padding: '0.85rem 1rem' }}>{emp.designation}</td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                    {emp.employmentType}
                  </span>
                </td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <button onClick={() => navigate(`/employees/${emp._id}`)}
                    style={{ padding: '0.4rem 1rem', background: '#f0f4ff', border: '1px solid #667eea', color: '#667eea', borderRadius: '6px', cursor: 'pointer' }}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EmployeeList;
```

> 📝 **Code Breakdown:**
> - `const [employees, setEmployees] = useState([])` — holds the list of employees fetched from the backend
> - `useEffect(() => { fetchEmployees(); }, [])` — the empty dependency array `[]` means this function only runs once immediately after the component first mounts to the screen
> - `fetchEmployees(searchTerm)` — an async function that abstracts out the fetching logic. It sets `loading` to true, calls the backend, and then sets `loading` to false in the `finally` block (which runs regardless of success or failure)
> - `handleSearch(e)` — called on every keystroke in the search box. Updates the input box state AND triggers a fresh fetch with the new term
> - `employees.map((emp) => (...))` — the standard React loop idiom. It iterates over the array and renders a `<tr>` table row for each employee. Requires a unique `key` prop on the top-level element

---

### Step 9 — Add Employee Form

📁 `frontend/src/pages/AddEmployee.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { createEmployee } from '../services/employeeService';
import { getDepartments } from '../services/employeeService';
import { useNavigate } from 'react-router-dom';

const AddEmployee = () => {
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', gender: 'Male',
    phone: '', address: '', designation: '',
    department: '', baseSalary: '', employmentType: 'Full-Time',
    dateOfJoining: new Date().toISOString().split('T')[0],
    createUserAccount: false, email: '', password: '', role: 'Employee',
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getDepartments().then(({ data }) => setDepartments(data.departments));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await createEmployee(formData);
      navigate('/hr/employees');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, name, type='text', options=null) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</label>
      {options ? (
        <select name={name} value={formData[name]} onChange={handleChange} style={inputStyle}>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={formData[name]} onChange={handleChange} style={inputStyle} required />
      )}
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Add New Employee</h1>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {field('First Name', 'firstName')}
        {field('Last Name', 'lastName')}
        {field('Gender', 'gender', 'text', [{value:'Male',label:'Male'},{value:'Female',label:'Female'},{value:'Other',label:'Other'}])}
        {field('Phone', 'phone', 'tel')}
        {field('Designation', 'designation')}
        {field('Department', 'department', 'text', departments.map(d => ({ value: d._id, label: d.name })))}
        {field('Base Salary (₹)', 'baseSalary', 'number')}
        {field('Employment Type', 'employmentType', 'text', ['Full-Time','Part-Time','Contract','Intern'].map(v => ({value:v,label:v})))}
        {field('Date of Joining', 'dateOfJoining', 'date')}

        <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Address</label>
          <textarea name="address" value={formData.address} onChange={handleChange}
            rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Optional: Create Login Account */}
        <div style={{ gridColumn: '1/-1', marginTop: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" name="createUserAccount" checked={formData.createUserAccount} onChange={handleChange} />
            Create Login Account for this Employee
          </label>
        </div>

        {formData.createUserAccount && (
          <>
            {field('Email', 'email', 'email')}
            {field('Password', 'password', 'password')}
            {field('Role', 'role', 'text', ['Employee','HR Officer','Payroll Officer','Admin'].map(v => ({value:v,label:v})))}
          </>
        )}

        <div style={{ gridColumn: '1/-1', marginTop: '0.5rem' }}>
          <button type="submit" disabled={saving}
            style={{ padding: '0.85rem 2.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
            {saving ? 'Creating...' : 'Create Employee'}
          </button>
        </div>
      </form>
    </div>
  );
};

const inputStyle = {
  padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem',
};

export default AddEmployee;
```

> 📝 **Code Breakdown:**
> - `const [formData, setFormData] = useState({ ... })` — instead of a dozen separate state variables for each input, we hold everything in one central object
> - `const handleChange = (e) => { ... }` — a generic event handler. It uses `[e.target.name]: e.target.value` to dynamically update the correct piece of state regardless of which input triggered the event
> - `e.target.type === 'checkbox' ? checked : value` — standardizes input reading. Checkboxes use `.checked` (true/false) instead of the text `.value`
> - `await createEmployee(formData)` — passes the entire form object up to the API service
> - `navigate('/hr/employees')` — on success, programmatically bounces the user back to the list view using React Router
> - `const field = (...) => (...)` — a custom helper function to stamp out identical label/input HTML blocks, keeping the `return` statement clean and DRY (Don't Repeat Yourself)

---

## ⚠️ Edge Cases & Gotchas

### 1. `/me` route must come before `/:id`
Express matches routes top-to-bottom. If `/:id` is registered first, `/me` would be treated as an ID and fail:
```javascript
router.get('/me', getMyProfile); // ✅ First
router.get('/:id', getEmployee); // ✅ Second
```

### 2. `sparse: true` on the user field
An Employee might not have a user account yet. Without `sparse: true`, MongoDB would enforce uniqueness even on `null` values, and you couldn't create two employees without accounts. `sparse: true` ignores `null` values in the unique index.

### 3. Error code `11000` = Duplicate Key
When MongoDB throws a duplicate key error, the error code is `11000`. Always check for it and return a user-friendly message instead of the raw MongoDB error.

### 4. Virtuals need `toJSON: { virtuals: true }`
Mongoose virtuals (like `fullName`) are not included in the JSON output by default. You must enable them:
```javascript
{ toJSON: { virtuals: true }, toObject: { virtuals: true } }
```

### 5. Destructure request body carefully on update
```javascript
const { employeeId, user, ...updates } = req.body;
```
This ensures that protected fields (like the employee's ID code and linked user) can't be accidentally overwritten via a PUT request.

### 6. Search with `$regex` is case-insensitive with `$options: 'i'`
For production, consider a **text index** for better performance:
```javascript
employeeSchema.index({ firstName: 'text', lastName: 'text', employeeId: 'text' });
// Then query:
Employee.find({ $text: { $search: searchTerm } });
```

---

## ✅ Phase 3 Checklist
- [ ] `models/Department.js` created
- [ ] `models/Employee.js` created with virtual + static method
- [ ] Department and Employee controllers created
- [ ] Routes registered with correct role guards
- [ ] Routes added to `app.js`
- [ ] Tested: create employee with user account in Postman
- [ ] `services/employeeService.js` created
- [ ] `pages/EmployeeList.jsx` with search
- [ ] `pages/AddEmployee.jsx` with department dropdown
- [ ] Routes added to `App.jsx`

---

## 🔗 What's Next?
**Phase 4** — Attendance tracking: daily marking, calendar view, and monthly summaries using MongoDB Aggregation.
