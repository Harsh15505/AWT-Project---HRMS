import React, { useEffect, useState } from 'react';
import { getByEmployee, getMonthlySummary } from '../services/attendanceService';

// Simple map from status to colour
const STATUS_COLOR = {
  Present:   '#22c55e',
  Absent:    '#ef4444',
  Late:      '#f59e0b',
  'Half-Day':'#3b82f6',
  'On-Leave':'#8b5cf6',
  Holiday:   '#ec4899',
};

const AttendanceCalendar = ({ employeeId }) => {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [records, setRecords] = useState({});
  const [summary, setSummary] = useState({});

  useEffect(() => {
    if (!employeeId) return;

    // Fetch records and summary in parallel
    Promise.all([
      getByEmployee(employeeId, { month, year }),
      getMonthlySummary(employeeId, { month, year }),
    ]).then(([attRes, sumRes]) => {
      // Convert array to date-keyed map for O(1) lookup
      const map = {};
      attRes.data.records.forEach((r) => {
        const key = new Date(r.date).getUTCDate();
        map[key] = r;
      });
      setRecords(map);
      setSummary(sumRes.data.summary);
    }).catch(console.error);
  }, [employeeId, month, year]);

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const cells = [];

  // Empty cells for days before 1st
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={{ padding: '2rem' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={prevMonth}>◀</button>
        <h2 style={{ minWidth: '140px', textAlign: 'center' }}>{MONTH_NAMES[month]} {year}</h2>
        <button onClick={nextMonth}>▶</button>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {Object.entries(summary).map(([status, count]) => (
          <span key={status} style={{ padding: '0.4rem 0.9rem', background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status], borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem' }}>
            {status}: {count}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#888', padding: '0.5rem', fontSize: '0.8rem' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const rec = day ? records[day] : null;
          return (
            <div key={i} style={{
              aspectRatio: '1',
              borderRadius: '8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: rec ? STATUS_COLOR[rec.status] + '22' : day ? '#f9fafb' : 'transparent',
              border: day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear() ? '2px solid #667eea' : '1px solid #eee',
              fontSize: '0.85rem',
            }}>
              {day && (
                <>
                  <span style={{ fontWeight: 600 }}>{day}</span>
                  {rec && <span style={{ fontSize: '0.6rem', color: STATUS_COLOR[rec.status], fontWeight: 700 }}>{rec.status}</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
