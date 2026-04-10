import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Package, Users, Settings, CreditCard, BarChart3, LayoutDashboard, LogOut, ImageIcon, Eye, Shield, Menu, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import TrialBanner from "@/components/TrialBanner";
import { ClipboardList } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIMITS } from "@/lib/plans";
import { toast } from "sonner";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Inicio", exact: true },
  { to: "/dashboard/inventory", icon: Package, label: "Inventario" },
  { to: "/dashboard/covers", icon: ImageIcon, label: "Portadas" },
  { to: "/dashboard/profiles", icon: Users, label: "Perfiles" },
  { to: "/dashboard/publish", icon: Settings, label: "Configurar" },
  { to: "/dashboard/publish-preview", icon: Eye, label: "Publicar" },
  { to: "/dashboard/logs", icon: ClipboardList, label: "Registro" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analítica" },
  { to: "/dashboard/subscription", icon: CreditCard, label: "Suscripción" },
];

function SidebarContent({ pathname, allNavItems, handleSignOut, onNavClick }: {
  pathname: string;
  allNavItems: typeof navItems;
  handleSignOut: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      <div className="p-6">
        <Link to="/" className="font-display text-xl font-bold tracking-tight" onClick={onNavClick}>
          Market<span className="text-sidebar-primary">Master</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {allNavItems.map((item) => {
          const active = (item as any).exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={() => { handleSignOut(); onNavClick?.(); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
        </Button>
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const { sub } = useSubscription();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentPlan = sub?.plan || "basico";
  const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basico;

  const registersRef = useRef<Record<string, boolean>>({});
  
  useEffect(() => {
    if (!user) return;

    const handleAutoProfile = async (e: MessageEvent) => {
      if (e.data?.source !== "MARKETMASTER_BRIDGE" || e.data.action !== "PROFILE_DETECTED") return;
      const { id, name } = e.data.payload;

      // MUTEX: Liberar siempre en 1 segundo pase lo que pase
      if (registersRef.current[id]) return;
      registersRef.current[id] = true;

      try {
        // 1. BUSCAR SI EXISTE (Con Timeout de Seguridad)
        const fetchExisting = async () => {
            const { data, error } = await supabase
              .from("connected_accounts")
              .select("id, name, active")
              .eq("chrome_profile_path", id)
              .eq("user_id", user.id)
              .maybeSingle();
            if (error) throw error;
            return data;
        };

        // Timeout de 6 segundos para la DB
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("TIMEOUT")), 6000)
        );

        const existing = await Promise.race([fetchExisting(), timeoutPromise]) as any;

        if (!existing) {
          // INSERTAR NUEVO
          toast.promise(
            (async () => {
              const { error: insertError } = await supabase.from("connected_accounts").insert({
                user_id: user.id, 
                name: name, 
                active: true, 
                chrome_profile_path: id,
                updated_at: new Date().toISOString()
              });
              if (insertError) throw insertError;
            })(),
            {
              loading: 'Vinculando nuevo perfil...',
              success: `¡Perfil "${name}" vinculado!`,
              error: (err) => {
                  if (err?.message === "TIMEOUT") return "El servidor tarda demasiado. Reintenta.";
                  return "Error de red: No se pudo registrar el perfil.";
              }
            }
          );
        } else {
          // ACTUALIZAR EXISTENTE
          await supabase
            .from("connected_accounts")
            .update({ 
              active: true, 
              name: existing.name || name,
              updated_at: new Date().toISOString() 
            })
            .eq("id", existing.id);
          
          if (!existing.active) {
            toast.success(`Perfil "${existing.name}" reactivado.`);
          }
        }
      } catch (err: any) {
        console.error("[AutoProfile] Error:", err);
        if (err?.message?.includes("fetch") || err?.message === "TIMEOUT") {
            toast.error("⚠️ Error de conexión con el servidor. Reintenta en unos segundos.");
        }
      } finally {
        setTimeout(() => {
          if (registersRef.current) delete registersRef.current[id];
        }, 1000);
      }
    };

    window.addEventListener("message", handleAutoProfile);
    return () => window.removeEventListener("message", handleAutoProfile);
  }, [user, planLimits]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const allNavItems = isAdmin
    ? [...navItems, { to: "/dashboard/admin", icon: Shield, label: "Admin" }]
    : navItems;

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-50 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
            Market<span className="text-sidebar-primary">Master</span>
          </Link>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <div className="flex flex-col h-full">
                <SidebarContent
                  pathname={pathname}
                  allNavItems={allNavItems}
                  handleSignOut={handleSignOut}
                  onNavClick={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 overflow-auto">
          <TrialBanner />
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0 overflow-y-auto hidden md:flex">
        <SidebarContent
          pathname={pathname}
          allNavItems={allNavItems}
          handleSignOut={handleSignOut}
        />
      </aside>
      <main className="flex-1 overflow-y-auto relative">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
