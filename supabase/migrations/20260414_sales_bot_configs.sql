-- ============================================================
-- Migración: sales_bot_configs
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_bot_configs (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES auth.users NOT NULL,
  business_name         text,
  business_description  text,
  products              text[] DEFAULT '{}',
  price_range           text,
  tone                  text DEFAULT 'friendly' CHECK (tone IN ('friendly','professional','urgent','spiritual')),
  custom_rules          text,
  preferred_model       text DEFAULT 'groq-llama-70b',
  copilot_mode          boolean DEFAULT true,
  delay_ms              integer DEFAULT 1500,
  quick_replies         jsonb DEFAULT '[]'::jsonb,
  updated_at            timestamptz DEFAULT now(),

  CONSTRAINT one_config_per_user UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.sales_bot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own config"
  ON public.sales_bot_configs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice
CREATE INDEX IF NOT EXISTS sales_bot_configs_user_id_idx
  ON public.sales_bot_configs (user_id);
