const Employee   = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Payroll    = require('../models/Payroll');
const User       = require('../models/User');
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
