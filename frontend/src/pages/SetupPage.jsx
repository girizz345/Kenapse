import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Mail, ArrowRight, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://kenapse-production.up.railway.app';

const SetupPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/admin/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, setup_key: setupKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || 'Setup failed.');
        setStatus('error');
        return;
      }

      setMessage(data.message);
      setStatus('success');
    } catch (err) {
      setMessage('Could not reach the backend. Make sure the server is running.');
      setStatus('error');
    }
  };

  return (
    <div
      className="page-container"
      style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
    >
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '3rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', marginBottom: '1rem' }}>
            <Shield size={28} color="var(--accent-color)" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Admin Setup</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Create the first admin account. This page locks itself once an admin exists.
          </p>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
            <p style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '1rem' }}>
              Admin created!
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '2rem' }}>
              {message}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              onClick={() => navigate('/auth')}
            >
              Sign In <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <Mail size={14} /> Your Account Email
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Must match an existing account — register first if you haven't.
              </p>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <KeyRound size={14} /> Setup Key
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter the key from backend .env"
                value={setupKey}
                onChange={e => setSetupKey(e.target.value)}
                required
                disabled={status === 'loading'}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Value of <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '3px' }}>ADMIN_SETUP_KEY</code> in <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '3px' }}>backend/.env</code>
              </p>
            </div>

            {status === 'error' && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.85rem 1rem', color: '#ef4444', fontSize: '0.88rem' }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === 'loading'}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}
            >
              <Shield size={18} />
              {status === 'loading' ? 'Creating admin…' : 'Create Admin Account'}
            </button>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Already have an account?{' '}
              <span style={{ color: 'var(--accent-color)', cursor: 'pointer' }} onClick={() => navigate('/auth')}>
                Sign in
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetupPage;
