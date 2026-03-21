# Phase 10 — Final Delivery

## 🎯 What You'll Do
- Write a clean **README.md** with setup instructions
- Build a **seed script** to populate demo data for all roles
- **Clean up** debug code, console logs, and dead code
- Do a final **Git push** with a tidy commit history
- Do a final **self-review** of role-based access

---

## 📚 Theory

### Why a Seed Script?
When someone clones your project, they need data to see it working immediately. A seed script creates realistic demo data (employees, attendance records, leaves, payroll) in one command:

```bash
node backend/scripts/seed.js
```

### Why Clean Up Console Logs?
`console.log` statements left in production:
- Expose internal data to anyone looking at server logs
- Slow down the server slightly
- Look unprofessional

Replace debug logs with a proper logger (like `morgan` for HTTP, or a custom logger) or remove them entirely.

### Git Branching Convention (for reference)
Even as a solo developer, good branch hygiene is a good habit:
```
main        ← production-ready code only
dev         ← integration branch
feature/auth, feature/payroll, etc.
```

For this project, committing directly to `main` is fine.

---

## 🔧 Implementation

### Step 1 — The Master Seed Script

📁 `backend/scripts/seed.js`
```javascript
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: '../.env' });

// Import models
const User          = require('../models/User');
const Department    = require('../models/Department');
const Employee      = require('../models/Employee');
const Attendance    = require('../models/Attendance');
const Leave         = require('../models/Leave');
const LeaveBalance  = require('../models/LeaveBalance');
const Payroll       = require('../models/Payroll');
const SystemSetting = require('../models/SystemSetting');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected to MongoDB');

  // ─── Clear existing data ────────────────────────────────────
  console.log('🧹 Clearing existing data...');
  await Promise.all([
    User.deleteMany({}), Department.deleteMany({}), Employee.deleteMany({}),
    Attendance.deleteMany({}), Leave.deleteMany({}), LeaveBalance.deleteMany({}),
    Payroll.deleteMany({}),
  ]);

  // ─── System Settings ────────────────────────────────────────
  await SystemSetting.insertMany([
    { key: 'company_name',       value: 'HRMS Corporation',  label: 'Company Name' },
    { key: 'casual_leave_quota', value: 12,                  label: 'Casual Leave Quota' },
    { key: 'sick_leave_quota',   value: 10,                  label: 'Sick Leave Quota' },
    { key: 'annual_leave_quota', value: 15,                  label: 'Annual Leave Quota' },
    { key: 'pf_percentage',      value: 12,                  label: 'PF %' },
  ]);
  console.log('⚙️  System settings seeded');

  // ─── Departments ────────────────────────────────────────────
  const [engDept, hrDept, finDept] = await Department.insertMany([
    { name: 'Engineering',  code: 'ENG', description: 'Software development' },
    { name: 'Human Resources', code: 'HR',  description: 'People & culture' },
    { name: 'Finance',      code: 'FIN', description: 'Accounts & payroll' },
  ]);
  console.log('🏢 Departments seeded');

  // ─── Users ──────────────────────────────────────────────────
  const [adminUser, hrUser, payUser, emp1User, emp2User] = await User.insertMany([
    { name: 'Super Admin',    email: 'admin@hrms.com',   password: 'admin123',   role: 'Admin' },
    { name: 'Priya HR',       email: 'priya@hrms.com',   password: 'priya123',   role: 'HR Officer' },
    { name: 'Raj Payroll',    email: 'raj@hrms.com',     password: 'raj123',     role: 'Payroll Officer' },
    { name: 'Alice Engineer', email: 'alice@hrms.com',   password: 'alice123',   role: 'Employee' },
    { name: 'Bob Engineer',   email: 'bob@hrms.com',     password: 'bob123',     role: 'Employee' },
  ]);
  console.log('👤 Users seeded (passwords are hashed)');

  // ─── Employees ──────────────────────────────────────────────
  const [emp1, emp2, emp3] = await Employee.insertMany([
    {
      employeeId: 'EMP001', user: emp1User._id,
      firstName: 'Alice', lastName: 'Johnson',
      gender: 'Female', phone: '9876543210',
      department: engDept._id, designation: 'Software Engineer',
      employmentType: 'Full-Time', baseSalary: 75000,
      dateOfJoining: new Date('2024-01-15'),
    },
    {
      employeeId: 'EMP002', user: emp2User._id,
      firstName: 'Bob', lastName: 'Smith',
      gender: 'Male', phone: '9876543211',
      department: engDept._id, designation: 'Senior Developer',
      employmentType: 'Full-Time', baseSalary: 95000,
      dateOfJoining: new Date('2023-07-01'),
    },
    {
      employeeId: 'EMP003', user: hrUser._id,
      firstName: 'Priya', lastName: 'Sharma',
      gender: 'Female', phone: '9876543212',
      department: hrDept._id, designation: 'HR Manager',
      employmentType: 'Full-Time', baseSalary: 80000,
      dateOfJoining: new Date('2022-03-10'),
    },
  ]);
  console.log('👥 Employees seeded');

  // ─── Attendance for current month ───────────────────────────
  const now        = new Date();
  const month      = now.getMonth() + 1;
  const year       = now.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today      = now.getDate();

  const attendanceRecords = [];
  const STATUSES = ['Present', 'Present', 'Present', 'Present', 'Absent', 'Late'];

  for (const emp of [emp1, emp2, emp3]) {
    for (let d = 1; d < today; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      const day  = date.getDay(); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) continue; // Skip weekends

      attendanceRecords.push({
        employee: emp._id,
        date, month, year,
        status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        markedBy: adminUser._id,
      });
    }
  }
  await Attendance.insertMany(attendanceRecords);
  console.log(`📅 Attendance seeded: ${attendanceRecords.length} records`);

  // ─── Leave Balances ─────────────────────────────────────────
  await LeaveBalance.insertMany([emp1, emp2, emp3].map(emp => ({
    employee: emp._id, year,
    casual:  { allocated: 12, used: 2 },
    sick:    { allocated: 10, used: 1 },
    annual:  { allocated: 15, used: 0 },
  })));
  console.log('🌴 Leave balances seeded');

  // ─── Some Leave Applications ─────────────────────────────────
  await Leave.insertMany([
    {
      employee: emp1._id, leaveType: 'Casual',
      fromDate: new Date(year, month - 1, 3),
      toDate:   new Date(year, month - 1, 4),
      numberOfDays: 2, reason: 'Personal work',
      status: 'Approved', approvedBy: hrUser._id,
    },
    {
      employee: emp2._id, leaveType: 'Sick',
      fromDate: new Date(year, month - 1, 5),
      toDate:   new Date(year, month - 1, 5),
      numberOfDays: 1, reason: 'Fever',
      status: 'Approved', approvedBy: hrUser._id,
    },
    {
      employee: emp3._id, leaveType: 'Casual',
      fromDate: new Date(year, month + 1, 10),
      toDate:   new Date(year, month + 1, 12),
      numberOfDays: 3, reason: 'Family event',
      status: 'Pending',
    },
  ]);
  console.log('📋 Leave applications seeded');

  console.log('\n✅ Seed complete! Login credentials:');
  console.log('   Admin:           admin@hrms.com   / admin123');
  console.log('   HR Officer:      priya@hrms.com   / priya123');
  console.log('   Payroll Officer: raj@hrms.com     / raj123');
  console.log('   Employee 1:      alice@hrms.com   / alice123');
  console.log('   Employee 2:      bob@hrms.com     / bob123');

  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
```

