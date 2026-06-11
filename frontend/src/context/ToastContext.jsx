import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let _id = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const COLORS = {
  success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', accent: '#10b981', icon: '✓' },
  error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  accent: '#ef4444', icon: '✕' },
  info:    { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', accent: '#6366f1', icon: 'ℹ' },
  warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', accent: '#f59e0b', icon: '⚠' },
};

const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{
    position: 'fixed', top: '1.5rem', right: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '10px',
    zIndex: 9999, pointerEvents: 'none',
  }}>
    {toasts.map(t => {
      const c = COLORS[t.type] || COLORS.info;
      return (
        <div
          key={t.id}
          style={{
            pointerEvents: 'all',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 16px',
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderLeft: `3px solid ${c.accent}`,
            borderRadius: '10px',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            fontSize: '0.88rem',
            maxWidth: '340px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            animation: 'toastIn 0.25s ease',
          }}
        >
          <span style={{ color: c.accent, fontWeight: 'bold', flexShrink: 0, marginTop: '1px' }}>
            {c.icon}
          </span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0 0 0 8px', fontSize: '1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      );
    })}
    <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }`}</style>
  </div>
);
