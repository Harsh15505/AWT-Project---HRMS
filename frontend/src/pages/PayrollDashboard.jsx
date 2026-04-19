import React, { useEffect, useState } from 'react';
import { getPayrollStats } from '../services/dashboardService';
import StatCard from '../components/StatCard';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#667eea','#22c55e'];

const PayrollDashboard = () => {
  const [data, setData] = useState(null);
  useEffect(() => { getPayrollStats().then(({ data }) => setData(data)); }, []);
  if (!data) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const trendData = data.monthlyTrend.map(d => ({
    month: MONTH_LABELS[d.month - 1],
    total: d.total,
  }));

  const payStatusData = data.paymentStatus.length > 0
    ? data.paymentStatus
    : [{ name: 'No Data', value: 1 }];

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Payroll Dashboard 💰</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="This Month — Total Disbursed" value={`₹${data.currentMonth.total.toLocaleString()}`} icon="💵" color="#667eea" />
        <StatCard title="Payrolls Generated"           value={data.currentMonth.count} icon="📄" color="#22c55e" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Monthly Salary Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData.length > 0 ? trendData : [{ month: 'No Data', total: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="total" stroke="#667eea" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Payment Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={payStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                {payStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PayrollDashboard;
