import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Eye, CheckCircle2, ImageIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
}

interface GalleryImage {
  id: string;
  image_url: string;
  product_id: string;
  is_cover: boolean;
}

interface PublishItem {
  product: Product;
  cover: Cover | null;
  gallery: GalleryImage[];
}

const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export default function PublishPreview() {
  const { user } = useAuth();
  const [items, setItems] = useState<PublishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(10);
  const [launched, setLaunched] = useState(false);

  const todayKey = dayNames[new Date().getDay()];

  useEffect(() => {
    if (!user) return;
    buildPreview();
  }, [user]);

  const buildPreview = async () => {
    setLoading(true);
    // Get config
    const { data: configs } = await supabase.from("publish_configs").select("*").limit(1);
    const config = configs?.[0];
    const qty = config?.quantity || 10;
    setQuantity(qty);

    // Get products
    const { data: products } = await supabase.from("products").select("id, title, price, category").limit(qty);

    // Get today's covers
    const { data: covers } = await supabase.from("daily_covers").select("id, image_url, position").eq("day_of_week", todayKey).order("position");

    // Get gallery images for these products
    const productIds = (products || []).map((p) => p.id);
    const { data: galleries } = await supabase.from("product_images").select("id, image_url, product_id, is_cover").in("product_id", productIds.length > 0 ? productIds : ["none"]).order("position");

    // Build items
    const publishItems: PublishItem[] = (products || []).slice(0, qty).map((product, idx) => ({
      product,
      cover: (covers || [])[idx] || null,
      gallery: (galleries || []).filter((g) => g.product_id === product.id && !g.is_cover),
    }));

    setItems(publishItems);
    setLoading(false);
  };

  const handleLaunch = () => {
    setLaunched(true);
    toast.success("¡Flujo de publicación activado! El bot comenzará a publicar según la configuración.");
  };

  const missingCovers = items.filter((i) => !i.cover).length;
  const missingGallery = items.filter((i) => i.gallery.length === 0).length;

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Preview de Publicación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Revisa cómo se armará cada publicación hoy (<span className="capitalize text-primary font-medium">{todayKey}</span>) antes de activar el bot.
        </p>
      </div>

      {/* Warnings */}
      {(missingCovers > 0 || missingGallery > 0) && (
        <Card className="border-destructive/50 bg-destructive/5 mb-6">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Atención</span>
            </div>
            {missingCovers > 0 && <p className="text-xs text-muted-foreground">{missingCovers} publicaciones sin portada del día. Sube más portadas en "Portadas Diarias".</p>}
            {missingGallery > 0 && <p className="text-xs text-muted-foreground">{missingGallery} productos sin imágenes de galería. Agrégalas desde el Inventario.</p>}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="border-border/60 mb-6">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">{items.length} publicaciones</Badge>
            <Badge variant="outline" className="text-sm capitalize">{todayKey}</Badge>
          </div>
          <Button onClick={handleLaunch} disabled={launched} size="lg">
            {launched ? (
              <><CheckCircle2 className="h-5 w-5 mr-2" /> Activado</>
            ) : (
              <><Play className="h-5 w-5 mr-2" /> Activar publicación</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Items preview */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <Card key={item.product.id} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Position */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                </div>

                {/* Cover thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-border/60 bg-muted">
                  {item.cover ? (
                    <img src={item.cover.image_url} alt="Portada" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{item.product.title}</p>
                  <p className="text-xs text-muted-foreground">${item.product.price} · {item.product.category || "Sin categoría"}</p>
                </div>

                {/* Gallery count */}
                <div className="flex-shrink-0 text-right">
                  <Badge variant={item.gallery.length > 0 ? "secondary" : "outline"} className="text-xs">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    {item.gallery.length} galería
                  </Badge>
                  {item.cover && <p className="text-[10px] text-muted-foreground mt-1">Portada #{item.cover.position + 1}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {items.length === 0 && (
          <Card className="border-border/60">
            <CardContent className="p-10 text-center text-muted-foreground">
              <p className="text-sm">No hay productos en el inventario para publicar.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
