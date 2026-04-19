const mongoose = require('mongoose');
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
        employee: new mongoose.Types.ObjectId(employeeId),
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
