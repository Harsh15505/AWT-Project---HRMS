import API from './api';
export const getAllUsers       = ()       => API.get('/admin/users');
export const updateUserRole   = (id, r)  => API.put(`/admin/users/${id}/role`, { role: r });
export const toggleUserStatus = (id)     => API.put(`/admin/users/${id}/toggle-status`);
export const resetPassword    = (id, p)  => API.put(`/admin/users/${id}/reset-password`, { newPassword: p });
export const getSettings      = ()       => API.get('/admin/settings');
export const updateSettings   = (data)   => API.put('/admin/settings', { settings: data });
