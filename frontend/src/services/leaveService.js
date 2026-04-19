import API from './api';

export const applyLeave        = (data)       => API.post('/leaves', data);
export const getMyLeaves       = ()           => API.get('/leaves/my');
export const getAllLeaves       = (params)     => API.get('/leaves', { params });
export const updateLeaveStatus = (id, data)   => API.put(`/leaves/${id}/status`, data);
export const cancelLeave       = (id)         => API.put(`/leaves/${id}/cancel`);
export const getLeaveBalance   = (id, year)   => API.get(`/leaves/balance/${id}`, { params: { year } });
