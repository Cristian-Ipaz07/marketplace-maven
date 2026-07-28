-- Migration to add alternative titles and descriptions for anti-spam rotation
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS title_alternatives TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS description_alternatives TEXT[] DEFAULT '{}';
