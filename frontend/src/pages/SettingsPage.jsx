import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Bell, Shield, Palette, Activity, BookOpen,
  User, LogOut, Brain, Check, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const SETTINGS_KEY = 'kenapse_settings';
const defaultSettings = {
  notifications: true,
  weeklyDigest: false,
  theme: 'dark',
  difficultyAdjustment: 'auto',
};

function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: '46px', height: '26px', borderRadius: '13px', cursor: 'pointer', flexShrink: 0,
        background: on ? '#6366f1' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.25s',
        boxShadow: on ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: '4px',
        left: on ? '24px' : '4px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'white', transition: 'left 0.25s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      padding: '1.1rem 1.25rem', borderRadius: '12px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div>
        <div style={{ fontSize: '0.92rem', color: '#f1f5f9', fontFamily: 'var(--font-body)', marginBottom: '3px' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [activeTab,          setActiveTab]          = useState('general');
  const [settings,           setSettings]           = useState(defaultSettings);
  const [saveStatus,         setSaveStatus]         = useState(null);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [isDeleting,         setIsDeleting]         = useState(false);

  const displayName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Student';
  const initials    = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  const handleToggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2500);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try { await supabase.auth.signOut(); } catch { /* best-effort */ }
    localStorage.clear();
    sessionStorage.clear();
    navigate('/auth');
  };

  const sideNavItems = [
    { key: 'general',       label: 'General',       icon: Settings  },
    { key: 'notifications', label: 'Notifications', icon: Bell      },
    { key: 'appearance',    label: 'Appearance',    icon: Palette   },
    { key: 'privacy',       label: 'Privacy',       icon: Shield    },
  ];

  const mainNavItems = [
    { label: 'Dashboard',  icon: Activity, path: '/dashboard' },
    { label: 'My Courses', icon: BookOpen, path: '/courses'   },
    { label: 'Profile',    icon: User,     path: '/profile'   },
    { label: 'Settings',   icon: Settings, path: '/settings', active: true },
  ];
  if (isAdmin) mainNavItems.push({ label: 'Admin Panel', icon: Shield, path: '/admin', accent: '#f43f5e' });

  const selectStyle = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#f1f5f9',
    fontFamily: 'var(--font-body)', fontSize: '0.9rem',
    outline: 'none', cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '36px',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Ambient */}
      <div style={{ position: 'fixed', top: '-10%', right: '10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Left nav sidebar ── */}
      <aside style={{ width: '230px', flexShrink: 0, background: 'rgba(6,6,10,0.97)', borderRight: '1px solid rgba(255,255,255,0.055)', display: 'flex', flexDirection: 'column', padding: '1.75rem 1.1rem', position: 'sticky', top: 0, height: '100vh', zIndex: 10 }}
        className="settings-sidebar"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2.25rem', padding: '0 4px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(99,102,241,0.55)' }}>
            <Brain size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: '1.25rem', letterSpacing: '4px', color: '#fff' }}>KENAPSE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-body)' }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }}>{displayName}</div>
            <div style={{ fontSize: '0.71rem', color: isAdmin ? '#f87171' : '#818cf8', fontFamily: 'var(--font-body)', marginTop: '1px' }}>{isAdmin ? '⬡ Admin' : '◈ Student'}</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
          {mainNavItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => navigate(item.path)} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.87rem', fontFamily: 'var(--font-body)', background: item.active ? 'rgba(99,102,241,0.13)' : 'transparent', color: item.accent || (item.active ? '#c7d2fe' : '#94a3b8'), borderLeft: `2px solid ${item.active ? '#6366f1' : item.accent || 'transparent'}`, transition: 'all 0.18s' }}>
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '1rem 0' }} />
        <button onClick={async () => { await signOut(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px', width: '100%', border: 'none', cursor: 'pointer', fontSize: '0.87rem', fontFamily: 'var(--font-body)', background: 'transparent', color: '#64748b', transition: 'all 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(244,63,94,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="animate-fade-in" style={{ flex: 1, padding: '2.75rem', position: 'relative', zIndex: 1 }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '0.76rem', color: '#475569', letterSpacing: '2px', fontFamily: 'var(--font-body)', marginBottom: '6px' }}>PREFERENCES</p>
          <h1 style={{ fontSize: '2.5rem', letterSpacing: '3px', lineHeight: 1.1 }}>Settings</h1>
        </div>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Settings category sidebar */}
          <div style={{ width: '200px', flexShrink: 0, background: 'rgba(10,10,16,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0.75rem', alignSelf: 'flex-start' }}>
            {sideNavItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '0.88rem', fontFamily: 'var(--font-body)', textAlign: 'left',
                  background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: active ? '#c7d2fe' : '#64748b',
                  borderLeft: `2px solid ${active ? '#6366f1' : 'transparent'}`,
                  transition: 'all 0.18s',
                }}>
                  <Icon size={15} /> {item.label}
                  {active && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
          </div>

          {/* Settings content */}
          <div style={{ flex: 1, minWidth: '280px', background: 'rgba(10,10,16,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '2rem' }}>

            {activeTab === 'general' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', letterSpacing: '2px', marginBottom: '1.75rem' }}>General</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', color: '#64748b', letterSpacing: '1.5px', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-body)' }}>
                      DIFFICULTY ADJUSTMENT
                    </label>
                    <select value={settings.difficultyAdjustment} onChange={e => setSettings({ ...settings, difficultyAdjustment: e.target.value })} style={selectStyle}>
                      <option value="auto">Automatic (AI managed)</option>
                      <option value="manual">Manual</option>
                    </select>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
                      When set to automatic, Kenapse adjusts lesson and quiz difficulty based on your performance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', letterSpacing: '2px', marginBottom: '1.75rem' }}>Notifications</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <SettingRow label="Push Notifications" desc="Alerts for new courses, quiz reminders, and streak updates.">
                    <Toggle on={settings.notifications} onToggle={() => handleToggle('notifications')} />
                  </SettingRow>
                  <SettingRow label="Weekly Digest" desc="A weekly email summarising your learning progress and suggestions.">
                    <Toggle on={settings.weeklyDigest} onToggle={() => handleToggle('weeklyDigest')} />
                  </SettingRow>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', letterSpacing: '2px', marginBottom: '1.75rem' }}>Appearance</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', color: '#64748b', letterSpacing: '1.5px', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-body)' }}>THEME</label>
                    <select value={settings.theme} onChange={e => setSettings({ ...settings, theme: e.target.value })} style={selectStyle}>
                      <option value="dark">Cinematic Dark</option>
                      <option value="light">Light Mode (Coming Soon)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div>
                <h2 style={{ fontSize: '1.3rem', letterSpacing: '2px', marginBottom: '1.75rem' }}>Privacy & Security</h2>
                <p style={{ color: '#64748b', fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '2rem' }}>
                  Your learning data is private. Kenapse does not share your generated courses or quiz performance with third parties.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '11px 20px', borderRadius: '10px', cursor: 'pointer',
                      background: 'rgba(244,63,94,0.08)',
                      border: '1px solid rgba(244,63,94,0.25)',
                      color: '#f87171', fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.14)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.08)'}
                  >
                    Sign Out & Clear Data
                  </button>
                ) : (
                  <div style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '14px', padding: '1.5rem' }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#f87171', fontFamily: 'var(--font-body)' }}>Are you sure?</p>
                    <p style={{ color: '#64748b', fontSize: '0.87rem', marginBottom: '1.5rem', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
                      This will sign you out and clear all local data. Your courses and account data on the server will remain intact.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={handleDeleteAccount} disabled={isDeleting} style={{ padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#f87171', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                        {isDeleting ? 'Signing out...' : 'Yes, clear & sign out'}
                      </button>
                      <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            {activeTab !== 'privacy' && (
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                {saveStatus === 'saved' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.87rem', fontFamily: 'var(--font-body)' }}>
                    <Check size={15} /> Saved
                  </div>
                )}
                {saveStatus === 'error' && (
                  <span style={{ color: '#f87171', fontSize: '0.87rem', fontFamily: 'var(--font-body)' }}>Failed to save</span>
                )}
                <button
                  onClick={handleSave}
                  style={{
                    padding: '11px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 600,
                    boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                    transition: 'all 0.2s',
                  }}
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) { .settings-sidebar { display: none !important; } }
      `}</style>
    </div>
  );
};

export default SettingsPage;
