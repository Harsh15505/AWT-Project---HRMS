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
