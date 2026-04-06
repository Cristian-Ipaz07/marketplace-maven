import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Upload, TrendingUp, Loader2 } from "lucide-react";
import BotStatusIndicator from "@/components/BotStatusIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function Overview() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: "Productos", value: "0", icon: Package, change: "Cargando..." },
    { label: "Perfiles activos", value: "0", icon: Users, change: "de 0 disponibles" },
    { label: "Publicaciones hoy", value: "0", icon: Upload, change: "Hoy" },
    { label: "Tasa de éxito", value: "0%", icon: TrendingUp, change: "Total" },
  ]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { count: productCount },
        { data: profiles },
        { count: publicationsToday },
        { data: allLogs }
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("connected_accounts").select("id, active"),
        supabase.from("publication_logs").select("*", { count: "exact", head: true }).gte("published_at", today.toISOString()),
        supabase.from("publication_logs").select("id, status, error_message, published_at, product_id").order("published_at", { ascending: false }).limit(20)
      ]);

      // Calculate success rate
      const totalLogs = allLogs?.length || 0;
      const successLogs = allLogs?.filter(l => l.status === 'success').length || 0;
      const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100;

      // Stats mapping
      const activeProfiles = profiles?.filter(p => p.active).length || 0;
      const totalProfiles = profiles?.length || 0;

      setStats([
        { label: "Productos", value: (productCount || 0).toString(), icon: Package, change: "En tu catálogo" },
        { label: "Perfiles activos", value: activeProfiles.toString(), icon: Users, change: `de ${totalProfiles} disponibles` },
        { label: "Publicaciones hoy", value: (publicationsToday || 0).toString(), icon: Upload, change: "Últimas 24h" },
        { label: "Tasa de éxito", value: `${successRate}%`, icon: TrendingUp, change: "Histórico reciente" },
      ]);

      // Recent activity (last 5)
      if (allLogs && allLogs.length > 0) {
        const productIds = [...new Set(allLogs.slice(0, 5).map(l => l.product_id))];
        const { data: products } = await supabase.from("products").select("id, title").in("id", productIds);
        const productMap = Object.fromEntries((products || []).map(p => [p.id, p.title]));

        setRecentActivity(allLogs.slice(0, 5).map(l => {
          const time = new Date(l.published_at);
          const diff = Math.floor((new Date().getTime() - time.getTime()) / 60000); // mins
          let timeStr = "";
          if (diff < 1) timeStr = "Hace un momento";
          else if (diff < 60) timeStr = `Hace ${diff} min`;
          else if (diff < 1440) timeStr = `Hace ${Math.floor(diff / 60)}h`;
          else timeStr = time.toLocaleDateString();

          return {
            text: l.status === 'success' 
              ? `Publicación exitosa: ${productMap[l.product_id] || 'Producto'}`
              : `Error al publicar: ${l.error_message || 'desconocido'}`,
            time: timeStr,
            ok: l.status === 'success'
          };
        }));
      }

    } catch (e) {
      console.error("Error loading dashboard data:", e);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Bienvenido a MarketMaster</h1>
        <p className="text-muted-foreground text-sm mt-1">Tu aliado en ventas diarias — resumen general de tu actividad</p>
      </div>

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
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">No hay actividad reciente.</p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-start sm:items-center gap-2 sm:gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 sm:mt-0 shrink-0 ${a.ok ? "bg-accent" : "bg-destructive"}`} />
                  <span className="text-xs sm:text-sm text-foreground flex-1">{a.text}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
