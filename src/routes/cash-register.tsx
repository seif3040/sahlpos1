import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";

export const Route = createFileRoute("/cash-register")({
  component: () => (<RequireAuth><CashRegisterPage /></RequireAuth>),
});

interface Shift { id: string; opened_at: string; closed_at: string | null; opening_cash: number; closing_cash: number | null }

function CashRegisterPage() {
  const { employee } = useAuth();
  const [active, setActive] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [opening, setOpening] = useState(0);
  const [closing, setClosing] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [currency, setCurrency] = useState("ج.م");

  const load = async () => {
    if (!employee) return;
    const [{ data: act }, { data: hist }, { data: s }] = await Promise.all([
      supabase.from("cash_register_shifts").select("*").eq("employee_id", employee.id).is("closed_at", null).maybeSingle(),
      supabase.from("cash_register_shifts").select("*").eq("employee_id", employee.id).not("closed_at", "is", null).order("opened_at", { ascending: false }).limit(20),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setActive(act as Shift | null);
    setHistory((hist ?? []) as Shift[]);
    if (s?.currency) setCurrency(s.currency);
    if (act) {
      const [{ data: sales }, { data: exp }] = await Promise.all([
        supabase
          .from("sales")
          .select("total,cash_part,payment_method,sale_items(quantity,refunded_quantity,unit_price)")
          .gte("created_at", act.opened_at)
          .in("payment_method", ["cash", "mixed"]),
        supabase.from("expenses").select("amount").gte("created_at", act.opened_at),
      ]);
      // Cash collected = cash_part for mixed, total for cash; minus refunds proportional to cash share
      type R = { total: number; cash_part: number; payment_method: string; sale_items?: { quantity: number; refunded_quantity: number; unit_price: number }[] };
      const cashSum = ((sales ?? []) as R[]).reduce((acc, s) => {
        const gross = Number(s.total) || 0;
        const cashShare = s.payment_method === "cash" ? gross : Number(s.cash_part) || 0;
        const refundedAmt = (s.sale_items ?? []).reduce(
          (a, it) => a + Number(it.refunded_quantity || 0) * Number(it.unit_price || 0),
          0,
        );
        const cashRatio = gross > 0 ? cashShare / gross : 0;
        return acc + Math.max(0, cashShare - refundedAmt * cashRatio);
      }, 0);
      setSalesTotal(cashSum);
      setExpensesTotal((exp ?? []).reduce((a, x) => a + Number(x.amount), 0));
    }
  };
  useEffect(() => { void load(); }, [employee]);

  const openShift = async () => {
    if (!employee) return;
    const { error } = await supabase.from("cash_register_shifts").insert({ employee_id: employee.id, opening_cash: opening });
    if (error) return toast.error(error.message);
    toast.success("تم فتح الوردية"); setOpening(0); void load();
  };
  const closeShift = async () => {
    if (!active) return;
    const { error } = await supabase.from("cash_register_shifts").update({ closed_at: new Date().toISOString(), closing_cash: closing }).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success("تم إغلاق الوردية"); setClosing(0); void load();
  };

  const expectedCash = active ? Number(active.opening_cash) + salesTotal - expensesTotal : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الصندوق</h1>
      {!active ? (
        <Card><CardContent className="p-6 space-y-3">
          <h2 className="font-bold">فتح وردية جديدة</h2>
          <div><Label>المبلغ الافتتاحي</Label><Input type="number" value={opening} onChange={e => setOpening(Number(e.target.value) || 0)} /></div>
          <Button onClick={openShift}>فتح الوردية</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-bold">وردية مفتوحة</h2><Badge>{formatDate(active.opened_at)}</Badge></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="افتتاحي" value={formatMoney(Number(active.opening_cash), currency)} />
            <Stat label="مبيعات نقدي" value={formatMoney(salesTotal, currency)} />
            <Stat label="مصروفات" value={formatMoney(expensesTotal, currency)} />
            <Stat label="المتوقع بالصندوق" value={formatMoney(expectedCash, currency)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end pt-3 border-t">
            <div><Label>المبلغ الفعلي عند الإغلاق</Label><Input type="number" value={closing} onChange={e => setClosing(Number(e.target.value) || 0)} /></div>
            <Button variant="destructive" onClick={closeShift}>إغلاق الوردية</Button>
          </div>
          {closing > 0 && <div>الفرق: <strong className={closing - expectedCash >= 0 ? "text-success" : "text-destructive"}>{formatMoney(closing - expectedCash, currency)}</strong></div>}
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4">
        <h2 className="font-bold mb-3">آخر الورديات</h2>
        <div className="space-y-2">
          {history.length === 0 ? <div className="text-center text-muted-foreground py-6">لا يوجد سجل</div> :
          history.map(h => (
            <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg flex-wrap gap-2">
              <div><div className="text-sm">{formatDate(h.opened_at)} → {h.closed_at && formatDate(h.closed_at)}</div></div>
              <div className="flex gap-3 text-sm">
                <span>افتتاحي: {formatMoney(Number(h.opening_cash), currency)}</span>
                <span>إغلاق: {formatMoney(Number(h.closing_cash ?? 0), currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (<div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-bold">{value}</div></div>);
}
