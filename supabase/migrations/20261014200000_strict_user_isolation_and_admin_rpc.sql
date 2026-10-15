-- ============================================================
-- MarketMaster Migration: Strict User Isolation & Admin RPC
-- Fecha: 2026-10-14 (Compatibilidad Universal de Tipos)
-- ============================================================

-- 1. Crear función has_role con argumento TEXT para compatibilidad total de tipos
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  )
$$;

-- 2. Asegurar rol admin para ipazcristian34@gmail.com con tipos seguros
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'ipazcristian34@gmail.com' LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_admin_id AND role::text = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'admin');
    END IF;
  END IF;
END $$;

-- 3. Función RPC para listar usuarios en el Panel de Administrador directamente desde auth.users
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
  caller_email := auth.jwt() ->> 'email';

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'admin'
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

-- 4. Reforzar RLS en la tabla PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5. Reforzar RLS en la tabla SUBSCRIPTIONS
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users and admins can view subscriptions" ON public.subscriptions;

CREATE POLICY "Users and admins can view subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  );

-- 6. Reforzar RLS en la tabla PRODUCTS (AISLAMIENTO TOTAL)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;

CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- 7. Reforzar RLS en la tabla DAILY_COVERS
ALTER TABLE public.daily_covers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_covers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own covers" ON public.daily_covers;
DROP POLICY IF EXISTS "Users can insert own covers" ON public.daily_covers;
DROP POLICY IF EXISTS "Users can update own covers" ON public.daily_covers;
DROP POLICY IF EXISTS "Users can delete own covers" ON public.daily_covers;

CREATE POLICY "Users can view own covers" ON public.daily_covers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own covers" ON public.daily_covers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own covers" ON public.daily_covers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own covers" ON public.daily_covers FOR DELETE USING (auth.uid() = user_id);
