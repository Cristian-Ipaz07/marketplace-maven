import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://uovgzbedxxjatlfsbatv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdmd6YmVkeHhqYXRsZnNiYXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjQzMzgsImV4cCI6MjA1MTYwMDMzOH0.kAUGm9lSOCinMWoq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
