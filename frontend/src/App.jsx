import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

const AdminDashboard = () => <h1>Admin Dashboard</h1>;
const HRDashboard = () => <h1>HR Dashboard</h1>;
const PayrollDashboard = () => <h1>Payroll Dashboard </h1>;
const EmployeeDashboard = () => <h1>Employee Dashboard </h1>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

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

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;