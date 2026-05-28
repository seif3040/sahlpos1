import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, MessageCircle, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";
import { buildCustomerStatement, classifySale, itemRefundedAmount, type SaleLike } from "@/lib/calc";

export const Route = createFileRoute("/customers")({
  component: () => (<RequireAuth><CustomersPage /></RequireAuth>),
});

interface Customer { id: string; name: string; phone: string | null; notes: string | null }
interface Debt { id: string; customer_id: string; amount: number; paid: number; remaining: number; is_settled: boolean; created_at: string }

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [payOpen, setPayOpen] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [currency, setCurrency] = useState("ج.م");
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [historySales, setHistorySales] = useState<Array<{ id: string; invoice_number: number; total: number; created_at: string; payment_method: string; is_refunded: boolean; net_total: number; refunded_amount: number; status: string }>>([]);
  const [historyDebts, setHistoryDebts] = useState<Array<{ id: string; amount: number; paid: number; remaining: number; is_settled: boolean; created_at: string }>>([]);
  const [historyPayments, setHistoryPayments] = useState<Array<{ id: string; amount: number; created_at: string }>>([]);

  const openHistory = async (c: Customer) => {
    setHistoryFor(c);
    const [{ data: salesData }, { data: debtsData }] = await Promise.all([
      supabase
        .from("sales")
        .select("id,invoice_number,total,cash_part,payment_method,created_at,is_refunded,sale_items(quantity,refunded_quantity,unit_price)")
        .eq("customer_id", c.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("customer_debts")
        .select("id,amount,paid,remaining,is_settled,created_at")
        .eq("customer_id", c.id)
        .order("created_at", { ascending: false }),
    ]);
    type Row = SaleLike & { id: string; invoice_number: number; created_at: string; is_refunded: boolean };
    const rows = ((salesData ?? []) as Row[]).map((s) => {
      const refunded = itemRefundedAmount(s.sale_items);
      return {
        id: s.id,
        invoice_number: s.invoice_number,
        total: Number(s.total),
        created_at: s.created_at,
        payment_method: s.payment_method,
        is_refunded: s.is_refunded,
        net_total: Math.max(0, Number(s.total) - refunded),
        refunded_amount: refunded,
        status: classifySale(s),
      };
    });
    setHistorySales(rows);
    setHistoryDebts((debtsData ?? []) as typeof historyDebts);
    const debtIds = (debtsData ?? []).map((d) => d.id);
    if (debtIds.length) {
      const { data: pays } = await supabase
        .from("debt_payments")
        .select("id,amount,created_at,debt_id")
        .in("debt_id", debtIds)
        .order("created_at", { ascending: false });
      setHistoryPayments((pays ?? []) as typeof historyPayments);
    } else {
      setHistoryPayments([]);
    }
  };

  const load = async () => {
    const [{ data: c }, { data: d }, { data: s }] = await Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("customer_debts").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setCustomers(c ?? []); setDebts((d ?? []) as Debt[]); if (s?.currency) setCurrency(s.currency);
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("الاسم مطلوب");
    const payload = { name: form.name.trim(), phone: form.phone || null, notes: form.notes || null };
    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setOpen(false); setForm({ name: "", phone: "", notes: "" }); setEditing(null); void load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف العميل؟")) return;
    await supabase.from("customers").delete().eq("id", id); void load();
  };

  const pay = async () => {
    if (!payOpen || payAmount <= 0) return;
    const newPaid = Number(payOpen.paid) + payAmount;
    const settled = newPaid >= Number(payOpen.amount);
    await supabase.from("debt_payments").insert({ debt_id: payOpen.id, amount: payAmount });
    await supabase.from("customer_debts").update({ paid: newPaid, is_settled: settled }).eq("id", payOpen.id);
    toast.success("تم تسجيل الدفعة"); setPayOpen(null); setPayAmount(0); void load();
  };

  const remind = (c: Customer, d: Debt) => {
    if (!c.phone) return toast.error("لا يوجد رقم هاتف");
    const msg = encodeURIComponent(`مرحباً ${c.name}، تذكير بالمستحقات المتبقية: ${d.remaining} ${currency}. شكراً.`);
    window.open(`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">العملاء</h1>
        <Button onClick={() => { setEditing(null); setForm({ name: "", phone: "", notes: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 ml-2" />عميل جديد
        </Button>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>الهاتف</TableHead><TableHead>المستحقات</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {customers.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">لا يوجد عملاء</TableCell></TableRow> :
            customers.map(c => {
              const owe = debts.filter(d => d.customer_id === c.id && !d.is_settled).reduce((a, d) => a + Number(d.remaining), 0);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone ?? "-"}</TableCell>
                  <TableCell>{owe > 0 ? <Badge variant="destructive">{formatMoney(owe, currency)}</Badge> : <Badge variant="secondary">سداد</Badge>}</TableCell>
                  <TableCell className="text-left">
                    <Button size="icon" variant="ghost" title="السجل" onClick={() => openHistory(c)}><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone ?? "", notes: c.notes ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-bold mb-3">الديون المستحقة</h2>
          <div className="space-y-2">
            {debts.filter(d => !d.is_settled).length === 0 ? <div className="text-center py-6 text-muted-foreground">لا توجد ديون</div> :
            debts.filter(d => !d.is_settled).map(d => {
              const c = customers.find(x => x.id === d.customer_id);
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 border rounded-lg flex-wrap">
                  <div className="flex-1">
                    <div className="font-medium">{c?.name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(d.created_at)}</div>
                  </div>
                  <div>المتبقي: <strong>{formatMoney(Number(d.remaining), currency)}</strong></div>
                  <Button size="sm" onClick={() => { setPayOpen(d); setPayAmount(Number(d.remaining)); }}>دفع</Button>
                  {c?.phone && <Button size="sm" variant="outline" onClick={() => remind(c, d)}><MessageCircle className="h-4 w-4 ml-1" />تذكير</Button>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "تعديل العميل" : "عميل جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={v => !v && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
          <div><Label>المبلغ</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value) || 0)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPayOpen(null)}>إلغاء</Button><Button onClick={pay}>تأكيد</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={v => !v && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>سجل مشتريات: {historyFor?.name}</DialogTitle></DialogHeader>
          {historySales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد فواتير</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>الفاتورة</TableHead><TableHead>التاريخ</TableHead><TableHead>الدفع</TableHead><TableHead>الإجمالي</TableHead><TableHead>الصافي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {historySales.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>#{s.invoice_number}</TableCell>
                    <TableCell>{formatDate(s.created_at)}</TableCell>
                    <TableCell>{s.payment_method}</TableCell>
                    <TableCell>{formatMoney(s.total, currency)}</TableCell>
                    <TableCell className="font-bold text-primary">{formatMoney(s.net_total, currency)}</TableCell>
                    <TableCell>{s.is_refunded ? <Badge variant="destructive">مرتجعة</Badge> : s.net_total < s.total ? <Badge variant="secondary">جزئي</Badge> : <Badge variant="outline">سليمة</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <div className="text-sm text-muted-foreground ml-auto">إجمالي صافي: <strong>{formatMoney(historySales.reduce((a, s) => a + s.net_total, 0), currency)}</strong></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
