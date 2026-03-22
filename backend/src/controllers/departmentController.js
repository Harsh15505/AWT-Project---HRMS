const Department = require('../models/Department');
const { asyncHandler } = require('../middleware/errorMiddleware');

const getAllDepartments = asyncHandler(async (req, res) => {
    const departments = await Department.find({ isActive: true }).sort({ name: 1 });
    res.json({
        success: true,
        departments
    });
});

const createDepartment = asyncHandler(async (req, res) => {
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, department: dept });
});

const updateDepartment = asyncHandler(async (req, res) => {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dept) {
        res.status(404);
        throw new Error('Department not found');
    }
    res.json({ success: true, department: dept });
});

module.exports = { getAllDepartments, createDepartment, updateDepartment };