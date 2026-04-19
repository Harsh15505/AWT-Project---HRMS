import React, { useEffect, useState } from 'react';
import { getSalaryReport, generateBulkPayroll, markAsPaid } from '../services/payrollService';

const SalaryReport = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [report, setReport] = useState([]);
  const [total, setTotal]   = useState(0);
  const [msg, setMsg] = useState('');

  const load = () =>
    getSalaryReport({ month, year }).then(({ data }) => { setReport(data.report); setTotal(data.totalSalary); });

  useEffect(() => { load(); }, [month, year]);

  const runPayroll = async () => {
    try {
      await generateBulkPayroll({ month, year });
      setMsg('✅ Payroll generated!'); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed'));
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1>Salary Report</h1>
        <button onClick={runPayroll}
          style={{ padding: '0.7rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          ⚙️ Run Payroll
        </button>
      </div>

      {msg && <p style={{ color: msg.startsWith('✅') ? 'green' : 'red', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd' }}>
          {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', width: '90px' }} />
      </div>

      <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Total Disbursed</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{total.toLocaleString()}</div>
        </div>
        <div style={{ opacity: 0.9, alignSelf: 'center' }}>{report.length} Employees</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
        <thead><tr style={{ background: '#f5f7fa' }}>
          {['Employee','Designation','Working Days','Present','LOP','Net Salary','Status',''].map(h => (
            <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {report.map((r) => (
            <tr key={r._id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.85rem 1rem' }}>{r.employee?.firstName} {r.employee?.lastName}</td>
              <td style={{ padding: '0.85rem 1rem', color: '#777', fontSize: '0.9rem' }}>{r.employee?.designation}</td>
              <td style={{ padding: '0.85rem 1rem' }}>{r.workingDays}</td>
              <td style={{ padding: '0.85rem 1rem' }}>{r.daysPresent}</td>
              <td style={{ padding: '0.85rem 1rem', color: r.lopDays > 0 ? '#ef4444' : '#333' }}>{r.lopDays}</td>
              <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>₹{r.netSalary.toLocaleString()}</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                  background: r.status === 'Paid' ? '#dcfce7' : '#fef9c3',
                  color: r.status === 'Paid' ? '#166534' : '#854d0e' }}>
                  {r.status}
                </span>
              </td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {r.status === 'Generated' && (
                  <button onClick={() => markAsPaid(r._id).then(load)}
                    style={{ padding: '0.3rem 0.9rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Mark Paid
                  </button>
                )}
                <a href={`/employee/payslip/${r.employee?._id}?month=${month}&year=${year}`} target="_blank" rel="noreferrer" style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#667eea', textDecoration: 'none' }}>Payslip</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalaryReport;
