import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Save, BookOpen, CheckCircle, Star } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import AvatarUpload from '../components/AvatarUpload';
import { getUserCourses } from '../services/api';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, profile, fetchProfile } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Student';
  const email = user?.email || '';

  const memberSince = (() => {
    const raw = user?.created_at;
    if (!raw) return '—';
    return new Date(raw).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  const [editName, setEditName] = useState(displayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [stats, setStats] = useState({ courses: 0, completedChapters: 0, avgScore: null });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getUserCourses(user.id)
      .then(data => {
        const completedChapters = data.reduce((acc, m) => acc + (m.completed_chapters ?? 0), 0);
        const scores = JSON.parse(localStorage.getItem('quiz_scores') || '[]');
        const avgScore = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        setStats({ courses: data.length, completedChapters, avgScore });
      })
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [user?.id]);

  const handleSaveName = async () => {
    if (!editName.trim() || !user) return;
    setIsSaving(true);
    try {
      await supabase.auth.updateUser({ data: { name: editName.trim(), full_name: editName.trim() } });
      await fetchProfile(user.id);
      setIsEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      console.error('Name update failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button className="btn btn-outline" style={{ alignSelf: 'flex-start', marginBottom: '2rem' }} onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Back to Dashboard
      </button>

      <div className="glass-panel animate-fade-in" style={{ padding: '3rem' }}>
        <h1 style={{ marginBottom: '2rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <User size={28} /> My Profile
        </h1>

        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar with upload */}
          <AvatarUpload size={120} />

          {/* Details */}
          <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Editable name */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Full Name</label>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-field"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleSaveName} disabled={isSaving} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Save size={15} /> {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-outline" onClick={() => { setIsEditingName(false); setEditName(displayName); }} style={{ padding: '8px 12px' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingName(true)}
                  style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  title="Click to edit"
                >
                  <span>{displayName}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{nameSaved ? '✓ Saved' : 'Click to edit'}</span>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email Address</label>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} color="var(--text-muted)" /> {email}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Member Since</label>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                {memberSince}
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '3rem 0' }} />

        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Learning Statistics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
            <BookOpen size={24} color="var(--accent-color)" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{statsLoading ? '—' : stats.courses}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Courses Generated</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
            <CheckCircle size={24} color="#10b981" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{statsLoading ? '—' : stats.completedChapters}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chapters Completed</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
            <Star size={24} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {statsLoading ? '—' : stats.avgScore !== null ? `${stats.avgScore}%` : 'N/A'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Quiz Score</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
