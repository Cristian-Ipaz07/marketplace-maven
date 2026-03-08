import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function TrialBanner() {
  const { sub, loading, isExpired, trialDaysLeft } = useSubscription();

  if (loading || !sub) return null;

  if (isExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Tu {sub.is_trial ? "prueba gratuita" : "suscripción"} ha vencido.</span>
        </div>
        <Link to="/dashboard/subscription" className="text-xs font-semibold text-primary hover:underline">
          Ver planes →
        </Link>
      </div>
    );
  }

  if (sub.is_trial && trialDaysLeft !== null && trialDaysLeft <= 7) {
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

  return null;
}