> 📝 **Code Breakdown:**
> - `await Promise.all([ User.deleteMany({}), ... ])` — immediately wipes the database clean. We do this concurrently to save time. It ensures that running `node seed.js` multiple times doesn't endlessly stack up duplicate dummy data
> - `const [adminUser, hrUser, ...] = await User.insertMany(...)` — bulk creating users and simultaneously destructuring the returned array so we can cleanly grab their autogenerated `_id`s for use in the next step
> - `employeeId: 'EMP001', user: emp1User._id, ...` — here we link the `Employee` profile to the `User` account via the `_id` we just harvested. We also link them to the newly created `Department` IDs
> - `new Date(Date.UTC(year, month - 1, d))` — forcefully treating the loop counter as UTC time ensures we don't accidentally skip or duplicate days when seeding data depending on the local timezone of the developer running the script
> - `Math.floor(Math.random() * STATUSES.length)` — randomly picks 'Present', 'Absent', or 'Late' to give the attendance dashboard charts some realistic variance

---

### Step 2 — Clean Up

#### Backend
```bash
# Search for console.log statements (review and remove debug ones)
grep -r "console.log" backend/controllers
grep -r "console.log" backend/routes
```

Keep:
- `console.error` in error handlers (intentional logging)
- `console.log` in `connectDB` (server startup is fine)

Remove:
- `console.log(req.body)` or `console.log(result)` debug statements

#### Frontend
```bash
# Search for debug logs
grep -r "console.log" frontend/src
```

Remove all `console.log` calls before final submission.

---

### Step 3 — Write README.md

📁 `README.md` (in root of project)
```markdown
# HRMS — Human Resource Management System

A full-stack web application for managing employees, attendance, leaves, and payroll.

## Tech Stack
- **Frontend**: React.js + Vite, Recharts
- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Auth**: JWT + bcryptjs

## Roles
| Role | Access |
|---|---|
| Admin | Full system access |
| HR Officer | Employees, Attendance, Leaves |
| Payroll Officer | Payroll & Reports |
| Employee | Own data only |

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/hrms-project.git
cd hrms-project
```

