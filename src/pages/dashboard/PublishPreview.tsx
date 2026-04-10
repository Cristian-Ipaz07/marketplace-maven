import { useState, useEffect, useRef } from "react";
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
  Loader2,
  Lock,
  Info,
  WifiOff
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { withTimeout, isNetworkTimeout } from "@/lib/supabaseWithTimeout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
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
  const [networkError, setNetworkError] = useState(false);
  const [telemetryMsg, setTelemetryMsg] = useState<string>("");
  const [todayPublished, setTodayPublished] = useState(0);
  const autoSelectedRef = useRef(false);
  const [detectedProfile, setDetectedProfile] = useState<{ id: string, name: string } | null>(null);

  const [profiles, setProfiles] = useState<{ id: string, name: string, chrome_profile_path: string }[]>([]);

  const profilesRef = useRef<{ id: string, name: string, chrome_profile_path: string }[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [publishConfig, setPublishConfig] = useState<any>(null);

  // Execution state
  const [execStatus, setExecStatus] = useState<ExecStatus>("idle");
  const [completedCount, setCompletedCount] = useState(0);
  const [execId, setExecId] = useState<string | null>(null);
  const [bridgeOk, setBridgeOk] = useState(false);
  const [bridgeChecking, setBridgeChecking] = useState(true);

  // Monitor del bridge (detección de extensión)
  useEffect(() => {
    // 1. Saludo inicial para despertar a la extensión inmediatamente
    window.postMessage({ source: "MARKETMASTER_DASHBOARD", action: "REQUEST_PROFILE_INFO" }, "*");

    const check = () => {
      // El bridge inyecta este marcador si está vivo y funcional
      const isOk = !!document.getElementById('mmaster-bridge-ok') || !!document.getElementById('mmaster-reload-banner');
      setBridgeOk(isOk);
      setBridgeChecking(false);
    };

    // Check inicial rápido
    check();

    // Polling de respaldo
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  const todayKey = dayNames[new Date().getDay()];
  const todayDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;

    const fetchProfiles = async () => {
      try {
        const { data }: any = await withTimeout(
          supabase.from("connected_accounts").select("id, name, chrome_profile_path").eq("user_id", user.id).eq("active", true).order("created_at") as any,
          5000
        );
        if (data && data.length > 0) {
          setProfiles(data);
          profilesRef.current = data;
          setSelectedProfileId(prev => prev && prev !== "none" ? prev : data[0].id);
        } else {
          setProfiles([]);
          profilesRef.current = [];
          setSelectedProfileId("none");
        }
      } catch (err) {
        if (isNetworkTimeout(err)) {
          setNetworkError(true);
        }
      }
    };

    fetchProfiles();

    // Suscribirse a cambios en perfiles para actualización automática
    const channel = supabase
      .channel("profiles-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "connected_accounts",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedProfileId) return;
    setItems([]); // IMPORTANT: Clear items on profile change to prevent ghost UI
    loadAll();
  }, [user, selectedProfileId]);

  const loadAll = async () => {
    setLoading(true);
    setNetworkError(false);
    try {
      await Promise.all([buildPreview(), loadTodayLogs(), loadExecution(), loadPublishConfig()]);
    } catch (err) {
      if (isNetworkTimeout(err)) {
        setNetworkError(true);
        toast.error("⚠️ Error de red al cargar el preview, reintenta");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPublishConfig = async () => {
    if (!user) return;
    const { data }: any = await withTimeout(supabase.from("publish_configs").select("*").eq("user_id", user.id).limit(1) as any, 5000);
    if (data && data.length > 0) setPublishConfig(data[0]);
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
    } else {
      setTodayPublished(0);
      return;
    }
    const { count }: any = await withTimeout(query as any, 5000);
    setTodayPublished(count || 0);
  };

  const loadExecution = async () => {
    if (!user) return;
    const { data }: any = await withTimeout(
      supabase
        .from("campaign_executions")
        .select("*")
        .eq("user_id", user.id)
        .eq("day_of_week", todayKey)
        .gte("created_at", todayDate + "T00:00:00")
        .order("created_at", { ascending: false })
        .limit(1) as any,
      5000
    );
    if (data && data.length > 0) {
      const exec = data[0];
      setExecId(exec.id);
      setExecStatus(exec.status as ExecStatus);
      setCompletedCount(exec.completed_count);
    }
  };

  const buildPreview = async () => {
    if (!user || selectedProfileId === "none") {
      setItems([]);
      return;
    }

    // 1. Obtener todas las portadas de hoy
    const { data: covers }: any = await withTimeout(
      supabase
        .from("daily_covers")
        // product_id instead of category
        .select("id, image_url, position, product_id, category")
        .eq("user_id", user.id)
        .eq("day_of_week", todayKey)
        .order("position") as any,
      5000
    );

    if (!covers || covers.length === 0) { setItems([]); return; }

    // Agrupar por Producto
    const coversByProduct: Record<string, any[]> = {};
    for (const c of covers) {
      if (c.product_id) {
        if (!coversByProduct[c.product_id]) coversByProduct[c.product_id] = [];
        coversByProduct[c.product_id].push(c);
      }
    }

    const uniqueProductIds = Object.keys(coversByProduct);
    if (uniqueProductIds.length === 0) { setItems([]); return; }

    const { data: products }: any = await withTimeout(
      supabase
        .from("products")
        .select("id, title, price, category, description, location, tags, condition")
        .in("id", uniqueProductIds) as any,
      5000
    );

    const productsMap: Record<string, any> = {};
    for (const p of (products || [])) {
      productsMap[p.id] = p;
    }

    const { data: galleries }: any = await withTimeout(
      supabase
        .from("product_images")
        .select("id, image_url, product_id")
        .in("product_id", uniqueProductIds)
        .eq("is_cover", false)
        .order("position") as any,
      5000
    );

    // Load today's successful logs to mark completed
    // SECURITY + PROFILE ISOLATION: Fetch strictly for the authenticated user and selected profile
    let logQuery = supabase
      .from("publication_logs")
      .select("cover_id, product_id")
      .eq("user_id", user.id)
      .eq("profile_id", selectedProfileId)
      .gte("published_at", todayDate + "T00:00:00")
      .eq("status", "success");

    const { data: logs }: any = await withTimeout(logQuery as any, 5000);
    const loggedSet = new Set((logs || []).map((l) => `${l.cover_id}-${l.product_id}`));

    const publishItems: PublishItem[] = [];
    let globalIdx = 0;

    for (const productId of uniqueProductIds) {
      const catCovers = coversByProduct[productId];
      const product = productsMap[productId];
      if (!product) continue;

      for (let i = 0; i < catCovers.length; i++) {
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
  const blocked = limitReached || subExpired || networkError;

  // Realtime Logs Listener
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

          // INDEPENDENCIA TOTAL: Solo actualizar si el log pertenece al perfil seleccionado
          if (log.profile_id === selectedProfileId) {
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
                .then(() => { });
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, execId, completedCount, selectedProfileId]);

  // Telemetry Listener (Separate from public-logs to avoid bugs)
  useEffect(() => {
    if (!user) return;
    // ESCUCHAR TELEMETRÍA REMOTA (Celulares)
    const telemetryChannel = supabase.channel('bot-telemetry')
      .on("broadcast", { event: "bot_status" }, (payload) => {
        if (payload.payload?.profile_id === selectedProfileId || !selectedProfileId) {
          setTelemetryMsg(payload.payload.message);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(telemetryChannel);
    };
  }, [user, selectedProfileId]);

  // Escuchar mensajes del Bridge sobre el estado de la extensión (Local)
  useEffect(() => {
    const handleBridgeMessage = (e: MessageEvent) => {
      if (e.data?.source === "MARKETMASTER_BRIDGE") {
        console.log(`[Bridge Action] 📥 ${e.data.action}`, e.data.payload);

        if (e.data.action === "PROFILE_DETECTED") {
          const profileId = e.data.payload.id; // Este es el chromeProfileId (UUID de la extensión)
          // CORRECCIÓN: buscar por chrome_profile_path, NO por id (Supabase UUID)
          const knownProfile = profilesRef.current.find(p => p.chrome_profile_path === profileId);
          const profileName = knownProfile ? knownProfile.name : e.data.payload.name;

          setDetectedProfile({ id: profileId, name: profileName });

          if (!autoSelectedRef.current && knownProfile) {
            console.log("[Bridge] 🤖 Perfil detectado de manera automática:", profileName);
            // Seleccionar por Supabase UUID para que el Select funcione correctamente
            setSelectedProfileId(knownProfile.id);
            autoSelectedRef.current = true;
          }
          return;
        }

        // --- FILTRADO DE SEGURIDAD (Multi-perfil) ---
        const msgProfileId = e.data.payload?.profile_id || e.data.payload?.profileId;

        // RELAXED MATCH: Si el mensaje no trae ID, o si coincide con el seleccionado, lo dejamos pasar.
        // Esto previene que el dashboard se quede "mudo" si la extensión olvida mandar el ID en algún paso.
        const matches = !msgProfileId || !selectedProfileId || selectedProfileId === "none" || selectedProfileId === msgProfileId;

        if (!matches) {
          console.log(`[Bridge Filter] 🛡️ Mensaje de otro perfil (${msgProfileId}) ignorado en UI local.`);
          // Relay hacia Supabase para el móvil (telemetría cross-profile)
          if (e.data.action === "TELEMETRY_UPDATE") {
            supabase.channel('bot-telemetry').send({
              type: "broadcast",
              event: "bot_status",
              payload: { ...e.data.payload, profile_id: msgProfileId }
            });
          }
          return;
        }

        if (e.data.action === "ITEM_START") {
          setActiveIdx(e.data.payload.index);
          setIsAutomationRunning(true);
          setTelemetryMsg("Iniciando...");

        } else if (e.data.action === "COMPLETED") {
          setIsAutomationRunning(false);
          setActiveIdx(null);
          setTelemetryMsg("Esperando...");

          if (e.data.payload.productId) {
            setItems(prevItems => prevItems.map(item => {
              if (item.product.id === e.data.payload.productId) return { ...item, logged: true };
              return item;
            }));
          }

        } else if (e.data.action === "ITEM_PUBLISHED_SUCCESS") {
          const { productId, index } = e.data.payload;
          setItems(prev => prev.map((item, i) => {
            if (i === index || item.product.id === productId) return { ...item, logged: true };
            return item;
          }));
          setActiveIdx(index + 1);
          setTelemetryMsg(`✅ Producto #${index + 1} listo.`);

        } else if (e.data.action === "TELEMETRY_UPDATE") {
          const msg = e.data.payload.message;
          setTelemetryMsg(msg);

          // PROPAGACIÓN REALTIME AL CELULAR
          supabase.channel('bot-telemetry').send({
            type: "broadcast",
            event: "bot_status",
            payload: {
              ...e.data.payload,
              profile_id: msgProfileId || selectedProfileId
            }
          });
        }
      }
    };
    window.addEventListener("message", handleBridgeMessage);
    return () => window.removeEventListener("message", handleBridgeMessage);
  }, [selectedProfileId]);

  const dispatchToExtension = (startIdx: number, forceStart = false) => {
    // SALTO INTELIGENTE: Solo al REANUDAR (no al iniciar)
    // Al iniciar siempre empezar desde donde se pide, ignorando logs
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
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
    // CRÍTICO: Enviar chrome_profile_path (no Supabase UUID) como profileId
    // La extensión compara esto contra su chromeProfileId almacenado en chrome.storage
    const selectedProfileData = profiles.find(p => p.id === selectedProfileId);
    const chromeProfilePath = selectedProfileData?.chrome_profile_path ?? null;

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
        manualPublish: true,
        options: publishConfig?.options || ["public_place", "hide_friends"],
        useProductCategory: publishConfig?.use_product_category ?? true,
        selectedCategories: publishConfig?.categories || []
      },
      profileId: selectedProfile?.chrome_profile_path || null,
      currentIndex: realStartIdx
    };


    setIsAutomationRunning(true);
    setActiveIdx(realStartIdx);
    console.log("[MarketMaster] Enviando AutomationTask a extensión (test):", automationTask);

    // Enviar el mensaje al bridge
    window.postMessage({
      source: "MARKETMASTER_DASHBOARD",
      action: "START_AUTO_FILL",
      payload: automationTask
    }, "*");

    // Si el bridge no responde en 3s, alertar al usuario
    setTimeout(() => {
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
      await withTimeout(supabase.from("campaign_executions").update({ ...payload, status: "running" } as any).eq("id", execId) as any, 5000);
    } else {
      const { data, error }: any = await withTimeout(supabase.from("campaign_executions").insert(payload).select("id").single() as any, 5000);
      if (!error && data) {
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
    // 1. Pausa Extrema: detener la extensión inmediatamente
    window.postMessage({ source: "MARKETMASTER_DASHBOARD", action: "PAUSE_AUTOMATION" }, "*");

    // 2. Guardar estado en BD
    await withTimeout(supabase.from("campaign_executions").update({ status: "paused", paused_at: new Date().toISOString() } as any).eq("id", execId) as any, 5000);
    setExecStatus("paused");
    toast.info(`Campaña pausada abruptamente en #${completedCount}.`);
  };

  const handleResume = async () => {
    if (!execId) return;
    await withTimeout(supabase.from("campaign_executions").update({ status: "running", paused_at: null } as any).eq("id", execId) as any, 5000);
    setExecStatus("running");

    dispatchToExtension(completedCount); // resume: usar smart-skip normal
    toast.success(`Campaña reanudada desde #${completedCount + 1}.`);
  };

  const handleReset = async () => {
    if (!execId) return;
    await withTimeout(supabase.from("campaign_executions").update({ status: "idle", completed_count: 0, paused_at: null, started_at: null } as any).eq("id", execId) as any, 5000);
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

  if (networkError) {
    return (
      <div className="p-8">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <WifiOff className="h-8 w-8 text-destructive" />
            <p className="font-medium text-destructive">⚠️ Error de red</p>
            <p className="text-sm text-muted-foreground">No se pudo conectar con el servidor para cargar el preview. Verifica tu internet.</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadAll(); }}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Preview de Publicación</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Revisa las publicaciones para hoy (<span className="capitalize text-primary font-medium">{todayKey}</span>).
          </p>
        </div>
        <div className="w-full sm:w-auto flex flex-col md:flex-row items-end md:items-center gap-3">
          {/* Notificación persistente del Perfil que está emitiendo por el bridge local */}
          {detectedProfile && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 hidden md:flex items-center gap-1.5 h-10 px-3">
              <CheckCircle2 className="h-4 w-4" />
              <span>Perfil Activo en esta ventana: <strong>{detectedProfile.name}</strong></span>
            </Badge>
          )}

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
              <div className="flex flex-col gap-2 min-w-[220px]">
                <Button
                  onClick={handleStart}
                  disabled={blocked || items.length === 0 || selectedProfileId === "none" || profiles.length === 0 || (!bridgeOk && !bridgeChecking)}
                  size="lg"
                  className={cn(
                    "w-full transition-all active:scale-95",
                    !bridgeOk && !bridgeChecking ? "bg-muted text-muted-foreground opacity-50" : "bg-primary hover:bg-primary/90 text-white shadow-md"
                  )}
                >
                  <Play className={cn("h-5 w-5 mr-2", (!bridgeOk && !bridgeChecking) ? "" : "text-white")} />
                  {!bridgeOk && !bridgeChecking ? "Extensión no detectada" : "Iniciar publicación"}
                </Button>
                {!bridgeOk && !bridgeChecking && (
                  <p className="text-[10px] text-destructive flex items-center justify-center gap-1 animate-pulse font-bold bg-destructive/10 py-1 rounded">
                    <Info className="h-3 w-3" /> Extensión no lista. Refresca (F5).
                  </p>
                )}
                {bridgeChecking && (
                  <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verificando extensión...
                  </p>
                )}
              </div>
            )}
            {execStatus === "running" && (
              <>
                <Button onClick={handlePause} variant="destructive" size="lg" className="animate-pulse shadow-md">
                  <Pause className="h-5 w-5 mr-2" /> Pausar Bot
                </Button>
                <div className="flex flex-col gap-1.5 ml-2">
                  <Badge className="bg-accent text-accent-foreground animate-pulse self-start">
                    <ListChecks className="h-3 w-3 mr-1" /> Publicando... {completedCount}/{items.length}
                  </Badge>
                  {telemetryMsg && (
                    <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 bg-muted/50 px-2 py-1.5 rounded-md">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                      </span>
                      {telemetryMsg}
                    </span>
                  )}
                </div>
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

