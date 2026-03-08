import { Link, useLocation, Outlet } from "react-router-dom";
import { Package, Users, Settings, CreditCard, BarChart3, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { to: "/dashboard/inventory", icon: Package, label: "Inventario" },
  { to: "/dashboard/profiles", icon: Users, label: "Perfiles" },
  { to: "/dashboard/publish", icon: Settings, label: "Publicar" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analítica" },
  { to: "/dashboard/subscription", icon: CreditCard, label: "Suscripción" },
];

export default function DashboardLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0">
        <div className="p-6">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Multi<span className="text-sidebar-primary">Hub</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
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
          <Link to="/">
            <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
