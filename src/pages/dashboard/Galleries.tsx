import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImagePlus, Plus, Trash2, Loader2, X, Images, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/utils/imageCompressor";

interface Gallery {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface GalleryImage {
  id: string;
  image_url: string;
  position: number;
}

export default function Galleries() {
  const { user } = useAuth();

  // --- State galerías ---
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Crear / Editar galería ---
  const [createOpen, setCreateOpen] = useState(false);
  const [editGallery, setEditGallery] = useState<Gallery | null>(null);
  const [galleryName, setGalleryName] = useState("");
  const [galleryDesc, setGalleryDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Gestión de imágenes de una galería ---
  const [imagesOpen, setImagesOpen] = useState(false);
  const [activeGallery, setActiveGallery] = useState<Gallery | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Carga inicial ---
  useEffect(() => {
    if (!user) return;
    fetchGalleries();
  }, [user]);

  const fetchGalleries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shared_galleries")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Error cargando galerías");
    else setGalleries(data || []);
    setLoading(false);
  };

  // ============================================================
  // CRUD galerías
  // ============================================================
  const createGallery = async () => {
    if (!user || !galleryName.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("shared_galleries")
      .insert({ user_id: user.id, name: galleryName.trim(), description: galleryDesc.trim() || null })
      .select("id, name, description, created_at")
      .single();
    setSaving(false);
    if (error) { toast.error("Error creando galería"); return; }
    setGalleries(prev => [data, ...prev]);
    setGalleryName(""); setGalleryDesc("");
    setCreateOpen(false);
    toast.success(`Galería "${data.name}" creada`);
  };

  const updateGallery = async () => {
    if (!editGallery || !galleryName.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("shared_galleries")
      .update({ name: galleryName.trim(), description: galleryDesc.trim() || null })
      .eq("id", editGallery.id)
      .select("id, name, description, created_at")
      .single();
    setSaving(false);
    if (error) { toast.error("Error actualizando galería"); return; }
    setGalleries(prev => prev.map(g => g.id === editGallery.id ? data : g));
    setEditGallery(null); setGalleryName(""); setGalleryDesc("");
    toast.success("Galería actualizada");
  };

  const deleteGallery = async (gallery: Gallery) => {
    if (!confirm(`¿Eliminar galería "${gallery.name}"? Las imágenes se perderán.`)) return;
    // Borrar imágenes del storage
    const { data: imgs } = await supabase
      .from("shared_gallery_images")
      .select("image_url")
      .eq("gallery_id", gallery.id);
    if (imgs && imgs.length > 0) {
      const paths = imgs.map(i => {
        const parts = i.image_url.split("/gallery-images/");
        return parts.length > 1 ? parts[1] : null;
      }).filter(Boolean) as string[];
      if (paths.length > 0) await supabase.storage.from("gallery-images").remove(paths);
    }
    const { error } = await supabase.from("shared_galleries").delete().eq("id", gallery.id);
    if (error) { toast.error("Error eliminando galería"); return; }
    setGalleries(prev => prev.filter(g => g.id !== gallery.id));
    toast.success("Galería eliminada");
  };

  // ============================================================
  // Gestión de imágenes
  // ============================================================
  const openImages = async (gallery: Gallery) => {
    setActiveGallery(gallery);
    setImagesOpen(true);
    const { data } = await supabase
      .from("shared_gallery_images")
      .select("id, image_url, position")
      .eq("gallery_id", gallery.id)
      .order("position");
    setImages(data || []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !activeGallery) return;
    const remaining = 20 - images.length;
    if (files.length > remaining) { toast.error(`Solo puedes agregar ${remaining} imágenes más (máx. 20)`); return; }

    setUploading(true);
    const newImages: GalleryImage[] = [];
    const maxPos = images.reduce((max, img) => Math.max(max, img.position), -1);

    // Compress all files first
    const compressedFiles = await Promise.all(
      Array.from(files).slice(0, remaining).map(file => compressImage(file))
    );

    // Upload in parallel
    const uploadPromises = compressedFiles.map(async (file, i) => {
      const ext = "webp";
      const path = `${user.id}/${activeGallery.id}/${Date.now()}_${i}.webp`;
      
      const { error: upErr } = await supabase.storage
        .from("gallery-images")
        .upload(path, file, {
          contentType: "image/webp",
          upsert: true,
        });
      if (upErr) { console.error(upErr); return null; }
      
      const { data: urlData } = supabase.storage.from("gallery-images").getPublicUrl(path);
      
      const { data: row, error: dbErr } = await supabase
        .from("shared_gallery_images")
        .insert({ gallery_id: activeGallery.id, user_id: user.id, image_url: urlData.publicUrl, position: maxPos + 1 + i })
        .select("id, image_url, position")
        .single();
        
      if (!dbErr && row) return row;
      return null;
    });

    const results = await Promise.all(uploadPromises);
    const validImages = results.filter((r): r is GalleryImage => r !== null);
    
    newImages.push(...validImages);

    setImages(prev => [...prev, ...newImages]);
    setUploading(false);
    toast.success(`${newImages.length} imagen(es) subida(s)`);
    e.target.value = "";
  };

  const removeImage = async (img: GalleryImage) => {
    await supabase.from("shared_gallery_images").delete().eq("id", img.id);
    const parts = img.image_url.split("/gallery-images/");
    if (parts[1]) await supabase.storage.from("gallery-images").remove([parts[1]]);
    setImages(prev => prev.filter(i => i.id !== img.id));
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Images className="h-6 w-6 text-primary" /> Galerías de Apoyo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conjuntos de imágenes reutilizables entre productos del mismo tipo
          </p>
        </div>
        <Button size="sm" onClick={() => { setGalleryName(""); setGalleryDesc(""); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Galería
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-6 text-sm text-muted-foreground">
        💡 Crea un conjunto de imágenes (ej: <strong>Lociones Mujer</strong>) y asígnalo a varios productos en el
        Inventario. El bot usará esas imágenes como apoyo en cada publicación.
      </div>

      {/* Lista de galerías */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : galleries.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Images className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin galerías aún</p>
          <p className="text-sm mt-1">Crea tu primera galería de imágenes de apoyo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleries.map(gallery => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              onOpenImages={() => openImages(gallery)}
              onEdit={() => { setEditGallery(gallery); setGalleryName(gallery.name); setGalleryDesc(gallery.description || ""); }}
              onDelete={() => deleteGallery(gallery)}
            />
          ))}
        </div>
      )}

      {/* --- Dialog Crear --- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nueva Galería</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={galleryName}
                onChange={e => setGalleryName(e.target.value)}
                placeholder="Ej: Lociones Mujer, Chaquetas Hombre..."
                onKeyDown={e => e.key === "Enter" && createGallery()}
              />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Input
                value={galleryDesc}
                onChange={e => setGalleryDesc(e.target.value)}
                placeholder="Para identificarla rápido"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createGallery} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Dialog Editar nombre --- */}
      <Dialog open={!!editGallery} onOpenChange={open => !open && setEditGallery(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Editar Galería</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={galleryName} onChange={e => setGalleryName(e.target.value)} placeholder="Nombre de la galería" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Input value={galleryDesc} onChange={e => setGalleryDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGallery(null)}>Cancelar</Button>
            <Button onClick={updateGallery} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Dialog Imágenes de la galería --- */}
      <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Images className="h-5 w-5 text-primary" />
              {activeGallery?.name}
              <Badge variant="secondary" className="ml-1">{images.length} imagen{images.length !== 1 ? "es" : ""}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2 text-xs text-amber-700 dark:text-amber-400">
            📌 Estas imágenes se añaden <strong>después</strong> de las propias del producto en cada publicación.
            Máximo 20 imágenes por galería.
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 py-2 max-h-[50vh] overflow-y-auto">
            {images.map((img, idx) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border-2 border-border/60 aspect-square">
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-background/80">#{idx + 1}</Badge>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-destructive" onClick={() => removeImage(img)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {images.length < 20 && (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><ImagePlus className="h-5 w-5" /><span className="text-[10px] mt-1">Subir</span></>
                }
              </button>
            )}
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Componente tarjeta de galería ----
function GalleryCard({
  gallery,
  onOpenImages,
  onEdit,
  onDelete,
}: {
  gallery: Gallery;
  onOpenImages: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [imageCount, setImageCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("shared_gallery_images")
      .select("image_url")
      .eq("gallery_id", gallery.id)
      .order("position")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setPreview(data[0].image_url);
      });
  }, [gallery.id, gallery.updated_at]);

  useEffect(() => {
    supabase
      .from("shared_gallery_images")
      .select("id", { count: "exact", head: true })
      .eq("gallery_id", gallery.id)
      .then(({ count }) => setImageCount(count ?? 0));
  }, [gallery.id, gallery.updated_at]);

  return (
    <Card className="border-border/60 hover:border-primary/40 transition-colors group">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground leading-tight">{gallery.name}</CardTitle>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {gallery.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{gallery.description}</p>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Preview + conteo */}
        <button
          onClick={onOpenImages}
          className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden"
        >
          {preview ? (
            <div className="relative aspect-video">
              <img src={preview} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium flex items-center gap-1.5">
                  <ImagePlus className="h-4 w-4" /> Administrar imágenes
                </span>
              </div>
            </div>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ImagePlus className="h-8 w-8 opacity-40" />
              <span className="text-xs">Sin imágenes — clic para agregar</span>
            </div>
          )}
        </button>
        <div className="flex items-center justify-between mt-2">
          <Badge variant="secondary" className="text-xs">
            {imageCount === null ? "..." : imageCount} imagen{imageCount !== 1 ? "es" : ""}
          </Badge>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenImages}>
            <ImagePlus className="h-3.5 w-3.5 mr-1" /> Administrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
