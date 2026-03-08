import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserCircle, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Profile {
  id: string;
  name: string;
  active: boolean;
}

export default function Profiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("connected_accounts").select("id, name, active").order("created_at").then(({ data, error }) => {
      if (error) console.error(error);
      else setProfiles(data || []);
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

  const addProfile = async () => {
    if (!user) return;
    const name = `Perfil ${profiles.length + 1}`;
    const { data, error } = await supabase.from("connected_accounts").insert({ user_id: user.id, name, active: false }).select("id, name, active").single();
    if (error) { toast.error("Error creando perfil"); return; }
    setProfiles((prev) => [...prev, data]);
    toast.success("Perfil agregado");
  };

  const activeCount = profiles.filter((p) => p.active).length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Perfiles conectados</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeCount} de {profiles.length} perfiles activos</p>
        </div>
        <Button onClick={addProfile}>
          <Plus className="h-4 w-4 mr-2" /> Agregar perfil
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : profiles.length === 0 ? (
        <Card className="border-border/60"><CardContent className="p-10 text-center text-muted-foreground">No hay perfiles. Agrega uno para empezar.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <Card key={p.id} className={`border-border/60 transition-colors ${p.active ? "ring-1 ring-accent/30" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
