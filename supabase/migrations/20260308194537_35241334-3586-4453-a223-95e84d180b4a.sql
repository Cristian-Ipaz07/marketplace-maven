
-- Daily covers table: stores cover images per day of week
CREATE TABLE public.daily_covers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week text NOT NULL,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own covers" ON public.daily_covers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own covers" ON public.daily_covers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own covers" ON public.daily_covers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own covers" ON public.daily_covers FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for daily covers
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-covers', 'daily-covers', true);

-- Storage policies for daily-covers bucket
CREATE POLICY "Users can upload covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'daily-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'daily-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public can view covers" ON storage.objects FOR SELECT TO public USING (bucket_id = 'daily-covers');
