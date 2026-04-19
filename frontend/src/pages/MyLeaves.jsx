import React, { useEffect, useState } from 'react';
import { getMyLeaves, cancelLeave, getLeaveBalance } from '../services/leaveService';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = {
  Pending:   '#f59e0b',
  Approved:  '#22c55e',
  Rejected:  '#ef4444',
  Cancelled: '#94a3b8',
};

const MyLeaves = () => {
  const { user } = useAuth();
  const [leaves,  setLeaves]  = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        getMyLeaves(),
        user?.employeeId ? getLeaveBalance(user.employeeId) : Promise.resolve(null),
      ]);
      setLeaves(leavesRes.data.leaves);
      if (balanceRes) setBalance(balanceRes.data.balance);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave application?')) return;
    try {
      await cancelLeave(id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling leave');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>My Leaves</h1>

      {/* Leave Balance Cards */}
      {balance && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Casual',  key: 'casual',  color: '#3b82f6' },
            { label: 'Sick',    key: 'sick',    color: '#f59e0b' },
            { label: 'Annual',  key: 'annual',  color: '#22c55e' },
          ].map(({ label, key, color }) => (
            <div key={key} style={{ flex: '1', minWidth: '160px', background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: `4px solid ${color}` }}>
              <div style={{ fontWeight: 700, color, marginBottom: '0.5rem' }}>{label} Leave</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b' }}>
                {balance[key].allocated - balance[key].used}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                of {balance[key].allocated} remaining · {balance[key].used} used
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leave History */}
      {leaves.length === 0 ? (
        <p style={{ color: '#888' }}>No leave applications yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {leaves.map((leave) => (
            <div key={leave._id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                  {leave.leaveType} Leave
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#888', fontWeight: 400 }}>
                    {leave.numberOfDays} day{leave.numberOfDays > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>
                  {new Date(leave.fromDate).toLocaleDateString()} → {new Date(leave.toDate).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#777', marginTop: '0.25rem' }}>
                  {leave.reason}
                </div>
                {leave.approverRemarks && (
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    Remarks: {leave.approverRemarks}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', background: STATUS_COLOR[leave.status] + '22', color: STATUS_COLOR[leave.status], fontWeight: 700, fontSize: '0.85rem' }}>
                  {leave.status}
                </span>
                {leave.status === 'Pending' && (
                  <button onClick={() => handleCancel(leave._id)}
                    style={{ padding: '0.3rem 0.75rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLeaves;
