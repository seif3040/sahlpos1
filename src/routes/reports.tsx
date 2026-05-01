import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";

export const Route = createFileRoute("/reports")({
  component: () => (<RequireAuth level={2}><ReportsPage /></RequireAuth>),
});

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<{ id: string; invoice_number: number; total: number; created_at: string; payment_method: string }[]>([]);
  const [expenses, setExpenses] = useState<{ category: string; amount: number; created_at: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; quantity: number; purchase_price: number; selling_price: number }[]>([]);
  const [currency, setCurrency] = useState("ج.م");
  const [profit, setProfit] = useState(0);

  const load = async () => {
    const startISO = new Date(from).toISOString();
    const endISO = new Date(to + "T23:59:59").toISOString();
    const [{ data: s }, { data: e }, { data: p }, { data: si }, { data: st }] = await Promise.all([
      supabase.from("sales").select("id,invoice_number,total,created_at,payment_method").gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }),
      supabase.from("expenses").select("category,amount,created_at").gte("created_at", startISO).lte("created_at", endISO),
      supabase.from("products").select("id,name,quantity,purchase_price,selling_price"),
      supabase.from("sale_items").select("quantity,unit_price,cost_price,sales!inner(created_at)").gte("sales.created_at", startISO).lte("sales.created_at", endISO),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setSales((s ?? []) as typeof sales); setExpenses((e ?? []) as typeof expenses); setProducts((p ?? []) as typeof products);
    if (st?.currency) setCurrency(st.currency);
    const pr = (si ?? []).reduce((a, it) => a + (Number(it.unit_price) - Number(it.cost_price)) * Number(it.quantity), 0);
    setProfit(pr);
  };
  useEffect(() => { void load(); }, [from, to]);

  const totalSales = sales.reduce((a, s) => a + Number(s.total), 0);
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const inventoryValue = products.reduce((a, p) => a + Number(p.quantity) * Number(p.purchase_price), 0);

  // sales per day chart
  const dayMap = new Map<string, number>();
  for (const s of sales) {
    const k = new Date(s.created_at).toLocaleDateString("ar-EG");
    dayMap.set(k, (dayMap.get(k) ?? 0) + Number(s.total));
  }
  const chartData = Array.from(dayMap, ([day, total]) => ({ day, total })).reverse();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">التقارير</h1>
      <Card><CardContent className="p-4 flex gap-3 items-end flex-wrap">
        <div><Label>من</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>إلى</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <Button onClick={load}>تحديث</Button>
      </CardContent></Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="إجمالي المبيعات" value={formatMoney(totalSales, currency)} />
        <KPI label="الربح" value={formatMoney(profit, currency)} />
        <KPI label="المصروفات" value={formatMoney(totalExpenses, currency)} />
        <KPI label="قيمة المخزون" value={formatMoney(inventoryValue, currency)} />
      </div>

      <Card>
        <CardHeader><CardTitle>المبيعات اليومية</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
              <Bar dataKey="total" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">المبيعات</TabsTrigger>
          <TabsTrigger value="expenses">المصروفات</TabsTrigger>
          <TabsTrigger value="inventory">المخزون</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => exportToExcel(sales.map(s => ({ رقم: s.invoice_number, التاريخ: s.created_at, "طريقة الدفع": s.payment_method, الإجمالي: s.total })), "sales.xlsx")}>
              <Download className="h-4 w-4 ml-2" />تصدير
            </Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>الفاتورة</TableHead><TableHead>التاريخ</TableHead><TableHead>الدفع</TableHead><TableHead>المبلغ</TableHead></TableRow></TableHeader>
              <TableBody>
                {sales.map(s => <TableRow key={s.id}><TableCell>#{s.invoice_number}</TableCell><TableCell>{formatDate(s.created_at)}</TableCell><TableCell>{s.payment_method}</TableCell><TableCell>{formatMoney(Number(s.total), currency)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="expenses">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الفئة</TableHead><TableHead>المبلغ</TableHead></TableRow></TableHeader>
              <TableBody>
                {expenses.map((e, i) => <TableRow key={i}><TableCell>{formatDate(e.created_at)}</TableCell><TableCell>{e.category}</TableCell><TableCell>{formatMoney(Number(e.amount), currency)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="inventory">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الكمية</TableHead><TableHead>سعر الشراء</TableHead><TableHead>القيمة</TableHead></TableRow></TableHeader>
              <TableBody>
                {products.map(p => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.quantity}</TableCell><TableCell>{formatMoney(Number(p.purchase_price), currency)}</TableCell><TableCell>{formatMoney(Number(p.purchase_price) * Number(p.quantity), currency)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (<Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="text-xl font-bold mt-1">{value}</div></CardContent></Card>);
}
