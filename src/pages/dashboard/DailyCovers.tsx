import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePlus, Loader2, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Cover {
  id: string;
  image_url: string;
  position: number;
  day_of_week: string;
}

const days = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export default function DailyCovers() {
  const { user } = useAuth();
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [maxCovers, setMaxCovers] = useState(10);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeDay, setActiveDay] = useState(dayNames[new Date().getDay()]);
  const [uploadDay, setUploadDay] = useState("");

  useEffect(() => {
    if (!user) return;
    // Fetch all covers
    supabase.from("daily_covers").select("*").order("position").then(({ data, error }) => {
      if (error) console.error(error);
      setCovers(data || []);
      setLoading(false);
    });
    // Fetch publish config to get max quantity
    supabase.from("publish_configs").select("quantity").limit(1).then(({ data }) => {
      if (data && data.length > 0) setMaxCovers(data[0].quantity);
    });
  }, [user]);

  const coversForDay = (day: string) => covers.filter((c) => c.day_of_week === day).sort((a, b) => a.position - b.position);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    const dayCvrs = coversForDay(uploadDay);
    const remaining = maxCovers - dayCvrs.length;
    if (files.length > remaining) {
      toast.error(`Solo puedes agregar ${remaining} portadas más para este día`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    const newCovers: Cover[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${uploadDay}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("daily-covers").upload(path, file);
      if (upErr) { console.error(upErr); continue; }
      const { data: urlData } = supabase.storage.from("daily-covers").getPublicUrl(path);
      const position = dayCvrs.length + i;
      const { data: row, error: dbErr } = await supabase.from("daily_covers").insert({
        user_id: user.id,
        day_of_week: uploadDay,
        image_url: urlData.publicUrl,
        position,
      }).select("id, image_url, position, day_of_week").single();
      if (!dbErr && row) newCovers.push(row);
    }
    setCovers((prev) => [...prev, ...newCovers]);
    setUploading(false);
    toast.success(`${newCovers.length} portada(s) subida(s) para ${uploadDay}`);
    e.target.value = "";
  };

  const removeCover = async (cover: Cover) => {
    await supabase.from("daily_covers").delete().eq("id", cover.id);
    const urlParts = cover.image_url.split("/daily-covers/");
    if (urlParts[1]) await supabase.storage.from("daily-covers").remove([urlParts[1]]);
    setCovers((prev) => prev.filter((c) => c.id !== cover.id));
    toast.success("Portada eliminada");
  };

  const startUpload = (day: string) => {
    setUploadDay(day);
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const todayKey = dayNames[new Date().getDay()];

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Portadas Diarias</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sube hasta <span className="font-semibold text-primary">{maxCovers}</span> portadas por día. Cada publicación usará una portada única en orden.
        </p>
      </div>

      <Card className="border-border/60 bg-primary/5 mb-6">
        <CardContent className="p-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Hoy es <span className="capitalize text-primary">{todayKey}</span> — el bot usará las portadas de esta pestaña.
            </p>
            <p className="text-xs text-muted-foreground">
              Máximo basado en tu configuración de publicación ({maxCovers} publicaciones).
            </p>
          </div>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      <Tabs value={activeDay} onValueChange={setActiveDay}>
        <TabsList className="grid grid-cols-7 w-full mb-4">
          {days.map((d) => {
            const count = coversForDay(d.key).length;
            return (
              <TabsTrigger key={d.key} value={d.key} className="relative text-xs">
                {d.label}
                {count > 0 && (
                  <Badge variant={d.key === todayKey ? "default" : "secondary"} className="ml-1 text-[10px] px-1 py-0">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {days.map((d) => {
          const dayCvrs = coversForDay(d.key);
          return (
            <TabsContent key={d.key} value={d.key}>
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-base capitalize">{d.label}</CardTitle>
                      <CardDescription>{dayCvrs.length}/{maxCovers} portadas subidas</CardDescription>
                    </div>
                    {dayCvrs.length < maxCovers && (
                      <Button size="sm" onClick={() => startUpload(d.key)} disabled={uploading}>
                        {uploading && uploadDay === d.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                        Subir portadas
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {dayCvrs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay portadas para {d.label}</p>
                      <p className="text-xs">Sube imágenes para que el bot las use en orden.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-3">
                      {dayCvrs.map((cover, idx) => (
                        <div key={cover.id} className="relative group rounded-lg overflow-hidden border-2 border-border/60 aspect-square">
                          <img src={cover.image_url} alt={`Portada ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute top-1 left-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-background/80">
                              #{idx + 1}
                            </Badge>
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-destructive" onClick={() => removeCover(cover)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
