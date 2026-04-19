const express = require('express');
const router  = express.Router();
const {
  getAllUsers, updateUserRole, toggleUserStatus,
  resetPassword, getSettings, updateSettings,
} = require('../controllers/adminController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { updateUserRoleRules, resetPasswordRules, updateSettingsRules, validate } = require('../middleware/validators');

// All admin routes require Admin role
router.use(protect, authorizeRoles('Admin'));

router.get('/users',                      getAllUsers);
router.put('/users/:id/role',             updateUserRoleRules, validate, updateUserRole);
router.put('/users/:id/toggle-status',    toggleUserStatus);
router.put('/users/:id/reset-password',   resetPasswordRules, validate, resetPassword);
router.get('/settings',                   getSettings);
router.put('/settings',                   updateSettingsRules, validate, updateSettings);

module.exports = router;
