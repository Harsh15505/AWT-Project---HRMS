import React, { useEffect, useState } from 'react';
import { getAdminStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS = ['#667eea', '#764ba2', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

const AdminDashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    getAdminStats().then(({ data }) => setData(data));
  }, []);

  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  // Guard: empty pie data
  const roleData = data.roleDistribution.length > 0
    ? data.roleDistribution
    : [{ name: 'No Data', value: 1 }];
  const deptData = data.deptDistribution.length > 0
    ? data.deptDistribution
    : [{ name: 'No Data', value: 1 }];

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Admin Dashboard 🛡️</h1>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Total Employees"  value={data.stats.totalEmployees}  icon="👥" color="#667eea" />
        <StatCard title="Active Employees" value={data.stats.activeEmployees}  icon="✅" color="#22c55e" />
        <StatCard title="System Users"     value={data.stats.totalUsers}       icon="🔑" color="#f59e0b" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Role Distribution Pie */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Role Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Dept Headcount Bar */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Headcount by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={deptData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#667eea" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
