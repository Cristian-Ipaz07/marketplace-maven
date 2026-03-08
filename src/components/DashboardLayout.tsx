import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Package, Users, Settings, CreditCard, BarChart3, LayoutDashboard, LogOut, ImageIcon, Eye, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import TrialBanner from "@/components/TrialBanner";
import { ClipboardList } from "lucide-react";

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

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const allNavItems = isAdmin
    ? [...navItems, { to: "/dashboard/admin", icon: Shield, label: "Admin" }]
    : navItems;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0">
        <div className="p-6">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Multi<span className="text-sidebar-primary">Hub</span>
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
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
