import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface LogEntry {
  id: string;
  product_id: string;
  profile_id: string | null;
  category: string | null;
  status: string;
  error_message: string | null;
  published_at: string;
  product_title?: string;
  profile_name?: string;
}

export default function PublicationLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadLogs();
  }, [user]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("publication_logs")
      .select("*")
      .eq("user_id", user!.id)
      .order("published_at", { ascending: false })
      .limit(100);

    if (!data) { setLoading(false); return; }

    // Fetch product and profile names
    const productIds = [...new Set(data.map((l) => l.product_id))];
    const profileIds = [...new Set(data.map((l) => l.profile_id).filter(Boolean))] as string[];

    const [{ data: products }, { data: profiles }] = await Promise.all([
      supabase.from("products").select("id, title").in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("connected_accounts").select("id, name").in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const productMap = Object.fromEntries((products || []).map((p) => [p.id, p.title]));
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));

    setLogs(data.map((l) => ({
      ...l,
      product_title: productMap[l.product_id] || "Producto eliminado",
      profile_name: l.profile_id ? profileMap[l.profile_id] || "—" : "—",
    })));
    setLoading(false);
  };

  const statusIcon = (s: string) => {
    if (s === "success") return <CheckCircle2 className="h-4 w-4 text-accent" />;
    if (s === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const statusLabel = (s: string) => {
    if (s === "success") return "Exitoso";
    if (s === "error") return "Error";
    return "Pendiente";
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Registro de Publicaciones</h1>
        <p className="text-muted-foreground text-sm mt-1">Historial de publicaciones realizadas por el bot</p>
      </div>

      {logs.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">
            <p className="text-sm">No hay publicaciones registradas aún.</p>
            <p className="text-xs mt-1">Los registros aparecerán aquí cuando el bot ejecute publicaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-4">
                {statusIcon(log.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{log.product_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.category || "General"} · Perfil: {log.profile_name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={log.status === "success" ? "default" : log.status === "error" ? "destructive" : "secondary"} className="text-xs">
                    {statusLabel(log.status)}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(log.published_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {log.error_message && (
                  <p className="text-xs text-destructive w-full mt-1">{log.error_message}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
