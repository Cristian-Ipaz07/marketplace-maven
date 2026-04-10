import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePlus, Loader2, Trash2, CalendarDays, ChevronDown, FolderOpen, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIMITS } from "@/lib/plans";

interface Cover {
  id: string;
  image_url: string;
  position: number;
  day_of_week: string;
  product_id: string;
}

interface ProductInfo {
  id: string;
  title: string;
  short_name: string | null;
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
  const { sub, loading: loadingSub } = useSubscription();
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [maxCovers, setMaxCovers] = useState(10);
  const [productsList, setProductsList] = useState<ProductInfo[]>([]);
  const [openProducts, setOpenProducts] = useState<Record<string, boolean>>({});
  const [activeDays, setActiveDays] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ day: string; product_id: string } | null>(null);

  const todayKey = dayNames[new Date().getDay()];

  useEffect(() => {
    if (!user || loadingSub) return;
    const load = async () => {
      const [coversRes, configRes, productsRes] = await Promise.all([
        supabase.from("daily_covers").select("*").order("position"),
        supabase.from("publish_configs").select("quantity").limit(1),
        supabase.from("products").select("id, title, short_name").order("created_at", { ascending: false }),
      ]);
      setCovers(coversRes.data || []);
      
      const currentPlan = sub?.plan || "basico";
      const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basico;
      
      const baseMax = configRes.data?.[0]?.quantity || 10;
      setMaxCovers(planLimits.covers_per_category >= 9999 ? 9999 : baseMax);
      
      // Limit products allowed to have covers based on plan (re-using cover_categories limit logic)
      const allowedProducts = (productsRes.data || []).slice(0, planLimits.cover_categories);
      setProductsList(allowedProducts);

      if (allowedProducts.length > 0) {
        setOpenProducts({ [allowedProducts[0].id]: true });
        const dayDefaults: Record<string, string> = {};
        allowedProducts.forEach((p) => { dayDefaults[p.id] = todayKey; });
        setActiveDays(dayDefaults);
      }
      setLoading(false);
    };
    load();
  }, [user, sub, loadingSub]);

  const coversFor = (product_id: string, day: string) =>
    covers.filter((c) => c.product_id === product_id && c.day_of_week === day).sort((a, b) => a.position - b.position);

  const totalCoversForProductToday = (product_id: string) =>
    covers.filter((c) => c.product_id === product_id && c.day_of_week === todayKey).length;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !uploadTarget) return;
    const { day, product_id } = uploadTarget;
    const existing = coversFor(product_id, day);
    const remaining = maxCovers - existing.length;
    if (files.length > remaining) {
      toast.error(`Solo puedes agregar ${remaining} portadas más para este producto - ${day}`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    const newCovers: Cover[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${product_id}/${day}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("daily-covers").upload(path, file);
      if (upErr) { console.error(upErr); continue; }
      const { data: urlData } = supabase.storage.from("daily-covers").getPublicUrl(path);
      const position = existing.length + i;
      const { data: row, error: dbErr } = await supabase.from("daily_covers").insert({
        user_id: user.id,
        day_of_week: day,
        image_url: urlData.publicUrl,
        position,
        product_id,
      }).select("id, image_url, position, day_of_week, product_id").single();
      if (!dbErr && row) newCovers.push(row);
    }
    setCovers((prev) => [...prev, ...newCovers]);
    setUploading(false);
    toast.success(`${newCovers.length} portada(s) subida(s)`);
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

  const clearAllCovers = async () => {
    if (!user) return;
    if (!confirm("¿Estás seguro de que quieres eliminar TODAS las portadas de todos los productos? Esto dejará las portadas limpias para empezar de cero.")) return;
    setClearing(true);
    
    // First we fetch them to delete in storage if we want, or rely on db cascade/cron.
    // Let's delete from storage best effort
    const coversToDelete = [...covers];
    
    // Delete from DB completely
    const { error } = await supabase.from("daily_covers").delete().eq("user_id", user.id);
    if (error) {
      toast.error("Error al limpiar la base de datos");
      setClearing(false);
      return;
    }
    
    setCovers([]);
    toast.success("Se ha limpiado todo el registro de portadas.");
    
    // Delete files in background to avoid blocking
    for (const c of coversToDelete) {
      const urlParts = c.image_url.split("/daily-covers/");
      if (urlParts[1]) {
        supabase.storage.from("daily-covers").remove([urlParts[1]]).catch(console.error);
      }
    }
    setClearing(false);
  };

  const clearDayCovers = async (product_id: string, day: string) => {
    if (!user) return;
    if (!confirm(`¿Borrar todas las portadas para el ${day}?`)) return;
    
    const coversToDelete = coversFor(product_id, day);
    if (coversToDelete.length === 0) return;

    const { error } = await supabase.from("daily_covers").delete().eq("user_id", user.id).eq("product_id", product_id).eq("day_of_week", day);
    if (error) { toast.error("Error al limpiar"); return; }
    
    setCovers((prev) => prev.filter((c) => !(c.product_id === product_id && c.day_of_week === day)));
    toast.success("Portadas borradas.");
    
    for (const c of coversToDelete) {
      const urlParts = c.image_url.split("/daily-covers/");
      if (urlParts[1]) {
        supabase.storage.from("daily-covers").remove([urlParts[1]]).catch(console.error);
      }
    }
  };

  const startUpload = (product_id: string, day: string) => {
    setUploadTarget({ day, product_id });
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const toggleProduct = (prodId: string) => {
    setOpenProducts((prev) => ({ ...prev, [prodId]: !prev[prodId] }));
    if (!activeDays[prodId]) setActiveDays((prev) => ({ ...prev, [prodId]: todayKey }));
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Portadas Diarias</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sube hasta <span className="font-semibold text-primary">{maxCovers}</span> portadas por producto por día. Cada publicación usa su propio cronograma semanal.
          </p>
        </div>
        <div>
          <Button variant="destructive" onClick={clearAllCovers} disabled={clearing || covers.length === 0}>
            {clearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
            Limpiar Portadas
          </Button>
        </div>
      </div>

      <Card className="border-border/60 bg-primary/5 mb-6">
        <CardContent className="p-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Hoy es <span className="capitalize text-primary">{todayKey}</span> — el bot publicará usando las fotos guardadas para este día en cada producto.
            </p>
            <p className="text-xs text-muted-foreground">
              Asegúrate de tener portadas subidas para todos los productos que deseas publicar hoy.
            </p>
          </div>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      {productsList.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay productos en tu inventario o tu plan restringe su uso.</p>
            <p className="text-xs">Agrega productos en la sección Inventario.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {productsList.map((prod) => {
            const isOpen = openProducts[prod.id] ?? false;
            const todayCount = totalCoversForProductToday(prod.id);
            const activeDay = activeDays[prod.id] || todayKey;
            const displayName = prod.short_name ? prod.short_name : prod.title;

            return (
              <Collapsible key={prod.id} open={isOpen} onOpenChange={() => toggleProduct(prod.id)}>
                <Card className="border-border/60">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                          <div className="min-w-0">
                            <CardTitle className="font-display text-base font-semibold text-foreground truncate max-w-sm sm:max-w-md" title={prod.title}>
                              {displayName}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5 truncate max-w-sm">
                              {prod.short_name ? prod.title : ""}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={todayCount >= maxCovers ? "default" : "secondary"} className="text-xs hidden sm:flex">
                            {todayCount} hoy
                          </Badge>
                          <div className="flex gap-1">
                            {days.map((d) => {
                              const count = coversFor(prod.id, d.key).length;
                              return count > 0 ? (
                                <div key={d.key} className={`w-2 h-2 rounded-full ${d.key === todayKey ? "bg-primary" : "bg-muted-foreground/30"}`} title={`${d.label}: ${count}`} />
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <Tabs value={activeDay} onValueChange={(v) => setActiveDays((prev) => ({ ...prev, [prod.id]: v }))}>
                        <TabsList className="grid grid-cols-7 w-full mb-4 bg-muted/50">
                          {days.map((d) => {
                            const count = coversFor(prod.id, d.key).length;
                            return (
                              <TabsTrigger key={d.key} value={d.key} className="text-[10px] sm:text-xs relative">
                                <span className="hidden sm:inline">{d.label}</span>
                                <span className="sm:hidden">{d.label.substring(0, 1)}</span>
                                {count > 0 && (
                                  <Badge variant={d.key === todayKey ? "default" : "secondary"} className="ml-0.5 sm:ml-1 text-[8px] sm:text-[10px] px-1 py-0 h-4 min-w-[16px] justify-center">
                                    {count}
                                  </Badge>
                                )}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>

                        {days.map((d) => {
                          const dayCvrs = coversFor(prod.id, d.key);
                          return (
                            <TabsContent key={d.key} value={d.key} className="mt-0">
                              <div className="flex items-center justify-between mb-3 bg-card p-2 rounded-md border border-border/40">
                                <p className="text-xs text-muted-foreground">{dayCvrs.length}/{maxCovers} portadas</p>
                                <div className="flex items-center gap-2">
                                  {dayCvrs.length > 0 && (
                                    <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => clearDayCovers(prod.id, d.key)}>
                                      <Trash2 className="h-3 w-3 sm:mr-1.5" />
                                      <span className="hidden sm:inline">Limpiar</span>
                                    </Button>
                                  )}
                                  {dayCvrs.length < maxCovers && (
                                    <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => startUpload(prod.id, d.key)} disabled={uploading && uploadTarget?.product_id === prod.id && uploadTarget?.day === d.key}>
                                      {uploading && uploadTarget?.product_id === prod.id && uploadTarget?.day === d.key ? <Loader2 className="h-3 w-3 sm:mr-1.5 animate-spin" /> : <ImagePlus className="h-3 w-3 sm:mr-1.5" />}
                                      <span className="hidden sm:inline">Subir</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {dayCvrs.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground border border-dashed border-border/60 rounded-lg bg-muted/10">
                                  <ImagePlus className="h-5 w-5 mx-auto mb-2 opacity-30" />
                                  <p className="text-[11px] uppercase tracking-wider font-semibold opacity-70">Vacío</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                  {dayCvrs.map((cover, idx) => (
                                    <div key={cover.id} className="relative group rounded-lg overflow-hidden border border-border/60 aspect-square shadow-sm">
                                      <img src={cover.image_url} alt={`Portada ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                      <div className="absolute top-1 left-1">
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 border-background/20 bg-background/90 backdrop-blur-sm text-foreground shadow-sm">
                                          #{idx + 1}
                                        </Badge>
                                      </div>
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                        <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full shadow-md transform scale-90 group-hover:scale-100 transition-transform" onClick={() => removeCover(cover)}>
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
