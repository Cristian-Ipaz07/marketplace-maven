-- ============================================================
-- MarketMaster Migration: Admin Subscription & Role Management
-- Fecha: 2026-10-16
-- ============================================================

-- 1. Función RPC para guardar o actualizar suscripciones desde el panel de admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_save_user_subscription(
  p_user_id uuid,
  p_plan text,
  p_daily_limit integer,
  p_price integer,
  p_is_trial boolean,
  p_trial_ends_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sub_id uuid;
  caller_email text;
  is_admin boolean;
BEGIN
  caller_email := auth.jwt() ->> 'email';

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'admin'
  ) INTO is_admin;

  IF NOT is_admin AND caller_email != 'ipazcristian34@gmail.com' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden modificar suscripciones';
  END IF;

  -- Buscar si el usuario ya tiene suscripción registrada
  SELECT id INTO v_sub_id
  FROM public.subscriptions
  WHERE user_id = p_user_id
  ORDER BY active DESC, created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET plan = p_plan,
        daily_limit = p_daily_limit,
        price = p_price,
        is_trial = p_is_trial,
        trial_ends_at = p_trial_ends_at,
        expires_at = p_expires_at,
        active = true,
        updated_at = now()
    WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.subscriptions (
      user_id, plan, daily_limit, price, is_trial, trial_ends_at, expires_at, active
    ) VALUES (
      p_user_id, p_plan, p_daily_limit, p_price, p_is_trial, p_trial_ends_at, p_expires_at, true
    ) RETURNING id INTO v_sub_id;
  END IF;

  RETURN json_build_object('success', true, 'subscription_id', v_sub_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_user_subscription TO authenticated;

-- 2. Función RPC para asignar o remover rol de admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_toggle_role(
  p_target_user_id uuid,
  p_role text,
  p_assign boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
  is_admin boolean;
BEGIN
  caller_email := auth.jwt() ->> 'email';

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'admin'
  ) INTO is_admin;

  IF NOT is_admin AND caller_email != 'ipazcristian34@gmail.com' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden gestionar roles';
  END IF;

  IF p_assign THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = p_target_user_id AND role::text = p_role
    ) THEN
      INSERT INTO public.user_roles (user_id, role) 
      VALUES (p_target_user_id, p_role::public.app_role);
    END IF;
  ELSE
    DELETE FROM public.user_roles 
    WHERE user_id = p_target_user_id AND role::text = p_role;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_role TO authenticated;

-- 3. Habilitar permisos de INSERT y UPDATE a administradores en la tabla subscriptions
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins and users can insert subscriptions" ON public.subscriptions;

CREATE POLICY "Admins and users can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins and users can update subscriptions" ON public.subscriptions;

CREATE POLICY "Admins and users can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Habilitar permisos en user_roles para administradores
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (
    (auth.jwt() ->> 'email') = 'ipazcristian34@gmail.com'
    OR public.has_role(auth.uid(), 'admin')
  );
