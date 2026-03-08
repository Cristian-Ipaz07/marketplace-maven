import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Rocket, Settings } from "lucide-react";
import { toast } from "sonner";

const categories = ["Ropa", "Accesorios", "Calzado", "Electrónica", "Hogar", "Deportes"];
const conditions = ["Nuevo", "Usado - Como nuevo", "Usado - Buen estado"];
const options = [
  { id: "hide_friends", label: "Ocultar de amigos" },
  { id: "public_place", label: "Encuentro en lugar público" },
  { id: "door_pickup", label: "Recogida en puerta" },
  { id: "door_delivery", label: "Envío a domicilio" },
];

export default function Publish() {
  const [quantity, setQuantity] = useState("10");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [condition, setCondition] = useState("Nuevo");
  const [selectedOptions, setSelectedOptions] = useState<string[]>(["public_place"]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleOption = (id: string) => {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selectedCategories.length === 0) { toast.error("Selecciona al menos una categoría"); return; }
    toast.success(`Configuración guardada: ${quantity} publicaciones en ${selectedCategories.length} categorías`);
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Configurar publicación</h1>
        <p className="text-muted-foreground text-sm mt-1">Define los parámetros de tus publicaciones</p>
      </div>

      <div className="space-y-6">
        {/* Quantity */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Cantidad de publicaciones</CardTitle>
            <CardDescription>Cuántas publicaciones deseas crear en esta campaña</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={quantity} onValueChange={setQuantity}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 publicaciones</SelectItem>
                <SelectItem value="10">10 publicaciones</SelectItem>
                <SelectItem value="15">15 publicaciones</SelectItem>
                <SelectItem value="20">20 publicaciones</SelectItem>
                <SelectItem value="30">30 publicaciones</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Categorías</CardTitle>
            <CardDescription>Selecciona las categorías de productos a publicar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategories.includes(cat) ? "default" : "outline"}
                  className="cursor-pointer text-sm px-3 py-1.5 transition-colors"
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Condition */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Condición del producto</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Options */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Opciones de Marketplace</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <Checkbox
                    id={opt.id}
                    checked={selectedOptions.includes(opt.id)}
                    onCheckedChange={() => toggleOption(opt.id)}
                  />
                  <Label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={handleStart}>
          <Rocket className="h-5 w-5 mr-2" /> Guardar configuración
        </Button>
      </div>
    </div>
  );
}
