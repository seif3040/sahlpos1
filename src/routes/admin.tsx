import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, LogOut, Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  checkAdminAccess,
  listSubmissions,
  approveSubmission,
  rejectSubmission,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
});

interface Row {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string;
  plan: string;
  method: string;
  amount: number;
  status: string;
  ai_status: string | null;
  ai_notes: string | null;
  signed_url: string | null;
  account_created: boolean;
  tenant_id: string | null;
  created_at: string;
}

const PLAN_AR: Record<string, string> = { basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
const METHOD_AR: Record<string, string> = {
  vodafone_cash: "فودافون كاش",
  instapay: "InstaPay",
  bank_transfer: "تحويل بنكي",
};

function statusBadge(status: string, account: boolean) {
  if (account || status === "admin_approved") return <Badge className="bg-emerald-600">مفعّل</Badge>;
  if (status === "admin_rejected") return <Badge variant="destructive">مرفوض</Badge>;
  return <Badge variant="secondary">قيد المراجعة</Badge>;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const check = useServerFn(checkAdminAccess);
  const list = useServerFn(listSubmissions);
  const approve = useServerFn(approveSubmission);
  const reject = useServerFn(rejectSubmission);

  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [selected, setSelected] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await check();
        if (!r.isAdmin) {
          toast.error("هذا الحساب ليس مدير منصة");
          navigate({ to: "/admin/login" });
          return;
        }
      } catch {
        navigate({ to: "/admin/login" });
        return;
      } finally {
        setChecking(false);
      }
      void refresh("pending");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async (status: "pending" | "all") => {
    setLoading(true);
    try {
      const r = await list({ data: { status } });
      setRows(r.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  };

  const onFilter = (f: "pending" | "all") => {
    setFilter(f);
    void refresh(f);
  };

  const onApprove = async () => {
    if (!selected) return;
    setActing("approve");
    try {
      const r = await approve({ data: { id: selected.id, notes: note || undefined } });
      toast.success(`تم التفعيل: /pos/${r.slug}`);
      setSelected(null);
      setNote("");
      void refresh(filter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التفعيل");
    } finally {
      setActing(null);
    }
  };

  const onReject = async () => {
    if (!selected) return;
    setActing("reject");
    try {
      await reject({ data: { id: selected.id, notes: note || undefined } });
      toast.success("تم رفض الطلب");
      setSelected(null);
      setNote("");
      void refresh(filter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفض");
    } finally {
      setActing(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  const counts = useMemo(() => {
    if (!rows) return { pending: 0, approved: 0, rejected: 0 };
    return {
      pending: rows.filter((r) => r.status === "pending" && !r.account_created).length,
      approved: rows.filter((r) => r.account_created || r.status === "admin_approved").length,
      rejected: rows.filter((r) => r.status === "admin_rejected").length,
    };
  }, [rows]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Shield className="h-4 w-4" />
            </div>
            لوحة مدير المنصة
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
              الموقع
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">قيد المراجعة</div><div className="text-2xl font-bold">{counts.pending}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">مفعّلة</div><div className="text-2xl font-bold text-emerald-600">{counts.approved}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">مرفوضة</div><div className="text-2xl font-bold text-destructive">{counts.rejected}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>طلبات الاشتراك</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => onFilter("pending")}>
                قيد المراجعة
              </Button>
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => onFilter("all")}>
                الكل
              </Button>
              <Button size="sm" variant="ghost" onClick={() => refresh(filter)} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !rows ? (
              <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
            ) : !rows || rows.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">لا توجد طلبات</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-right text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 px-2">الشركة</th>
                      <th className="py-2 px-2">الباقة</th>
                      <th className="py-2 px-2">المبلغ</th>
                      <th className="py-2 px-2">طريقة الدفع</th>
                      <th className="py-2 px-2">AI</th>
                      <th className="py-2 px-2">الحالة</th>
                      <th className="py-2 px-2">التاريخ</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 px-2">
                          <div className="font-medium">{r.company_name}</div>
                          <div className="text-xs text-muted-foreground">{r.contact_phone} · {r.contact_email}</div>
                        </td>
                        <td className="py-2 px-2">{PLAN_AR[r.plan] ?? r.plan}</td>
                        <td className="py-2 px-2">{Number(r.amount).toLocaleString("ar-EG")} ج.م</td>
                        <td className="py-2 px-2">{METHOD_AR[r.method] ?? r.method}</td>
                        <td className="py-2 px-2">
                          {r.ai_status === "ai_approved" && <Badge className="bg-emerald-600">مقبول</Badge>}
                          {r.ai_status === "ai_rejected" && <Badge variant="destructive">مرفوض</Badge>}
                          {(r.ai_status === "needs_review" || !r.ai_status) && <Badge variant="secondary">مراجعة</Badge>}
                        </td>
                        <td className="py-2 px-2">{statusBadge(r.status, r.account_created)}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="py-2 px-2 text-end">
                          <Button size="sm" variant="outline" onClick={() => { setSelected(r); setNote(""); }}>
                            مراجعة
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.company_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">الباقة:</span> {PLAN_AR[selected.plan] ?? selected.plan}</div>
                <div><span className="text-muted-foreground">المبلغ:</span> {Number(selected.amount).toLocaleString("ar-EG")} ج.م</div>
                <div><span className="text-muted-foreground">الطريقة:</span> {METHOD_AR[selected.method] ?? selected.method}</div>
                <div><span className="text-muted-foreground">التاريخ:</span> {new Date(selected.created_at).toLocaleString("ar-EG")}</div>
                <div><span className="text-muted-foreground">الإيميل:</span> <span dir="ltr">{selected.contact_email}</span></div>
                <div><span className="text-muted-foreground">الهاتف:</span> <span dir="ltr">{selected.contact_phone}</span></div>
              </div>

              {selected.ai_notes && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="font-medium mb-1">تحليل AI</div>
                  <p className="text-muted-foreground">{selected.ai_notes}</p>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-2">صورة التحويل</div>
                {selected.signed_url ? (
                  <a href={selected.signed_url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={selected.signed_url}
                      alt="إيصال التحويل"
                      className="max-h-96 w-full object-contain rounded-md border bg-muted/30"
                    />
                    <span className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                      فتح في تبويب جديد <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">لا توجد صورة</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">ملاحظات (اختياري)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="سبب الرفض أو ملاحظة..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button
              variant="destructive"
              onClick={onReject}
              disabled={!!acting || !selected || selected.account_created}
            >
              {acting === "reject" ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <XCircle className="h-4 w-4 ml-1" />}
              رفض
            </Button>
            <Button onClick={onApprove} disabled={!!acting}>
              {acting === "approve" ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
              تأكيد التحويل وتفعيل الحساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
