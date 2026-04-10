import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserCircle,
  Plus,
  Loader2,
  Info,
  Trash2,
  Edit2,
  RotateCcw,
  WifiOff,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { withTimeout, isNetworkTimeout } from "@/lib/supabaseWithTimeout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIMITS } from "@/lib/plans";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  name: string;
  active: boolean;
  chrome_profile_path: string | null;
}

export default function Profiles() {
  const { user } = useAuth();
  const { sub } = useSubscription();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const currentPlan = sub?.plan || "basico";
  const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basico;
  const atProfileLimit =
    profiles.length >= planLimits.profiles && planLimits.profiles < 9999;

  // ─── Fetch con aislamiento estricto y timeout ────────────────────────────
  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    setNetworkError(false);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("connected_accounts")
          .select("id, name, active, chrome_profile_path")
          // ✅ SEGURIDAD: Siempre filtrar por user_id del usuario autenticado
          .eq("user_id", user.id)
          .order("created_at"),
        5000
      );
      if (error) {
        console.error("[Profiles] Error fetching:", error);
        toast.error("No se pudieron cargar los perfiles.");
        return;
      }
      setProfiles((data as Profile[]) || []);
    } catch (err) {
      if (isNetworkTimeout(err)) {
        setNetworkError(true);
        toast.error("⚠️ Error de red, reintenta");
      } else {
        console.error("[Profiles] Error inesperado:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchProfiles();

    // ─── Auto-detección de perfiles desde la extensión ────────────────────
    const handleMessage = async (e: MessageEvent) => {
      if (
        e.data?.source !== "MARKETMASTER_BRIDGE" ||
        e.data.action !== "PROFILE_DETECTED"
      )
        return;

      const { id: hardwareId, name } = e.data.payload;
      if (!hardwareId) return;

      // Verificar límite de plan antes de hacer nada
      setProfiles((currentProfiles) => {
        const exists = currentProfiles.some(
          (p) => p.chrome_profile_path === hardwareId
        );
        if (exists) return currentProfiles; // Ya registrado

        if (atProfileLimit) {
          toast.info(
            `Perfil "${name}" detectado, pero tu plan no permite más perfiles.`
          );
          return currentProfiles;
        }

        // ✅ UPSERT ATÓMICO: onConflict basado en (user_id, chrome_profile_path)
        // Gracias al UNIQUE constraint de la migración SQL, esto es idempotente.
        toast.promise(
          (async () => {
            const { data, error } = await supabase
              .from("connected_accounts")
              .upsert(
                {
                  user_id: user.id,
                  name: name,
                  active: true,
                  chrome_profile_path: hardwareId,
                },
                {
                  onConflict: "user_id,chrome_profile_path",
                  ignoreDuplicates: false, // Actualizar nombre si ya existe
                }
              )
              .select("id, name, active, chrome_profile_path")
              .single();

            if (error) throw error;

            if (data) {
              setProfiles((prev) => {
                // Si ya está en lista local (por UPSERT de update), actualizar
                const idx = prev.findIndex(
                  (p) => p.chrome_profile_path === hardwareId
                );
                if (idx !== -1) {
                  const updated = [...prev];
                  updated[idx] = data as Profile;
                  return updated;
                }
                return [...prev, data as Profile];
              });
            }
          })(),
          {
            loading: "Registrando Perfil Detectado...",
            success: `¡Perfil "${name}" auto-vinculado con éxito!`,
            error: "No se pudo auto-vincular el perfil.",
          }
        );

        return currentProfiles;
      });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [user, fetchProfiles, atProfileLimit]);

  // ─── Toggle activo/inactivo ──────────────────────────────────────────────
  const toggle = async (id: string) => {
    if (!user) return;
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    const { error } = await supabase
      .from("connected_accounts")
      .update({ active: !profile.active })
      .eq("id", id)
      // ✅ SEGURIDAD: Doble guardía — RLS + filtro explícito
      .eq("user_id", user.id);
    if (error) {
      toast.error("Error actualizando estado");
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  // ─── Actualizar nombre ───────────────────────────────────────────────────
  const updateName = async (id: string, name: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase
      .from("connected_accounts")
      .update({ name } as any)
      .eq("id", id)
      // ✅ SEGURIDAD: Double guard
      .eq("user_id", user.id);
    if (error) {
      toast.error("Error guardando nombre");
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
    toast.success("Nombre actualizado");
  };

  // ─── Eliminar perfil ─────────────────────────────────────────────────────
  const deleteProfile = async (id: string) => {
    if (!user) return;
    if (
      !confirm(
        "¿Estás seguro de eliminar este perfil? Esta acción no se puede deshacer."
      )
    )
      return;
    const { error } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("id", id)
      // ✅ SEGURIDAD: Double guard
      .eq("user_id", user.id);
    if (error) {
      toast.error("Error eliminando perfil");
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast.success("Perfil eliminado");
  };

  // ─── Agregar perfil manual ───────────────────────────────────────────────
  const addProfile = async () => {
    if (!user) return;
    if (atProfileLimit) {
      toast.error(
        `Tu plan ${currentPlan} permite máximo ${planLimits.profiles} perfil(es). Actualiza tu plan para conectar más.`
      );
      return;
    }
    if (!newName.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!newPath.trim()) {
      toast.error("La ruta del perfil de Chrome es obligatoria");
      return;
    }

    const { data, error } = await supabase
      .from("connected_accounts")
      .upsert(
        {
          user_id: user.id,
          name: newName.trim(),
          active: false,
          chrome_profile_path: newPath.trim(),
        },
        { onConflict: "user_id,chrome_profile_path" }
      )
      .select("id, name, active, chrome_profile_path")
      .single();

    if (error) {
      toast.error("Error creando perfil");
      return;
    }
    setProfiles((prev) => {
      const idx = prev.findIndex(
        (p) => p.chrome_profile_path === newPath.trim()
      );
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = data as Profile;
        return updated;
      }
      return [...prev, data as Profile];
    });
    setNewName("");
    setNewPath("");
    setAddOpen(false);
    toast.success("Perfil agregado");
  };

  // ─── Sincronizar con extensión ───────────────────────────────────────────
  const handleSync = () => {
    const probe = () =>
      window.postMessage(
        { source: "MARKETMASTER_DASHBOARD", action: "REQUEST_PROFILE_INFO" },
        "*"
      );
    probe();
    setTimeout(probe, 500);
    setTimeout(probe, 1500);

    const toastId = toast.loading("Sincronizando con extensión...", {
      duration: 5000,
    });

    setTimeout(async () => {
      try {
        const { data } = await withTimeout(
          supabase
            .from("connected_accounts")
            .select("id, name, active, chrome_profile_path")
            // ✅ SEGURIDAD: Siempre user_id
            .eq("user_id", user!.id)
            .order("created_at"),
          5000
        );
        if (data) setProfiles(data as Profile[]);
      } catch (err) {
        if (isNetworkTimeout(err)) toast.error("⚠️ Error de red, reintenta");
      } finally {
        toast.dismiss(toastId);
      }
    }, 4000);
  };

  const activeCount = profiles.filter((p) => p.active).length;

  return (
    <div className="p-4 sm:p-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
            Perfiles conectados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount} de {profiles.length} perfiles activos ·{" "}
            <span className="text-primary font-medium capitalize">
              Plan {currentPlan}
            </span>{" "}
            ({profiles.length}/{planLimits.profiles >= 9999 ? "∞" : planLimits.profiles} perfiles)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="border-primary/30 hover:bg-primary/5"
            onClick={handleSync}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Sincronizar
          </Button>
          {/* ✅ Botón Agregar deshabilitado si alcanzó el límite del plan */}
          <Button
            onClick={() => setAddOpen(true)}
            disabled={atProfileLimit}
            title={
              atProfileLimit
                ? `Tu plan ${currentPlan} no permite más perfiles`
                : undefined
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar perfil
          </Button>
        </div>
      </div>

      {/* ── Aviso de límite de plan ──────────────────────────────────────── */}
      {atProfileLimit && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Has alcanzado el límite de <strong>{planLimits.profiles} perfil(es)</strong> de tu plan{" "}
            <strong className="capitalize">{currentPlan}</strong>. Actualiza para agregar más perfiles.
          </span>
        </div>
      )}

      {/* ── Dialog: Agregar perfil ───────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="font-display">
              Nuevo perfil de Chrome
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-primary/5 border border-border/60 rounded-lg p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">
                  <strong>La detección es ahora automática.</strong>
                  <br />
                  No necesitas crear perfiles a mano si ya tienes la extensión
                  instalada. Simplemente usa Chrome con MarketMaster abierto y
                  la extensión registrará esta firma por ti.
                </p>
              </div>
            </div>
            <div>
              <Label>Nombre del perfil *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Cuenta principal"
                className="mt-1"
              />
            </div>
            <div>
              <Label>ID de Firma (Solo si lo sabes) *</Label>
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="Ej: d8a8fca2dc..."
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addProfile} disabled={atProfileLimit}>
              Guardar perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Estados de carga ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : networkError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <WifiOff className="h-8 w-8 text-destructive" />
            <p className="font-medium text-destructive">⚠️ Error de red</p>
            <p className="text-sm text-muted-foreground">
              No se pudo conectar con el servidor. Verifica tu internet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                fetchProfiles();
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : profiles.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">
            No hay perfiles. Agrega uno o espera a que la extensión lo detecte.
          </CardContent>
        </Card>
      ) : (
        /* ── Grid de perfiles ─────────────────────────────────────────── */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <Card
              key={p.id}
              className={`border-border/60 transition-colors ${
                p.active ? "ring-1 ring-accent/30" : ""
              }`}
            >
              <CardContent className="p-5 flex flex-col gap-3">
                {/* ── Cabecera del perfil ─────────────────────────── */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                        p.active ? "bg-accent/10" : "bg-muted"
                      }`}
                    >
                      <UserCircle
                        className={`h-5 w-5 ${
                          p.active ? "text-accent" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground text-sm truncate max-w-[140px]">
                        {p.name}
                      </div>
                      <Badge
                        variant={p.active ? "default" : "secondary"}
                        className={`mt-1 text-xs ${
                          p.active ? "bg-accent text-accent-foreground" : ""
                        }`}
                      >
                        {p.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={p.active}
                    onCheckedChange={() => toggle(p.id)}
                    className="flex-shrink-0"
                  />
                </div>

                {/* ── Nombre editable ─────────────────────────────── */}
                <div className="border-t border-border/60 pt-3">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <Edit2 className="h-3 w-3" /> Nombre (Personalizable)
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      className="h-9 text-sm flex-1 min-w-0"
                      value={p.name || ""}
                      onChange={(e) =>
                        setProfiles((prev) =>
                          prev.map((pr) =>
                            pr.id === p.id
                              ? { ...pr, name: e.target.value }
                              : pr
                          )
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateName(p.id, p.name || "");
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs bg-primary/5 text-primary hover:bg-primary/10 border-primary/20 flex-shrink-0"
                      onClick={() => updateName(p.id, p.name || "")}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>

                {/* ── Hardware ID ──────────────────────────────────── */}
                <div className="bg-muted/30 p-2.5 rounded-md group">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                        Firma de Hardware ID
                      </Label>
                      {/* ✅ UI FIX: break-all para evitar desbordamiento */}
                      <span className="text-xs font-mono text-muted-foreground break-all leading-relaxed">
                        {p.chrome_profile_path || "—"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                      onClick={() => deleteProfile(p.id)}
                      title="Eliminar Perfil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
