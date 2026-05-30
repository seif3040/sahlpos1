import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Delete, Building2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { findTenantEmployeeByPin, getPublicTenant, setupOwnerPin } from "@/lib/tenant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pos/$slug")({
  component: TenantLoginPage,
});

function TenantLoginPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { employee, refresh } = useAuth();
  const lookup = useServerFn(findTenantEmployeeByPin);
  const fetchTenant = useServerFn(getPublicTenant);
  const doSetup = useServerFn(setupOwnerPin);

  const [tenantName, setTenantName] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"pin" | "setup" | "done">("pin");
  const [ownerName, setOwnerName] = useState("صاحب الشركة");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    fetchTenant({ data: { slug } }).then((r) => {
      if (!r.found) { toast.error("الشركة غير موجودة"); navigate({ to: "/" }); }
      else setTenantName(r.name);
    });
  }, [slug, fetchTenant, navigate]);

  useEffect(() => {
    if (employee && phase === "done") navigate({ to: "/app" });
  }, [employee, phase, navigate]);

  const submitPin = async (fullPin: string) => {
    setBusy(true);
    try {
      const res = await lookup({ data: { slug, pin: fullPin } });
      if (!res.found) {
        toast.error(res.reason === "inactive" ? "الاشتراك متوقف" : "رقم سري غير صحيح");
        setPin("");
        return;
      }
      const { error } = await supabase.auth.setSession({ access_token: res.accessToken, refresh_token: res.refreshToken });
      if (error) { toast.error("فشل تسجيل الدخول"); setPin(""); return; }
      await refresh();
      if (res.mustResetPin) {
        setPhase("setup");
      } else {
        toast.success(`أهلاً ${res.employee.name}`);
        setPhase("done");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
      setPin("");
    } finally { setBusy(false); }
  };

  const press = (d: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) void submitPin(next);
  };

  const doResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) { toast.error("الرقمين مش متطابقين"); return; }
    if (newPin === "0000") { toast.error("لا يمكن استخدام 0000"); return; }
    if (!/^\d{4}$/.test(newPin)) { toast.error("4 أرقام بالضبط"); return; }
    setBusy(true);
    try {
      await doSetup({ data: { name: ownerName.trim() || "صاحب الشركة", newPin } });
      toast.success("تم حفظ بياناتك");
      await refresh();
      setPhase("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally { setBusy(false); }
  };

  if (!tenantName) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (phase === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-warning/10 via-background to-primary/10">
        <div className="w-full max-w-md">
          <div className="bg-card border-2 border-warning rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 text-warning mb-3">
              <AlertTriangle className="h-6 w-6" />
              <div className="font-bold">تحذير: لازم تغيّر الرقم السري دلوقتي</div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              لو خرجت قبل ما تحفظ رقم سري جديد لنفسك كصاحب الشركة، <span className="font-bold text-destructive">مش هتقدر تدخل تاني</span>.
              الرقم 0000 هيتقفل بمجرد ما تحفظ.
            </p>
            <form onSubmit={doResetPin} className="space-y-3">
              <div>
                <Label>اسمك</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required maxLength={60} />
              </div>
              <div>
                <Label>الرقم السري الجديد (4 أرقام، ليس 0000)</Label>
                <Input type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} required />
              </div>
              <div>
                <Label>تأكيد الرقم السري</Label>
                <Input type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin h-4 w-4" /> : "احفظ وادخل"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">{tenantName}</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل الرقم السري للدخول</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-xl border">
          <div className="flex justify-center gap-3 mb-6 h-14 items-center">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(
                "h-4 w-4 rounded-full border-2 transition-all",
                pin.length > i ? "bg-primary border-primary scale-110" : "border-muted-foreground/30",
              )} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["1","2","3","4","5","6","7","8","9"].map((d) => (
              <Button key={d} variant="outline" className="h-16 text-2xl font-bold rounded-xl" onClick={() => press(d)} disabled={busy}>{d}</Button>
            ))}
            <div />
            <Button variant="outline" className="h-16 text-2xl font-bold rounded-xl" onClick={() => press("0")} disabled={busy}>0</Button>
            <Button variant="ghost" className="h-16 rounded-xl" onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy || !pin.length}>
              <Delete className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          أول دخول؟ الرقم المبدئي: <span className="font-mono font-bold">0000</span>
        </p>
      </div>
    </div>
  );
}
