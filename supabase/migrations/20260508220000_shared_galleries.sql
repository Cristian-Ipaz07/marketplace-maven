-- ============================================================
-- Galería de Imágenes Compartidas
-- Permite crear conjuntos de imágenes de apoyo reutilizables
-- entre múltiples productos (ej: "Lociones Hombre", "Lociones Mujer")
-- ============================================================

-- Tabla de galerías (conjuntos nombrados)
DROP TABLE IF EXISTS public.shared_gallery_images CASCADE;
DROP TABLE IF EXISTS public.shared_galleries CASCADE;

CREATE TABLE public.shared_galleries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de imágenes dentro de cada galería
CREATE TABLE public.shared_gallery_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_id  UUID NOT NULL REFERENCES public.shared_galleries(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Columna en products para referenciar una galería (ya puede existir, se usa IF NOT EXISTS)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS shared_gallery_id UUID REFERENCES public.shared_galleries(id) ON DELETE SET NULL;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_shared_galleries_user     ON public.shared_galleries(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_gallery_images_gal ON public.shared_gallery_images(gallery_id);
CREATE INDEX IF NOT EXISTS idx_products_shared_gallery   ON public.products(shared_gallery_id);

-- RLS — Cada usuario solo accede a sus galerías
ALTER TABLE public.shared_galleries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_gallery_images  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "galleries_own"        ON public.shared_galleries;
DROP POLICY IF EXISTS "gallery_images_own"   ON public.shared_gallery_images;

CREATE POLICY "galleries_own" ON public.shared_galleries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gallery_images_own" ON public.shared_gallery_images
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket para imágenes de galerías compartidas
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-images', 'gallery-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "gallery_images_storage_own" ON storage.objects;
CREATE POLICY "gallery_images_storage_own" ON storage.objects
    FOR ALL USING (
        bucket_id = 'gallery-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
        bucket_id = 'gallery-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
