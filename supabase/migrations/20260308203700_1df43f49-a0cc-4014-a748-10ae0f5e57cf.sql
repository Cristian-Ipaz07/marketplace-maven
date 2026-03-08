
-- Subscriptions table for plan management
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'basico',
  daily_limit integer NOT NULL DEFAULT 15,
  price integer NOT NULL DEFAULT 30000,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Add chrome_profile_path to connected_accounts
ALTER TABLE public.connected_accounts ADD COLUMN chrome_profile_path text;

-- Publication log table
CREATE TABLE public.publication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  cover_id uuid,
  profile_id uuid,
  category text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.publication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.publication_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON public.publication_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own logs" ON public.publication_logs FOR UPDATE USING (auth.uid() = user_id);

-- Campaign execution state table
CREATE TABLE public.campaign_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week text NOT NULL,
  total_publications integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle',
  started_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own executions" ON public.campaign_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own executions" ON public.campaign_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own executions" ON public.campaign_executions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own executions" ON public.campaign_executions FOR DELETE USING (auth.uid() = user_id);
