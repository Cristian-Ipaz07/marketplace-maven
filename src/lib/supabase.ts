import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://flacwzwbqbbgqhzwrepg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsYWN3endicWJiZ3FoendyZXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODE3NzIsImV4cCI6MjA5MDc1Nzc3Mn0.TP_a9ke1V-laN7kFUojpK_N5duAW7rXceZnk0xNsQUE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
