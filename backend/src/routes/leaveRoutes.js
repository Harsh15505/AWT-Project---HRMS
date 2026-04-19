const express = require('express');
const router  = express.Router();
const {
  applyLeave, updateLeaveStatus, getMyLeaves,
  getAllLeaves, getLeaveBalance, cancelLeave,
} = require('../controllers/leaveController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { leaveRules, validate } = require('../middleware/validators');

router.use(protect);

router.get('/my',                    getMyLeaves);
router.post('/',                     leaveRules, validate, applyLeave);
router.put('/:id/cancel',            cancelLeave);
router.put('/:id/status',            authorizeRoles('Admin', 'HR Officer'), updateLeaveStatus);
router.get('/',                      authorizeRoles('Admin', 'HR Officer'), getAllLeaves);
router.get('/balance/:employeeId',   getLeaveBalance);

module.exports = router;
