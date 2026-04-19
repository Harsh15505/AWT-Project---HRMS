import API from './api';
export const generatePayroll     = (data)   => API.post('/payroll/generate', data);
export const generateBulkPayroll = (data)   => API.post('/payroll/generate/bulk', data);
export const getPayslip          = (id, p)  => API.get(`/payroll/payslip/${id}`, { params: p });
export const getSalaryReport     = (params) => API.get('/payroll/report', { params });
export const markAsPaid          = (id)     => API.put(`/payroll/${id}/paid`);
