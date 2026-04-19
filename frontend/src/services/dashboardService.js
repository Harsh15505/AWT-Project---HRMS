import API from './api';
export const getAdminStats    = () => API.get('/dashboard/admin');
export const getHRStats       = () => API.get('/dashboard/hr');
export const getPayrollStats  = () => API.get('/dashboard/payroll');
export const getEmployeeStats = () => API.get('/dashboard/employee');
