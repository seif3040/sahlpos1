import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, MessageCircle } from "lucide-react";
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
    </div>
  );
}
