import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, Search, Plus, Trash2, Loader2, Download, ImagePlus, Star, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  title: string;
  price: string;
  description: string | null;
  tags: string | null;
  category: string | null;
  location: string | null;
  condition: string | null;
}

interface ProductImage {
  id: string;
  image_url: string;
  position: number;
  is_cover: boolean;
}

const conditions = ["Nuevo", "Usado - Como nuevo", "Usado - Buen estado"];
const categories = ["General", "Ropa", "Accesorios", "Calzado", "Electrónica", "Hogar", "Deportes"];

const emptyProduct = { title: "", price: "", description: "", tags: "", category: "General", location: "", condition: "Nuevo" };

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);

  // Image upload state
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      const { data, error } = await supabase.from("products").select("id, title, price, description, tags, category, location, condition").order("created_at", { ascending: false });
      if (error) { toast.error("Error cargando productos"); console.error(error); }
      else setProducts(data || []);
      setLoading(false);
    };
    fetchProducts();
  }, [user]);

  const filtered = products.filter(
    (p) => p.title.toLowerCase().includes(search.toLowerCase()) || (p.tags || "").toLowerCase().includes(search.toLowerCase())
  );

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["title", "price", "category", "condition", "description", "tags", "location"],
      ["Chaqueta térmica", "45000", "Ropa", "Nuevo", "Chaqueta premium resistente al frío", "chaqueta,invierno,hombre", "Bogotá"],
      ["Gorra urbana", "15000", "Accesorios", "Nuevo", "Gorra moderna para uso diario", "gorra,urbana,moda", "Medellín"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "plantilla_productos.xlsx");
    toast.success("Plantilla descargada");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const rows = data.map((row) => ({
          user_id: user.id,
          title: row["title"] || row["titulo"] || "Sin título",
          price: row["price"] || row["precio"] || "0",
          description: row["description"] || row["descripcion"] || null,
          tags: row["tags"] || row["etiquetas"] || null,
          category: row["category"] || row["categoria"] || "General",
          condition: row["condition"] || row["estado"] || "Nuevo",
          location: row["location"] || row["ubicacion"] || null,
        }));
        const { data: inserted, error } = await supabase.from("products").insert(rows).select("id, title, price, description, tags, category, location, condition");
        if (error) { toast.error("Error importando"); console.error(error); return; }
        setProducts((prev) => [...(inserted || []), ...prev]);
        toast.success(`${inserted?.length || 0} productos importados`);
      } catch { toast.error("Error al leer el archivo"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const addProduct = async () => {
    if (!user || !form.title.trim()) { toast.error("El título es obligatorio"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("products").insert({
      user_id: user.id, title: form.title, price: form.price || "0",
      description: form.description || null, tags: form.tags || null,
      category: form.category, condition: form.condition, location: form.location || null,
    }).select("id, title, price, description, tags, category, location, condition").single();
    setSaving(false);
    if (error) { toast.error("Error agregando producto"); return; }
    setProducts((prev) => [data, ...prev]);
    setForm(emptyProduct);
    setAddOpen(false);
    toast.success("Producto agregado");
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Error eliminando"); return; }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Producto eliminado");
  };

  // Image management
  const openImageManager = async (product: Product) => {
    setSelectedProduct(product);
    setImageDialogOpen(true);
    const { data } = await supabase.from("product_images").select("id, image_url, position, is_cover").eq("product_id", product.id).order("position");
    setProductImages(data || []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !selectedProduct) return;
    const remaining = 9 - productImages.length;
    if (files.length > remaining) { toast.error(`Solo puedes agregar ${remaining} imágenes más (máx. 9 de galería)`); return; }
    setUploadingImages(true);
    const newImages: ProductImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${selectedProduct.id}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
      if (upErr) { console.error(upErr); continue; }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      const position = productImages.length + i;
      const isCover = productImages.length === 0 && i === 0;
      const { data: imgRow, error: dbErr } = await supabase.from("product_images").insert({
        product_id: selectedProduct.id, user_id: user.id,
        image_url: urlData.publicUrl, position, is_cover: isCover,
      }).select("id, image_url, position, is_cover").single();
      if (!dbErr && imgRow) newImages.push(imgRow);
    }
    setProductImages((prev) => [...prev, ...newImages]);
    setUploadingImages(false);
    toast.success(`${newImages.length} imagen(es) subida(s)`);
    e.target.value = "";
  };

  const setCover = async (imgId: string) => {
    if (!selectedProduct) return;
    await supabase.from("product_images").update({ is_cover: false }).eq("product_id", selectedProduct.id);
    await supabase.from("product_images").update({ is_cover: true }).eq("id", imgId);
    setProductImages((prev) => prev.map((img) => ({ ...img, is_cover: img.id === imgId })));
  };

  const removeImage = async (img: ProductImage) => {
    await supabase.from("product_images").delete().eq("id", img.id);
    // extract path from url
    const urlParts = img.image_url.split("/product-images/");
    if (urlParts[1]) await supabase.storage.from("product-images").remove([urlParts[1]]);
    setProductImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Inventario</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} productos en tu catálogo</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Descargar plantilla
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Importar Excel
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Agregar producto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-display">Nuevo producto</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del producto" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Precio</Label><Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></div>
                  <div><Label>Categoría</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Estado</Label>
                    <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{conditions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Ubicación</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ciudad" /></div>
                </div>
                <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del producto" /></div>
                <div><Label>Etiquetas</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="etiqueta1, etiqueta2" /></div>
              </div>
              <DialogFooter>
                <Button onClick={addProduct} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Image Manager Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Imágenes de Apoyo — {selectedProduct?.title}</DialogTitle></DialogHeader>
          <div className="bg-primary/5 border border-border/60 rounded-lg p-3 mb-2">
            <p className="text-xs text-muted-foreground">📌 La portada se asigna automáticamente desde <span className="font-medium text-primary">"Portadas Diarias"</span> según la categoría del producto y el día actual.</p>
          </div>
          <p className="text-xs text-muted-foreground">Sube hasta 9 imágenes fijas de apoyo que acompañarán cada publicación.</p>
          <div className="grid grid-cols-5 gap-3 py-2">
            {productImages.filter((img) => !img.is_cover).map((img, idx) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border-2 border-border/60 aspect-square">
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-background/80">#{idx + 1}</Badge>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-destructive" onClick={() => removeImage(img)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {productImages.filter((img) => !img.is_cover).length < 9 && (
              <button onClick={() => imageInputRef.current?.click()} className="border-2 border-dashed border-border rounded-lg aspect-square flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {uploadingImages ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ImagePlus className="h-5 w-5" /><span className="text-[10px] mt-1">Subir</span></>}
              </button>
            )}
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        </DialogContent>
      </Dialog>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar productos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead className="hidden md:table-cell">Categoría</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                  <TableHead className="hidden lg:table-cell">Etiquetas</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      {products.length === 0 ? "Importa un Excel o agrega productos para comenzar" : "No se encontraron productos"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{p.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">${p.price}</TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="outline">{p.condition || "Nuevo"}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{p.location || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {(p.tags || "").split(",").filter(Boolean).slice(0, 3).map((t) => (
                            <Badge key={t.trim()} variant="outline" className="text-xs">{t.trim()}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openImageManager(p)}>
                            <ImagePlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeProduct(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
