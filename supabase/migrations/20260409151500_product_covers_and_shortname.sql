-- Migración para añadir short_name a products y enlazar daily_covers con products

-- 1. Añadir short_name a la tabla products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_name TEXT;

-- 2. Limpiar las portadas existentes que estaban basadas en categorías (según lo acordado con el usuario)
DELETE FROM public.daily_covers;

-- 3. Añadir product_id a daily_covers y establecer la relación
ALTER TABLE public.daily_covers ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;

-- 4. category ya no será estrictamente necesario para la lógica de portadas, 
-- pero lo mantenemos para evitar romper cualquier otra query, o se podría eliminar a futuro.
-- Si en algún momento quisiéramos eliminarlo:
-- ALTER TABLE public.daily_covers DROP COLUMN category;
