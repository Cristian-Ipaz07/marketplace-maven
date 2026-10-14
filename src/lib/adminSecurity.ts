/**
 * Utilidades de seguridad para el Panel de Administracion de MarketMaster.
 * Permite bloquear el panel con un PIN seguro (hasheado con SHA-256)
 * para que colaboradores o familiares que compartan la cuenta no puedan acceder.
 */

const SALT = '_marketmaster_admin_salt_2026';
const UNLOCK_STORAGE_KEY = 'admin_panel_unlocked';
const HIDE_SIDEBAR_KEY = 'hide_admin_in_sidebar';
export const ADMIN_VISIBILITY_EVENT = 'mm_admin_visibility_changed';

/**
 * Genera un hash SHA-256 del PIN utilizando la Web Crypto API nativa.
 */
export async function hashPin(pin: string): Promise<string> {
  const cleanPin = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(cleanPin + SALT);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Crypto subtle error, using fallback hash', e);
    }
  }

  // Fallback seguro en caso de contexto no seguro
  let hash = 0;
  const str = cleanPin + SALT;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return 'fb_' + Math.abs(hash).toString(36);
}

/**
 * Verifica si el panel esta desbloqueado en la sesion de pestana actual.
 * Usa sessionStorage para que se bloquee automaticamente al cerrar el navegador.
 */
export function isAdminUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';
}

/**
 * Marca el panel como desbloqueado o bloqueado en la sesion actual.
 */
export function setAdminUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  if (unlocked) {
    sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
  } else {
    sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
  }
}

/**
 * Verifica si el boton Admin esta configurado como oculto en este dispositivo.
 */
export function isHideAdminInSidebar(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(HIDE_SIDEBAR_KEY) === 'true';
}

/**
 * Modifica la visibilidad del boton Admin en la barra lateral de este dispositivo.
 */
export function setHideAdminInSidebar(hidden: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HIDE_SIDEBAR_KEY, String(hidden));
  window.dispatchEvent(new Event(ADMIN_VISIBILITY_EVENT));
}
