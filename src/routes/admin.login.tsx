import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminSignIn, adminBootstrap, adminBootstrapNeeded } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const signIn = useServerFn(adminSignIn);
  const bootstrap = useServerFn(adminBootstrap);
  const checkBootstrap = useServerFn(adminBootstrapNeeded);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "bootstrap">("signin");
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);

  useEffect(() => {
    void checkBootstrap()
      .then((r) => {
        setBootstrapAvailable(r.needed);
        if (r.needed) setMode("bootstrap");
      })
      .catch(() => {});
  }, [checkBootstrap]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === "bootstrap"
        ? await bootstrap({ data: { email, password } })
        : await signIn({ data: { email, password } });
      const { error } = await supabase.auth.setSession({
        access_token: res.accessToken,
        refresh_token: res.refreshToken,
      });
      if (error) throw new Error(error.message);
      toast.success("أهلاً بك");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">لوحة مدير المنصة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "bootstrap" ? "أنشئ أول حساب مدير منصة" : "سجّل الدخول كمدير منصة"}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
                {mode === "bootstrap" && (
                  <p className="text-xs text-muted-foreground mt-1">8 أحرف على الأقل</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                {mode === "bootstrap" ? "إنشاء حساب مدير" : "تسجيل الدخول"}
              </Button>
              {bootstrapAvailable && mode === "signin" && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline w-full text-center"
                  onClick={() => setMode("bootstrap")}
                >
                  أنشئ أول حساب مدير
                </button>
              )}
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:underline">العودة للرئيسية</Link>
        </p>
      </div>
    </div>
  );
}
