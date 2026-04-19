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
