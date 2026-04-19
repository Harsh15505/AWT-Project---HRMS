import React from 'react';

const ErrorMessage = ({ message, onRetry }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
    <div style={{ fontSize: '2.5rem' }}>⚠️</div>
    <p style={{ color: '#c00', fontWeight: 600 }}>{message}</p>
    {onRetry && (
      <button onClick={onRetry}
        style={{ padding: '0.6rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        Try Again
      </button>
    )}
  </div>
);

export default ErrorMessage;