2. Set up the backend:
```bash
cd backend
npm install
cp .env.example .env  # Then fill in your values
```

3. Set up the frontend:
```bash
cd ../frontend
npm install
```

4. Seed the database:
```bash
cd ../backend
node scripts/seed.js
```

### Running the App

Backend (in one terminal):
```bash
cd backend
npm run dev
```

Frontend (in another terminal):
```bash
cd frontend
npm run dev
```

Open browser at: http://localhost:5173

### Demo Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@hrms.com | admin123 |
| HR Officer | priya@hrms.com | priya123 |
| Payroll Officer | raj@hrms.com | raj123 |
| Employee | alice@hrms.com | alice123 |

## Project Structure
```
HRMS PROJECT/
├── backend/
│   ├── config/          # MongoDB connection
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Auth & validation
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── scripts/         # Seed & utility scripts
│   ├── utils/           # Helpers (JWT, payroll calc)
│   ├── app.js
│   └── server.js
└── frontend/
    └── src/
        ├── components/  # Reusable UI pieces
        ├── context/     # Auth context
        ├── hooks/       # Custom React hooks
        ├── pages/       # Route-level components
        └── services/    # API call functions
```
```

---

### Step 4 — Create .env.example

📁 `backend/.env.example`
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/hrmsdb
JWT_SECRET=replace_this_with_a_strong_secret_key
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

### Step 5 — Final Git Push

```bash
# From root directory
git add .
git commit -m "feat: complete HRMS project - all 10 phases"
git push origin main
```

Or use structured commits:
```bash
git add backend/
git commit -m "feat(backend): add complete HRMS API with auth, employees, attendance, leave, payroll, admin"

git add frontend/
git commit -m "feat(frontend): add React HRMS with role-specific dashboards and all pages"

git add README.md
git commit -m "docs: add setup instructions and demo credentials"

git push origin main
```

---

### Step 6 — Final Self-Review Checklist

Go through every role one more time end-to-end:

#### As Admin:
- [ ] Log in → redirect to Admin Dashboard ✅
- [ ] View all employees ✅
- [ ] Create a new department ✅
- [ ] Change a user's role ✅
- [ ] Deactivate a user ✅
- [ ] Update system settings ✅

#### As HR Officer:
- [ ] Log in → redirect to HR Dashboard ✅
- [ ] Mark attendance for today ✅
- [ ] View attendance calendar for an employee ✅
- [ ] Approve a pending leave ✅
- [ ] View leave management panel ✅

#### As Payroll Officer:
- [ ] Log in → redirect to Payroll Dashboard ✅
- [ ] Run bulk payroll for current month ✅
- [ ] View salary report ✅
- [ ] Mark a payroll as Paid ✅

#### As Employee:
- [ ] Log in → redirect to Employee Dashboard ✅
- [ ] View own profile and attendance calendar ✅
- [ ] Apply for leave → Pending status ✅
- [ ] View leave balance ✅
- [ ] View own payslip ✅
- [ ] Cannot access `/hr` or `/admin` routes ✅

---

## ⚠️ Final Gotchas

### 1. .env is never committed
Verify your `.gitignore` has these:
```
backend/.env
frontend/.env
node_modules/
```
Run `git status` and make sure no `.env` files appear.

### 2. Check for hardcoded localhost URLs
Search for any hardcoded `http://localhost:5000` or `http://localhost:5173` in your code. Replace with environment variables or relative paths.

### 3. MongoDB Atlas for deployment
If you want to host this online, create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com) and update `MONGO_URI` in your deployment environment.

### 4. CORS in production
If you deploy frontend and backend separately, update the CORS origin in `app.js`:
```javascript
cors({ origin: process.env.FRONTEND_URL, credentials: true })
```

---

## ✅ Phase 10 Checklist
- [ ] `scripts/seed.js` runs without errors
- [ ] All demo login credentials work
- [ ] `README.md` written with setup steps and credentials
- [ ] `.env.example` committed (without real values)
- [ ] No `console.log` debug statements remaining in controllers
- [ ] No hardcoded localhost URLs in frontend
- [ ] Self-review checklist completed for all 4 roles
- [ ] Final `git add . && git commit && git push` done

---

## 🎉 Congratulations!

You've built a complete, production-quality HRMS from scratch covering:
- ✅ JWT Authentication & Role-Based Access Control
- ✅ Employee Profile Management
- ✅ Daily Attendance Tracking with Calendar UI
- ✅ Leave Application & Approval Workflow
- ✅ Payroll Calculation & Printable Payslips
- ✅ Role-Specific Dashboards & Recharts Analytics
- ✅ Admin Controls & System Settings
- ✅ Security: Rate Limiting, Input Validation, XSS/NoSQL Prevention
