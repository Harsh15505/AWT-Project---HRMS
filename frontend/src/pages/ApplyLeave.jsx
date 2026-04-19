import React, { useState } from 'react';
import { applyLeave } from '../services/leaveService';
import { useNavigate } from 'react-router-dom';

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual', 'LOP'];

const ApplyLeave = () => {
  const [form, setForm] = useState({
    leaveType: 'Casual', fromDate: '', toDate: '', reason: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Calculate days for display
  const days = form.fromDate && form.toDate
    ? Math.round((new Date(form.toDate) - new Date(form.fromDate)) / 86400000) + 1
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (days < 1) return setError('To date must be on or after From date');
    setLoading(true);
    try {
      await applyLeave(form);
      setSuccess('✅ Leave application submitted successfully!');
      setTimeout(() => navigate('/employee/leaves'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply for leave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '560px' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Apply for Leave</h1>

      {error   && <div style={{ color: 'red',   marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: '1rem' }}>{success}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Leave Type</label>
          <select name="leaveType" value={form.leaveType} onChange={handleChange} style={inputStyle}>
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>From Date</label>
            <input type="date" name="fromDate" value={form.fromDate} onChange={handleChange} style={inputStyle} required />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>To Date</label>
            <input type="date" name="toDate" value={form.toDate} onChange={handleChange} style={inputStyle} required />
          </div>
        </div>

        {days > 0 && (
          <div style={{ background: '#f0f4ff', padding: '0.75rem 1rem', borderRadius: '8px', color: '#667eea', fontWeight: 600 }}>
            📅 Duration: {days} day{days > 1 ? 's' : ''}
          </div>
        )}

        <div>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Reason</label>
          <textarea name="reason" value={form.reason} onChange={handleChange}
            rows={3} style={{ ...inputStyle, resize: 'vertical' }} required />
        </div>

        <button type="submit" disabled={loading}
          style={{ padding: '0.85rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

const inputStyle = {
  width: '100%', padding: '0.7rem 1rem', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '1rem', marginTop: '0.4rem',
  boxSizing: 'border-box',
};

export default ApplyLeave;
