const express = require('express');
const router  = express.Router();
const { getAdminStats, getHRStats, getPayrollStats, getEmployeeStats } = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/admin',    authorizeRoles('Admin'), getAdminStats);
router.get('/hr',       authorizeRoles('Admin', 'HR Officer'), getHRStats);
router.get('/payroll',  authorizeRoles('Admin', 'Payroll Officer'), getPayrollStats);
router.get('/employee', getEmployeeStats);

module.exports = router;
