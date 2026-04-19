import React, { useEffect, useState } from 'react';
import { getPayslip } from '../services/payrollService';
import { useParams, useSearchParams } from 'react-router-dom';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

const Row = ({ label, value, bold }) => (
  <tr>
    <td style={{ padding: '0.4rem 0', color: '#666' }}>{label}</td>
    <td style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: bold ? 700 : 500 }}>{value}</td>
  </tr>
);

const Payslip = () => {
  const { employeeId } = useParams();
  const [sp] = useSearchParams();
  const [payroll, setPayroll] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPayslip(employeeId, { month: sp.get('month'), year: sp.get('year') })
      .then(({ data }) => setPayroll(data.payroll))
      .catch((err) => setError(err.response?.data?.message || 'Not found'));
  }, [employeeId, sp]);

  if (error) return <p style={{ padding: '2rem', color: 'red' }}>{error}</p>;
  if (!payroll) return <p style={{ padding: '2rem' }}>Loading...</p>;
  const emp = payroll.employee;

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto' }}>
      <div style={{ textAlign: 'right', marginBottom: '1rem' }} className="no-print">
        <button onClick={() => window.print()}
          style={{ padding: '0.6rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          🖨️ Print PDF
        </button>
      </div>

      <div id="payslip" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', padding: '1.5rem 2rem' }}>
          <h1 style={{ margin: 0 }}>🏢 HRMS Company</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.85 }}>Payslip — {MONTHS[payroll.month]} {payroll.year}</p>
        </div>

        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div><strong>Name:</strong> {emp.firstName} {emp.lastName}</div>
          <div><strong>ID:</strong> {emp.employeeId}</div>
          <div><strong>Designation:</strong> {emp.designation}</div>
          <div><strong>Status:</strong> <span style={{ color: payroll.status === 'Paid' ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{payroll.status}</span></div>
        </div>

        <div style={{ padding: '1rem 2rem', background: '#f8fafc', borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', textAlign: 'center' }}>
          {[['Working Days', payroll.workingDays], ['Present', payroll.daysPresent], ['Half Days', payroll.halfDays], ['LOP Days', payroll.lopDays]].map(([l, v]) => (
            <div key={l} style={{ background: '#fff', borderRadius: '8px', padding: '0.75rem', border: '1px solid #eee' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#667eea' }}>{v}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <h3 style={{ color: '#22c55e' }}>Earnings</h3>
            <table style={{ width: '100%' }}><tbody>
              <Row label="Base Salary"   value={`₹${payroll.baseSalary.toLocaleString()}`} />
              <Row label="Gross Salary"  value={`₹${payroll.grossSalary.toLocaleString()}`} bold />
              <Row label="Bonuses"       value={`₹${payroll.bonuses}`} />
            </tbody></table>
          </div>
          <div>
             <h3 style={{ color: '#ef4444' }}>Deductions</h3>
            <table style={{ width: '100%' }}><tbody>
              <Row label="PF (12%)"      value={`₹${payroll.pfDeduction.toLocaleString()}`} />
              <Row label="LOP Deduction" value={`₹${payroll.lopDeduction.toLocaleString()}`} />
              <Row label="Income Tax"    value={`₹${payroll.taxDeduction}`} />
            </tbody></table>
          </div>
        </div>

        <div style={{ margin: '0 2rem 2rem', padding: '1.25rem 1.5rem', background: '#f0f4ff', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Net Salary (Take Home)</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#667eea' }}>₹{payroll.netSalary.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Payslip;
