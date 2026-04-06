import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionData {
  id: string;
  plan: string;
  daily_limit: number;
  price: number;
  active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  expires_at: string | null;
  final_price: number | null;
  coupon_id: string | null;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

function isDatePast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);
    if (data && data.length > 0) setSub(data[0] as SubscriptionData);
    else setSub(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchSub();

    // Escuchar cambios en tiempo real (cuando admin actualiza el plan)
    const channel = supabase
      .channel("sub-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "subscriptions",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchSub())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Lógica de expiración según tipo de suscripción
  const isTrialExpired = sub?.is_trial ? isDatePast(sub.trial_ends_at) : false;
  const isPaidExpired  = !sub?.is_trial ? isDatePast(sub?.expires_at ?? null) : false;
  const isExpired = isTrialExpired || isPaidExpired;

  // Días restantes
  const trialDaysLeft = sub?.is_trial ? daysUntil(sub.trial_ends_at) : null;
  const paidDaysLeft  = !sub?.is_trial ? daysUntil(sub?.expires_at ?? null) : null;

  return {
    sub,
    loading,
    isExpired,
    trialDaysLeft,
    paidDaysLeft,
    refresh: fetchSub,
  };
}
