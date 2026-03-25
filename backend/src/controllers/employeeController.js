const Employee = require('../models/Employee');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');

// @route GET /api/employees
const getAllEmployees = asyncHandler(async (req, res) => {
    const { department, isActive, search } = req.query;
    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (department) filter.department = department;
    if (search) {
        filter.$or = [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { employeeId: { $regex: search, $options: 'i' } },
        ];
    }

    const employees = await Employee.find(filter)
        .populate('department', 'name code')
        .populate('user', 'email role')
        .sort({ createdAt: -1 });

    res.json({ success: true, count: employees.length, employees });
});

// @route GET /api/employees/:id
const getEmployee = asyncHandler(async (req, res) => {
    if (req.user.role === 'Employee') {
        const emp = await Employee.findOne({ user: req.user.userId });
        if (!emp || emp._id.toString() !== req.params.id) {
            res.status(403);
            throw new Error('Access denied');
        }
    }

    const employee = await Employee.findById(req.params.id)
        .populate('department', 'name code')
        .populate('user', 'email role isActive');

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    res.json({ success: true, employee });
});

// @route POST /api/employees
const createEmployee = asyncHandler(async (req, res) => {
    const {
        firstName, lastName, gender, dateOfBirth, phone, address,
        department, designation, employmentType, baseSalary,
        dateOfJoining, emergencyContact,
        createUserAccount, email, password, role,
    } = req.body;

    const employeeId = await Employee.generateEmployeeId();

    let userId = null;

    if (createUserAccount && email && password) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400);
            throw new Error('A user with this email already exists');
        }
        const newUser = await User.create({
            name: `${firstName} ${lastName}`,
            email, password,
            role: role || 'Employee',
        });
        userId = newUser._id;
    }

    const employee = await Employee.create({
        employeeId, user: userId,
        firstName, lastName, gender, dateOfBirth, phone, address,
        department, designation, employmentType, baseSalary,
        dateOfJoining, emergencyContact,
    });

    const populated = await Employee.findById(employee._id)
        .populate('department', 'name code')
        .populate('user', 'email role');

    res.status(201).json({ success: true, employee: populated });
});

// @route PUT /api/employees/:id
const updateEmployee = asyncHandler(async (req, res) => {
    const { employeeId, user, ...updates } = req.body;

    const employee = await Employee.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
    ).populate('department', 'name code');

    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    res.json({ success: true, employee });
});

// @route DELETE /api/employees/:id
const deactivateEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
    );
    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    if (employee.user) {
        await User.findByIdAndUpdate(employee.user, { isActive: false });
    }

    res.json({ success: true, message: 'Employee deactivated successfully' });
});

// @route GET /api/employees/me
const getMyProfile = asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({ user: req.user.userId })
        .populate('department', 'name code')
        .populate('user', 'email role');

    if (!employee) {
        res.status(404);
        throw new Error('Profile not found');
    }

    res.json({ success: true, employee });
});

module.exports = { getAllEmployees, getEmployee, createEmployee, updateEmployee, deactivateEmployee, getMyProfile };
