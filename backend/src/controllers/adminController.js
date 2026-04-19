const User          = require('../models/User');
const Employee      = require('../models/Employee');
const SystemSetting = require('../models/SystemSetting');
const { asyncHandler } = require('../middleware/errorMiddleware');

// ─── User Management ──────────────────────────────────────────

// GET /api/admin/users
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, users });
});

// PUT /api/admin/users/:id/role
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  // Prevent admin from changing their own role (safety)
  if (req.params.id === req.user.userId) {
    res.status(400);
    throw new Error('Cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({ success: true, user });
});

// PUT /api/admin/users/:id/toggle-status
const toggleUserStatus = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.userId) {
    res.status(400);
    throw new Error('Cannot deactivate yourself');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.isActive = !user.isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    user,
  });
});

// PUT /api/admin/users/:id/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.password = newPassword; // Pre-save hook will hash it
  await user.save();

  res.json({ success: true, message: 'Password reset successfully' });
});

// ─── System Settings ──────────────────────────────────────────

// GET /api/admin/settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSetting.find();
  // Convert array to object for easier frontend use
  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.key] = { value: s.value, label: s.label }; });
  res.json({ success: true, settings: settingsMap, raw: settings });
});

// PUT /api/admin/settings
const updateSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body; // { key: value, key: value, ... }

  const updates = Object.entries(settings).map(([key, value]) =>
    SystemSetting.findOneAndUpdate({ key }, { value }, { new: true })
  );
  await Promise.all(updates);

  res.json({ success: true, message: 'Settings updated successfully' });
});

module.exports = { getAllUsers, updateUserRole, toggleUserStatus, resetPassword, getSettings, updateSettings };
