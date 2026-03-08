import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserCircle, Plus } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  active: boolean;
}

const initial: Profile[] = [
  { id: "1", name: "Perfil Principal", active: true },
  { id: "2", name: "Tienda Ropa Online", active: true },
  { id: "3", name: "Accesorios MKT", active: false },
  { id: "4", name: "Ventas Bogotá", active: true },
  { id: "5", name: "Outlet Medellín", active: false },
  { id: "6", name: "Perfil Reserva", active: false },
];

export default function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>(initial);

  const toggle = (id: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  };

  const activeCount = profiles.filter((p) => p.active).length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Perfiles conectados</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeCount} de {profiles.length} perfiles activos</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Agregar perfil
        </Button>
      </div>

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
    </div>
  );
}
