import React, { useState } from 'react';
import { getAllUsers, updateUserRole, toggleUserStatus, resetPassword } from '../services/adminService';
import useFetch from '../hooks/useFetch';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

const ROLES = ['Admin','HR Officer','Payroll Officer','Employee'];

const UserManagement = () => {
  const [newPass, setNewPass] = useState({});
  const [msg, setMsg]         = useState('');

  const { data, loading, error, refetch } = useFetch(() => getAllUsers());
  const users = data?.users || [];

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleRole = async (id, role) => {
    try { await updateUserRole(id, role); refetch(); flash('✅ Role updated'); }
    catch (e) { flash('❌ ' + e.response?.data?.message); }
  };

  const handleToggle = async (id) => {
    try { await toggleUserStatus(id); refetch(); flash('✅ Status toggled'); }
    catch (e) { flash('❌ ' + e.response?.data?.message); }
  };

  const handleReset = async (id) => {
    const pwd = newPass[id];
    if (!pwd || pwd.length < 6) return flash('❌ Password must be 6+ characters');
    try { await resetPassword(id, pwd); setNewPass({ ...newPass, [id]: '' }); refetch(); flash('✅ Password reset'); }
    catch (e) { flash('❌ ' + e.response?.data?.message); }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>User Management</h1>
      {msg && <p style={{ color: msg.startsWith('✅') ? 'green' : 'red', marginBottom: '1rem' }}>{msg}</p>}

      {loading && <LoadingSpinner message="Loading users..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}
      {!loading && !error && users.length === 0 && <EmptyState icon="👤" title="No users found" />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {users.map((u) => (
          <div key={u._id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '180px' }}>
              <div style={{ fontWeight: 700 }}>{u.name}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{u.email}</div>
            </div>

            {/* Role Selector */}
            <select value={u.role} onChange={(e) => handleRole(u._id, e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Active / Inactive Badge */}
            <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
              background: u.isActive ? '#dcfce7' : '#fee2e2',
              color: u.isActive ? '#166534' : '#991b1b' }}>
              {u.isActive ? 'Active' : 'Inactive'}
            </span>

            {/* Toggle Status */}
            <button onClick={() => handleToggle(u._id)}
              style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', background: '#f8fafc' }}>
              {u.isActive ? '🔒 Deactivate' : '🔓 Activate'}
            </button>

            {/* Reset Password */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="password" placeholder="New password"
                value={newPass[u._id] || ''}
                onChange={(e) => setNewPass({ ...newPass, [u._id]: e.target.value })}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #ddd', width: '130px' }} />
              <button onClick={() => handleReset(u._id)}
                style={{ padding: '0.45rem 1rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserManagement;
