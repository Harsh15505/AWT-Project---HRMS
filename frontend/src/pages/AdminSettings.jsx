import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../services/adminService';

const AdminSettings = () => {
  const [settings, setSettings] = useState({});
  const [values,   setValues]   = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getSettings().then(({ data }) => {
      setSettings(data.settings);
      const initial = {};
      Object.entries(data.settings).forEach(([k, v]) => { initial[k] = v.value; });
      setValues(initial);
    });
  }, []);

  const handleChange = (key, val) => setValues({ ...values, [key]: val });

  const handleSave = async () => {
    try {
      await updateSettings(values);
      setMsg('✅ Settings saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed'));
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>System Settings ⚙️</h1>
      {msg && <p style={{ color: msg.startsWith('✅') ? 'green' : 'red', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {Object.entries(settings).map(([key, { label }]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</label>
            <input
              type={typeof values[key] === 'number' ? 'number' : 'text'}
              value={values[key] ?? ''}
              onChange={(e) => handleChange(key, typeof values[key] === 'number' ? Number(e.target.value) : e.target.value)}
              style={{ padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
            />
          </div>
        ))}

        <button onClick={handleSave}
          style={{ padding: '0.85rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
