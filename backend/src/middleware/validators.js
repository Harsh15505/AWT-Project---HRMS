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

module.exports = { validate, registerRules, loginRules, departmentRules, employeeRules };