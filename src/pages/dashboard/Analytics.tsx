import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { day: "Lun", publicaciones: 8 },
  { day: "Mar", publicaciones: 12 },
  { day: "Mié", publicaciones: 6 },
  { day: "Jue", publicaciones: 15 },
  { day: "Vie", publicaciones: 10 },
  { day: "Sáb", publicaciones: 18 },
  { day: "Dom", publicaciones: 4 },
];

export default function Analytics() {
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
          { label: "Total esta semana", value: "73" },
          { label: "Exitosas", value: "70" },
          { label: "Fallidas", value: "3" },
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
