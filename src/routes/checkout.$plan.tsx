import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload, Smartphone, CreditCard, Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MarketingShell } from "@/components/marketing-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPayment, getPlanInfo } from "@/lib/tenant.functions";

export const Route = createFileRoute("/checkout/$plan")({
  component: CheckoutPage,
});

type Method = "vodafone_cash" | "instapay" | "bank_transfer";

function CheckoutPage() {
  const { plan } = Route.useParams();
  const navigate = useNavigate();
  const submit = useServerFn(submitPayment);
  const fetchInfo = useServerFn(getPlanInfo);

  const [info, setInfo] = useState<{ name: string; price: number; vodafone: string; instapay: string; bank: string } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<Method>("vodafone_cash");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; notes: string; slug?: string } | null>(null);

  useEffect(() => {
    fetchInfo({ data: { plan } }).then(setInfo).catch(() => {
      toast.error("خطة غير صحيحة");
      navigate({ to: "/pricing" });
    });
  }, [plan, fetchInfo, navigate]);

  const onFile = (f: File | null) => {
    if (!f) { setFile(null); setFilePreview(""); return; }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("الصورة أكبر من 5 ميجا");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast.error("الصيغة غير مدعومة (png/jpg/webp)");
      return;
    }
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("ارفع سكرين شوت التحويل"); return; }
    if (!info) return;
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await submit({
        data: {
          companyName, email, phone, plan: plan as "basic" | "pro" | "enterprise",
          method, screenshotBase64: base64, screenshotMime: file.type as "image/png" | "image/jpeg" | "image/webp",
        },
      });
      setResult({ status: res.status, notes: res.notes, slug: "slug" in res ? res.slug : undefined });
      if (res.status === "approved") toast.success("تم التفعيل!");
      else toast.info("تم الاستلام — في انتظار المراجعة");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return <MarketingShell><div className="container mx-auto p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div></MarketingShell>;
  }

  if (result) {
    const approved = result.status === "approved";
    return (
      <MarketingShell>
        <div className="container mx-auto px-4 py-12 max-w-xl">
          <Card>
            <CardContent className="p-8 text-center">
              {approved ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                  <h1 className="text-2xl font-bold mb-2">تم تفعيل حسابك!</h1>
                  <p className="text-muted-foreground mb-6">{result.notes}</p>
                  {result.slug && (
                    <div className="bg-muted rounded-lg p-4 mb-6 text-right">
                      <div className="text-xs text-muted-foreground mb-1">رابط الدخول لشركتك:</div>
                      <div className="font-mono text-sm break-all">/pos/{result.slug}</div>
                      <div className="text-xs text-muted-foreground mt-3 mb-1">الرقم السري المبدئي:</div>
                      <div className="font-mono text-2xl font-bold">0000</div>
                      <div className="text-xs text-warning mt-2">⚠ هتُجبر تغيره أول دخول</div>
                    </div>
                  )}
                  {result.slug && (
                    <Button asChild className="w-full">
                      <Link to="/pos/$slug" params={{ slug: result.slug }}>ادخل لحسابي الآن</Link>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="h-16 w-16 text-warning mx-auto mb-4" />
                  <h1 className="text-2xl font-bold mb-2">في انتظار المراجعة</h1>
                  <p className="text-muted-foreground mb-2">{result.notes}</p>
                  <p className="text-sm text-muted-foreground">هنتواصل معاك على {email} خلال 24 ساعة.</p>
                  <Button asChild variant="outline" className="mt-6">
                    <Link to="/">العودة للرئيسية</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </MarketingShell>
    );
  }

  const recipient = method === "vodafone_cash" ? info.vodafone : method === "instapay" ? info.instapay : info.bank;

  return (
    <MarketingShell>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">اشترك في {info.name}</h1>
        <p className="text-muted-foreground mb-6">المبلغ المستحق: <span className="font-bold text-foreground">{info.price} ج.م / شهرياً</span></p>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="font-bold mb-3">1. اختر طريقة التحويل</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "vodafone_cash", label: "فودافون كاش", icon: Smartphone },
                { id: "instapay", label: "إنستاباي", icon: CreditCard },
                { id: "bank_transfer", label: "تحويل بنكي", icon: Building2 },
              ] as { id: Method; label: string; icon: typeof Smartphone }[]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    method === m.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <m.icon className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{m.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground mb-1">حوّل المبلغ على:</div>
              <div className="font-mono font-bold text-lg break-all">{recipient}</div>
              <div className="text-xs text-muted-foreground mt-2">المبلغ بالضبط: <span className="font-bold">{info.price} ج.م</span></div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={onSubmit} className="space-y-5">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="font-bold">2. ارفع سكرين شوت التحويل</div>
              <label className="block">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                  {filePreview ? (
                    <img src={filePreview} alt="" className="max-h-48 mx-auto rounded" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <div className="text-sm">اضغط لاختيار صورة (PNG / JPG / WEBP حتى 5 ميجا)</div>
                      <div className="text-xs text-muted-foreground mt-1">AI هيقرأ المبلغ ويفعّل حسابك تلقائياً</div>
                    </>
                  )}
                </div>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="font-bold">3. بيانات الشركة</div>
              <div>
                <Label htmlFor="cn">اسم الشركة / المحل *</Label>
                <Input id="cn" required minLength={2} maxLength={80} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="مثال: محل النور" />
              </div>
              <div>
                <Label htmlFor="em">البريد الإلكتروني *</Label>
                <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <Label htmlFor="ph">رقم الموبايل *</Label>
                <Input id="ph" required minLength={8} maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري التحقق...</> : "أكد الدفع وفعّل حسابي"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            AI هيتحقق من السكرين شوت تلقائياً. لو فيه أي مشكلة هنتواصل معاك.
          </p>
        </form>
      </div>
    </MarketingShell>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
