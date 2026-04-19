import React, { useEffect, useState } from 'react';
import { getAllEmployees } from '../services/employeeService';
import { bulkMark } from '../services/attendanceService';

const STATUSES = ['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday'];

const MarkAttendance = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getAllEmployees({ isActive: true }).then(({ data }) => {
      setEmployees(data.employees);
      // Default everyone to Absent
      const defaults = {};
      data.employees.forEach((e) => { defaults[e._id] = 'Absent'; });
      setRecords(defaults);
    });
  }, []);

  const handleStatusChange = (empId, status) => {
    setRecords((prev) => ({ ...prev, [empId]: status }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = employees.map((e) => ({
        employeeId: e._id,
        status: records[e._id] || 'Absent',
      }));
      await bulkMark({ date, records: payload });
      setMessage('✅ Attendance saved successfully!');
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'Error saving attendance'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Mark Attendance</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
        <label><strong>Date:</strong></label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ddd' }} />
      </div>

      {message && <div style={{ marginBottom: '1rem', color: message.startsWith('✅') ? 'green' : 'red' }}>{message}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px' }}>
        <thead>
          <tr style={{ background: '#f5f7fa' }}>
            <th style={th}>ID</th><th style={th}>Name</th><th style={th}>Department</th><th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp._id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={td}>{emp.employeeId}</td>
              <td style={td}>{emp.fullName}</td>
              <td style={td}>{emp.department?.name}</td>
              <td style={td}>
                <select
                  value={records[emp._id] || 'Absent'}
                  onChange={(e) => handleStatusChange(emp._id, e.target.value)}
                  style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #ddd' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={handleSubmit} disabled={saving}
        style={{ marginTop: '1.5rem', padding: '0.8rem 2rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
        {saving ? 'Saving...' : 'Save Attendance'}
      </button>
    </div>
  );
};

const th = { padding: '1rem', textAlign: 'left', fontWeight: 700 };
const td = { padding: '0.75rem 1rem' };

export default MarkAttendance;
