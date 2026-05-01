import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";

export const Route = createFileRoute("/expenses")({
  component: () => (<RequireAuth><ExpensesPage /></RequireAuth>),
});

interface Expense { id: string; category: string; amount: number; note: string | null; created_at: string }
const CATS = [{ v: "rent", l: "إيجار" }, { v: "electricity", l: "كهرباء" }, { v: "water", l: "مياه" }, { v: "salaries", l: "رواتب" }, { v: "other", l: "أخرى" }];

function ExpensesPage() {
  const { employee } = useAuth();
  const [list, setList] = useState<Expense[]>([]);
  const [form, setForm] = useState({ category: "other", amount: 0, note: "" });
  const [currency, setCurrency] = useState("ج.م");

  const load = async () => {
    const [{ data }, { data: s }] = await Promise.all([
      supabase.from("expenses").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setList((data ?? []) as Expense[]); if (s?.currency) setCurrency(s.currency);
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (form.amount <= 0) return toast.error("المبلغ غير صالح");
    const { error } = await supabase.from("expenses").insert({ category: form.category, amount: form.amount, note: form.note || null, employee_id: employee?.id });
    if (error) return toast.error(error.message);
    toast.success("تم الإضافة"); setForm({ category: "other", amount: 0, note: "" }); void load();
  };
  const del = async (id: string) => { if (!confirm("حذف؟")) return; await supabase.from("expenses").delete().eq("id", id); void load(); };

  const total = list.reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المصروفات</h1>
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div><Label>الفئة</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) || 0 })} /></div>
        <div><Label>ملاحظة</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
        <Button onClick={add}><Plus className="h-4 w-4 ml-2" />إضافة</Button>
      </CardContent></Card>

      <div className="text-lg">إجمالي المصروفات: <strong className="text-destructive">{formatMoney(total, currency)}</strong></div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الفئة</TableHead><TableHead>المبلغ</TableHead><TableHead>ملاحظة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {list.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">لا توجد مصروفات</TableCell></TableRow> :
            list.map(e => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.created_at)}</TableCell>
                <TableCell>{CATS.find(c => c.v === e.category)?.l ?? e.category}</TableCell>
                <TableCell className="font-bold">{formatMoney(Number(e.amount), currency)}</TableCell>
                <TableCell>{e.note ?? "-"}</TableCell>
                <TableCell><Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
