import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  Building2,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { useAuth, canAccess } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard, level: 1 as const },
  { to: "/sales", label: "المبيعات", icon: ShoppingCart, level: 1 as const },
  { to: "/products", label: "المنتجات", icon: Package, level: 2 as const },
  { to: "/purchases", label: "المشتريات", icon: Truck, level: 2 as const },
  { to: "/customers", label: "العملاء", icon: Users, level: 1 as const },
  { to: "/suppliers", label: "الموردين", icon: Building2, level: 2 as const },
  { to: "/cash-register", label: "الصندوق", icon: Wallet, level: 1 as const },
  { to: "/expenses", label: "المصروفات", icon: Receipt, level: 1 as const },
  { to: "/reports", label: "التقارير", icon: BarChart3, level: 2 as const },
  { to: "/settings", label: "الإعدادات", icon: Settings, level: 3 as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { employee, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((n) => canAccess(employee?.role, n.level));

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-sidebar border-l border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
            ن
          </div>
          <div>
            <div className="font-bold text-sm">نقاط البيع</div>
            <div className="text-xs text-muted-foreground">{employee?.name}</div>
          </div>
        </div>
        <div className="mt-2 inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
          {roleLabel(employee?.role || "")}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <it.icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b bg-card flex items-center px-3 gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="font-bold">نظام نقاط البيع</div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
