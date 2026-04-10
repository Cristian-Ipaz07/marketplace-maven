import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, Search, Plus, Trash2, Loader2, Download, ImagePlus, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface Product {
  id: string;
  title: string;
  short_name: string | null;
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

// CATEGORÍAS EXACTAS DE FACEBOOK MARKETPLACE (Español)
// Estos nombres deben coincidir EXACTAMENTE con lo que muestra Facebook
const categories = [
  "Hogar",
  "Jardinería",
  "Muebles",
  "Electrodomésticos",
  "Salud y belleza",
  "Ropa y accesorios",
  "Bolsos y equipaje",
  "Ropa y calzado de mujer",
  "Ropa y calzado de hombre",
  "Joyas y accesorios",
  "Eletrónica e informática",
  "Teléfonos celulares",
  "Videojuegos",
  "Libros, películas y música",
  "Deportes y actividades al aire libre",
  "Bicicletas",
  "Juguetes y juegos",
  "Bebés y niños",
  "Productos para mascotas",
  "Arte y manualidades",
  "Instrumentos musicales",
  "Antigüedades y artículos de colección",
  "Herramientas",
  "Autopartes",
  "Pasatiempos",
  "Clasificados",
  "Varios",
];

const emptyProduct = { title: "", short_name: "", price: "", description: "", tags: "", category: "Hogar", location: "", condition: "Nuevo" };

export default function Inventory() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [editForm, setEditForm] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      const { data, error } = await supabase.from("products").select("id, title, short_name, price, description, tags, category, location, condition").order("created_at", { ascending: false });
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
      ["title", "short_name", "price", "category", "condition", "description", "tags", "location"],
      ["Chaqueta térmica", "Chaqueta Invierno", "45000", "Ropa y calzado de hombre", "Nuevo", "Chaqueta premium resistente al frío", "chaqueta,invierno,hombre", "Bogotá"],
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
          short_name: row["short_name"] || row["nombre_corto"] || null,
          price: row["price"] || row["precio"] || "0",
          description: row["description"] || row["descripcion"] || null,
          tags: row["tags"] || row["etiquetas"] || null,
          category: row["category"] || row["categoria"] || "General",
          condition: row["condition"] || row["estado"] || "Nuevo",
          location: row["location"] || row["ubicacion"] || null,
        }));
        const { data: inserted, error } = await supabase.from("products").insert(rows).select("id, title, short_name, price, description, tags, category, location, condition");
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
      user_id: user.id, title: form.title, short_name: form.short_name || null, price: form.price || "0",
      description: form.description || null, tags: form.tags || null,
      category: form.category, condition: form.condition, location: form.location || null,
    }).select("id, title, short_name, price, description, tags, category, location, condition").single();
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

  const updateProduct = async () => {
    if (!user || !editForm || !editForm.title.trim()) { toast.error("El título es obligatorio"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("products").update({
      title: editForm.title, short_name: editForm.short_name || null, price: editForm.price || "0",
      description: editForm.description || null, tags: editForm.tags || null,
      category: editForm.category, condition: editForm.condition, location: editForm.location || null,
    }).eq("id", editForm.id).select("id, title, short_name, price, description, tags, category, location, condition").single();
    setSaving(false);
    if (error) { toast.error("Error actualizando producto"); return; }
    setProducts((prev) => prev.map((p) => p.id === editForm.id ? data : p));
    setEditForm(null);
    setEditOpen(false);
    toast.success("Producto actualizado");
  };

  const exportInventory = () => {
    const dataToExport = products.map((p) => ({
      title: p.title,
      short_name: p.short_name || "",
      price: p.price,
      category: p.category || "",
      condition: p.condition || "",
      description: p.description || "",
      tags: p.tags || "",
      location: p.location || "",
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "inventario.xlsx");
    toast.success("Inventario exportado");
  };

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
    if (files.length > remaining) { toast.error(`Solo puedes agregar ${remaining} imágenes más (máx. 9)`); return; }
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

  const removeImage = async (img: ProductImage) => {
    await supabase.from("product_images").delete().eq("id", img.id);
    const urlParts = img.image_url.split("/product-images/");
    if (urlParts[1]) await supabase.storage.from("product-images").remove([urlParts[1]]);
    setProductImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Inventario</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} productos en tu catálogo</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Plantilla</span>
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Importar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportInventory}>
            <Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Exportar</span>
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Agregar</span></Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-display">Nuevo producto</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del producto" /></div>
                  <div className="col-span-2 sm:col-span-1"><Label>Nombre Corto (Opcional)</Label><Input value={form.short_name || ""} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder="Ej: Adrenaline" /></div>
                </div>
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
                <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" /></div>
                <div><Label>Etiquetas</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="etiqueta1, etiqueta2" /></div>
              </div>
              <DialogFooter>
                <Button onClick={addProduct} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Editar producto</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1"><Label>Título *</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Nombre del producto" /></div>
                <div className="col-span-2 sm:col-span-1"><Label>Nombre Corto (Opcional)</Label><Input value={editForm.short_name || ""} onChange={(e) => setEditForm({ ...editForm, short_name: e.target.value })} placeholder="Ej: Adrenaline" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Precio</Label><Input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="0" /></div>
                <div><Label>Categoría</Label>
                  <Select value={editForm.category || "General"} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Estado</Label>
                  <Select value={editForm.condition || "Nuevo"} onValueChange={(v) => setEditForm({ ...editForm, condition: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{conditions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Ubicación</Label><Input value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Ciudad" /></div>
              </div>
              <div><Label>Descripción</Label><Input value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descripción" /></div>
              <div><Label>Etiquetas</Label><Input value={editForm.tags || ""} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="etiqueta1, etiqueta2" /></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={updateProduct} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Manager Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Imágenes — {selectedProduct?.title}</DialogTitle></DialogHeader>
          <div className="bg-primary/5 border border-border/60 rounded-lg p-3 mb-2">
            <p className="text-xs text-muted-foreground">📌 La portada se asigna desde "Portadas Diarias" según categoría y día.</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 py-2">
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

      {/* Product list */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar productos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm px-4">
                  {products.length === 0 ? "Importa un Excel o agrega productos" : "No se encontraron productos"}
                </div>
              ) : (
                filtered.map((p) => (
                  <div key={p.id} className="p-4 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm truncate" title={p.title}>{p.short_name || p.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">${p.price}</span>
                        <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.condition || "Nuevo"}</Badge>
                      </div>
                      {p.location && <div className="text-[10px] text-muted-foreground mt-1">{p.location}</div>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openImageManager(p)}>
                        <ImagePlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditForm(p); setEditOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeProduct(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Desktop: Table layout */
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
                        <div className="font-medium text-foreground" title={p.title}>{p.short_name || p.title}</div>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditForm(p); setEditOpen(true); }}>
                            <Pencil className="h-4 w-4" />
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
