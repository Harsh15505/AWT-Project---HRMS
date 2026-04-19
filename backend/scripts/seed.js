const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

// Import models using correct src/ path
const User          = require('../src/models/User');
const Department    = require('../src/models/Department');
const Employee      = require('../src/models/Employee');
const Attendance    = require('../src/models/Attendance');
const Leave         = require('../src/models/Leave');
const LeaveBalance  = require('../src/models/LeaveBalance');
const Payroll       = require('../src/models/Payroll');
const SystemSetting = require('../src/models/SystemSetting');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected to MongoDB');

  // ─── Clear existing data ────────────────────────────────────
  console.log('🧹 Clearing existing data...');
  await Promise.all([
    User.deleteMany({}), Department.deleteMany({}), Employee.deleteMany({}),
    Attendance.deleteMany({}), Leave.deleteMany({}), LeaveBalance.deleteMany({}),
    Payroll.deleteMany({}), SystemSetting.deleteMany({}),
  ]);

  // ─── System Settings ────────────────────────────────────────
  await SystemSetting.insertMany([
    { key: 'company_name',       value: 'HRMS Corporation',  label: 'Company Name' },
    { key: 'casual_leave_quota', value: 12,                  label: 'Casual Leave Quota / Year' },
    { key: 'sick_leave_quota',   value: 10,                  label: 'Sick Leave Quota / Year' },
    { key: 'annual_leave_quota', value: 15,                  label: 'Annual Leave Quota / Year' },
    { key: 'working_days_week',  value: 5,                   label: 'Working Days per Week' },
    { key: 'pf_percentage',      value: 12,                  label: 'PF Deduction %' },
  ]);
  console.log('⚙️  System settings seeded');

  // ─── Departments ────────────────────────────────────────────
  const [engDept, hrDept, finDept] = await Department.insertMany([
    { name: 'Engineering',     code: 'ENG', description: 'Software development' },
    { name: 'Human Resources', code: 'HR',  description: 'People & culture' },
    { name: 'Finance',         code: 'FIN', description: 'Accounts & payroll' },
  ]);
  console.log('🏢 Departments seeded');

  // ─── Users ──────────────────────────────────────────────────
  // NOTE: insertMany does NOT trigger pre-save hooks (bcrypt). Create individually.
  const usersData = [
    { name: 'Super Admin',    email: 'admin@hrms.com', password: 'admin123',  role: 'Admin'           },
    { name: 'Priya HR',       email: 'priya@hrms.com', password: 'priya123',  role: 'HR Officer'      },
    { name: 'Raj Payroll',    email: 'raj@hrms.com',   password: 'raj123',    role: 'Payroll Officer' },
    { name: 'Alice Engineer', email: 'alice@hrms.com', password: 'alice123',  role: 'Employee'        },
    { name: 'Bob Engineer',   email: 'bob@hrms.com',   password: 'bob123',    role: 'Employee'        },
  ];
  const createdUsers = [];
  for (const u of usersData) {
    const user = new User(u);
    await user.save(); // triggers bcrypt pre-save hook
    createdUsers.push(user);
  }
  const [adminUser, hrUser, payUser, emp1User, emp2User] = createdUsers;
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
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const today = now.getDate();

  const attendanceRecords = [];
  const STATUSES = ['Present', 'Present', 'Present', 'Present', 'Absent', 'Late'];

  for (const emp of [emp1, emp2, emp3]) {
    for (let d = 1; d < today; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      const day  = date.getDay();
      if (day === 0 || day === 6) continue;

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

  // ─── Leave Applications ──────────────────────────────────────
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
