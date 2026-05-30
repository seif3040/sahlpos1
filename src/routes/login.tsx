import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Delete, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ensureDefaultOwner, findEmployeeByPin } from "@/server/bootstrap.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { employee, refresh } = useAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDefaultHint, setShowDefaultHint] = useState(false);

  useEffect(() => {
    void ensureDefaultOwner({ data: undefined } as never)
      .then((r) => { if (r?.created) setShowDefaultHint(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (employee) navigate({ to: "/app" });
  }, [employee, navigate]);

  const submitPin = async (fullPin: string) => {
    setBusy(true);
    try {
      const res = await findEmployeeByPin({ data: { pin: fullPin } });
      if (!res.found) {
        toast.error("رقم سري غير صحيح");
        setPin("");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: res.accessToken,
        refresh_token: res.refreshToken,
      });
      if (error) {
        toast.error("فشل تسجيل الدخول");
        setPin("");
        return;
      }
      toast.success(`أهلاً ${res.employee.name}`);
      await refresh();
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) void submitPin(next);
  };

  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">sahl pos</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل الرقم السري للدخول</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-xl border">
          <div className="flex justify-center gap-3 mb-6 h-14 items-center">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-all",
                  pin.length > i
                    ? "bg-primary border-primary scale-110"
                    : "border-muted-foreground/30",
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Button
                key={d}
                variant="outline"
                className="h-16 text-2xl font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={() => press(d)}
                disabled={busy}
              >
                {d}
              </Button>
            ))}
            <div />
            <Button
              variant="outline"
              className="h-16 text-2xl font-bold rounded-xl hover:bg-primary hover:text-primary-foreground"
              onClick={() => press("0")}
              disabled={busy}
            >
              0
            </Button>
            <Button
              variant="ghost"
              className="h-16 rounded-xl"
              onClick={back}
              disabled={busy || pin.length === 0}
            >
              <Delete className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {showDefaultHint && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            الرقم السري الافتراضي للمالك: <span className="font-mono font-bold">1234</span>
            <br />
            (يُرجى تغييره من الإعدادات)
          </p>
        )}
      </div>
    </div>
  );
}
