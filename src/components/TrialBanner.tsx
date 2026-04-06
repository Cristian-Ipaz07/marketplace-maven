import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, Zap, Crown } from "lucide-react";
import { Link } from "react-router-dom";

export default function TrialBanner() {
  const { sub, loading, isExpired, trialDaysLeft, paidDaysLeft } = useSubscription();

  if (loading || !sub) return null;

  // Plan pago activo (Pro o Business) sin vencer → sin banner
  const isPaidActive = !sub.is_trial && sub.active && !isExpired;
  if (isPaidActive) return null;

  // Suscripción vencida (trial o pago)
  if (isExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Tu {sub.is_trial ? "prueba gratuita" : "suscripción"} ha vencido. Activa un plan para seguir publicando.</span>
        </div>
        <Link to="/dashboard/subscription" className="text-xs font-semibold text-primary hover:underline">
          Ver planes →
        </Link>
      </div>
    );
  }

  // Trial activo — mostrar cuenta regresiva
  if (sub.is_trial && trialDaysLeft !== null) {
    return (
      <div className="bg-primary/5 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Zap className="h-4 w-4 text-primary" />
          <span>Te quedan <strong className="text-primary">{trialDaysLeft} día{trialDaysLeft !== 1 ? "s" : ""}</strong> de tu prueba gratuita. Pásate a Pro para más publicaciones.</span>
        </div>
        <Link to="/dashboard/subscription" className="text-xs font-semibold text-primary hover:underline">
          Mejorar plan →
        </Link>
      </div>
    );
  }

  // Plan pago próximo a vencer (≤ 7 días)
  if (!sub.is_trial && paidDaysLeft !== null && paidDaysLeft <= 7) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Crown className="h-4 w-4 text-amber-500" />
          <span>Tu plan <strong className="text-amber-500 capitalize">{sub.plan}</strong> vence en <strong className="text-amber-500">{paidDaysLeft} día{paidDaysLeft !== 1 ? "s" : ""}</strong>. Renueva para no perder acceso.</span>
        </div>
        <Link to="/dashboard/subscription" className="text-xs font-semibold text-amber-500 hover:underline">
          Renovar →
        </Link>
      </div>
    );
  }

  return null;
}
