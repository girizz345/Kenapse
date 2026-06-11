import { createClient } from '@supabase/supabase-js';

// Fallback values ensure the client works even if Vite env vars aren't picked up during build
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://riusdktnbevcsdjkpktq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXNka3RuYmV2Y3Nkamtwa3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDU1MTEsImV4cCI6MjA5NDMyMTUxMX0.UD4V9osCKo--AiH6A1xi9jckxw1EWK5qHcw4-utDpws';

// Use sessionStorage so each browser tab has an independent session.
// This prevents a login in one tab from logging out another tab.
const sessionStorageAdapter = {
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => sessionStorage.setItem(key, value),
  removeItem: (key) => sessionStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorageAdapter,
    storageKey: 'kenapse-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
