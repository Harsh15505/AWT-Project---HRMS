import API from './api';

export const getAllEmployees = (params) => API.get('/employees', { params });
export const getEmployee = (id) => API.get(`/employees/${id}`);
export const getMyProfile = () => API.get('/employees/me');
export const createEmployee = (data) => API.post('/employees', data);
export const updateEmployee = (id, data) => API.put(`/employees/${id}`, data);
export const deactivateEmployee = (id) => API.delete(`/employees/${id}`);
export const getDepartments = () => API.get('/departments');