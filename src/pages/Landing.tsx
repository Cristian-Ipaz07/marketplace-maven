import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Upload, BarChart3, Users, Zap, Shield, ArrowRight, Check, Crown, Building2, Monitor, Clock, FileSpreadsheet } from "lucide-react";

const features = [
  { icon: Package, title: "Catálogo centralizado", desc: "Gestiona todos tus productos desde un solo lugar con importación masiva desde Excel." },
  { icon: Upload, title: "Publicación multicanal", desc: "Publica en Facebook Marketplace de forma masiva con portadas automáticas por categoría y día." },
  { icon: Users, title: "Multi-perfil", desc: "Conecta hasta 6 cuentas de Chrome y rota publicaciones entre perfiles automáticamente." },
  { icon: BarChart3, title: "Analítica en tiempo real", desc: "Monitorea publicaciones, tasa de éxito y actividad diaria con métricas detalladas." },
  { icon: Monitor, title: "Bot local inteligente", desc: "Tu PC trabaja por ti: el bot automatiza la publicación mientras tú descansas." },
  { icon: Shield, title: "Seguridad total", desc: "Tus credenciales y datos están protegidos con encriptación de nivel bancario." },
  { icon: FileSpreadsheet, title: "Importación Excel", desc: "Sube cientos de productos de un solo clic con nuestra plantilla de Excel." },
  { icon: Clock, title: "7 días gratis", desc: "Prueba todas las funciones del plan Básico sin compromiso durante una semana." },
  { icon: Zap, title: "Portadas automáticas", desc: "Asigna portadas por categoría y día de la semana para destacar tus publicaciones." },
];

const plans = [
  {
    id: "basico",
    name: "Básico",
    price: "$20.000",
    desc: "Para empezar a vender",
    icon: Zap,
    features: ["10 publicaciones/día", "1 perfil conectado", "2 categorías de portadas", "Importación Excel", "Soporte por email"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$30.000",
    desc: "Para vendedores serios",
    icon: Crown,
    recommended: true,
    features: ["20 publicaciones/día", "3 perfiles conectados", "5 categorías de portadas", "Importación Excel", "Soporte prioritario", "Analítica avanzada"],
  },
  {
    id: "business",
    name: "Business",
    price: "$50.000",
    desc: "Uso profesional",
    icon: Building2,
    features: ["Publicaciones ilimitadas", "Perfiles ilimitados", "Portadas ilimitadas", "Soporte dedicado", "API personalizada", "Multi-cuenta"],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link to="/" className="font-display text-xl font-bold text-foreground tracking-tight">
            Market<span className="text-primary">Master</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Crear cuenta <ArrowRight className="ml-1 h-4 w-4 hidden sm:inline" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="container relative px-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              🚀 7 días gratis · Tu aliado en ventas diarias
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
              Automatiza tus ventas en{" "}
              <span className="text-primary">Marketplace</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Centraliza tu inventario, conecta múltiples perfiles de Chrome y publica en Facebook Marketplace de forma masiva con portadas automáticas y un bot local que trabaja por ti.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link to="/register">
                <Button size="lg" className="text-base px-8 w-full sm:w-auto">
                  Empezar gratis <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button variant="outline" size="lg" className="text-base px-8 w-full sm:w-auto">Ver planes</Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20 bg-card/50">
        <div className="container px-4">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">Todo lo que necesitas para vender más</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Herramientas diseñadas para vendedores que quieren escalar sin complicaciones.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="h-full border-border/60 hover:border-primary/30 transition-colors">
                  <CardContent className="p-5 sm:p-6">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20">
        <div className="container px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">¿Cómo funciona?</h2>
            <p className="text-muted-foreground">En 4 pasos simples estarás vendiendo más</p>
          </div>
          <div className="space-y-6">
            {[
              { step: "1", title: "Crea tu cuenta gratis", desc: "Regístrate y obtén 7 días de prueba gratuita con todas las funciones del plan Básico." },
              { step: "2", title: "Sube tu inventario", desc: "Importa tus productos desde Excel o agrégalos manualmente con fotos y portadas." },
              { step: "3", title: "Conecta tus perfiles", desc: "Vincula hasta 6 perfiles de Chrome de Facebook Marketplace." },
              { step: "4", title: "Activa el bot y vende", desc: "Configura la publicación diaria, enciende el bot local y deja que trabaje por ti." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-20 bg-card/50">
        <div className="container px-4 max-w-5xl">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">Planes simples, sin sorpresas</h2>
            <p className="text-muted-foreground">Empieza con 7 días gratis y escala cuando quieras. Precios en COP/mes.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card key={plan.id} className={`border-border/60 relative ${plan.recommended ? "ring-2 ring-primary/30 border-primary/40" : ""}`}>
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Popular
                    </div>
                  )}
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">{plan.desc}</p>
                    <div className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-6">
                      {plan.price} <span className="text-base font-normal text-muted-foreground">COP/mes</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((t) => (
                        <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-accent shrink-0" />{t}
                        </li>
                      ))}
                    </ul>
                    <Link to="/register">
                      <Button variant={plan.recommended ? "default" : "outline"} className="w-full">
                        Empezar con {plan.name}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-10">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} MarketMaster. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
