import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePlus, Loader2, Trash2, CalendarDays, ChevronDown, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Cover {
  id: string;
  image_url: string;
  position: number;
  day_of_week: string;
  category: string;
}

const days = [
  { key: "lunes", label: "Lun" },
  { key: "martes", label: "Mar" },
  { key: "miercoles", label: "Mié" },
  { key: "jueves", label: "Jue" },
  { key: "viernes", label: "Vie" },
  { key: "sabado", label: "Sáb" },
  { key: "domingo", label: "Dom" },
];

const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export default function DailyCovers() {
  const { user } = useAuth();
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [maxCovers, setMaxCovers] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [activeDays, setActiveDays] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ day: string; category: string } | null>(null);

  const todayKey = dayNames[new Date().getDay()];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [coversRes, configRes, productsRes] = await Promise.all([
        supabase.from("daily_covers").select("*").order("position"),
        supabase.from("publish_configs").select("quantity").limit(1),
        supabase.from("products").select("category"),
      ]);
      setCovers(coversRes.data || []);
      if (configRes.data?.[0]) setMaxCovers(configRes.data[0].quantity);
      const uniqueCats = [...new Set((productsRes.data || []).map((p) => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCats.length > 0 ? uniqueCats : ["General"]);
      // Open first category by default
      if (uniqueCats.length > 0) {
        setOpenCategories({ [uniqueCats[0]]: true });
        const dayDefaults: Record<string, string> = {};
        uniqueCats.forEach((c) => { dayDefaults[c] = todayKey; });
        setActiveDays(dayDefaults);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const coversFor = (category: string, day: string) =>
    covers.filter((c) => c.category === category && c.day_of_week === day).sort((a, b) => a.position - b.position);

  const totalCoversForCategoryToday = (category: string) =>
    covers.filter((c) => c.category === category && c.day_of_week === todayKey).length;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !uploadTarget) return;
    const { day, category } = uploadTarget;
    const existing = coversFor(category, day);
    const remaining = maxCovers - existing.length;
    if (files.length > remaining) {
      toast.error(`Solo puedes agregar ${remaining} portadas más para ${category} - ${day}`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    const newCovers: Cover[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${category}/${day}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("daily-covers").upload(path, file);
      if (upErr) { console.error(upErr); continue; }
      const { data: urlData } = supabase.storage.from("daily-covers").getPublicUrl(path);
      const position = existing.length + i;
      const { data: row, error: dbErr } = await supabase.from("daily_covers").insert({
        user_id: user.id,
        day_of_week: day,
        image_url: urlData.publicUrl,
        position,
        category,
      }).select("id, image_url, position, day_of_week, category").single();
      if (!dbErr && row) newCovers.push(row);
    }
    setCovers((prev) => [...prev, ...newCovers]);
    setUploading(false);
    toast.success(`${newCovers.length} portada(s) subida(s) para ${category} - ${day}`);
    e.target.value = "";
    setUploadTarget(null);
  };

  const removeCover = async (cover: Cover) => {
    await supabase.from("daily_covers").delete().eq("id", cover.id);
    const urlParts = cover.image_url.split("/daily-covers/");
    if (urlParts[1]) await supabase.storage.from("daily-covers").remove([urlParts[1]]);
    setCovers((prev) => prev.filter((c) => c.id !== cover.id));
    toast.success("Portada eliminada");
  };

  const startUpload = (category: string, day: string) => {
    setUploadTarget({ day, category });
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
    if (!activeDays[cat]) setActiveDays((prev) => ({ ...prev, [cat]: todayKey }));
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Portadas Diarias</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sube hasta <span className="font-semibold text-primary">{maxCovers}</span> portadas por categoría por día. Cada categoría tiene su propio cronograma semanal.
        </p>
      </div>

      <Card className="border-border/60 bg-primary/5 mb-6">
        <CardContent className="p-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Hoy es <span className="capitalize text-primary">{todayKey}</span> — el bot usará las portadas de hoy para cada categoría.
            </p>
            <p className="text-xs text-muted-foreground">
              Máximo {maxCovers} portadas por categoría según tu configuración.
            </p>
          </div>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      {categories.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay categorías en tu inventario.</p>
            <p className="text-xs">Importa productos con categorías para crear cronogramas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const isOpen = openCategories[cat] ?? false;
            const todayCount = totalCoversForCategoryToday(cat);
            const activeDay = activeDays[cat] || todayKey;

            return (
              <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCategory(cat)}>
                <Card className="border-border/60">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                          <div>
                            <CardTitle className="font-display text-base">{cat}</CardTitle>
                            <CardDescription>
                              {todayCount}/{maxCovers} portadas para hoy ({todayKey})
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={todayCount >= maxCovers ? "default" : "secondary"} className="text-xs">
                            {todayCount} hoy
                          </Badge>
                          {days.map((d) => {
                            const count = coversFor(cat, d.key).length;
                            return count > 0 ? (
                              <div key={d.key} className={`w-2 h-2 rounded-full ${d.key === todayKey ? "bg-primary" : "bg-muted-foreground/30"}`} title={`${d.label}: ${count}`} />
                            ) : null;
                          })}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Tabs value={activeDay} onValueChange={(v) => setActiveDays((prev) => ({ ...prev, [cat]: v }))}>
                        <TabsList className="grid grid-cols-7 w-full mb-4">
                          {days.map((d) => {
                            const count = coversFor(cat, d.key).length;
                            return (
                              <TabsTrigger key={d.key} value={d.key} className="text-xs relative">
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
                          const dayCvrs = coversFor(cat, d.key);
                          return (
                            <TabsContent key={d.key} value={d.key}>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-muted-foreground">{dayCvrs.length}/{maxCovers} portadas</p>
                                {dayCvrs.length < maxCovers && (
                                  <Button size="sm" variant="outline" onClick={() => startUpload(cat, d.key)} disabled={uploading && uploadTarget?.category === cat && uploadTarget?.day === d.key}>
                                    {uploading && uploadTarget?.category === cat && uploadTarget?.day === d.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                                    Subir portadas
                                  </Button>
                                )}
                              </div>
                              {dayCvrs.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border/60 rounded-lg">
                                  <ImagePlus className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                  <p className="text-xs">Sin portadas para {d.label}</p>
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
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
