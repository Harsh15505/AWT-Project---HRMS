import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import EmployeeList from './pages/EmployeeList';
import AddEmployee from './pages/AddEmployee';
import MarkAttendance from './pages/MarkAttendance';
import AttendanceCalendar from './pages/AttendanceCalendar';
import ApplyLeave from './pages/ApplyLeave';
import MyLeaves from './pages/MyLeaves';
import LeaveManagement from './pages/LeaveManagement';
import Payslip from './pages/Payslip';
import SalaryReport from './pages/SalaryReport';
import AdminDashboard from './pages/AdminDashboard';
import HRDashboard from './pages/HRDashboard';
import PayrollDashboard from './pages/PayrollDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import UserManagement from './pages/UserManagement';
import AdminSettings from './pages/AdminSettings';
import ProtectedRoute from './components/ProtectedRoute';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Employee Management Routes */}
        <Route path="/hr/employees" element={
          <ProtectedRoute roles={['Admin', 'HR Officer']}>
            <EmployeeList />
          </ProtectedRoute>
        } />

        <Route path="/hr/employees/new" element={
          <ProtectedRoute roles={['Admin', 'HR Officer']}>
            <AddEmployee />
          </ProtectedRoute>
        } />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['Admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/hr/dashboard" element={
          <ProtectedRoute roles={['Admin', 'HR Officer']}>
            <HRDashboard />
          </ProtectedRoute>
        } />

        <Route path="/payroll/dashboard" element={
          <ProtectedRoute roles={['Admin', 'Payroll Officer']}>
            <PayrollDashboard />
          </ProtectedRoute>
        } />

        <Route path="/employee/dashboard" element={
          <ProtectedRoute roles={['Admin', 'HR Officer', 'Payroll Officer', 'Employee']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        } />

        {/* Attendance Routes — Phase 4 */}
        <Route path="/hr/attendance" element={
          <ProtectedRoute roles={['Admin', 'HR Officer']}>
            <MarkAttendance />
          </ProtectedRoute>
        } />

        <Route path="/employee/attendance" element={
          <ProtectedRoute roles={['Admin', 'HR Officer', 'Payroll Officer', 'Employee']}>
            <AttendanceCalendar />
          </ProtectedRoute>
        } />

        {/* Leave Routes — Phase 5 */}
        <Route path="/employee/apply-leave" element={
          <ProtectedRoute roles={['Admin', 'HR Officer', 'Payroll Officer', 'Employee']}>
            <ApplyLeave />
          </ProtectedRoute>
        } />

        <Route path="/employee/leaves" element={
          <ProtectedRoute roles={['Admin', 'HR Officer', 'Payroll Officer', 'Employee']}>
            <MyLeaves />
          </ProtectedRoute>
        } />

        <Route path="/hr/leaves" element={
          <ProtectedRoute roles={['Admin', 'HR Officer']}>
            <LeaveManagement />
          </ProtectedRoute>
        } />
        {/* Payroll Routes — Phase 6 */}
        <Route path="/employee/payslip/:employeeId" element={
          <ProtectedRoute roles={['Admin', 'HR Officer', 'Payroll Officer', 'Employee']}>
            <Payslip />
          </ProtectedRoute>
        } />

        <Route path="/payroll/report" element={
          <ProtectedRoute roles={['Admin', 'Payroll Officer']}>
            <SalaryReport />
          </ProtectedRoute>
        } />

        {/* Admin Controls — Phase 8 */}
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['Admin']}>
            <UserManagement />
          </ProtectedRoute>
        } />

        <Route path="/admin/settings" element={
          <ProtectedRoute roles={['Admin']}>
            <AdminSettings />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;