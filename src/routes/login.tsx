import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, Loader2, LogIn, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyDestination } from "@/lib/tenant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Dest =
  | { kind: "admin" }
  | { kind: "tenant"; slug: string; name: string }
  | { kind: "pending"; company: string; status: string; adminNotes: string | null; aiStatus: string | null; aiNotes: string | null; createdAt: string }
  | { kind: "none" };

function LoginPage() {
  const navigate = useNavigate();
  const dest = useServerFn(getMyDestination);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Extract<Dest, { kind: "pending" }> | null>(null);

  // If already signed in, route to the right place.
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      try {
        const d = (await dest()) as Dest;
        await routeTo(d);
      } catch {
        /* ignore */
      }
    };
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeTo = async (d: Dest) => {
    if (d.kind === "admin") {
      navigate({ to: "/admin" });
      return;
    }
    if (d.kind === "tenant") {
      navigate({ to: "/app" });
      return;
    }
    if (d.kind === "pending") {
      setPending(d);
      return;
    }
    toast.info("ماعندكش أي حساب بعد. ابدأ من صفحة الأسعار.");
    navigate({ to: "/pricing" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error("الإيميل أو كلمة المرور غير صحيحة");
      toast.success("أهلاً بك");
      const d = (await dest()) as Dest;
      await routeTo(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    const statusLabel =
      pending.status === "admin_rejected"
        ? "تم رفض الطلب"
        : pending.aiStatus === "ai_rejected"
          ? "تم رفض الإيصال"
          : "قيد المراجعة";
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/20">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <h2 className="text-xl font-bold">{statusLabel}</h2>
              <p className="text-sm text-muted-foreground">شركة: {pending.company}</p>
              <p className="text-xs text-muted-foreground">
                أرسلت الطلب: {new Date(pending.createdAt).toLocaleString("ar-EG")}
              </p>
              {pending.aiNotes && (
                <p className="text-sm rounded-md bg-muted p-3 text-start">{pending.aiNotes}</p>
              )}
              {pending.adminNotes && (
                <p className="text-sm rounded-md bg-muted p-3 text-start">
                  ملاحظات الإدارة: {pending.adminNotes}
                </p>
              )}
              <p className="text-sm">هنتواصل معاك في أقرب وقت.</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setPending(null);
                  setEmail("");
                  setPassword("");
                }}
              >
                خروج
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/">العودة للرئيسية</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">دخول حساب الشركة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ادخل بالإيميل وكلمة المرور اللي سجّلت بيهم
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
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <LogIn className="h-4 w-4 ml-2" />}
                تسجيل الدخول
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t text-center text-sm space-y-2">
              <div className="text-muted-foreground">معندكش حساب؟</div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/pricing">اشترك في باقة وأنشئ حسابك</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> الرئيسية
          </Link>
          <Link to="/admin/login" className="hover:text-primary">دخول مدير المنصة</Link>
        </div>
      </div>
    </div>
  );
}
