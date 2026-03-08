import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Upload, TrendingUp } from "lucide-react";
import BotStatusIndicator from "@/components/BotStatusIndicator";
import { useIsMobile } from "@/hooks/use-mobile";

const stats = [
  { label: "Productos", value: "48", icon: Package, change: "+5 esta semana" },
  { label: "Perfiles activos", value: "3", icon: Users, change: "de 6 disponibles" },
  { label: "Publicaciones hoy", value: "12", icon: Upload, change: "+8 vs ayer" },
  { label: "Tasa de éxito", value: "96%", icon: TrendingUp, change: "+2% este mes" },
];

export default function Overview() {
  const isMobile = useIsMobile();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Bienvenido a MarketMaster</h1>
        <p className="text-muted-foreground text-sm mt-1">Tu aliado en ventas diarias — resumen general de tu actividad</p>
      </div>

      {/* Bot Status - prominent on mobile */}
      <div className="mb-4 sm:mb-6">
        <BotStatusIndicator />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm text-muted-foreground">{s.label}</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-display font-bold text-foreground">{s.value}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{s.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-base sm:text-lg">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {[
              { text: "Publicación exitosa: Chaqueta térmica", time: "Hace 5 min", ok: true },
              { text: "Nuevo producto agregado: Gorra urbana", time: "Hace 20 min", ok: true },
              { text: "Perfil 3 conectado exitosamente", time: "Hace 1 hora", ok: true },
              { text: "Error al publicar: tiempo de espera agotado", time: "Hace 2 horas", ok: false },
            ].map((a, i) => (
              <div key={i} className="flex items-start sm:items-center gap-2 sm:gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 sm:mt-0 shrink-0 ${a.ok ? "bg-accent" : "bg-destructive"}`} />
                <span className="text-xs sm:text-sm text-foreground flex-1">{a.text}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
