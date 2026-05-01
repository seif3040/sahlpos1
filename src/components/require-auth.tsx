import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, canAccess } from "@/lib/auth-context";
import { AppShell } from "./app-shell";

export function RequireAuth({
  children,
  level = 1,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const { employee, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !employee) {
      navigate({ to: "/login" });
    }
  }, [loading, employee, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">جارٍ التحميل...</div>
      </div>
    );
  }
  if (!employee) return null;

  if (!canAccess(employee.role, level)) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-2xl font-bold mb-2">غير مصرح</div>
          <div className="text-muted-foreground">
            لا تمتلك الصلاحية للوصول إلى هذه الصفحة.
          </div>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
