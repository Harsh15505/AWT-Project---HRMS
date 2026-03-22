const express = require('express');
const router = express.Router();
const { getAllDepartments, createDepartment, updateDepartment } = require('../controllers/departmentController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { departmentRules, validate } = require('../middleware/validators');

router.use(protect);
router.get('/', getAllDepartments);
router.post('/', authorizeRoles('Admin'), departmentRules, validate, createDepartment);
router.put('/:id', authorizeRoles('Admin'), departmentRules, validate, updateDepartment);

module.exports = router;