import React, { useState } from 'react';
import { getAllLeaves, updateLeaveStatus } from '../services/leaveService';
import useFetch from '../hooks/useFetch';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';

const STATUS_COLOR = {
  Pending:   '#f59e0b',
  Approved:  '#22c55e',
  Rejected:  '#ef4444',
  Cancelled: '#94a3b8',
};

const LeaveManagement = () => {
  const [filter,  setFilter]  = useState('Pending');
  const [remarks, setRemarks] = useState({});

  const { data, loading, error, refetch } = useFetch(
    () => getAllLeaves({ status: filter }),
    [filter]
  );
  const leaves = data?.leaves || [];

  const handleAction = async (id, status) => {
    try {
      await updateLeaveStatus(id, { status, approverRemarks: remarks[id] || '' });
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Leave Management</h1>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: filter === s ? STATUS_COLOR[s] : '#f1f5f9',
              color: filter === s ? '#fff' : '#64748b', fontWeight: 600 }}>
            {s}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading leaves..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!loading && !error && leaves.length === 0 && (
          <EmptyState icon="📋" title={`No ${filter.toLowerCase()} leaves`} subtitle="Nothing to show for this filter" />
        )}

        {leaves.map((leave) => (
          <div key={leave._id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  {leave.employee?.firstName} {leave.employee?.lastName}
                  <span style={{ color: '#888', fontWeight: 400, fontSize: '0.9rem' }}> — {leave.employee?.employeeId}</span>
                </h3>
                <p style={{ margin: '0.4rem 0', color: '#555' }}>
                  <strong>{leave.leaveType}</strong> · {leave.numberOfDays} day(s) ·{' '}
                  {new Date(leave.fromDate).toLocaleDateString()} → {new Date(leave.toDate).toLocaleDateString()}
                </p>
                <p style={{ color: '#777', fontSize: '0.9rem' }}>Reason: {leave.reason}</p>
                {leave.approverRemarks && (
                  <p style={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Remarks: {leave.approverRemarks}
                  </p>
                )}
                {leave.approvedBy && (
                  <p style={{ color: '#888', fontSize: '0.8rem' }}>
                    {filter === 'Approved' ? 'Approved' : 'Handled'} by: {leave.approvedBy?.name}
                  </p>
                )}
              </div>
              <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', background: STATUS_COLOR[leave.status] + '22', color: STATUS_COLOR[leave.status], fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {leave.status}
              </span>
            </div>

            {leave.status === 'Pending' && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="Remarks (optional)"
                  value={remarks[leave._id] || ''}
                  onChange={(e) => setRemarks({ ...remarks, [leave._id]: e.target.value })}
                  style={{ flex: 1, minWidth: '180px', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ddd' }}
                />
                <button onClick={() => handleAction(leave._id, 'Approved')}
                  style={{ padding: '0.5rem 1.25rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  Approve
                </button>
                <button onClick={() => handleAction(leave._id, 'Rejected')}
                  style={{ padding: '0.5rem 1.25rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeaveManagement;
