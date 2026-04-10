import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Rocket, Loader2, CalendarDays, Sparkles, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Play } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, PauseCircle, Eye } from "lucide-react";

const categories = ["Ropa", "Accesorios", "Calzado", "Electrónica", "Hogar", "Deportes"];
const conditions = ["Nuevo", "Usado - Como nuevo", "Usado - Buen estado"];
const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const marketplaceOptions = [
  { id: "hide_friends", label: "Ocultar a amigos" },
  { id: "public_place", label: "Encuentro en lugar público" },
  { id: "door_pickup", label: "Recogida en puerta" },
  { id: "door_delivery", label: "Entrega a domicilio" },
];

export default function Publish() {
  const { user } = useAuth();
  const { sub, loading: loadingSub, isExpired } = useSubscription();
  const { isAdmin, loading: loadingAdmin } = useIsAdmin();
  const navigate = useNavigate();
  
  const [useProductCategory, setUseProductCategory] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [options, setOptions] = useState<Record<string, boolean>>({
    hide_friends: false,
    public_place: true,
    door_pickup: false,
    door_delivery: false,
  });
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [detectedProfile, setDetectedProfile] = useState<{id: string, name: string} | null>(null);
  const [isBotRunning, setIsBotRunning] = useState(false);

  const today = dayNames[new Date().getDay()];

  // Load existing config & product categories
  useEffect(() => {
    if (!user) return;
    supabase.from("publish_configs").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        const c = data[0];
        setConfigId(c.id);
        setSelectedCategories(c.categories || []);
        setUseProductCategory((c as any).use_product_category ?? false);
        const opts: Record<string, boolean> = { hide_friends: false, public_place: false, door_pickup: false, door_delivery: false };
        (c.options || []).forEach((o: string) => { if (o in opts) opts[o] = true; });
        setOptions(opts);
      }
    });
    // Fetch distinct categories from inventory
    supabase.from("products").select("category").then(({ data }) => {
      if (data) {
        const unique = [...new Set(data.map((p) => p.category).filter(Boolean))] as string[];
        setProductCategories(unique);
      }
    });

    // Escuchar mensajes de la extensión (Perfil & Estado)
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.source !== "MARKETMASTER_BRIDGE") return;
      if (e.data.action === "PROFILE_DETECTED") {
        setDetectedProfile(e.data.payload);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [user]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleOption = (id: string) => {
    setOptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!useProductCategory && selectedCategories.length === 0) { toast.error("Selecciona al menos una categoría o activa 'Usar categoría del producto'"); return; }
    setSaving(true);
    const activeOptions = Object.entries(options).filter(([, v]) => v).map(([k]) => k);
    const payload = {
      user_id: user.id,
      quantity: 9999, // default max limit handled by plan in Preview
      categories: useProductCategory ? [] as string[] : selectedCategories,
      condition: "Nuevo", // Hardcoded
      options: activeOptions,
      day_of_week: today,
      use_product_category: useProductCategory,
    } as any;

    let error;
    if (configId) {
      ({ error } = await supabase.from("publish_configs").update(payload).eq("id", configId));
    } else {
      const res = await supabase.from("publish_configs").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setConfigId(res.data.id);
    }
    setSaving(false);
    if (error) { toast.error("Error guardando configuración"); console.error(error); return; }
    
    toast.success(`Configuración guardada exitosamente.`);
    navigate("/dashboard/publish-preview");
  };

  const hasAccess = isAdmin || (!loadingSub && sub && !isExpired);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Configurar publicación</h1>
          <p className="text-muted-foreground text-sm mt-1">Define los parámetros de tus publicaciones</p>
        </div>
        <div className="flex items-center gap-2">
          {detectedProfile && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 hidden md:flex items-center gap-1.5 h-10 px-3">
              <CheckCircle2 className="h-4 w-4" />
              <span>Perfil Detectado: <strong>{detectedProfile.name}</strong></span>
            </Badge>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/publish-preview">
              <Eye className="h-4 w-4 mr-2" />
              Ir a Área de Publicación
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Subscription Expired Warning */}
        {isExpired && !isAdmin && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">Tu plan ha expirado</p>
                <p className="text-xs text-muted-foreground mt-0.5">Renueva tu suscripción para seguir publicando automáticamente en Marketplace.</p>
              </div>
              <Button asChild size="sm" variant="destructive">
                <Link to="/dashboard/subscription">Renovar ahora</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Day indicator */}
        <Card className="border-border/60 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Día detectado: <span className="capitalize text-primary">{today}</span></p>
              <p className="text-xs text-muted-foreground">Las portadas se tomarán de la carpeta <code className="bg-muted px-1 rounded">/portadas/{today}</code></p>
            </div>
          </CardContent>
        </Card>

        {/* Quantity and Condition cards removed -> Simplified based on subscription plan limitations */}

        {/* Categories */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Categorías</CardTitle>
            <CardDescription>Selecciona cómo asignar categorías a cada publicación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Smart toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-border/60">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="use_product_category" className="text-sm font-medium cursor-pointer">Usar categoría del producto</Label>
                  <p className="text-xs text-muted-foreground">Cada artículo usará su propia categoría del inventario</p>
                </div>
              </div>
              <Switch id="use_product_category" checked={useProductCategory} onCheckedChange={setUseProductCategory} />
            </div>

            {useProductCategory ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Categorías detectadas en tu inventario:</p>
                <div className="flex flex-wrap gap-2">
                  {productCategories.length > 0 ? productCategories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-sm px-3 py-1.5">
                      {cat}
                    </Badge>
                  )) : (
                    <p className="text-xs text-muted-foreground italic">No se encontraron categorías en el inventario. Importa productos primero.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat} variant={selectedCategories.includes(cat) ? "default" : "outline"} className="cursor-pointer text-sm px-3 py-1.5 transition-colors" onClick={() => toggleCategory(cat)}>
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form elements mapped below */}

        {/* Marketplace Options as Switches */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Opciones de Marketplace</CardTitle>
            <CardDescription>Activa o desactiva las opciones de entrega y visibilidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {marketplaceOptions.map((opt) => (
                <div key={opt.id} className="flex items-center justify-between">
                  <Label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.label}</Label>
                  <Switch id={opt.id} checked={options[opt.id]} onCheckedChange={() => toggleOption(opt.id)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={handleSave} disabled={!hasAccess || saving}>
          {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Rocket className="h-5 w-5 mr-2" />}
          Guardar y Previsualizar
        </Button>
      </div>
    </div>
  );
}
