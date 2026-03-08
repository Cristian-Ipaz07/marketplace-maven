import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Crown, Zap, Building2, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const plans = [
  {
    id: "basico",
    name: "Básico",
    price: 30000,
    priceLabel: "$30.000",
    desc: "Para empezar a vender",
    dailyLimit: 15,
    icon: Zap,
    features: ["15 publicaciones/día", "3 perfiles", "Portadas por categoría", "Soporte email"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 50000,
    priceLabel: "$50.000",
    desc: "Para vendedores serios",
    dailyLimit: 40,
    icon: Crown,
    recommended: true,
    features: ["40 publicaciones/día", "6 perfiles", "Portadas ilimitadas", "Soporte prioritario", "Analítica avanzada", "Importación Excel"],
  },
  {
    id: "business",
    name: "Business",
    price: 100000,
    priceLabel: "$100.000",
    desc: "Uso profesional",
    dailyLimit: 9999,
    icon: Building2,
    features: ["Publicaciones ilimitadas", "Perfiles ilimitados", "Portadas ilimitadas", "Soporte dedicado", "API personalizada", "Multi-cuenta"],
  },
];

export default function Subscription() {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("basico");
  const [subId, setSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discount_percent: number; discount_amount: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("active", true).limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setCurrentPlan(data[0].plan);
        setSubId(data[0].id);
        setIsTrial((data[0] as any).is_trial || false);
        setTrialEndsAt((data[0] as any).trial_ends_at || null);
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

  const selectPlan = async (planId: string) => {
    if (!user || planId === currentPlan) return;
    const plan = plans.find((p) => p.id === planId)!;
    const finalPrice = calcFinalPrice(plan.price);
    const payload: any = {
      user_id: user.id,
      plan: planId,
      daily_limit: plan.dailyLimit,
      price: plan.price,
      active: true,
      is_trial: false,
      trial_ends_at: null,
      final_price: finalPrice,
      coupon_id: appliedCoupon?.id || null,
    };

    let error;
    if (subId) {
      ({ error } = await supabase.from("subscriptions").update(payload).eq("id", subId));
    } else {
      const res = await supabase.from("subscriptions").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setSubId(res.data.id);
    }

    if (appliedCoupon) {
      await supabase.from("coupons").update({ current_uses: (appliedCoupon as any).current_uses + 1 }).eq("id", appliedCoupon.id);
    }

    if (error) { toast.error("Error actualizando plan"); return; }
    setCurrentPlan(planId);
    setIsTrial(false);
    toast.success(`Plan actualizado a ${plan.name}${appliedCoupon ? ` con cupón ${appliedCoupon.code}` : ""}`);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const activePlan = plans.find((p) => p.id === currentPlan) || plans[0];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Suscripción</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tu plan y límites de publicación</p>
      </div>

      <Card className="border-border/60 mb-6">
        <CardContent className="p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-semibold text-foreground">Plan actual:</span>
              <Badge variant="default">{activePlan.name}</Badge>
              {isTrial && <Badge variant="outline" className="text-primary">Prueba gratuita</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Límite: {activePlan.dailyLimit >= 9999 ? "Ilimitado" : `${activePlan.dailyLimit} publicaciones/día`} · {activePlan.priceLabel} COP/mes
            </p>
            {isTrial && trialEndsAt && (
              <p className="text-xs text-primary mt-1">
                Tu prueba gratuita vence el {new Date(trialEndsAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coupon */}
      <Card className="border-border/60 mb-8">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Ticket className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Código de cupón"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="max-w-xs uppercase"
            />
            <Button variant="outline" size="sm" onClick={validateCoupon} disabled={validatingCoupon}>
              {validatingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
            </Button>
            {appliedCoupon && (
              <Badge variant="default" className="ml-2">
                {appliedCoupon.discount_percent > 0 && `${appliedCoupon.discount_percent}% off`}
                {appliedCoupon.discount_amount > 0 && ` -$${appliedCoupon.discount_amount.toLocaleString()}`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const Icon = plan.icon;
          const finalPrice = calcFinalPrice(plan.price);
          const hasDiscount = appliedCoupon && finalPrice < plan.price;
          return (
            <Card key={plan.id} className={`border-border/60 relative ${plan.recommended ? "ring-2 ring-primary/30 border-primary/40" : ""}`}>
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Recomendado
                </div>
              )}
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-6">{plan.desc}</p>
                <div className="mb-6">
                  {hasDiscount ? (
                    <>
                      <span className="text-lg text-muted-foreground line-through mr-2">{plan.priceLabel}</span>
                      <span className="text-4xl font-display font-bold text-foreground">${finalPrice.toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="text-4xl font-display font-bold text-foreground">{plan.priceLabel}</span>
                  )}
                  <span className="text-base font-normal text-muted-foreground ml-1">COP/mes</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-accent" />{t}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? "outline" : "default"}
                  className="w-full"
                  disabled={isCurrent && !isTrial}
                  onClick={() => selectPlan(plan.id)}
                >
                  {isCurrent && !isTrial ? "Plan actual" : isCurrent && isTrial ? "Activar plan" : `Seleccionar ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
