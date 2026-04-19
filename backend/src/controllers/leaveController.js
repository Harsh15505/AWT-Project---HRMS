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
      { fromDate: { $lte: to }, toDate: { $gte: from } },
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
    await getOrCreateBalance(leave.employee, year);
    const typeKey = leave.leaveType.toLowerCase();

    await LeaveBalance.findOneAndUpdate(
      { employee: leave.employee, year },
      { $inc: { [`${typeKey}.used`]: leave.numberOfDays } }
    );
  }

  leave.status          = status;
  leave.approvedBy      = req.user.userId;
  leave.approverRemarks = approverRemarks || '';
  leave.approvedAt      = new Date();
  await leave.save();

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
