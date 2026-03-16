import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Rocket, Loader2, CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

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
  const [quantity, setQuantity] = useState("10");
  const [useProductCategory, setUseProductCategory] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [condition, setCondition] = useState("Nuevo");
  const [options, setOptions] = useState<Record<string, boolean>>({
    hide_friends: false,
    public_place: true,
    door_pickup: false,
    door_delivery: false,
  });
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [productCategories, setProductCategories] = useState<string[]>([]);

  const today = dayNames[new Date().getDay()];

  // Load existing config & product categories
  useEffect(() => {
    if (!user) return;
    supabase.from("publish_configs").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        const c = data[0];
        setConfigId(c.id);
        setQuantity(String(c.quantity));
        setSelectedCategories(c.categories || []);
        setCondition(c.condition);
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
      quantity: parseInt(quantity),
      categories: useProductCategory ? [] as string[] : selectedCategories,
      condition,
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
    const catLabel = useProductCategory ? "categoría individual por producto" : `${selectedCategories.length} categorías`;
    toast.success(`Configuración guardada: ${quantity} publicaciones con ${catLabel}`);
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Configurar publicación</h1>
        <p className="text-muted-foreground text-sm mt-1">Define los parámetros de tus publicaciones</p>
      </div>

      <div className="space-y-6">
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

        {/* Quantity */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Cantidad de publicaciones</CardTitle>
            <CardDescription>Cuántas publicaciones deseas crear en esta campaña</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={quantity} onValueChange={setQuantity}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["5", "10", "15", "20", "30"].map((v) => (
                  <SelectItem key={v} value={v}>{v} publicaciones</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

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

        {/* Condition */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Condición del producto</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {conditions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

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

        <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Rocket className="h-5 w-5 mr-2" />}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
