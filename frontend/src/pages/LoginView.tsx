import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import api from '../api';

export default function LoginView({ onLoginSuccess }: { onLoginSuccess: (data: any) => void }) {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('OFF-2026-001');
  const [password, setPassword] = useState('admin123');
  const [stationId, setStationId] = useState<number>(1);
  const [stations, setStations] = useState<any[]>([]);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    api.get('/auth/stations')
      .then(res => {
        setStations(res.data || []);
        if (res.data && res.data.length > 0) {
          setStationId(res.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await api.post('/auth/login', {
        employee_id: employeeId,
        station_id: Number(stationId),
        password: password
      });
      localStorage.setItem('token', res.data.access_token);
      onLoginSuccess(res.data);
      navigate('/dashboard');
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || 'Authentication failed. Verify credentials.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <div className="brand-mark" style={{ width: '48px', height: '48px', marginBottom: '12px' }}>
            <Shield size={24} />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 750, color: '#172033', margin: 0 }}>INVESTIGATION INTELLIGENCE</h1>
          <p style={{ fontSize: '12px', color: '#7b8494', margin: '4px 0 0' }}>Secure Investigator Enclave</p>
        </div>

        {loginError && (
          <div style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>STATION / DIVISION</label>
            <select
              value={stationId}
              onChange={e => setStationId(Number(e.target.value))}
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            >
              {stations.map(st => (
                <option key={st.id} value={st.id}>
                  {st.station_name} ({st.station_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>INVESTIGATOR ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 650, color: '#687386', marginBottom: '4px' }}>PASSPHRASE</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0 12px', background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: '8px', fontSize: '13px', outline: 0 }}
            />
          </div>

          <button type="submit" className="primary" style={{ height: '40px', width: '100%', marginTop: '8px' }}>
            Authenticate Session
          </button>
        </form>
      </div>
    </div>
  );
}
