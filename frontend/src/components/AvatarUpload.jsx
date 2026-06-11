import React, { useRef, useState } from 'react';
import { Camera, Save, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 400,
  useWebWorker: true,
};

const AvatarUpload = ({ size = 120 }) => {
  const { user, profile, fetchProfile } = useAuth();
  const inputRef = useRef(null);

  const [preview, setPreview] = useState(null);
  const [compressedFile, setCompressedFile] = useState(null);
  const [status, setStatus] = useState(null); // 'compressing' | 'uploading' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const currentUrl = profile?.avatar_url ?? null;
  const displayUrl = preview ?? currentUrl;
  const initial = (user?.user_metadata?.name || user?.email || 'S').charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.35);

  const handleFileChange = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = '';

    setErrorMsg('');
    setStatus('compressing');
    try {
      const compressed = await imageCompression(raw, COMPRESSION_OPTIONS);
      setCompressedFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      setStatus(null);
    } catch (err) {
      setErrorMsg('Could not process image. Try a different file.');
      setStatus('error');
    }
  };

  const handleUpload = async () => {
    if (!compressedFile || !user) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      const ext = compressedFile.type.split('/')[1] || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('profiles')
        .upload(path, compressedFile, { upsert: true, contentType: compressedFile.type });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(path);

      // Best-effort: update profiles table (table may not exist yet)
      await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .then(() => {}, () => {});

      await fetchProfile(user.id);
      setPreview(null);
      setCompressedFile(null);
      setStatus('done');
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed');
      setStatus('error');
    }
  };

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCompressedFile(null);
    setStatus(null);
    setErrorMsg('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      {/* Avatar circle */}
      <div
        style={{ position: 'relative', width: `${size}px`, height: `${size}px`, cursor: 'pointer', flexShrink: 0 }}
        onClick={() => !status && inputRef.current?.click()}
        title="Click to change photo"
      >
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: displayUrl ? 'transparent' : 'var(--accent-color)',
          border: '3px solid var(--glass-border)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${fontSize}px`, fontWeight: 'bold', color: 'white',
        }}>
          {displayUrl
            ? <img src={displayUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial}
        </div>
        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
        >
          <Camera size={Math.round(size * 0.25)} color="white" />
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Action buttons when preview is ready */}
      {preview && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={status === 'uploading'}
            style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Save size={14} /> {status === 'uploading' ? 'Saving...' : 'Save Photo'}
          </button>
          <button
            className="btn btn-outline"
            onClick={handleCancel}
            disabled={status === 'uploading'}
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Default change button */}
      {!preview && (
        <button
          className="btn btn-outline"
          onClick={() => inputRef.current?.click()}
          disabled={!!status}
          style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <Camera size={13} /> {status === 'compressing' ? 'Processing...' : 'Change Photo'}
        </button>
      )}

      {status === 'done' && <p style={{ color: '#10b981', fontSize: '0.8rem' }}>✓ Photo updated</p>}
      {errorMsg && <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', maxWidth: '160px' }}>{errorMsg}</p>}
    </div>
  );
};

export default AvatarUpload;
