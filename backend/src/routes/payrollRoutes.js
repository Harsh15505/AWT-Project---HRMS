const express = require('express');
const router  = express.Router();
const {
  generatePayrollForEmployee, generateBulkPayroll,
  getPayslip, getSalaryReport, markAsPaid,
} = require('../controllers/payrollController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { generatePayrollRules, bulkPayrollRules, validate } = require('../middleware/validators');

router.use(protect);

router.post('/generate',       authorizeRoles('Admin', 'Payroll Officer'), generatePayrollRules, validate, generatePayrollForEmployee);
router.post('/generate/bulk',  authorizeRoles('Admin', 'Payroll Officer'), bulkPayrollRules, validate, generateBulkPayroll);
router.get('/report',          authorizeRoles('Admin', 'Payroll Officer'), getSalaryReport);
router.get('/payslip/:employeeId', getPayslip);
router.put('/:id/paid',        authorizeRoles('Admin'), markAsPaid);

module.exports = router;
