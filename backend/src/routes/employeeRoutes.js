const express = require('express');
const router = express.Router();
const {
    getAllEmployees, getEmployee, createEmployee,
    updateEmployee, deactivateEmployee, getMyProfile,
} = require('../controllers/employeeController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { employeeRules, validate } = require('../middleware/validators');

router.use(protect);

router.get('/me', getMyProfile); // Must be before /:id

router.get('/', authorizeRoles('Admin', 'HR Officer', 'Payroll Officer'), getAllEmployees);
router.post('/', authorizeRoles('Admin', 'HR Officer'), employeeRules, validate, createEmployee);
router.get('/:id', getEmployee);
router.put('/:id', authorizeRoles('Admin', 'HR Officer'), employeeRules, validate, updateEmployee);
router.delete('/:id', authorizeRoles('Admin'), deactivateEmployee);

module.exports = router;