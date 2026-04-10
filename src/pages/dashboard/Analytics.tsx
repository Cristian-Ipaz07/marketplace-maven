import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState<{day: string, publicaciones: number}[]>([]);
  const [stats, setStats] = useState({ total: 0, success: 0, error: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    // 7 days ago boundary
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 6);
    dateLimit.setHours(0,0,0,0);

    const { data: logs } = await supabase
      .from("publication_logs")
      .select("status, published_at")
      .eq("user_id", user!.id)
      .gte("published_at", dateLimit.toISOString());

    if(!logs){
      setLoading(false);
      return;
    }

    let total = 0; let success = 0; let err = 0;
    
    // Create base array for last 7 days
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dayNames[d.getDay()];
        dailyMap[key] = 0;
    }

    for (const log of logs) {
      total++;
      if (log.status === "success") success++;
      if (log.status === "error") err++;
      
      if(log.status === "success") {
          const logDate = new Date(log.published_at);
          const localDayString = dayNames[logDate.getDay()];
          if (dailyMap[localDayString] !== undefined) {
              dailyMap[localDayString]++;
          }
      }
    }

    const chartData = [];
    // Traverse chronological: from 6 days ago to today
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dayNames[d.getDay()];
        chartData.push({ day: key, publicaciones: dailyMap[key] });
    }

    setData(chartData);
    setStats({ total, success, error: err });
    setLoading(false);
  };
  
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Analítica</h1>
        <p className="text-muted-foreground text-sm mt-1">Rendimiento de publicaciones esta semana</p>
      </div>

      <Card className="border-border/60 mb-6">
        <CardHeader>
          <CardTitle className="font-display text-base">Publicaciones por día</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="publicaciones" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Total esta semana", value: stats.total.toString() },
          { label: "Exitosas", value: stats.success.toString() },
          { label: "Fallidas", value: stats.error.toString() },
        ].map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5 text-center">
              <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
