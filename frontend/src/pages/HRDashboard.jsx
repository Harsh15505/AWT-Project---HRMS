import React, { useEffect, useState } from 'react';
import { getHRStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#22c55e','#ef4444','#f59e0b','#3b82f6','#8b5cf6','#ec4899'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const HRDashboard = () => {
  const [data, setData] = useState(null);
  useEffect(() => { getHRStats().then(({ data }) => setData(data)); }, []);
  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const headcountFormatted = data.monthlyHeadcount.map(d => ({
    month: MONTH_LABELS[d.month - 1], count: d.count,
  }));

  const attData = data.attendanceSummary.length > 0
    ? data.attendanceSummary
    : [{ name: 'No Data', value: 1 }];

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>HR Dashboard 👔</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Active Employees"  value={data.totalActive}   icon="👥" color="#667eea" />
        <StatCard title="Pending Leaves"    value={data.pendingLeaves} icon="📋" color="#f59e0b" subtitle="Awaiting approval" />
        <StatCard title="Current Month"     value={new Date().toLocaleString('default',{month:'long'})} icon="📅" color="#22c55e" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Attendance This Month</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={attData} dataKey="value" nameKey="name" outerRadius={80} label>
                {attData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>New Joiners This Year</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={headcountFormatted.length > 0 ? headcountFormatted : [{ month: 'No Data', count: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
