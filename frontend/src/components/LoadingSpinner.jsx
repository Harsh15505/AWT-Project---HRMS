import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem' }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '50%',
      border: '4px solid #f0f4ff', borderTop: '4px solid #667eea',
      animation: 'spin 0.8s linear infinite',
    }} />
    <p style={{ color: '#888', fontSize: '0.9rem' }}>{message}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingSpinner;
