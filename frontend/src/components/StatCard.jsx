import React from 'react';

const StatCard = ({ title, value, subtitle, color = '#667eea', icon }) => (
  <div style={{
    background: '#fff', borderRadius: '12px', padding: '1.5rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}`,
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600 }}>{title}</span>
      {icon && <span style={{ fontSize: '1.5rem' }}>{icon}</span>}
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
    {subtitle && <div style={{ color: '#aaa', fontSize: '0.8rem' }}>{subtitle}</div>}
  </div>
);

export default StatCard;
