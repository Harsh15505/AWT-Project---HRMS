import React, { useEffect, useState } from 'react';
import { getEmployeeStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import { useNavigate } from 'react-router-dom';

const EmployeeDashboard = () => {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { getEmployeeStats().then(({ data }) => setData(data)); }, []);
  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const { employee, attSummary, leaveBalance, latestPayslip } = data;
  const present = attSummary.find(a => a.name === 'Present')?.value || 0;
  const absent  = attSummary.find(a => a.name === 'Absent')?.value || 0;

  const remaining = leaveBalance ? {
    Casual: leaveBalance.casual.allocated - leaveBalance.casual.used,
    Sick:   leaveBalance.sick.allocated   - leaveBalance.sick.used,
    Annual: leaveBalance.annual.allocated - leaveBalance.annual.used,
  } : {};

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Welcome, {employee.firstName}! 👋</h1>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>{employee.designation}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Days Present This Month" value={present} icon="✅" color="#22c55e" />
        <StatCard title="Days Absent"             value={absent}  icon="❌" color="#ef4444" />
        <StatCard title="Casual Leave Left"  value={remaining.Casual ?? '-'} icon="🌴" color="#667eea" />
        <StatCard title="Sick Leave Left"    value={remaining.Sick   ?? '-'} icon="🏥" color="#f59e0b" />
      </div>

      {latestPayslip && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', maxWidth: '500px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Latest Payslip</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>Net Salary</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#667eea' }}>
                ₹{latestPayslip.netSalary.toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => navigate(`/employee/payslip/${employee._id}?month=${latestPayslip.month}&year=${latestPayslip.year}`)}
              style={{ padding: '0.6rem 1.25rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              View Payslip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
