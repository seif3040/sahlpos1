import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            sahl pos
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/features" className="hover:text-primary">المميزات</Link>
            <Link to="/pricing" className="hover:text-primary">الأسعار</Link>
            <Link to="/login" className="hover:text-primary">دخول الموظفين</Link>
          </nav>
          <Button asChild size="sm">
            <Link to="/pricing">ابدأ الآن</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground flex flex-col md:flex-row justify-between gap-3">
          <div>© {new Date().getFullYear()} sahl pos — نظام نقاط البيع للشركات</div>
          <div className="flex gap-4">
            <Link to="/features">المميزات</Link>
            <Link to="/pricing">الأسعار</Link>
            <Link to="/admin/login" className="opacity-60 hover:opacity-100">مدير المنصة</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
