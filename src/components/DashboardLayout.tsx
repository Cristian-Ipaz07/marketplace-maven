import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { 
  Package, Users, Settings, CreditCard, BarChart3, LayoutDashboard, 
  LogOut, ImageIcon, Eye, Shield, Menu, X, Info, Images, ClipboardList 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import TrialBanner from "@/components/TrialBanner";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIMITS } from "@/lib/plans";
import { toast } from "sonner";
import { isHideAdminInSidebar, setHideAdminInSidebar, ADMIN_VISIBILITY_EVENT } from "@/lib/adminSecurity";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Inicio", exact: true },
  { to: "/dashboard/inventory", icon: Package, label: "Inventario" },
  { to: "/dashboard/covers", icon: ImageIcon, label: "Portadas" },
  { to: "/dashboard/galleries", icon: Images, label: "Galerías" },
  { to: "/dashboard/profiles", icon: Users, label: "Perfiles" },
  { to: "/dashboard/publish", icon: Settings, label: "Configurar" },
  { to: "/dashboard/publish-preview", icon: Eye, label: "Publicar" },
  { to: "/dashboard/logs", icon: ClipboardList, label: "Registro" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analítica" },
  { to: "/dashboard/subscription", icon: CreditCard, label: "Suscripción" },
];

function SidebarContent({ 
  pathname, 
  allNavItems, 
  handleSignOut, 
  onNavClick,
  onLogoClick,
}: {
  pathname: string;
  allNavItems: typeof navItems;
  handleSignOut: () => void;
  onNavClick?: () => void;
  onLogoClick?: () => void;
}) {
  return (
    <>
      <div className="p-6">
        <button
          type="button"
          onClick={onLogoClick}
          className="font-display text-xl font-bold tracking-tight text-left cursor-pointer focus:outline-none select-none hover:opacity-90"
          title="MarketMaster"
        >
          Market<span className="text-sidebar-primary">Master</span>
        </button>
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
  const [hideAdmin, setHideAdmin] = useState(() => isHideAdminInSidebar());

  const currentPlan = sub?.plan || "basico";
  const planLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basico;

  const registersRef = useRef<Record<string, boolean>>({});
  const logoClicksRef = useRef<{ count: number; timer: any }>({ count: 0, timer: null });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setHideAdmin(isHideAdminInSidebar());
    };
    window.addEventListener(ADMIN_VISIBILITY_EVENT, handleVisibilityChange);
    return () => window.removeEventListener(ADMIN_VISIBILITY_EVENT, handleVisibilityChange);
  }, []);

  const handleLogoClick = () => {
    logoClicksRef.current.count += 1;
    if (logoClicksRef.current.timer) {
      clearTimeout(logoClicksRef.current.timer);
    }

    if (logoClicksRef.current.count >= 5) {
      logoClicksRef.current.count = 0;
      const nextState = !isHideAdminInSidebar();
      setHideAdminInSidebar(nextState);
      if (nextState) {
        toast.info("Acceso de Administrador oculto en este navegador");
      } else {
        toast.success("Acceso de Administrador visible");
      }
    } else {
      logoClicksRef.current.timer = setTimeout(() => {
        logoClicksRef.current.count = 0;
      }, 2500);
    }
  };
  
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
              .eq("id", id)
              .maybeSingle();
            if (error) throw error;
            return data;
        };

        const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout conectando a Supabase")), 4000)
        );

        let existing: any = null;
        try {
            existing = await Promise.race([fetchExisting(), timeoutPromise]);
        } catch (fetchErr: any) {
            console.warn("Fallo lectura previa de cuenta, procediendo con fallback:", fetchErr.message);
        }

        if (existing) {
          if (existing.name !== name) {
            await supabase
              .from("connected_accounts")
              .update({ name, updated_at: new Date().toISOString() })
              .eq("id", id);
          }
        } else {
          // 2. CHECK LIMIT
          const { count } = await supabase
            .from("connected_accounts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);

          if ((count || 0) >= planLimits.accounts) {
            return;
          }

          // 3. INSERT
          const isFirst = (count || 0) === 0;
          await supabase.from("connected_accounts").insert({
            id,
            user_id: user.id,
            name,
            active: isFirst,
          });

          // Notificar al bridge para que actualice la UI de la extensión
          window.postMessage(
            {
              source: "MARKETMASTER_DASHBOARD",
              action: "PROFILES_UPDATED",
            },
            "*"
          );
        }
      } catch (err: any) {
        console.warn("Fallo registro silencioso de perfil:", err.message);
      } finally {
        setTimeout(() => {
          delete registersRef.current[id];
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

  const allNavItems = (isAdmin && !hideAdmin)
    ? [...navItems, { to: "/dashboard/admin", icon: Shield, label: "Admin" }]
    : navItems;

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-50 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={handleLogoClick}
            className="font-display text-lg font-bold tracking-tight text-sidebar-foreground select-none focus:outline-none"
          >
            Market<span className="text-sidebar-primary">Master</span>
          </button>
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
                  onLogoClick={handleLogoClick}
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
          onLogoClick={handleLogoClick}
        />
      </aside>
      <main className="flex-1 overflow-y-auto relative">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
