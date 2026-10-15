-- ============================================================
-- MarketMaster Migration: Strict User Isolation & Admin RPC
-- Fecha: 2026-10-14
-- ============================================================

-- 1. Asegurar rol admin para ipazcristian34@gmail.com sin depender de constraints ON CONFLICT
DO $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin'::public.app_role
  FROM auth.users u
  WHERE u.email = 'ipazcristian34@gmail.com'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = u.id AND ur.role = 'admin'
    );
END $$;

-- 2. Función RPC para listar usuarios en el Panel de Administrador directamente desde auth.users
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result json;
  caller_email text;
  is_admin boolean;
BEGIN
  -- Obtener email del usuario autenticado
  caller_email := auth.jwt() ->> 'email';

  -- Validar si es admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin AND caller_email != 'ipazcristian34@gmail.com' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden ver la lista completa de usuarios';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', u.id,
      'email', COALESCE(u.email, p.display_name, 'Usuario'),
      'created_at', u.created_at,
      'profile', CASE WHEN p.id IS NOT NULL THEN json_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url) ELSE NULL END,
      'subscription', CASE WHEN s.id IS NOT NULL THEN json_build_object(
        'id', s.id,
        'plan', s.plan,
        'daily_limit', s.daily_limit,
        'price', s.price,
        'is_trial', s.is_trial,
        'trial_ends_at', s.trial_ends_at,
        'expires_at', s.expires_at,
        'active', s.active
      ) ELSE NULL END,
      'roles', ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id)
    )
    ORDER BY u.created_at DESC
  ) INTO result
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT * FROM public.subscriptions sub 
    WHERE sub.user_id = u.id 
    ORDER BY sub.active DESC, sub.created_at DESC 
    LIMIT 1
  ) s ON true;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

-- 3. Reforzar RLS en la tabla PROFILES para que Administradores puedan ver todos los perfiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
  );

-- 4. Reforzar RLS en la tabla SUBSCRIPTIONS para que Administradores puedan ver todas las suscripciones
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

CREATE POLICY "Users and admins can view subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin') 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
  );

-- 5. Reforzar RLS en la tabla PRODUCTS (AISLAMIENTO TOTAL ESTRICTO)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;

CREATE POLICY "Users can view own products"
  ON public.products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON public.products FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON public.products FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Reforzar RLS en la tabla DAILY_COVERS
ALTER TABLE public.daily_covers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_covers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own covers" ON public.daily_covers;
DROP POLICY IF EXISTS "Users can insert own covers" ON public.daily_covers;
DROP POLICY IF EXISTS "Users can update own covers" ON public.daily_covers;
DROP POLICY IF EXISTS "Users can delete own covers" ON public.daily_covers;

CREATE POLICY "Users can view own covers"
  ON public.daily_covers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own covers"
  ON public.daily_covers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own covers"
  ON public.daily_covers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own covers"
  ON public.daily_covers FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Reforzar RLS en SHARED_GALLERIES y SHARED_GALLERY_IMAGES
ALTER TABLE public.shared_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_galleries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own galleries" ON public.shared_galleries;
DROP POLICY IF EXISTS "Users can insert own galleries" ON public.shared_galleries;
DROP POLICY IF EXISTS "Users can update own galleries" ON public.shared_galleries;
DROP POLICY IF EXISTS "Users can delete own galleries" ON public.shared_galleries;

CREATE POLICY "Users can view own galleries"
  ON public.shared_galleries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own galleries"
  ON public.shared_galleries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own galleries"
  ON public.shared_galleries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own galleries"
  ON public.shared_galleries FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Reforzar RLS en PUBLISH_CONFIGS
ALTER TABLE public.publish_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own config" ON public.publish_configs;
DROP POLICY IF EXISTS "Users can insert own config" ON public.publish_configs;
DROP POLICY IF EXISTS "Users can update own config" ON public.publish_configs;
DROP POLICY IF EXISTS "Users can delete own config" ON public.publish_configs;

CREATE POLICY "Users can view own config"
  ON public.publish_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
  ON public.publish_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON public.publish_configs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own config"
  ON public.publish_configs FOR DELETE
  USING (auth.uid() = user_id);
