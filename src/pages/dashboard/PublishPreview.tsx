import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, ImageIcon, AlertTriangle } from "lucide-react";
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
}

const dayNames = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export default function PublishPreview() {
  const { user } = useAuth();
  const [items, setItems] = useState<PublishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [launched, setLaunched] = useState(false);

  const todayKey = dayNames[new Date().getDay()];

  useEffect(() => {
    if (!user) return;
    buildPreview();
  }, [user]);

  const buildPreview = async () => {
    setLoading(true);

    // Get today's covers grouped by category
    const { data: covers } = await supabase
      .from("daily_covers")
      .select("id, image_url, position, category")
      .eq("day_of_week", todayKey)
      .order("position");

    if (!covers || covers.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Group covers by category
    const coversByCategory: Record<string, Cover[]> = {};
    for (const c of covers) {
      if (!coversByCategory[c.category]) coversByCategory[c.category] = [];
      coversByCategory[c.category].push(c);
    }

    // Get products (one per category is enough, each product maps to multiple publications)
    const { data: products } = await supabase
      .from("products")
      .select("id, title, price, category");

    // Group products by category
    const productsByCategory: Record<string, Product[]> = {};
    for (const p of (products || [])) {
      const cat = p.category || "General";
      if (!productsByCategory[cat]) productsByCategory[cat] = [];
      productsByCategory[cat].push(p);
    }

    // Get all product IDs for gallery fetch
    const allProductIds = (products || []).map((p) => p.id);
    const { data: galleries } = await supabase
      .from("product_images")
      .select("id, image_url, product_id")
      .in("product_id", allProductIds.length > 0 ? allProductIds : ["none"])
      .eq("is_cover", false)
      .order("position");

    // Build publication items: each cover = one publication
    const publishItems: PublishItem[] = [];
    let globalIdx = 0;

    for (const [category, catCovers] of Object.entries(coversByCategory)) {
      const catProducts = productsByCategory[category] || [];
      if (catProducts.length === 0) continue;

      for (let i = 0; i < catCovers.length; i++) {
        // Round-robin products if fewer products than covers
        const product = catProducts[i % catProducts.length];
        const productGallery = (galleries || []).filter((g) => g.product_id === product.id);

        publishItems.push({
          product,
          cover: catCovers[i],
          gallery: productGallery,
          publicationIndex: globalIdx++,
        });
      }
    }

    setItems(publishItems);
    setLoading(false);
  };

  const handleLaunch = () => {
    setLaunched(true);
    toast.success("¡Flujo de publicación activado! El bot comenzará a publicar según la configuración.");
  };

  // Stats
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
          Revisa las publicaciones para hoy (<span className="capitalize text-primary font-medium">{todayKey}</span>). Se generan según las portadas subidas.
        </p>
      </div>

      {/* Warnings */}
      {missingGallery > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 mb-6">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Atención</span>
            </div>
            <p className="text-xs text-muted-foreground">{missingGallery} publicaciones sin imágenes de galería. Agrégalas desde el Inventario.</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="border-border/60 mb-6">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-sm">{items.length} publicaciones</Badge>
            <Badge variant="outline" className="text-sm capitalize">{todayKey}</Badge>
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <Badge key={cat} variant="outline" className="text-xs">
                {cat}: {count}
              </Badge>
            ))}
          </div>
          <Button onClick={handleLaunch} disabled={launched || items.length === 0} size="lg">
            {launched ? (
              <><CheckCircle2 className="h-5 w-5 mr-2" /> Activado</>
            ) : (
              <><Play className="h-5 w-5 mr-2" /> Activar publicación</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={`${item.cover.id}-${item.publicationIndex}`} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">#{item.publicationIndex + 1}</span>
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
        ))}

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
