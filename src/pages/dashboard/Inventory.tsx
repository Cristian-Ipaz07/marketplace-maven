import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, Plus, Trash2, Loader2 } from "lucide-react";
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
}

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      const { data, error } = await supabase.from("products").select("id, title, price, description, tags, category").order("created_at", { ascending: false });
      if (error) { toast.error("Error cargando productos"); console.error(error); }
      else setProducts(data || []);
      setLoading(false);
    };
    fetchProducts();
  }, [user]);

  const filtered = products.filter(
    (p) => p.title.toLowerCase().includes(search.toLowerCase()) || (p.tags || "").toLowerCase().includes(search.toLowerCase())
  );

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
          title: row["title"] || row["titulo"] || row["product"] || "Sin título",
          price: row["price"] || row["precio"] || "0",
          description: row["description"] || row["descripcion"] || null,
          tags: row["tags"] || row["etiquetas"] || null,
          category: row["category"] || row["categoria"] || "General",
        }));

        const { data: inserted, error } = await supabase.from("products").insert(rows).select("id, title, price, description, tags, category");
        if (error) { toast.error("Error importando"); console.error(error); return; }
        setProducts((prev) => [...(inserted || []), ...prev]);
        toast.success(`${inserted?.length || 0} productos importados`);
      } catch {
        toast.error("Error al leer el archivo");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Error eliminando"); return; }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Producto eliminado");
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Inventario</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} productos en tu catálogo</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Importar Excel
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Agregar producto
          </Button>
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar productos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead className="hidden md:table-cell">Categoría</TableHead>
                  <TableHead className="hidden lg:table-cell">Etiquetas</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      {products.length === 0 ? "Importa un Excel para comenzar" : "No se encontraron productos"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{p.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">${p.price}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary">{p.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {(p.tags || "").split(",").filter(Boolean).slice(0, 3).map((t) => (
                            <Badge key={t.trim()} variant="outline" className="text-xs">{t.trim()}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeProduct(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
