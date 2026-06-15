import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, User, Settings, LogOut, Activity, Shield,
  Flame, Trophy, ArrowRight, Upload, File,
  Brain, Sparkles, ChevronRight, Zap,
} from 'lucide-react';
import { generateCourse, getUserCourses } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

// ── Animated counter (ease-out cubic) ────────────────────────────────────────
function useCounter(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Still up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const LEVELS = [
  { value: 'beginner',     label: 'Beginner',     sub: 'New to the topic',  color: '#10b981' },
  { value: 'intermediate', label: 'Intermediate', sub: 'Some experience',   color: '#6366f1' },
  { value: 'advanced',     label: 'Advanced',     sub: 'Deep knowledge',    color: '#f59e0b' },
];

// ── Component ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [topic,        setTopic]        = useState('');
  const [level,        setLevel]        = useState('intermediate');
  const [duration,     setDuration]     = useState(5);
  const [isLoading,    setIsLoading]    = useState(false);
  const [stats,        setStats]        = useState({ courses: 0, avgScore: null, lastCourse: null });
  const [activeTab,    setActiveTab]    = useState('ai');
  const [usageStats,   setUsageStats]   = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [file,         setFile]         = useState(null);
  const [isUploading,  setIsUploading]  = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragOver,     setDragOver]     = useState(false);
  const [isMobile,     setIsMobile]     = useState(window.innerWidth < 900);
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  const displayName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Student';
  const firstName   = displayName.split(' ')[0];
  const initials    = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const coursesCount  = useCounter(stats.courses);
  const avgScoreCount = useCounter(stats.avgScore ?? 0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getUserCourses(user.id)
      .then(data => {
        const scores = JSON.parse(localStorage.getItem('quiz_scores') || '[]');
        const avg = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        setStats({ courses: data.length, avgScore: avg, lastCourse: data[0] || null });
      })
      .catch(console.error);
  }, [user?.id]);

  // ── AI usage fetch ──────────────────────────────────────────────────────────
  const fetchUsage = async () => {
    setUsageLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const API_BASE = import.meta.env.VITE_API_URL || 'https://kenapse-production.up.railway.app';
      const res = await fetch(`${API_BASE}/user/tokens`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setUsageStats(await res.json());
    } catch { /* non-critical */ } finally {
      setUsageLoading(false);
    }
  };

  // ── Course generator ────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const course = await generateCourse(topic, level, duration, user?.id);
      localStorage.setItem('currentCourse', JSON.stringify(course));
      let materialId = course.material_id;
      if (!materialId && user?.id && course.chapters?.length) {
        const matId = crypto.randomUUID();
        const { error: matErr } = await supabase.from('study_materials').insert({
          id: matId, user_id: user.id, file_url: '', file_name: course.course_title || topic,
        });
        if (!matErr) {
          for (let i = 0; i < course.chapters.length; i++) {
            const ch = course.chapters[i];
            await supabase.from('chapters').insert({
              material_id: matId, title: ch.title, objective: ch.objective || '',
              topics: ch.topics || [], order_index: i + 1,
              status: i === 0 ? 'active' : 'locked',
            });
          }
          materialId = matId;
        }
      }
      if (materialId) navigate(`/course/${materialId}`);
      else alert('Failed to save course. Please try again.');
    } catch (err) {
      console.error(err);
      alert('Failed to generate course. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.pdf') || f.name.endsWith('.txt'))) setFile(f);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setUploadStatus('Uploading file...');
    try {
      const userId  = user?.id || 'anonymous';
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error } = await supabase.storage.from('materials').upload(filePath, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('materials').getPublicUrl(filePath);
      setUploadStatus('Analyzing with AI...');
      const API_BASE = import.meta.env.VITE_API_URL || 'https://kenapse-production.up.railway.app';
      const res = await fetch(`${API_BASE}/materials/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: pub.publicUrl, file_name: file.name, user_id: userId }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      if (result.material_id) {
        const { data: chs } = await supabase
          .from('chapters').select('*')
          .eq('material_id', result.material_id).order('order_index');
        if (chs?.length) {
          setUploadStatus('Course ready! Redirecting...');
          setTimeout(() => navigate(`/course/${result.material_id}`), 700);
          return;
        }
      }
      setUploadStatus('Upload complete.');
      setFile(null);
    } catch (err) {
      setUploadStatus(`Failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Nav ─────────────────────────────────────────────────────────────────────
  const navItems = [
    { label: 'Dashboard',  icon: Activity,  path: '/dashboard', active: true },
    { label: 'My Courses', icon: BookOpen,  path: '/courses' },
    { label: 'Profile',    icon: User,      path: '/profile' },
    { label: 'Settings',   icon: Settings,  path: '/settings' },
  ];
  if (isAdmin) navItems.push({ label: 'Admin Panel', icon: Shield, path: '/admin', accent: '#f43f5e' });

  const statCards = [
    {
      icon: BookOpen, color: '#6366f1',
      bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)', glow: 'rgba(99,102,241,0.18)',
      label: 'Courses Created', value: coursesCount, suffix: '',
    },
    {
      icon: Trophy, color: '#10b981',
      bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', glow: 'rgba(16,185,129,0.15)',
      label: 'Avg Quiz Score', value: stats.avgScore !== null ? avgScoreCount : null, suffix: '%',
    },
    {
      icon: Flame, color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', glow: 'rgba(245,158,11,0.15)',
      label: 'Day Streak', value: 1, suffix: ' day',
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>

      {/* Ambient blobs */}
      <div style={{ position: 'fixed', top: '-15%', right: '5%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '0%', left: '15%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '40%', right: '30%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {!isMobile && (
        <aside style={{
          width: '230px', flexShrink: 0,
          background: 'rgba(6,6,10,0.97)',
          borderRight: '1px solid rgba(255,255,255,0.055)',
          display: 'flex', flexDirection: 'column',
          padding: '1.75rem 1.1rem',
          position: 'sticky', top: 0, height: '100vh',
          zIndex: 10,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2.25rem', padding: '0 4px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(99,102,241,0.55)',
            }}>
              <Brain size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: '1.25rem', letterSpacing: '4px', color: '#fff' }}>
              KENAPSE
            </span>
          </div>

          {/* User chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '11px',
            padding: '12px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            marginBottom: '1.75rem',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.88rem', fontWeight: 700, color: 'white',
              fontFamily: 'var(--font-body)',
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '1.02rem', color: isAdmin ? '#f87171' : '#818cf8', fontFamily: 'var(--font-body)', marginTop: '1px' }}>
                {isAdmin ? '⬡ Admin' : '◈ Student'}
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = item.active;
              const accentColor = item.accent;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '11px',
                    padding: '10px 13px', borderRadius: '10px', width: '100%',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: '1.02rem', fontFamily: 'var(--font-body)',
                    background: isActive ? 'rgba(99,102,241,0.13)' : 'transparent',
                    color: accentColor || (isActive ? '#c7d2fe' : '#94a3b8'),
                    borderLeft: `2px solid ${isActive ? '#6366f1' : accentColor || 'transparent'}`,
                    transition: 'all 0.18s',
                    letterSpacing: '0.2px',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e2e8f0'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accentColor || '#94a3b8'; } }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '1rem 0' }} />

          {/* Sign out */}
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '11px',
              padding: '10px 13px', borderRadius: '10px', width: '100%',
              border: 'none', cursor: 'pointer', fontSize: '1.02rem',
              fontFamily: 'var(--font-body)',
              background: 'transparent', color: '#64748b',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(244,63,94,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </aside>
      )}

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main
        className="animate-fade-in"
        style={{
          flex: 1,
          padding: isMobile ? '1.5rem 1.1rem 4rem' : '2.75rem 2.75rem 4rem',
          position: 'relative', zIndex: 1,
          overflowX: 'hidden', maxWidth: '100%',
        }}
      >

        {/* Mobile top nav */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.label} onClick={() => navigate(item.path)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '20px', flexShrink: 0,
                  background: item.active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${item.active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: item.active ? '#c7d2fe' : '#94a3b8',
                  fontSize: '0.88rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
                }}>
                  <Icon size={13} /> {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Greeting ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '2.25rem',
        }}>
          <div>
            <p style={{ fontSize: '1.05rem', color: '#475569', letterSpacing: '2px', fontFamily: 'var(--font-body)', marginBottom: '8px' }}>
              {formatDate()}
            </p>
            <h1 style={{ fontSize: isMobile ? '2rem' : '2.75rem', lineHeight: 1.1, letterSpacing: '3px', margin: 0 }}>
              {getGreeting()},&nbsp;
              <span style={{
                backgroundImage: 'linear-gradient(90deg, #a5b4fc 0%, #818cf8 50%, #c084fc 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {firstName}.
              </span>
            </h1>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 16px', borderRadius: '50px',
            background: 'rgba(245,158,11,0.07)',
            border: '1px solid rgba(245,158,11,0.18)',
            alignSelf: 'flex-end',
          }}>
            <Flame size={14} color="#f59e0b" />
            <span style={{ fontSize: '1.05rem', color: '#fcd34d', fontFamily: 'var(--font-body)' }}>
              Keep the streak going!
            </span>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: '1rem', marginBottom: '1.5rem',
        }}>
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={i}
                style={{
                  background: 'rgba(10,10,16,0.85)',
                  border: `1px solid ${card.border}`,
                  borderRadius: '18px', padding: '1.5rem',
                  boxShadow: `0 0 28px ${card.glow}`,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'default',
                  gridColumn: isMobile && i === 2 ? '1 / -1' : 'auto',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 36px ${card.glow}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 28px ${card.glow}`; }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '11px',
                  background: card.bg, border: `1px solid ${card.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.1rem',
                }}>
                  <Icon size={19} color={card.color} />
                </div>
                <div style={{
                  fontSize: '2.25rem', fontWeight: 700, letterSpacing: '1px',
                  color: '#f8fafc', lineHeight: 1, marginBottom: '6px',
                  fontFamily: 'var(--font-main)',
                }}>
                  {card.value !== null ? `${card.value}${card.suffix}` : '—'}
                </div>
                <div style={{ fontSize: '0.98rem', color: '#64748b', fontFamily: 'var(--font-body)', letterSpacing: '0.3px' }}>
                  {card.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Continue Learning banner ── */}
        {stats.lastCourse && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.09) 0%, rgba(139,92,246,0.06) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '16px', padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '1rem', marginBottom: '1.5rem',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '13px', flexShrink: 0,
                background: 'rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BookOpen size={21} color="#818cf8" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', color: '#818cf8', letterSpacing: '1.8px', marginBottom: '5px', fontFamily: 'var(--font-body)' }}>
                  CONTINUE LEARNING
                </p>
                <p style={{
                  fontSize: '1.12rem', fontWeight: 600, color: '#f1f5f9',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontFamily: 'var(--font-body)',
                }}>
                  {stats.lastCourse.file_name || 'Recent Course'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/course/${stats.lastCourse.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(99,102,241,0.18)',
                border: '1px solid rgba(99,102,241,0.35)',
                color: '#c7d2fe', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '1.08rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.32)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; }}
            >
              Resume <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ── Start Learning card ── */}
        <div style={{
          background: 'rgba(8,8,14,0.92)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '22px', overflow: 'hidden',
          marginBottom: '1.25rem',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 1.75rem',
            background: 'rgba(255,255,255,0.015)',
          }}>
            {[
              { id: 'ai',     label: 'AI Course Generator', icon: Sparkles },
              { id: 'upload', label: 'Upload Material',     icon: Upload   },
              { id: 'usage',  label: 'My AI Usage',         icon: Zap      },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'usage') fetchUsage(); }} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '1.1rem 1rem', marginBottom: '-1px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? '#c7d2fe' : '#64748b',
                  borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                  fontSize: '1.02rem', fontFamily: 'var(--font-body)',
                  transition: 'color 0.18s',
                  letterSpacing: '0.2px',
                }}>
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: '2rem 1.75rem' }}>

            {/* ── AI Generate ── */}
            {activeTab === 'ai' && (
              <form onSubmit={handleGenerate}>
                <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: '1.75rem', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
                  Enter any topic and our AI will build a complete structured course — chapters, lessons, quizzes, and hints — in minutes.
                </p>

                {/* Topic */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1.02rem', color: '#64748b', letterSpacing: '1.8px', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-body)' }}>
                    TOPIC
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. Quantum Computing, French Revolution, Neural Networks..."
                    required
                    style={{
                      width: '100%', padding: '13px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '11px', color: '#f1f5f9',
                      fontFamily: 'var(--font-body)', fontSize: '1.08rem',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                  />
                </div>

                {/* Level pills */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1.02rem', color: '#64748b', letterSpacing: '1.8px', display: 'block', marginBottom: '10px', fontFamily: 'var(--font-body)' }}>
                    DIFFICULTY
                  </label>
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {LEVELS.map(l => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setLevel(l.value)}
                        style={{
                          padding: '10px 18px', borderRadius: '50px', cursor: 'pointer',
                          fontFamily: 'var(--font-body)', fontSize: '0.97rem',
                          border: `1px solid ${level === l.value ? l.color : 'rgba(255,255,255,0.09)'}`,
                          background: level === l.value ? `${l.color}15` : 'rgba(255,255,255,0.025)',
                          color: level === l.value ? l.color : '#64748b',
                          transition: 'all 0.18s', lineHeight: 1,
                        }}
                      >
                        {l.label}
                        <span style={{ display: 'block', fontSize: '0.92rem', opacity: 0.65, marginTop: '3px' }}>
                          {l.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration slider */}
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ fontSize: '1.02rem', color: '#64748b', letterSpacing: '1.8px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontFamily: 'var(--font-body)' }}>
                    DURATION
                    <span style={{ color: '#c7d2fe', letterSpacing: 0, fontWeight: 600 }}>{duration} hours</span>
                    <span style={{ color: '#475569', fontWeight: 400, letterSpacing: 0 }}>
                      · ~{Math.max(3, Math.round(duration * 1.6))} chapters
                    </span>
                  </label>
                  <input
                    type="range" min="1" max="50" value={duration}
                    onChange={e => setDuration(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer', height: '4px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', fontFamily: 'var(--font-body)', marginTop: '5px' }}>
                    <span>1 hr</span><span>25 hrs</span><span>50 hrs</span>
                  </div>
                </div>

                {/* Generate button */}
                <button
                  type="submit"
                  disabled={isLoading || !topic.trim()}
                  style={{
                    width: '100%', padding: '14px',
                    borderRadius: '12px', border: 'none',
                    cursor: isLoading || !topic.trim() ? 'not-allowed' : 'pointer',
                    background: isLoading || !topic.trim()
                      ? 'rgba(99,102,241,0.25)'
                      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#fff',
                    fontSize: '1.08rem', fontFamily: 'var(--font-body)',
                    fontWeight: 600, letterSpacing: '0.3px',
                    boxShadow: isLoading || !topic.trim() ? 'none' : '0 0 28px rgba(99,102,241,0.4), 0 4px 16px rgba(99,102,241,0.25)',
                    transition: 'all 0.25s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  }}
                >
                  {isLoading ? (
                    <>
                      <span style={{
                        display: 'inline-block', width: '15px', height: '15px',
                        border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff',
                        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                      }} />
                      Building your course...
                    </>
                  ) : (
                    <><Sparkles size={16} /> Generate Course</>
                  )}
                </button>
              </form>
            )}

            {/* ── My AI Usage ── */}
            {activeTab === 'usage' && (
              <div>
                <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: '1.75rem', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
                  Your personal AI token usage since the server last started. Resets on each backend restart.
                </p>
                {usageLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontFamily: 'var(--font-body)' }}>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Loading...
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.85rem' }}>
                    {[
                      { label: 'AI Calls',        value: (usageStats?.llm_calls ?? 0).toLocaleString(),        color: '#818cf8', sub: `${(usageStats?.gemini_calls ?? 0)} Gemini · ${(usageStats?.groq_calls ?? 0)} Groq` },
                      { label: 'Tokens Used',     value: ((usageStats?.total_tokens ?? 0)).toLocaleString(),    color: '#34d399', sub: `${(usageStats?.prompt_tokens ?? 0).toLocaleString()} in · ${(usageStats?.completion_tokens ?? 0).toLocaleString()} out` },
                      { label: 'Estimated Cost',  value: `$${(usageStats?.estimated_cost_usd ?? 0).toFixed(4)}`, color: '#fb923c', sub: 'Gemini + Groq blended' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem' }}>
                        <p style={{ fontSize: '0.73rem', color: '#64748b', letterSpacing: '1.2px', fontFamily: 'var(--font-body)', marginBottom: '8px' }}>{stat.label.toUpperCase()}</p>
                        <p style={{ fontSize: '1.6rem', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-main)', letterSpacing: '1px', marginBottom: '5px' }}>{stat.value}</p>
                        <p style={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'var(--font-body)' }}>{stat.sub}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={fetchUsage}
                  disabled={usageLoading}
                  style={{
                    marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)', color: '#64748b',
                    fontFamily: 'var(--font-body)', fontSize: '0.9rem', cursor: 'pointer',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Zap size={13} /> Refresh
                </button>
              </div>
            )}

            {/* ── Upload Material ── */}
            {activeTab === 'upload' && (
              <form onSubmit={handleUpload}>
                <p style={{ fontSize: '1.05rem', color: '#64748b', marginBottom: '1.75rem', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
                  Upload any PDF or text file. We'll extract the content and generate a complete personalized course from it — including chapters, lessons, and quizzes.
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? '#6366f1' : file ? '#10b981' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: '16px', padding: '3rem 2rem',
                    textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'rgba(99,102,241,0.06)' : file ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.22s', marginBottom: '1.25rem',
                  }}
                >
                  <input type="file" id="file-upload" accept=".pdf,.txt" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} style={{ display: 'none' }} />
                  <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    {file ? (
                      <>
                        <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <File size={24} color="#10b981" />
                        </div>
                        <div>
                          <p style={{ color: '#10b981', fontSize: '1.06rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{file.name}</p>
                          <p style={{ color: '#475569', fontSize: '0.98rem', fontFamily: 'var(--font-body)', marginTop: '4px' }}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Upload size={24} color="#818cf8" />
                        </div>
                        <div>
                          <p style={{ color: '#c7d2fe', fontSize: '1.08rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Drop your file here</p>
                          <p style={{ color: '#475569', fontSize: '1.08rem', fontFamily: 'var(--font-body)', marginTop: '4px' }}>
                            or click to browse · PDF or TXT supported
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {/* Status */}
                {uploadStatus && (
                  <div style={{
                    padding: '11px 15px', borderRadius: '10px', marginBottom: '1rem',
                    background: uploadStatus.toLowerCase().includes('fail') || uploadStatus.toLowerCase().includes('error')
                      ? 'rgba(244,63,94,0.08)' : 'rgba(99,102,241,0.09)',
                    border: `1px solid ${uploadStatus.toLowerCase().includes('fail') || uploadStatus.toLowerCase().includes('error')
                      ? 'rgba(244,63,94,0.25)' : 'rgba(99,102,241,0.25)'}`,
                    color: uploadStatus.toLowerCase().includes('fail') || uploadStatus.toLowerCase().includes('error')
                      ? '#f87171' : '#a5b4fc',
                    fontSize: '0.98rem', fontFamily: 'var(--font-body)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    {isUploading && (
                      <span style={{
                        display: 'inline-block', width: '13px', height: '13px', flexShrink: 0,
                        border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#818cf8',
                        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                      }} />
                    )}
                    {uploadStatus}
                  </div>
                )}

                {/* Upload button */}
                <button
                  type="submit"
                  disabled={!file || isUploading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                    cursor: !file || isUploading ? 'not-allowed' : 'pointer',
                    background: !file
                      ? 'rgba(255,255,255,0.05)'
                      : isUploading
                        ? 'rgba(16,185,129,0.35)'
                        : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: !file ? '#475569' : '#fff',
                    fontSize: '1.08rem', fontFamily: 'var(--font-body)', fontWeight: 600,
                    boxShadow: file && !isUploading ? '0 0 24px rgba(16,185,129,0.3), 0 4px 14px rgba(16,185,129,0.2)' : 'none',
                    transition: 'all 0.25s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  }}
                >
                  {isUploading ? (
                    <>
                      <span style={{
                        display: 'inline-block', width: '15px', height: '15px',
                        border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff',
                        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                      }} />
                      {uploadStatus || 'Processing...'}
                    </>
                  ) : (
                    <><Upload size={16} /> Upload & Generate Course</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Quick links ── */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {[
            { label: 'View All Courses', icon: BookOpen, path: '/courses' },
            { label: 'Edit Profile',     icon: User,     path: '/profile' },
          ].map(link => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#64748b', fontFamily: 'var(--font-body)', fontSize: '0.97rem',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
            >
              <link.icon size={14} /> {link.label} <ChevronRight size={12} />
            </button>
          ))}
        </div>

      </main>
    </div>
  );
};

export default Dashboard;
