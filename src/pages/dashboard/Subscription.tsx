import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";

export default function Subscription() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Suscripción</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tu plan y facturación</p>
      </div>

      {/* Current plan */}
      <Card className="border-border/60 mb-8">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-semibold text-foreground">Plan actual:</span>
              <Badge variant="secondary">Gratis</Badge>
            </div>
            <p className="text-sm text-muted-foreground">3 de 5 productos usados · 1 perfil conectado</p>
          </div>
          <Button variant="outline" size="sm">Gestionar</Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free */}
        <Card className="border-border/60">
          <CardContent className="p-8">
            <h3 className="font-display text-xl font-bold text-foreground mb-1">Gratis</h3>
            <p className="text-muted-foreground text-sm mb-6">Para empezar</p>
            <div className="text-4xl font-display font-bold text-foreground mb-6">
              $0 <span className="text-base font-normal text-muted-foreground">COP/mes</span>
            </div>
            <ul className="space-y-3 mb-8">
              {["5 productos", "1 perfil", "10 publicaciones/mes", "Soporte email"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent" />{t}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled>Plan actual</Button>
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className="border-primary/40 ring-2 ring-primary/20 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <Crown className="h-3 w-3" /> Recomendado
          </div>
          <CardContent className="p-8">
            <h3 className="font-display text-xl font-bold text-foreground mb-1">Pro</h3>
            <p className="text-muted-foreground text-sm mb-6">Para vendedores serios</p>
            <div className="text-4xl font-display font-bold text-foreground mb-6">
              $20.000 <span className="text-base font-normal text-muted-foreground">COP/mes</span>
            </div>
            <ul className="space-y-3 mb-8">
              {["Productos ilimitados", "6 perfiles", "Publicaciones ilimitadas", "Soporte prioritario", "Analítica avanzada", "Importación Excel"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-accent" />{t}
                </li>
              ))}
            </ul>
            <Button className="w-full" onClick={() => toast.info("Integración con Stripe próximamente")}>
              Actualizar a Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
