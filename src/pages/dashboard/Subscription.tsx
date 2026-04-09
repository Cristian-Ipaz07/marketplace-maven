import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Crown, Zap, Building2, Loader2, Ticket, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const plans = [
  {
    id: "basico",
    name: "Básico",
    price: 20000,
    priceLabel: "$20.000",
    desc: "Para empezar a vender",
    dailyLimit: 10,
    icon: Zap,
    features: ["10 publicaciones/día", "1 perfil", "2 categorías de portadas", "Soporte email"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 30000,
    priceLabel: "$30.000",
    desc: "Para vendedores serios",
    dailyLimit: 20,
    icon: Crown,
    recommended: true,
    features: ["20 publicaciones/día", "3 perfiles", "5 categorías de portadas", "Soporte prioritario", "Analítica avanzada", "Importación Excel"],
  },
  {
    id: "business",
    name: "Business",
    price: 50000,
    priceLabel: "$50.000",
    desc: "Uso profesional",
    dailyLimit: 9999,
    icon: Building2,
    features: ["Publicaciones ilimitadas", "Perfiles ilimitados", "Portadas ilimitadas", "Soporte dedicado", "API personalizada", "Multi-cuenta"],
  },
];

export default function Subscription() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState("basico");
  const [subId, setSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discount_percent: number; discount_amount: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Handle payment return
  useEffect(() => {
    const payment = searchParams.get("payment");
    const plan = searchParams.get("plan");
    if (payment === "success") {
      toast.success(`¡Pago exitoso! Tu plan ${plan || ""} se activará en unos segundos.`);
      searchParams.delete("payment");
      searchParams.delete("plan");
      setSearchParams(searchParams, { replace: true });
      // Refresh subscription after a short delay for webhook processing
      setTimeout(() => window.location.reload(), 3000);
    } else if (payment === "failure") {
      toast.error("El pago no se completó. Intenta de nuevo.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    } else if (payment === "pending") {
      toast.info("Tu pago está pendiente de confirmación.");
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("active", true).limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setCurrentPlan(data[0].plan);
        setSubId(data[0].id);
        setIsTrial(data[0].is_trial || false);
        setTrialEndsAt(data[0].trial_ends_at || null);
        setExpiresAt(data[0].expires_at || null);
      }
      setLoading(false);
    });
  }, [user]);

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.trim().toUpperCase())
      .eq("active", true)
      .maybeSingle();

    if (!data) {
      toast.error("Cupón inválido o expirado");
      setAppliedCoupon(null);
    } else {
      const c = data as any;
      if (c.max_uses && c.current_uses >= c.max_uses) {
        toast.error("Cupón agotado");
        setAppliedCoupon(null);
      } else if (c.expires_at && new Date(c.expires_at) < new Date()) {
        toast.error("Cupón expirado");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({ id: c.id, code: c.code, discount_percent: c.discount_percent, discount_amount: c.discount_amount });
        toast.success(`Cupón "${c.code}" aplicado`);
      }
    }
    setValidatingCoupon(false);
  };

  const calcFinalPrice = (basePrice: number) => {
    if (!appliedCoupon) return basePrice;
    let price = basePrice;
    if (appliedCoupon.discount_percent > 0) price -= price * (appliedCoupon.discount_percent / 100);
    if (appliedCoupon.discount_amount > 0) price -= appliedCoupon.discount_amount;
    return Math.max(0, Math.round(price));
  };

  const handlePayment = async (planId: string) => {
    if (!user) return;
    const plan = plans.find((p) => p.id === planId)!;
    const finalPrice = calcFinalPrice(plan.price);

    setCheckingOut(planId);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-checkout", {
        body: {
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          finalPrice,
          couponId: appliedCoupon?.id || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Redirect to Mercado Pago
      const checkoutUrl = data.init_point;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Error al crear el pago. Intenta de nuevo.");
      setCheckingOut(null);
    }
  };

  if (loading) return <div className="p-4 sm:p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const activePlan = plans.find((p) => p.id === currentPlan) || plans[0];

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Suscripción</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tu plan y realiza pagos con Mercado Pago</p>
      </div>

      {/* Current plan */}
      <Card className="border-border/60 mb-6">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-display font-semibold text-foreground">Plan actual:</span>
              <Badge variant="default">{activePlan.name}</Badge>
              {isTrial && <Badge variant="outline" className="text-primary">Prueba gratuita</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Límite: {activePlan.dailyLimit >= 9999 ? "Ilimitado" : `${activePlan.dailyLimit} pub/día`} · {activePlan.priceLabel} COP/mes
            </p>
            {isTrial && trialEndsAt && (
              <p className="text-xs text-primary mt-1">
                Tu prueba gratuita vence el {new Date(trialEndsAt).toLocaleDateString()}
              </p>
            )}
            {!isTrial && expiresAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Expira: {new Date(expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coupon */}
      <Card className="border-border/60 mb-6 sm:mb-8">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Ticket className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Código de cupón"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="max-w-[200px] sm:max-w-xs uppercase"
            />
            <Button variant="outline" size="sm" onClick={validateCoupon} disabled={validatingCoupon}>
              {validatingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
            </Button>
            {appliedCoupon && (
              <Badge variant="default">
                {appliedCoupon.discount_percent > 0 && `${appliedCoupon.discount_percent}% off`}
                {appliedCoupon.discount_amount > 0 && ` -$${appliedCoupon.discount_amount.toLocaleString()}`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan && !isTrial;
          const Icon = plan.icon;
          const finalPrice = calcFinalPrice(plan.price);
          const hasDiscount = appliedCoupon && finalPrice < plan.price;
          const isLoading = checkingOut === plan.id;
          return (
            <Card key={plan.id} className={`border-border/60 relative ${plan.recommended ? "ring-2 ring-primary/30 border-primary/40" : ""}`}>
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Recomendado
                </div>
              )}
              <CardContent className="p-5 sm:p-8">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">{plan.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-5 sm:mb-6">{plan.desc}</p>
                <div className="mb-5 sm:mb-6">
                  {hasDiscount ? (
                    <>
                      <span className="text-lg text-muted-foreground line-through mr-2">{plan.priceLabel}</span>
                      <span className="text-3xl sm:text-4xl font-display font-bold text-foreground">${finalPrice.toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="text-3xl sm:text-4xl font-display font-bold text-foreground">{plan.priceLabel}</span>
                  )}
                  <span className="text-sm sm:text-base font-normal text-muted-foreground ml-1">COP/mes</span>
                </div>
                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                  {plan.features.map((t) => (
                    <li key={t} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-accent shrink-0" />{t}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? "outline" : "default"}
                  className="w-full"
                  disabled={isCurrent || isLoading}
                  onClick={() => handlePayment(plan.id)}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirigiendo...</>
                  ) : isCurrent ? (
                    "Plan actual"
                  ) : (
                    <><ExternalLink className="h-4 w-4 mr-2" />Pagar con Mercado Pago</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Los pagos se procesan de forma segura a través de Mercado Pago. Al completar el pago, tu plan se activará automáticamente.
      </p>
    </div>
  );
}
