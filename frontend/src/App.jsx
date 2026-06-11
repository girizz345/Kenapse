import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import LiveBackground from './components/LiveBackground';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import CourseFlow from './pages/CourseFlow';
import LessonView from './pages/LessonView';
import QuizView from './pages/QuizView';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import MyCoursesPage from './pages/MyCoursesPage';
import AdminDashboard from './pages/AdminDashboard';
import SetupPage from './pages/SetupPage';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '4rem 3rem', maxWidth: '480px' }}>
        <h1 style={{ fontSize: '5rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-color)', margin: 0 }}>404</h1>
        <h2 style={{ marginBottom: '1rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>The page you're looking for doesn't exist.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <LiveBackground />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/setup" element={<SetupPage />} />

              {/* Protected routes — require login */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/course/:materialId" element={<ProtectedRoute><CourseFlow /></ProtectedRoute>} />
              <Route path="/courses" element={<ProtectedRoute><MyCoursesPage /></ProtectedRoute>} />
              <Route path="/lesson/:materialId/:chapterId" element={<ProtectedRoute><LessonView /></ProtectedRoute>} />
              <Route path="/quiz/:materialId/:chapterId" element={<ProtectedRoute><QuizView /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

              {/* Admin only */}
              <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
