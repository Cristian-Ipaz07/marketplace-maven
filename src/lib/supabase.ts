import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Guardar para que la extensión pueda leerlos desde el mundo aislado (Isolated World)
if (typeof window !== "undefined") {
  localStorage.setItem("__MM_SUPABASE_URL", SUPABASE_URL);
  localStorage.setItem("__MM_SUPABASE_KEY", SUPABASE_ANON_KEY);
  (window as any).__SUPABASE_URL__ = SUPABASE_URL;
  (window as any).__SUPABASE_ANON_KEY__ = SUPABASE_ANON_KEY;
}
