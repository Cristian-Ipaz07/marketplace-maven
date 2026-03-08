import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setSub(data[0] as any);
        setLoading(false);
      });
  }, [user]);

  const isExpired = sub?.expires_at ? new Date(sub.expires_at) < new Date() : false;
  const isTrialExpired = sub?.is_trial && sub?.trial_ends_at ? new Date(sub.trial_ends_at) < new Date() : false;
  const trialDaysLeft = sub?.is_trial && sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return { sub, loading, isExpired: isExpired || isTrialExpired, trialDaysLeft, refresh: () => {
    if (!user) return;
    setLoading(true);
    supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("active", true).limit(1).then(({ data }) => {
      if (data && data.length > 0) setSub(data[0] as any);
      setLoading(false);
    });
  }};
}
