
-- Add location and condition columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location text DEFAULT null;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition text DEFAULT 'Nuevo';

-- Add day_of_week to publish_configs
ALTER TABLE public.publish_configs ADD COLUMN IF NOT EXISTS day_of_week text DEFAULT null;

-- Create product_images table
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images" ON public.product_images FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own images" ON public.product_images FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-images');
CREATE POLICY "Users can delete own product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
