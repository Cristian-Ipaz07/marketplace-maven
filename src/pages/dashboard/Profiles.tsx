import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Plus, Loader2, FolderOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIMITS } from "@/lib/plans";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const currentPlan = sub?.plan || "basico";
  const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basico;

  useEffect(() => {
    if (!user) return;
    supabase.from("connected_accounts").select("id, name, active, chrome_profile_path").order("created_at").then(({ data, error }) => {
      if (error) console.error(error);
      else setProfiles((data as Profile[]) || []);
      setLoading(false);
    });
  }, [user]);

  const toggle = async (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    const { error } = await supabase.from("connected_accounts").update({ active: !profile.active }).eq("id", id);
    if (error) { toast.error("Error actualizando"); return; }
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  };

  const updatePath = async (id: string, path: string) => {
    const { error } = await supabase.from("connected_accounts").update({ chrome_profile_path: path } as any).eq("id", id);
    if (error) { toast.error("Error guardando ruta"); return; }
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, chrome_profile_path: path } : p)));
    toast.success("Ruta guardada");
  };

  const addProfile = async () => {
    if (!user) return;
    if (profiles.length >= planLimits.profiles && planLimits.profiles < 9999) {
      toast.error(`Tu plan ${currentPlan} permite máximo ${planLimits.profiles} perfil(es). Actualiza tu plan para conectar más.`);
      return;
    }
    if (!newName.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!newPath.trim()) { toast.error("La ruta del perfil de Chrome es obligatoria"); return; }
    const { data, error } = await supabase.from("connected_accounts").insert({
      user_id: user.id, name: newName, active: false, chrome_profile_path: newPath,
    } as any).select("id, name, active, chrome_profile_path").single();
    if (error) { toast.error("Error creando perfil"); return; }
    setProfiles((prev) => [...prev, data as Profile]);
    setNewName("");
    setNewPath("");
    setAddOpen(false);
    toast.success("Perfil agregado");
  };

  const activeCount = profiles.filter((p) => p.active).length;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Perfiles conectados</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeCount} de {profiles.length} perfiles activos</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Agregar perfil
        </Button>
      </div>

      {/* Add Profile Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nuevo perfil de Chrome</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre del perfil *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Cuenta principal" />
            </div>
            <div>
              <Label>Ruta del Perfil (User Data Dir) *</Label>
              <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="Ej: Profile 1" />
              <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                Esta ruta identifica la sesión de Chrome que usará el bot local. Puedes encontrarla en <code className="bg-muted px-1 rounded">chrome://version</code> → "Profile Path". Generalmente es <code className="bg-muted px-1 rounded">Profile 1</code>, <code className="bg-muted px-1 rounded">Profile 2</code>, etc.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addProfile}>Guardar perfil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : profiles.length === 0 ? (
        <Card className="border-border/60"><CardContent className="p-10 text-center text-muted-foreground">No hay perfiles. Agrega uno para empezar.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <Card key={p.id} className={`border-border/60 transition-colors ${p.active ? "ring-1 ring-accent/30" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.active ? "bg-accent/10" : "bg-muted"}`}>
                      <UserCircle className={`h-5 w-5 ${p.active ? "text-accent" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">{p.name}</div>
                      <Badge variant={p.active ? "default" : "secondary"} className={`mt-1 text-xs ${p.active ? "bg-accent text-accent-foreground" : ""}`}>
                        {p.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                  <Switch checked={p.active} onCheckedChange={() => toggle(p.id)} />
                </div>
                <div className="border-t border-border/60 pt-3">
                  <Label className="text-xs text-muted-foreground">Ruta Chrome</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={p.chrome_profile_path || ""}
                    placeholder="Profile 1"
                    onBlur={(e) => {
                      if (e.target.value !== (p.chrome_profile_path || "")) {
                        updatePath(p.id, e.target.value);
                      }
                    }}
                    onChange={(e) => {
                      setProfiles((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, chrome_profile_path: e.target.value } : pr));
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
