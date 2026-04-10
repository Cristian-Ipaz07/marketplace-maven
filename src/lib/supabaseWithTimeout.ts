/**
 * withTimeout — Envuelve una promesa con un timeout de red.
 *
 * Si la promesa no resuelve en `ms` milisegundos, lanza un error
 * con código "NETWORK_TIMEOUT" para que los componentes puedan
 * liberarse del estado de carga y mostrar un aviso al usuario.
 *
 * @example
 * const { data, error } = await withTimeout(
 *   supabase.from("connected_accounts").select("*"),
 *   5000
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = 5000,
  errorMessage = "NETWORK_TIMEOUT"
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(errorMessage)),
      ms
    );
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

/** Comprueba si un error es de timeout de red */
export const isNetworkTimeout = (err: unknown): boolean =>
  err instanceof Error && err.message === "NETWORK_TIMEOUT";
