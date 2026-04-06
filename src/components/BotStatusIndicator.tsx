import { useState, useEffect } from "react";
import { Monitor, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const HEARTBEAT_TIMEOUT_MS = 90_000; // 90 segundos sin pulso = offline

export default function BotStatusIndicator() {
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  const checkHeartbeat = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("extension_heartbeats")
      .select("last_seen_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data?.last_seen_at) {
      const ts = new Date(data.last_seen_at);
      setLastSeen(ts);
      setOnline(Date.now() - ts.getTime() < HEARTBEAT_TIMEOUT_MS);
    } else {
      setOnline(false);
      setLastSeen(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    checkHeartbeat();

    // Refresh cada 30 segundos
    const interval = setInterval(checkHeartbeat, 30_000);

    // Escuchar cambios en tiempo real
    const channel = supabase
      .channel("heartbeat-watch")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "extension_heartbeats",
        filter: `user_id=eq.${user.id}`,
      }, () => checkHeartbeat())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const lastSeenStr = lastSeen
    ? (() => {
        const diff = Math.floor((Date.now() - lastSeen.getTime()) / 1000);
        if (diff < 60) return `hace ${diff}s`;
        if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
        return lastSeen.toLocaleTimeString();
      })()
    : null;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${online ? "bg-accent/10" : "bg-muted/50"}`}>
          <Monitor className={`h-5 w-5 ${online ? "text-accent" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Estado del Bot Local</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {online ? (
              <>
                <Wifi className="h-3 w-3 text-accent" />
                <span className="text-xs text-accent font-medium">Online</span>
                {lastSeenStr && (
                  <span className="text-xs text-muted-foreground">· pulso {lastSeenStr}</span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Offline</span>
                {lastSeenStr && (
                  <span className="text-xs text-muted-foreground">· último {lastSeenStr}</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${online ? "bg-accent animate-pulse" : "bg-muted-foreground/40"}`} />
      </CardContent>
    </Card>
  );
}
