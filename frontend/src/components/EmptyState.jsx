import React from 'react';

const EmptyState = ({ icon = '📭', title = 'Nothing here', subtitle = '' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', color: '#888' }}>
    <div style={{ fontSize: '3rem' }}>{icon}</div>
    <h3 style={{ margin: 0, color: '#555' }}>{title}</h3>
    {subtitle && <p style={{ margin: 0, fontSize: '0.9rem' }}>{subtitle}</p>}
  </div>
);

export default EmptyState;
