import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Pause, RotateCcw, CheckCircle2, ImageIcon, AlertTriangle, ListChecks, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Link } from "react-router-dom";
interface Product {
  id: string;
  title: string;
  price: string;
  category: string | null;
}

interface Cover {
  id: string;
  image_url: string;
  position: number;
  category: string;
}

interface GalleryImage {
  id: string;
  image_url: string;
  product_id: string;
}

interface PublishItem {
  product: Product;
  cover: Cover;
  gallery: GalleryImage[];
  publicationIndex: number;
  logged?: boolean;
}

type ExecStatus = "idle" | "running" | "paused" | "completed";

const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export default function PublishPreview() {
  const { user } = useAuth();
  const { isExpired: subExpired } = useSubscription();
  const [items, setItems] = useState<PublishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(15);
  const [todayPublished, setTodayPublished] = useState(0);

  // Execution state
  const [execStatus, setExecStatus] = useState<ExecStatus>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [execId, setExecId] = useState<string | null>(null);

  const todayKey = dayNames[new Date().getDay()];
  const todayDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([buildPreview(), loadSubscription(), loadTodayLogs(), loadExecution()]);
    setLoading(false);
  };

  const loadSubscription = async () => {
    const { data } = await supabase.from("subscriptions").select("daily_limit").eq("active", true).limit(1);
    if (data && data.length > 0) setDailyLimit(data[0].daily_limit);
  };

  const loadTodayLogs = async () => {
    const { count } = await supabase
      .from("publication_logs")
      .select("id", { count: "exact", head: true })
      .gte("published_at", todayDate + "T00:00:00")
      .lte("published_at", todayDate + "T23:59:59");
    setTodayPublished(count || 0);
  };

  const loadExecution = async () => {
    const { data } = await supabase
      .from("campaign_executions")
      .select("*")
      .eq("day_of_week", todayKey)
      .gte("created_at", todayDate + "T00:00:00")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const exec = data[0];
      setExecId(exec.id);
      setExecStatus(exec.status as ExecStatus);
      setCompletedCount(exec.completed_count);
    }
  };

  const buildPreview = async () => {
    const { data: covers } = await supabase
      .from("daily_covers")
      .select("id, image_url, position, category")
      .eq("day_of_week", todayKey)
      .order("position");

    if (!covers || covers.length === 0) { setItems([]); return; }

    const coversByCategory: Record<string, Cover[]> = {};
    for (const c of covers) {
      if (!coversByCategory[c.category]) coversByCategory[c.category] = [];
      coversByCategory[c.category].push(c);
    }

    const { data: products } = await supabase.from("products").select("id, title, price, category");
    const productsByCategory: Record<string, Product[]> = {};
    for (const p of (products || [])) {
      const cat = p.category || "General";
      if (!productsByCategory[cat]) productsByCategory[cat] = [];
      productsByCategory[cat].push(p);
    }

    const allProductIds = (products || []).map((p) => p.id);
    const { data: galleries } = await supabase
      .from("product_images")
      .select("id, image_url, product_id")
      .in("product_id", allProductIds.length > 0 ? allProductIds : ["none"])
      .eq("is_cover", false)
      .order("position");

    // Load today's successful logs to mark completed
    const { data: logs } = await supabase
      .from("publication_logs")
      .select("cover_id, product_id")
      .gte("published_at", todayDate + "T00:00:00")
      .eq("status", "success");
    const loggedSet = new Set((logs || []).map((l) => `${l.cover_id}-${l.product_id}`));

    const publishItems: PublishItem[] = [];
    let globalIdx = 0;

    for (const [category, catCovers] of Object.entries(coversByCategory)) {
      const catProducts = productsByCategory[category] || [];
      if (catProducts.length === 0) continue;

      for (let i = 0; i < catCovers.length; i++) {
        const product = catProducts[i % catProducts.length];
        const productGallery = (galleries || []).filter((g) => g.product_id === product.id);
        const key = `${catCovers[i].id}-${product.id}`;

        publishItems.push({
          product,
          cover: catCovers[i],
          gallery: productGallery,
          publicationIndex: globalIdx++,
          logged: loggedSet.has(key),
        });
      }
    }

    setItems(publishItems);
  };

  const remaining = Math.max(0, dailyLimit - todayPublished);
  const limitReached = dailyLimit < 9999 && remaining <= 0;
  const blocked = limitReached || subExpired;

  const handleStart = async () => {
    if (!user || blocked) return;
    const total = Math.min(items.length, remaining);
    const payload = { user_id: user.id, day_of_week: todayKey, total_publications: total, completed_count: 0, status: "running", started_at: new Date().toISOString() };

    if (execId) {
      await supabase.from("campaign_executions").update({ ...payload, status: "running" }).eq("id", execId);
    } else {
      const { data } = await supabase.from("campaign_executions").insert(payload).select("id").single();
      if (data) setExecId(data.id);
    }
    setExecStatus("running");
    setCompletedCount(0);
    toast.success(`¡Campaña iniciada! ${total} publicaciones programadas.`);
  };

  const handlePause = async () => {
    if (!execId) return;
    await supabase.from("campaign_executions").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", execId);
    setExecStatus("paused");
    toast.info(`Campaña pausada en publicación ${completedCount}. Al reanudar continuará desde la ${completedCount + 1}.`);
  };

  const handleResume = async () => {
    if (!execId) return;
    await supabase.from("campaign_executions").update({ status: "running", paused_at: null }).eq("id", execId);
    setExecStatus("running");
    toast.success(`Campaña reanudada desde publicación ${completedCount + 1}.`);
  };

  const handleReset = async () => {
    if (!execId) return;
    await supabase.from("campaign_executions").update({ status: "idle", completed_count: 0, paused_at: null, started_at: null }).eq("id", execId);
    setExecStatus("idle");
    setCompletedCount(0);
    toast.info("Campaña reiniciada.");
  };

  const categoryCounts: Record<string, number> = {};
  items.forEach((i) => {
    const cat = i.product.category || "General";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const missingGallery = items.filter((i) => i.gallery.length === 0).length;

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Preview de Publicación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Revisa las publicaciones para hoy (<span className="capitalize text-primary font-medium">{todayKey}</span>).
        </p>
      </div>

      {/* Subscription Expired */}
      {subExpired && (
        <Card className="border-destructive/50 bg-destructive/5 mb-6">
          <CardContent className="p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Suscripción vencida</p>
              <p className="text-xs text-muted-foreground">Tu prueba o plan ha expirado. Selecciona un plan para continuar publicando.</p>
            </div>
            <Link to="/dashboard/subscription">
              <Button size="sm" variant="destructive">Ver planes</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Limit Warning */}
      {!subExpired && limitReached && (
        <Card className="border-destructive/50 bg-destructive/5 mb-6">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Límite diario alcanzado</p>
              <p className="text-xs text-muted-foreground">Has publicado {todayPublished}/{dailyLimit >= 9999 ? "∞" : dailyLimit} publicaciones hoy. Actualiza tu plan para más.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {missingGallery > 0 && (
        <Card className="border-warning/50 bg-warning/5 mb-6">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-xs text-muted-foreground">{missingGallery} publicaciones sin imágenes de galería.</p>
          </CardContent>
        </Card>
      )}

      {/* Summary + Controls */}
      <Card className="border-border/60 mb-6">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-sm">{items.length} publicaciones</Badge>
              <Badge variant="outline" className="text-sm capitalize">{todayKey}</Badge>
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">{cat}: {count}</Badge>
              ))}
              {dailyLimit < 9999 && (
                <Badge variant={limitReached ? "destructive" : "secondary"} className="text-xs">
                  {todayPublished}/{dailyLimit} hoy
                </Badge>
              )}
            </div>
          </div>

          {/* Execution controls */}
          <div className="flex items-center gap-3 flex-wrap border-t border-border/60 pt-4">
            {execStatus === "idle" && (
              <Button onClick={handleStart} disabled={blocked || items.length === 0} size="lg">
                <Play className="h-5 w-5 mr-2" /> Iniciar publicación
              </Button>
            )}
            {execStatus === "running" && (
              <>
                <Button onClick={handlePause} variant="outline" size="lg">
                  <Pause className="h-5 w-5 mr-2" /> Pausar
                </Button>
                <Badge className="bg-accent text-accent-foreground animate-pulse">
                  <ListChecks className="h-3 w-3 mr-1" /> Publicando... {completedCount}/{items.length}
                </Badge>
              </>
            )}
            {execStatus === "paused" && (
              <>
                <Button onClick={handleResume} size="lg">
                  <Play className="h-5 w-5 mr-2" /> Reanudar desde #{completedCount + 1}
                </Button>
                <Button onClick={handleReset} variant="outline" size="lg">
                  <RotateCcw className="h-5 w-5 mr-2" /> Reiniciar
                </Button>
                <Badge variant="secondary">Pausado en #{completedCount}</Badge>
              </>
            )}
            {execStatus === "completed" && (
              <>
                <Badge className="bg-accent text-accent-foreground">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Completado ({completedCount})
                </Badge>
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" /> Nueva campaña
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => {
          const isCompleted = item.publicationIndex < completedCount || item.logged;
          return (
            <Card key={`${item.cover.id}-${item.publicationIndex}`} className={`border-border/60 transition-opacity ${isCompleted ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? "bg-accent/20" : "bg-primary/10"}`}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                    ) : (
                      <span className="text-xs font-bold text-primary">#{item.publicationIndex + 1}</span>
                    )}
                  </div>

                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-primary/30 bg-muted">
                    <img src={item.cover.image_url} alt="Portada" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{item.product.title}</p>
                    <p className="text-xs text-muted-foreground">${item.product.price} · {item.product.category || "General"}</p>
                  </div>

                  <div className="flex-shrink-0 text-right space-y-1">
                    <Badge variant="secondary" className="text-xs">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      {item.gallery.length} galería
                    </Badge>
                    <p className="text-[10px] text-muted-foreground">Portada #{item.cover.position + 1}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {items.length === 0 && (
          <Card className="border-border/60">
            <CardContent className="p-10 text-center text-muted-foreground">
              <p className="text-sm">No hay portadas subidas para hoy ({todayKey}).</p>
              <p className="text-xs mt-1">Sube portadas en "Portadas Diarias" para generar publicaciones.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
