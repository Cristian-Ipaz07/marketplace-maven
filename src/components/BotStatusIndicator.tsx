import { useState, useEffect } from "react";
import { Monitor, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function BotStatusIndicator() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    // Simulated check — in production this would ping the local bot API
    // or check a heartbeat timestamp in the database
    const check = () => {
      setOnline(false); // Default offline until local bot connects
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${online ? "bg-accent/10" : "bg-destructive/10"}`}>
          <Monitor className={`h-5 w-5 ${online ? "text-accent" : "text-destructive"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Estado del Bot Local</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {online ? (
              <>
                <Wifi className="h-3 w-3 text-accent" />
                <span className="text-xs text-accent font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive font-medium">Offline</span>
              </>
            )}
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${online ? "bg-accent animate-pulse" : "bg-destructive"}`} />
      </CardContent>
    </Card>
  );
}
