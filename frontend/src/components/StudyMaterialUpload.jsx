import React, { useState } from 'react';
import { Upload, File } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kenapse-production.up.railway.app';

const StudyMaterialUpload = () => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading to storage...');

    try {
      const userId = user?.id || 'anonymous';
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('materials')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath);
        
      setUploadStatus('Processing with AI...');

      // 2. Send to Backend to process
      const response = await fetch(`${API_BASE_URL}/materials/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: publicUrlData.publicUrl,
          file_name: file.name,
          user_id: userId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || response.statusText || 'Unknown error';
        throw new Error(`Backend error (${response.status}): ${errorMsg}`);
      }

      const result = await response.json();
      
      // Fetch the newly generated chapters from Supabase
      if (result.material_id) {
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .eq('material_id', result.material_id)
          .order('order_index', { ascending: true });

        if (!chaptersError && chaptersData && chaptersData.length > 0) {
          const course = {
            course_title: file.name.replace(/\.[^/.]+$/, ""),
            chapters: chaptersData.map((ch, idx) => ({
              chapter_id: ch.id,
              title: ch.title,
              objective: ch.objective,
              status: idx === 0 ? 'active' : 'locked'
            }))
          };
          localStorage.setItem('currentCourse', JSON.stringify(course));
          setUploadStatus('Successfully uploaded and course generated!');
          setFile(null);
          // Redirect to the course flow page
          setTimeout(() => navigate(`/course/${result.material_id}`), 1000);
          return;
        } else {
          throw new Error('Course generation completed, but no chapters were found.');
        }
      }

      setUploadStatus('Successfully uploaded, but failed to retrieve chapters.');
      setFile(null);
      setTimeout(() => setUploadStatus(''), 5000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`Error: ${error.message || 'Upload failed. Please try again.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <File size={24} color="var(--accent-color)" /> Upload Study Material
      </h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Upload a PDF or text file. Our AI will automatically generate a structured course and quizzes for you.
      </p>
      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{
          border: '2px dashed var(--glass-border)',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <input 
            type="file" 
            id="file-upload" 
            accept=".pdf,.txt"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <Upload size={32} color={file ? "var(--accent-color)" : "var(--text-muted)"} />
            <span style={{ color: file ? 'var(--text-color)' : 'var(--text-muted)' }}>
              {file ? file.name : 'Click to select a PDF or TXT file'}
            </span>
          </label>
        </div>
        
        {uploadStatus && (
          <div style={{ fontSize: '0.9rem', color: uploadStatus.includes('Error') ? '#ef4444' : 'var(--accent-color)' }}>
            {uploadStatus}
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={!file || isUploading}
        >
          {isUploading ? 'Processing...' : 'Upload & Generate Course'}
        </button>
      </form>
    </div>
  );
};

export default StudyMaterialUpload;
