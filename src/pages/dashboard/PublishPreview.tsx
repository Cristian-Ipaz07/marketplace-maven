import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ListChecks, 
  CheckCircle2, 
  Image as ImageIcon, 
  AlertTriangle, 
  ArrowRight, 
  Loader2,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { PLAN_LIMITS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const { isExpired: subExpired, sub } = useSubscription();
  const [isAutomationRunning, setIsAutomationRunning] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [items, setItems] = useState<PublishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayPublished, setTodayPublished] = useState(0);
  const [profiles, setProfiles] = useState<{id: string, name: string}[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  // Execution state
  const [execStatus, setExecStatus] = useState<ExecStatus>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [execId, setExecId] = useState<string | null>(null);

  const todayKey = dayNames[new Date().getDay()];
  const todayDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    supabase.from("connected_accounts").select("id, name").eq("user_id", user.id).eq("active", true).order("created_at").then(({ data }) => {
       if (data && data.length > 0) {
           setProfiles(data);
           setSelectedProfileId(data[0].id);
       } else {
           setProfiles([]);
           setSelectedProfileId("none");
       }
    });
  }, [user]);

  useEffect(() => {
    if (!user || !selectedProfileId) return;
    loadAll();
  }, [user, selectedProfileId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([buildPreview(), loadTodayLogs(), loadExecution()]);
    setLoading(false);
  };

  const loadTodayLogs = async () => {
    if (!user) return;
    let query = supabase
      .from("publication_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("published_at", todayDate + "T00:00:00")
      .lte("published_at", todayDate + "T23:59:59");
    if (selectedProfileId !== "none") {
      query = query.eq("profile_id", selectedProfileId);
    }
    const { count } = await query;
    setTodayPublished(count || 0);
  };

  const loadExecution = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("campaign_executions")
      .select("*")
      .eq("user_id", user.id)
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

    const { data: products } = await supabase.from("products").select("id, title, price, category, description, tags");
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
      .in("product_id", allProductIds.length > 0 ? allProductIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("is_cover", false)
      .order("position");

    // Load today's successful logs to mark completed
    let logQuery = supabase
      .from("publication_logs")
      .select("cover_id, product_id")
      .eq("user_id", user!.id)
      .gte("published_at", todayDate + "T00:00:00")
      .eq("status", "success");
    if (selectedProfileId !== "none") {
      logQuery = logQuery.eq("profile_id", selectedProfileId);
    }
    const { data: logs } = await logQuery;
    const loggedSet = new Set((logs || []).map((l) => `${l.cover_id}-${l.product_id}`));

    const publishItems: PublishItem[] = [];
    const currentPlan = sub?.plan || "basico";
    const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basico;
    
    // Solo permitimos X categorias para publicar, según el limite del plan
    const availableCategories = Object.keys(coversByCategory).slice(0, planLimits.cover_categories);

    let globalIdx = 0;

    for (const category of availableCategories) {
      const catCovers = coversByCategory[category];
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

  const effectiveLimit = sub?.daily_limit ?? 9999;
  const remaining = Math.max(0, effectiveLimit - todayPublished);
  const limitReached = effectiveLimit < 9999 && remaining <= 0;
  const blocked = limitReached || subExpired;

  useEffect(() => {
    if (!user) return;
    
    // Escuchar logs en tiempo real para actualizar progreso
    const channel = supabase
      .channel("public-logs")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "publication_logs",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new.status === 'success') {
          const log = payload.new;
          setCompletedCount(prev => prev + 1);
          setTodayPublished(prev => prev + 1);
          
          // Actualizar estado VISUAL del item en la lista
          setItems(prevItems => prevItems.map(item => {
            if (item.product.id === log.product_id && item.cover.id === log.cover_id) {
              return { ...item, logged: true };
            }
            return item;
          }));

          // Actualizar ejecución en DB
          if (execId) {
            supabase.from("campaign_executions")
              .update({ completed_count: completedCount + 1 })
              .eq("id", execId)
              .then(() => {});
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, execId, completedCount]);

  // Escuchar mensajes del Bridge sobre el estado de la extensión
  useEffect(() => {
    const handleBridgeMessage = (e: MessageEvent) => {
      if (e.data?.source === "MARKETMASTER_BRIDGE") {
        if (e.data.action === "ITEM_START") {
          setActiveIdx(e.data.payload.index);
          setIsAutomationRunning(true);
        } else if (e.data.action === "COMPLETED") {
          setIsAutomationRunning(false);
          setActiveIdx(null);
        }
      }
    };
    window.addEventListener("message", handleBridgeMessage);
    return () => window.removeEventListener("message", handleBridgeMessage);
  }, []);

  const dispatchToExtension = (startIdx: number, forceStart = false) => {
    // SALTO INTELIGENTE: Solo al REANUDAR (no al iniciar)
    // Al iniciar siempre empezar desde donde se pide, ignorando logs
    let realStartIdx = startIdx;
    if (!forceStart && items[startIdx]?.logged) {
      const firstUnlogged = items.findIndex((it, idx) => idx >= startIdx && !it.logged);
      if (firstUnlogged !== -1) {
        realStartIdx = firstUnlogged;
        console.log("[MarketMaster] Salto inteligente al primer ítem no publicado:", realStartIdx);
      } else {
        toast.info("Todos los productos de esta tanda ya han sido publicados hoy.");
        return;
      }
    }

    const automationTask = {
      items: items.map(it => ({
        product: {
          id: it.product.id,
          title: it.product.title,
          price: parseInt(it.product.price) || 0,
          description: (it.product as any).description || "",
          category: it.product.category || "Hogar",
          condition: (it.product as any).condition || "Nuevo",
          location: (it.product as any).location || "",
          tags: (it.product as any).tags ? (it.product as any).tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []
        },
        cover: { id: it.cover.id, image_url: it.cover.image_url },
        gallery: it.gallery.map(g => ({ image_url: g.image_url }))
      })),
      config: {
        manualPublish: true, // Siempre manual por ahora según petición del usuario
        options: ["public_place", "hide_friends"] // Ocultar a amigos activado por defecto
      },
      profileId: selectedProfileId !== "none" ? selectedProfileId : null,
      currentIndex: realStartIdx
    };

    setIsAutomationRunning(true);
    setActiveIdx(realStartIdx);
    console.log("[MarketMaster] Enviando AutomationTask a extensión (test):", automationTask);
    
    // Enviar el mensaje al bridge
    const sent = window.postMessage({ 
      source: "MARKETMASTER_DASHBOARD", 
      action: "START_AUTO_FILL", 
      payload: automationTask 
    }, "*");
    
    // Si el bridge no responde en 3s, alertar al usuario
    const bridgeTimeout = setTimeout(() => {
      if (!document.querySelector('#mmaster-bridge-ok')) {
        toast.warning("⚠️ La extensión no responde. Recarga esta página (F5) e inténtalo de nuevo.");
      }
    }, 3000);
  };

  const handleStart = async () => {
    if (!user || blocked) return;
    const total = Math.min(items.length, remaining);
    const payload = { user_id: user.id, day_of_week: todayKey, total_publications: total, completed_count: 0, status: "running", started_at: new Date().toISOString() };

    let currentExecId = execId;
    if (execId) {
      await supabase.from("campaign_executions").update({ ...payload, status: "running" }).eq("id", execId);
    } else {
      const { data } = await supabase.from("campaign_executions").insert(payload).select("id").single();
      if (data) {
        setExecId(data.id);
        currentExecId = data.id;
      }
    }
    setExecStatus("running");
    setCompletedCount(0);
    
    dispatchToExtension(0, true); // forceStart=true: ignorar logs previos al iniciar
    toast.success(`¡Campaña iniciada! La extensión comenzará el llenado.`);
  };

  const handlePause = async () => {
    if (!execId) return;
    await supabase.from("campaign_executions").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", execId);
    setExecStatus("paused");
    toast.info(`Campaña pausada en #${completedCount}.`);
  };

  const handleResume = async () => {
    if (!execId) return;
    await supabase.from("campaign_executions").update({ status: "running", paused_at: null }).eq("id", execId);
    setExecStatus("running");
    
    dispatchToExtension(completedCount); // resume: usar smart-skip normal
    toast.success(`Campaña reanudada desde #${completedCount + 1}.`);
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Preview de Publicación</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Revisa las publicaciones para hoy (<span className="capitalize text-primary font-medium">{todayKey}</span>).
          </p>
        </div>
        <div className="w-full sm:w-64">
           {profiles.length > 0 ? (
             <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
               <SelectTrigger className="w-full font-medium">
                 <SelectValue placeholder="Seleccionar Perfil" />
               </SelectTrigger>
               <SelectContent>
                 {profiles.map(p => (
                   <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           ) : (
             <Badge variant="outline" className="px-3 py-2 text-muted-foreground w-full justify-center">
               Sin perfiles conectados
             </Badge>
           )}
        </div>
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
              <p className="text-xs text-muted-foreground">Has publicado {todayPublished}/{effectiveLimit >= 9999 ? "∞" : effectiveLimit} publicaciones hoy. Actualiza tu plan para más.</p>
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
              {effectiveLimit < 9999 && (
                <Badge variant={limitReached ? "destructive" : "secondary"} className="text-xs">
                  {todayPublished}/{effectiveLimit} hoy
                </Badge>
              )}
            </div>
          </div>

          {/* Execution controls */}
          <div className="flex items-center gap-3 flex-wrap border-t border-border/60 pt-4">
            {execStatus === "idle" && (
              <Button onClick={handleStart} disabled={blocked || items.length === 0 || selectedProfileId === "none" || profiles.length === 0} size="lg">
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
        {items.map((item, idx) => {
          const isCompleted = item.logged;
          const isCurrent = activeIdx === idx && isAutomationRunning;
          
          return (
            <Card 
              key={`${item.cover.id}-${idx}`} 
              className={cn(
                "border-border/60 transition-all duration-300",
                isCompleted ? "opacity-60 bg-muted/20 border-accent/30" : "",
                isCurrent ? "border-accent ring-1 ring-accent/20 shadow-md translate-x-1" : ""
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    isCompleted ? "bg-accent/20" : isCurrent ? "bg-accent animate-pulse" : "bg-primary/10"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                      <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                    )}
                  </div>

                  <div className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 bg-muted transition-colors",
                    isCurrent ? "border-accent shadow-sm" : "border-primary/30"
                  )}>
                    <img src={item.cover.image_url} alt="Portada" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("font-medium text-sm truncate", isCompleted ? "text-muted-foreground line-through" : "text-foreground")}>
                        {item.product.title}
                      </p>
                      {isCurrent && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 animate-pulse bg-accent/10 text-accent border-accent/20">Publicando</Badge>}
                    </div>
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
