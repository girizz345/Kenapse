import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NeuralProgress from '../components/NeuralProgress';
import { getChapters } from '../services/api';
import { supabase } from '../lib/supabaseClient';

const CourseFlow = () => {
  const { materialId } = useParams();
  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // When QuizView completes a chapter it sets sessionStorage.animateImpulseFrom
  // before navigating back here. We detect it and fire the global brain pulse event.
  useEffect(() => {
    const flag = sessionStorage.getItem('animateImpulseFrom');
    if (flag !== null) {
      window.dispatchEvent(new CustomEvent('brain-pulse'));
    }
  }, []);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        let chaptersData;
        try {
          chaptersData = await getChapters(materialId);
        } catch {
          const { data, error } = await supabase
            .from('chapters')
            .select('*')
            .eq('material_id', materialId)
            .order('order_index');
          if (error) throw new Error(error.message);
          chaptersData = data || [];
        }
        if (chaptersData && chaptersData.length > 0) {
          setCourse({ course_title: 'My Course', chapters: chaptersData });
        }
      } catch (error) {
        console.error('Error fetching course flow:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourseData();
  }, [materialId]);

  if (isLoading) return <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading your path...</div>;
  if (!course) return <div className="page-container">Course not found.</div>;

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <button className="btn btn-outline" style={{ alignSelf: 'flex-start', marginBottom: '2rem' }} onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Back to Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{course.course_title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Follow the path to master this topic.</p>
      </div>

      <NeuralProgress chapters={course.chapters} />
    </div>
  );
};

export default CourseFlow;
