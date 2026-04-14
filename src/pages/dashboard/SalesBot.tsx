import { useState, useEffect, useRef } from "react";
import { Bot, Save, RefreshCw, Plus, X, ChevronDown, ChevronUp, Eye, EyeOff, MessageSquare, Zap, Settings2, BarChart2, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────
interface SalesBotConfig {
  id?: string;
  business_name: string;
  business_description: string;
  products: string[];
  price_range: string;
  tone: "friendly" | "professional" | "urgent" | "spiritual";
  custom_rules: string;
  preferred_model: string;
  copilot_mode: boolean;
  delay_ms: number;
  quick_replies: QuickReply[];
  updated_at?: string;
}

interface QuickReply {
  id: string;
  category: string;
  text: string;
}

interface ApiKeyStatus {
  hasGroq: boolean;
  hasOpenRouter: boolean;
}

// ── Default config ───────────────────────────────────────────
const DEFAULT_CONFIG: SalesBotConfig = {
  business_name: "",
  business_description: "",
  products: [],
  price_range: "",
  tone: "friendly",
  custom_rules: "",
  preferred_model: "groq-llama-70b",
  copilot_mode: true,
  delay_ms: 1500,
  quick_replies: [],
};

const TONES = [
  { id: "friendly", label: "Amigable", emoji: "😊", desc: "Cálido, cercano y con emojis moderados" },
  { id: "professional", label: "Profesional", emoji: "💼", desc: "Formal, conciso y sin excesos" },
  { id: "urgent", label: "Urgente", emoji: "🔥", desc: "Crea urgencia, disponibilidad limitada" },
  { id: "spiritual", label: "Espiritual", emoji: "🌿", desc: "Calma, positividad y conexión emocional" },
];

const MODELS = [
  { id: "groq-llama-70b", label: "Llama 3.3 70B", badge: "RECOMENDADO", provider: "Groq" },
  { id: "groq-llama-8b", label: "Llama 3.1 8B", badge: "RÁPIDO", provider: "Groq" },
  { id: "openrouter-mistral", label: "Mistral 7B", badge: "FALLBACK", provider: "OpenRouter" },
  { id: "openrouter-gemma", label: "Gemma 2 9B", badge: "FALLBACK", provider: "OpenRouter" },
];

const QUICK_REPLY_CATEGORIES = [
  "✅ Disponibilidad", "💰 Precio", "🎯 Gancho", "🛡️ Objeciones",
  "📦 Envíos", "✍️ Cierre", "🙏 Seguimiento", "🤗 Bienvenida",
];

// ── Subcomponents ────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-border/50">{children}</div>}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-primary/15 text-primary text-xs font-medium rounded-full border border-primary/25">
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-destructive transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-primary/60 focus:bg-muted/70 transition-colors"
        />
        <button onClick={add} className="px-3 py-2 bg-primary/15 hover:bg-primary/25 text-primary rounded-lg transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MaskedKeyInput({ label, value, onChange, link, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  link?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isSet = value.length > 8;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        <div className="flex items-center gap-2">
          {isSet ? (
            <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Configurada ✅
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" /> No configurada
            </span>
          )}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline">Obtener key ↗</a>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "sk-..."}
          className="w-full px-3 py-2.5 pr-10 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-primary/60 focus:bg-muted/70 transition-colors font-mono"
        />
        <button onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function SalesBot() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SalesBotConfig>(DEFAULT_CONFIG);
  const [groqKey, setGroqKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ hasGroq: false, hasOpenRouter: false });
  const [newReply, setNewReply] = useState({ category: QUICK_REPLY_CATEGORIES[0], text: "" });
  const [stats] = useState({ todayReplies: 0, avgResponseTime: "—", conversations: 0 });
  const configRef = useRef(config);
  configRef.current = config;

  // ── Load config from Supabase ────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadConfig();
    checkExtension();
  }, [user]);

  async function loadConfig() {
    const { data, error } = await supabase
      .from("sales_bot_configs")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) { console.error(error); return; }
    if (data) {
      setConfig({
        id: data.id,
        business_name: data.business_name || "",
        business_description: data.business_description || "",
        products: data.products || [],
        price_range: data.price_range || "",
        tone: data.tone || "friendly",
        custom_rules: data.custom_rules || "",
        preferred_model: data.preferred_model || "groq-llama-70b",
        copilot_mode: data.copilot_mode ?? true,
        delay_ms: data.delay_ms || 1500,
        quick_replies: data.quick_replies || [],
        updated_at: data.updated_at,
      });
    }
  }

  function checkExtension() {
    setExtensionStatus("checking");
    // Intentar comunicarse con la extensión via window.postMessage
    // La extensión responde si está activa
    const timeout = setTimeout(() => setExtensionStatus("disconnected"), 3000);

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "SALESBOT_PONG") {
        console.log("[Dashboard] Recibido PONG de la extensión:", e.data);
        clearTimeout(timeout);
        setExtensionStatus("connected");
        setApiKeyStatus({
          hasGroq: e.data.hasGroqKey,
          hasOpenRouter: e.data.hasOpenRouterKey,
        });
        window.removeEventListener("message", handler);
      } else if (e.data?.type === "SALESBOT_PING") {
        // Log para ver que el PING al menos se envía
        console.log("[Dashboard] PING emitido desde React.");
      }
    };

    window.addEventListener("message", handler);
    console.log("[Dashboard] Enviando PING a la extensión (via postMessage)... window origin:", window.location.origin);
    window.postMessage({ type: "SALESBOT_PING" }, "*");
    return () => { clearTimeout(timeout); window.removeEventListener("message", handler); };
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (!user) return;
    setIsSaving(true);

    try {
      // 1. Guardar config en Supabase (SIN API keys)
      const payload = {
        user_id: user.id,
        business_name: config.business_name,
        business_description: config.business_description,
        products: config.products,
        price_range: config.price_range,
        tone: config.tone,
        custom_rules: config.custom_rules,
        preferred_model: config.preferred_model,
        copilot_mode: config.copilot_mode,
        delay_ms: config.delay_ms,
        quick_replies: config.quick_replies,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        await supabase.from("sales_bot_configs").update(payload).eq("id", config.id);
      } else {
        const { data, error } = await supabase.from("sales_bot_configs").insert(payload).select().single();
        if (!error && data) setConfig(c => ({ ...c, id: data.id }));
      }

      // 2. Enviar config a la extensión via postMessage (sin API keys)
      window.postMessage({
        type: "SALESBOT_CONFIG_UPDATE",
        config: {
          ...payload,
          // Las API keys las guarda el usuario directo en la extensión,
          // este bridge solo envía la config de negocio
        }
      }, "*");

      toast.success("✅ Configuración guardada correctamente");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al guardar. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Sync: enviar config a extensión ──────────────────────
  async function handleSync() {
    setIsSyncing(true);
    const supabaseUrl = localStorage.getItem('__MM_SUPABASE_URL') || '';
    const supabaseKey = localStorage.getItem('__MM_SUPABASE_KEY') || '';
    window.postMessage({
      type: "SALESBOT_CONFIG_UPDATE",
      config: {
        business_name: config.business_name,
        business_description: config.business_description,
        products: config.products,
        price_range: config.price_range,
        tone: config.tone,
        custom_rules: config.custom_rules,
        preferred_model: config.preferred_model,
        copilot_mode: config.copilot_mode,
        delay_ms: config.delay_ms,
        quick_replies: config.quick_replies,
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseKey,
      }
    }, "*");
    setTimeout(() => {
      setIsSyncing(false);
      toast.success("🔄 Configuración enviada a la extensión");
      checkExtension();
    }, 1200);
  }

  const updateConfig = (patch: Partial<SalesBotConfig>) =>
    setConfig(c => ({ ...c, ...patch }));

  // ── Quick replies helpers ─────────────────────────────────
  function addQuickReply() {
    if (!newReply.text.trim()) return;
    const reply: QuickReply = {
      id: crypto.randomUUID(),
      category: newReply.category,
      text: newReply.text.trim(),
    };
    updateConfig({ quick_replies: [...config.quick_replies, reply] });
    setNewReply(r => ({ ...r, text: "" }));
  }

  function removeQuickReply(id: string) {
    updateConfig({ quick_replies: config.quick_replies.filter(r => r.id !== id) });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">SalesBot IA</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configura tu asistente de ventas para Messenger y WhatsApp Web
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm"
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Guardando…" : "Guardar todo"}
        </button>
      </div>

      {/* ── Sección 1: Estado ──────────────────────────────── */}
      <SectionCard title="Estado del Bot" icon={Wifi}>
        <div className="mt-3 space-y-4">
          {/* Extension status */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2.5">
              {extensionStatus === "connected"
                ? <Wifi className="h-4 w-4 text-emerald-500" />
                : extensionStatus === "checking"
                  ? <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                  : <WifiOff className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">
                  {extensionStatus === "connected" ? "Extensión conectada"
                    : extensionStatus === "checking" ? "Verificando..."
                      : "Extensión no detectada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {extensionStatus === "connected"
                    ? "SalesBot IA está activo en tu navegador"
                    : "Instala o activa la extensión SalesBot IA"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${extensionStatus === "connected" ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-zinc-500"}`} />
              <button onClick={checkExtension} className="text-xs text-primary hover:underline">Verificar</button>
            </div>
          </div>

          {/* API Keys status (read-only, lo mostra mascado */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Groq API Key", active: apiKeyStatus.hasGroq },
              { label: "OpenRouter Key", active: apiKeyStatus.hasOpenRouter, optional: true },
            ].map(k => (
              <div key={k.label} className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${k.active ? "bg-emerald-500" : k.optional ? "bg-amber-500" : "bg-zinc-500"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{k.label}</p>
                  <p className="text-xs text-muted-foreground">{k.active ? "Configurada ✅" : k.optional ? "Opcional" : "No configurada"}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Las API Keys se guardan <strong>solo en tu extensión de Chrome</strong>, nunca salen de tu dispositivo.
              Configúralas en el panel de la extensión (tab Config).
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing || extensionStatus !== "connected"}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando…" : "Sincronizar config con extensión"}
          </button>
        </div>
      </SectionCard>

      {/* ── Sección 2: Contexto de Negocio ────────────────── */}
      <SectionCard title="Contexto de Negocio" icon={MessageSquare}>
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Nombre del negocio / marca
            </label>
            <input
              value={config.business_name}
              onChange={e => updateConfig({ business_name: e.target.value })}
              placeholder="Ej: Estilo Nórdico"
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-primary/60 focus:bg-muted/70 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Descripción del negocio <span className="font-normal normal-case">(alimenta el system prompt)</span>
            </label>
            <textarea
              value={config.business_description}
              onChange={e => updateConfig({ business_description: e.target.value })}
              placeholder="Ej: Vendemos ropa escandinava minimalista para mujer. Nos especializamos en telas naturales, colores neutros y prendas versátiles para el día a día."
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-primary/60 focus:bg-muted/70 transition-colors resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{config.business_description.length}/500</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Productos destacados
            </label>
            <TagInput
              tags={config.products}
              onChange={products => updateConfig({ products })}
              placeholder="Ej: Chaqueta Invierno, Jeans Oslo... Enter"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Rango de precios
            </label>
            <input
              value={config.price_range}
              onChange={e => updateConfig({ price_range: e.target.value })}
              placeholder="Ej: $30.000 - $150.000 COP"
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-primary/60 focus:bg-muted/70 transition-colors"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Sección 3: Tono de Ventas ──────────────────────── */}
      <SectionCard title="Tono de Ventas" icon={Zap}>
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Personalidad del bot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(tone => (
                <button
                  key={tone.id}
                  onClick={() => updateConfig({ tone: tone.id as SalesBotConfig["tone"] })}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    config.tone === tone.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">{tone.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold">{tone.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">{tone.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Reglas personalizadas
            </label>
            <textarea
              value={config.custom_rules}
              onChange={e => updateConfig({ custom_rules: e.target.value })}
              placeholder={"Ej:\n- No mencionar a la competencia\n- Siempre usar emojis al final\n- Dar precio solo si el cliente pregunta directamente"}
              rows={4}
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-lg outline-none focus:border-primary/60 focus:bg-muted/70 transition-colors resize-none font-mono"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Sección 4: Configuración de IA ────────────────── */}
      <SectionCard title="Configuración de IA" icon={Settings2}>
        <div className="mt-3 space-y-5">
          {/* Modelo */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Modelo preferido
            </label>
            <div className="space-y-2">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => updateConfig({ preferred_model: model.id })}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    config.preferred_model === model.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      config.preferred_model === model.id ? "border-primary" : "border-muted-foreground/40"
                    }`}>
                      {config.preferred_model === model.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{model.label}</p>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    model.badge === "RECOMENDADO" ? "bg-emerald-500/15 text-emerald-500" :
                    model.badge === "RÁPIDO" ? "bg-blue-500/15 text-blue-500" :
                    "bg-muted text-muted-foreground"
                  }`}>{model.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Modo */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Modo de operación
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: true, label: "✋ Copiloto", desc: "Escribe pero tú envías" },
                { id: false, label: "🤖 Automático", desc: "Envía mensajes solo" },
              ].map(mode => (
                <button
                  key={String(mode.id)}
                  onClick={() => updateConfig({ copilot_mode: mode.id })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.copilot_mode === mode.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold">{mode.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Delay slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Retraso humanizador
              </label>
              <span className="text-sm font-bold text-primary">{(config.delay_ms / 1000).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={500}
              max={5000}
              step={250}
              value={config.delay_ms}
              onChange={e => updateConfig({ delay_ms: parseInt(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.5s (veloz)</span>
              <span>5.0s (muy natural)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Mayor retraso = más natural para Messenger y WhatsApp. Recomendado: 1.5–2.5s.
            </p>
          </div>

          {/* API Keys */}
          <div className="space-y-3 pt-1 border-t border-border/50">
            <p className="text-xs text-muted-foreground pt-2">
              ⚠️ Las API Keys <strong>NO se guardan en Supabase</strong>. Se almacenan localmente en tu extensión de Chrome. 
              Introdúcelas directamente en el tab <strong>⚙️ Config</strong> del panel flotante en Messenger/WhatsApp.
            </p>
            <div className="flex gap-3">
              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center py-2 text-xs font-semibold border border-primary/30 text-primary rounded-lg hover:bg-primary/10 transition-colors">
                Obtener Groq API Key ↗
              </a>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center py-2 text-xs font-semibold border border-border text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors">
                Obtener OpenRouter Key ↗
              </a>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Sección 5: Respuestas Rápidas ─────────────────── */}
      <SectionCard title="Respuestas Rápidas Personalizadas" icon={MessageSquare} defaultOpen={false}>
        <div className="mt-3 space-y-4">
          {/* Add new */}
          <div className="space-y-2 p-3.5 rounded-xl bg-muted/30 border border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nueva respuesta</p>
            <select
              value={newReply.category}
              onChange={e => setNewReply(r => ({ ...r, category: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary/60 transition-colors"
            >
              {QUICK_REPLY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                value={newReply.text}
                onChange={e => setNewReply(r => ({ ...r, text: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addQuickReply()}
                placeholder="Texto de la respuesta... usa [Nombre], [Producto], [Precio]"
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary/60 transition-colors"
              />
              <button onClick={addQuickReply}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Variables disponibles: <code className="bg-muted px-1 rounded">[Nombre]</code> <code className="bg-muted px-1 rounded">[Producto]</code> <code className="bg-muted px-1 rounded">[Precio]</code></p>
          </div>

          {/* List */}
          {config.quick_replies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin respuestas personalizadas aún</p>
              <p className="text-xs mt-1">Agrega para complementar las 12 categorías preinstaladas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {config.quick_replies.map(reply => (
                <div key={reply.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50 group">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0 mt-0.5">{reply.category}</span>
                  <p className="flex-1 text-sm text-muted-foreground">{reply.text}</p>
                  <button onClick={() => removeQuickReply(reply.id)}
                    className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Sección 6: Estadísticas ────────────────────────── */}
      <SectionCard title="Estadísticas" icon={BarChart2} defaultOpen={false}>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: "Respuestas hoy", value: stats.todayReplies, suffix: "" },
            { label: "Tiempo promedio", value: stats.avgResponseTime, suffix: "" },
            { label: "Conversaciones", value: stats.conversations, suffix: "" },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl bg-muted/40 border border-border/50 text-center">
              <p className="text-2xl font-bold text-foreground">{stat.value}{stat.suffix}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          📊 Las estadísticas detalladas estarán disponibles próximamente
        </p>
      </SectionCard>

      {/* Save footer */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm"
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
