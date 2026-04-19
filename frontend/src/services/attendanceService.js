import API from './api';

export const markAttendance    = (data)       => API.post('/attendance', data);
export const bulkMark          = (data)       => API.post('/attendance/bulk', data);
export const getByEmployee     = (id, params) => API.get(`/attendance/employee/${id}`, { params });
export const getMonthlySummary = (id, params) => API.get(`/attendance/summary/${id}`, { params });
export const getByDate         = (date)       => API.get(`/attendance/date/${date}`);
