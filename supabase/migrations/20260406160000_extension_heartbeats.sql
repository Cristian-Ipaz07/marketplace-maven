-- Tabla de heartbeat para saber si la extensión está activa
CREATE TABLE IF NOT EXISTS public.extension_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  version text DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own heartbeat"
  ON public.extension_heartbeats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own heartbeat"
  ON public.extension_heartbeats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own heartbeat"
  ON public.extension_heartbeats FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can see all heartbeats
CREATE POLICY "Admins can view all heartbeats"
  ON public.extension_heartbeats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
