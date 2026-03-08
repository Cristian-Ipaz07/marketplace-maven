import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Upload, BarChart3, Users, Zap, Shield, ArrowRight, Check } from "lucide-react";

const features = [
  { icon: Package, title: "Catálogo centralizado", desc: "Gestiona todos tus productos desde un solo lugar con importación masiva desde Excel." },
  { icon: Upload, title: "Publicación multicanal", desc: "Configura y programa publicaciones para múltiples marketplaces simultáneamente." },
  { icon: Users, title: "Multi-perfil", desc: "Conecta y administra múltiples cuentas de venta desde un solo dashboard." },
  { icon: BarChart3, title: "Analítica en tiempo real", desc: "Monitorea el rendimiento de tus publicaciones con métricas detalladas." },
  { icon: Zap, title: "Automatización inteligente", desc: "Define reglas para publicar automáticamente según horarios y demanda." },
  { icon: Shield, title: "Seguridad total", desc: "Tus credenciales y datos están protegidos con encriptación de nivel bancario." },
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
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="font-display text-xl font-bold text-foreground tracking-tight">
            Market<span className="text-primary">Master</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Crear cuenta <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              Tu aliado en ventas diarias
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
              Tu catálogo.{" "}
              <span className="text-primary">Todos los marketplaces.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Centraliza tu inventario, conecta múltiples perfiles y publica en marketplaces de forma masiva desde un solo panel de control.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="text-base px-8">
                  Empezar gratis <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button variant="outline" size="lg" className="text-base px-8">Ver planes</Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-card/50">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold text-foreground mb-3">Todo lo que necesitas para vender más</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Herramientas diseñadas para vendedores que quieren escalar sin complicaciones.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="h-full border-border/60 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
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

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="container max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold text-foreground mb-3">Plan simple, sin sorpresas</h2>
            <p className="text-muted-foreground">Empieza gratis y escala cuando quieras.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <Card className="border-border/60">
              <CardContent className="p-8">
                <h3 className="font-display text-xl font-bold text-foreground mb-1">Gratis</h3>
                <p className="text-muted-foreground text-sm mb-6">Para probar la plataforma</p>
                <div className="text-4xl font-display font-bold text-foreground mb-6">$0 <span className="text-base font-normal text-muted-foreground">COP/mes</span></div>
                <ul className="space-y-3 mb-8">
                  {["5 productos", "1 perfil conectado", "10 publicaciones/mes", "Soporte por email"].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-accent" />{t}</li>
                  ))}
                </ul>
                <Link to="/register"><Button variant="outline" className="w-full">Empezar gratis</Button></Link>
              </CardContent>
            </Card>
            {/* Pro */}
            <Card className="border-primary/40 ring-2 ring-primary/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Popular</div>
              <CardContent className="p-8">
                <h3 className="font-display text-xl font-bold text-foreground mb-1">Pro</h3>
                <p className="text-muted-foreground text-sm mb-6">Para vendedores serios</p>
                <div className="text-4xl font-display font-bold text-foreground mb-6">$20.000 <span className="text-base font-normal text-muted-foreground">COP/mes</span></div>
                <ul className="space-y-3 mb-8">
                  {["Productos ilimitados", "6 perfiles conectados", "Publicaciones ilimitadas", "Soporte prioritario", "Analítica avanzada", "Importación masiva Excel"].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-accent" />{t}</li>
                  ))}
                </ul>
                <Link to="/register"><Button className="w-full">Suscribirme al Pro</Button></Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} MarketMaster. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
