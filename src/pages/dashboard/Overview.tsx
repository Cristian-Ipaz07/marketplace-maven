import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Upload, TrendingUp } from "lucide-react";

const stats = [
  { label: "Productos", value: "48", icon: Package, change: "+5 esta semana" },
  { label: "Perfiles activos", value: "3", icon: Users, change: "de 6 disponibles" },
  { label: "Publicaciones hoy", value: "12", icon: Upload, change: "+8 vs ayer" },
  { label: "Tasa de éxito", value: "96%", icon: TrendingUp, change: "+2% este mes" },
];

export default function Overview() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen general de tu actividad</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-lg">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { text: "Publicación exitosa: Chaqueta térmica", time: "Hace 5 min", ok: true },
              { text: "Nuevo producto agregado: Gorra urbana", time: "Hace 20 min", ok: true },
              { text: "Perfil 3 conectado exitosamente", time: "Hace 1 hora", ok: true },
              { text: "Error al publicar: tiempo de espera agotado", time: "Hace 2 horas", ok: false },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${a.ok ? "bg-accent" : "bg-destructive"}`} />
                <span className="text-sm text-foreground flex-1">{a.text}</span>
                <span className="text-xs text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
