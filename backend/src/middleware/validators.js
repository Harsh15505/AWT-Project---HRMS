const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

const registerRules = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['Admin', 'HR Officer', 'Payroll Officer', 'Employee'])
];

const loginRules = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

const departmentRules = [
    body('name').trim().notEmpty().withMessage('Department name is required'),
    body('code').trim().notEmpty().withMessage('Department code is required'),
];

const employeeRules = [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('department').isMongoId().withMessage('Valid Department ID is required'),
    body('baseSalary').isNumeric().withMessage('Base salary must be a number'),
]

const attendanceRules = [
    body('employeeId').isMongoId().withMessage('Valid Employee ID is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('status').isIn(['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday']).withMessage('Invalid status'),
];

const leaveRules = [
    body('leaveType').isIn(['Casual', 'Sick', 'Annual', 'LOP']).withMessage('Invalid leave type'),
    body('fromDate').isISO8601().withMessage('Valid start date is required'),
    body('toDate').isISO8601().withMessage('Valid end date is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
];

const generatePayrollRules = [
    body('employeeId').isMongoId().withMessage('Valid Employee ID is required'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt({ min: 2000 }).withMessage('Valid year is required'),
];

const bulkPayrollRules = [
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt({ min: 2000 }).withMessage('Valid year is required'),
];

const updateUserRoleRules = [
    body('role').isIn(['Admin', 'HR Officer', 'Payroll Officer', 'Employee']).withMessage('Invalid role'),
];

const resetPasswordRules = [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const updateSettingsRules = [
    body('settings').isObject().withMessage('Settings must be an object'),
];

module.exports = {
    validate, registerRules, loginRules, departmentRules, employeeRules,
    attendanceRules, leaveRules, generatePayrollRules, bulkPayrollRules,
    updateUserRoleRules, resetPasswordRules, updateSettingsRules,
};
