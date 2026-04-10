-- ============================================================
-- MarketMaster Security Surgery — 2026-04-10
-- Objetivos:
--   1. UNIQUE constraint en connected_accounts(user_id, chrome_profile_path)
--      para habilitar UPSERT atómico sin duplicados.
--   2. RLS explícito y reforzado en connected_accounts (DROP + RECREATE).
--   3. Índice compuesto en publication_logs para consultas por perfil rápidas.
--   4. UNIQUE constraint en publication_logs para evitar logs dobles.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CONNECTED_ACCOUNTS: UNIQUE constraint para UPSERT seguro
-- ─────────────────────────────────────────────────────────────

-- Primero eliminar duplicados que puedan hacer fallar el constraint
DELETE FROM public.connected_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, chrome_profile_path) id
  FROM public.connected_accounts
  WHERE chrome_profile_path IS NOT NULL
  ORDER BY user_id, chrome_profile_path, created_at ASC
)
AND chrome_profile_path IS NOT NULL;

-- Agregar constraint único para habilitar UPSERT por Hardware ID
ALTER TABLE public.connected_accounts
  ADD CONSTRAINT connected_accounts_user_chrome_profile_unique
  UNIQUE (user_id, chrome_profile_path);

-- ─────────────────────────────────────────────────────────────
-- 2. CONNECTED_ACCOUNTS: Reforzar RLS (drop + recreate)
-- ─────────────────────────────────────────────────────────────

-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Users can view own accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.connected_accounts;

-- Recrear con USING + WITH CHECK explícitos en todas las operaciones
CREATE POLICY "Users can view own accounts"
  ON public.connected_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON public.connected_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON public.connected_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON public.connected_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Asegurarse de que RLS está habilitado (idempotente)
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. PUBLICATION_LOGS: Índice compuesto para consultas por perfil
-- ─────────────────────────────────────────────────────────────

-- Índice para acelerar buildPreview (filtro por user_id + profile_id + fecha)
CREATE INDEX IF NOT EXISTS idx_publication_logs_user_profile_date
  ON public.publication_logs (user_id, profile_id, published_at DESC);

-- Índice adicional para el conteo diario
CREATE INDEX IF NOT EXISTS idx_publication_logs_user_date
  ON public.publication_logs (user_id, published_at);

-- ─────────────────────────────────────────────────────────────
-- 4. PUBLICATION_LOGS: Constraint único para evitar logs dobles
--    Clave: un perfil no puede loggear el mismo producto+portada dos veces el mismo día
-- ─────────────────────────────────────────────────────────────

-- Crear función para extraer la fecha de published_at (para usar en unique partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_publication_logs_no_duplicates
  ON public.publication_logs (user_id, profile_id, product_id, cover_id, ((published_at AT TIME ZONE 'UTC')::date))
  WHERE status = 'success';

-- ─────────────────────────────────────────────────────────────
-- 5. PUBLICATION_LOGS: Reforzar RLS
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own logs" ON public.publication_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.publication_logs;
DROP POLICY IF EXISTS "Users can update own logs" ON public.publication_logs;

CREATE POLICY "Users can view own logs"
  ON public.publication_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON public.publication_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON public.publication_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.publication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_logs FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 6. Comentarios de auditoría
-- ─────────────────────────────────────────────────────────────
COMMENT ON CONSTRAINT connected_accounts_user_chrome_profile_unique
  ON public.connected_accounts
  IS 'Garantiza que cada Hardware ID (chrome_profile_path) sea único por usuario. Habilita UPSERT atómico desde la extensión.';

COMMENT ON INDEX idx_publication_logs_no_duplicates
  IS 'Previene que el mismo perfil loggee el mismo producto+portada dos veces en el mismo día.';
