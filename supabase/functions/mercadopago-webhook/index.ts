import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const planConfig: Record<string, { dailyLimit: number; price: number }> = {
  basico: { dailyLimit: 15, price: 30000 },
  pro: { dailyLimit: 40, price: 50000 },
  business: { dailyLimit: 9999, price: 100000 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // Mercado Pago sends notifications with type and data.id
    if (body.type === "payment") {
      const paymentId = body.data?.id;
      if (!paymentId) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch payment details from Mercado Pago
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const payment = await paymentRes.json();

      if (!paymentRes.ok) {
        console.error("Error fetching payment:", JSON.stringify(payment));
        throw new Error(`MP payment fetch error [${paymentRes.status}]`);
      }

      console.log("Payment status:", payment.status, "metadata:", JSON.stringify(payment.metadata));

      if (payment.status === "approved") {
        const meta = payment.metadata;
        const userId = meta?.user_id;
        const planId = meta?.plan_id;
        const finalPrice = meta?.final_price;
        const couponId = meta?.coupon_id;

        if (!userId || !planId) {
          console.error("Missing metadata in payment");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const config = planConfig[planId] || planConfig.basico;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Update or insert subscription
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("active", true)
          .limit(1);

        const payload = {
          user_id: userId,
          plan: planId,
          daily_limit: config.dailyLimit,
          price: config.price,
          final_price: finalPrice || config.price,
          active: true,
          is_trial: false,
          trial_ends_at: null,
          expires_at: expiresAt.toISOString(),
          coupon_id: couponId || null,
        };

        if (existing && existing.length > 0) {
          const { error } = await supabase
            .from("subscriptions")
            .update(payload)
            .eq("id", existing[0].id);
          if (error) console.error("Error updating subscription:", error);
          else console.log("Subscription updated for user:", userId);
        } else {
          const { error } = await supabase
            .from("subscriptions")
            .insert(payload);
          if (error) console.error("Error inserting subscription:", error);
          else console.log("Subscription created for user:", userId);
        }

        // Increment coupon usage if applicable
        if (couponId) {
          try {
            await supabase.rpc("increment_coupon_uses", { coupon_id: couponId });
          } catch {
            console.log("RPC not available, skipping coupon increment");
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
