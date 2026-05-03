import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Sparkles, Upload, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import { exportToExcel, exportMultiSheet, readExcelAllSheets } from "@/lib/excel";

export const Route = createFileRoute("/reports")({
  component: () => (<RequireAuth level={2}><ReportsPage /></RequireAuth>),
});

interface SaleRow { id: string; invoice_number: number; total: number; created_at: string; payment_method: string; is_refunded: boolean; cash_part: number; card_part: number; refund_total?: number }
interface ExpenseRow { category: string; amount: number; created_at: string }
interface ProductRow { id: string; name: string; quantity: number; purchase_price: number; selling_price: number; barcode?: string | null; min_quantity?: number; category_id?: string | null }

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [currency, setCurrency] = useState("ج.م");
  const [profit, setProfit] = useState(0);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [debts, setDebts] = useState<{ remaining: number }[]>([]);

  // AI dialog
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const startISO = new Date(from).toISOString();
    const endISO = new Date(to + "T23:59:59").toISOString();
    const [{ data: s }, { data: e }, { data: p }, { data: si }, { data: st }, { data: d }] = await Promise.all([
      supabase.from("sales").select("id,invoice_number,total,created_at,payment_method,is_refunded,cash_part,card_part").gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }),
      supabase.from("expenses").select("category,amount,created_at").gte("created_at", startISO).lte("created_at", endISO),
      supabase.from("products").select("id,name,quantity,purchase_price,selling_price,barcode,min_quantity,category_id"),
      supabase.from("sale_items").select("sale_id,product_name,quantity,unit_price,cost_price,refunded_quantity,sales!inner(created_at)").gte("sales.created_at", startISO).lte("sales.created_at", endISO),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
      supabase.from("customer_debts").select("remaining").eq("is_settled", false),
    ]);

    // compute refund total per sale
    const refundMap = new Map<string, number>();
    let pr = 0;
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    for (const it of (si ?? []) as { sale_id: string; product_name: string; quantity: number; unit_price: number; cost_price: number; refunded_quantity: number }[]) {
      const netQty = Number(it.quantity) - Number(it.refunded_quantity ?? 0);
      pr += (Number(it.unit_price) - Number(it.cost_price)) * netQty;
      const cur = prodMap.get(it.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += netQty;
      cur.revenue += Number(it.unit_price) * netQty;
      prodMap.set(it.product_name, cur);
      if (it.refunded_quantity > 0) {
        refundMap.set(it.sale_id, (refundMap.get(it.sale_id) ?? 0) + Number(it.refunded_quantity) * Number(it.unit_price));
      }
    }
    const salesEnriched = (s ?? []).map((row) => ({ ...row, refund_total: refundMap.get(row.id) ?? 0 })) as SaleRow[];
    setSales(salesEnriched);
    setExpenses((e ?? []) as ExpenseRow[]);
    setProducts((p ?? []) as ProductRow[]);
    setDebts((d ?? []) as { remaining: number }[]);
    if (st?.currency) setCurrency(st.currency);
    setProfit(pr);
    setTopProducts(Array.from(prodMap, ([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 10));
  };
  useEffect(() => { void load(); }, [from, to]);

  // gross = original sale total (always counted), refunds = refunded amounts (item-level),
  // a fully refunded sale has refund_total === total so net = 0. No double counting.
  const totalSales = sales.reduce((a, s) => a + Number(s.total), 0);
  const totalRefunds = sales.reduce((a, s) => a + Number(s.refund_total ?? 0), 0);
  const netSales = totalSales - totalRefunds;
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const inventoryValue = products.reduce((a, p) => a + Number(p.quantity) * Number(p.purchase_price), 0);
  const outstandingDebts = debts.reduce((a, d) => a + Number(d.remaining), 0);

  const dayMap = new Map<string, number>();
  for (const s of sales) {
    const k = new Date(s.created_at).toLocaleDateString("ar-EG");
    const net = Number(s.total) - Number(s.refund_total ?? 0);
    if (net === 0 && !s.refund_total) {
      // skip nothing
    }
    dayMap.set(k, (dayMap.get(k) ?? 0) + net);
  }
  const chartData = Array.from(dayMap, ([day, total]) => ({ day, total })).reverse();

  // daily breakdown by payment method (gross per method, refunds & net separately)
  type PMRow = { day: string; cash: number; card: number; mixed: number; deferred: number; gross: number; refunds: number; net: number };
  const pmDayMap = new Map<string, PMRow>();
  for (const s of sales) {
    const k = new Date(s.created_at).toLocaleDateString("ar-EG");
    const row = pmDayMap.get(k) ?? { day: k, cash: 0, card: 0, mixed: 0, deferred: 0, gross: 0, refunds: 0, net: 0 };
    const gross = Number(s.total);
    const refunds = Number(s.refund_total ?? 0);
    row.gross += gross;
    row.refunds += refunds;
    row.net += gross - refunds;
    const m = s.payment_method as keyof PMRow;
    if (m === "cash" || m === "card" || m === "mixed" || m === "deferred") row[m] += gross;
    pmDayMap.set(k, row);
  }
  const pmDaily = Array.from(pmDayMap.values()).sort((a, b) => a.day.localeCompare(b.day));

  // -------- AI analysis --------
  const runAi = async () => {
    setAiOpen(true);
    setAiLoading(true);
    setAiText("");
    try {
      const paymentBreakdown: Record<string, number> = {};
      for (const s of sales) paymentBreakdown[s.payment_method] = (paymentBreakdown[s.payment_method] ?? 0) + Number(s.total);
      const expenseByCategory: Record<string, number> = {};
      for (const e of expenses) expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount);
      const lowStock = products.filter(p => Number(p.quantity) <= Number(p.min_quantity ?? 0)).map(p => ({ name: p.name, qty: p.quantity }));

      const summary = {
        period: { from, to, days: chartData.length },
        currency,
        totals: {
          sales: totalSales,
          profit,
          expenses: totalExpenses,
          net_profit: profit - totalExpenses,
          inventory_value: inventoryValue,
          outstanding_debts: outstandingDebts,
          invoices_count: sales.length,
          avg_invoice: sales.length ? totalSales / sales.length : 0,
        },
        sales_by_day: chartData,
        top_products: topProducts,
        payment_methods: paymentBreakdown,
        expenses_by_category: expenseByCategory,
        low_stock_products: lowStock.slice(0, 20),
        products_count: products.length,
      };

      const { data, error } = await supabase.functions.invoke("ai-analyze", { body: { summary } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiText(data?.analysis ?? "لا يوجد ناتج");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التحليل";
      setAiText("❌ " + msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  // -------- Full Excel export --------
  const exportAll = () => {
    exportMultiSheet([
      { name: "ملخص", rows: [{
        "الفترة من": from, "إلى": to,
        "إجمالي المبيعات": totalSales, "الربح": profit,
        "المصروفات": totalExpenses, "صافي الربح": profit - totalExpenses,
        "قيمة المخزون": inventoryValue, "الديون المستحقة": outstandingDebts,
        "عدد الفواتير": sales.length,
      }]},
      { name: "المبيعات", rows: sales.map(s => ({ "رقم الفاتورة": s.invoice_number, "التاريخ": s.created_at, "طريقة الدفع": s.payment_method, "الإجمالي": s.total })) },
      { name: "المنتجات", rows: products.map(p => ({ "الاسم": p.name, "الباركود": p.barcode ?? "", "الكمية": p.quantity, "الحد الأدنى": p.min_quantity ?? 0, "سعر الشراء": p.purchase_price, "سعر البيع": p.selling_price })) },
      { name: "المصروفات", rows: expenses.map(e => ({ "التاريخ": e.created_at, "الفئة": e.category, "المبلغ": e.amount })) },
      { name: "الأكثر مبيعاً", rows: topProducts.map(t => ({ "المنتج": t.name, "الكمية المباعة": t.qty, "الإيراد": t.revenue })) },
    ], `report-${from}-to-${to}.xlsx`);
    toast.success("تم تصدير التقرير الكامل");
  };

  // -------- Excel import (products) --------
  const downloadTemplate = () => {
    exportToExcel([
      { name: "مثال منتج", barcode: "1234567890", quantity: 10, min_quantity: 2, purchase_price: 50, selling_price: 80, category: "" },
    ], "products-template.xlsx", "products");
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const sheets = await readExcelAllSheets(file);
      // accept first sheet or sheet named products / المنتجات
      const key = Object.keys(sheets).find(k => /product|منتج/i.test(k)) ?? Object.keys(sheets)[0];
      const rows = sheets[key] ?? [];
      if (!rows.length) throw new Error("الملف فارغ");

      // categories cache
      const { data: cats } = await supabase.from("categories").select("id,name");
      const catMap = new Map((cats ?? []).map(c => [c.name.trim(), c.id]));

      let inserted = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const r of rows) {
        try {
          const row = r as Record<string, unknown>;
          const name = String(row.name ?? row["الاسم"] ?? "").trim();
          if (!name) { failed++; continue; }
          const barcode = row.barcode ?? row["الباركود"] ?? null;
          const quantity = Number(row.quantity ?? row["الكمية"] ?? 0);
          const min_quantity = Number(row.min_quantity ?? row["الحد الأدنى"] ?? 0);
          const purchase_price = Number(row.purchase_price ?? row["سعر الشراء"] ?? 0);
          const selling_price = Number(row.selling_price ?? row["سعر البيع"] ?? 0);
          const catName = String(row.category ?? row["الفئة"] ?? "").trim();
          let category_id: string | null = null;
          if (catName) {
            if (catMap.has(catName)) {
              category_id = catMap.get(catName) ?? null;
            } else {
              const { data: nc } = await supabase.from("categories").insert({ name: catName }).select("id").maybeSingle();
              if (nc) { category_id = nc.id; catMap.set(catName, nc.id); }
            }
          }

          const payload = {
            name,
            barcode: barcode ? String(barcode) : null,
            quantity, min_quantity, purchase_price, selling_price,
            category_id,
          };

          // upsert by barcode if provided, else by name
          const { data: existing } = await supabase.from("products")
            .select("id")
            .or(barcode ? `barcode.eq.${String(barcode)}` : `name.eq.${name}`)
            .limit(1);
          if (existing && existing.length > 0) {
            const { error } = await supabase.from("products").update(payload).eq("id", existing[0].id);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await supabase.from("products").insert(payload);
            if (error) throw error;
            inserted++;
          }
        } catch (err) {
          failed++;
          if (errors.length < 5) errors.push(err instanceof Error ? err.message : "خطأ");
        }
      }

      toast.success(`تم: ${inserted} جديد · ${updated} تحديث · ${failed} فشل`);
      if (errors.length) console.warn("import errors:", errors);
      setImportOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستيراد");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={runAi} className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground">
            <Sparkles className="h-4 w-4 ml-2" />تحليل AI
          </Button>
          <Button variant="outline" onClick={exportAll}>
            <Download className="h-4 w-4 ml-2" />تصدير شامل (Excel)
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 ml-2" />استيراد منتجات (Excel)
          </Button>
        </div>
      </div>

      <Card><CardContent className="p-4 flex gap-3 items-end flex-wrap">
        <div><Label>من</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>إلى</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <Button onClick={load}>تحديث</Button>
      </CardContent></Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="إجمالي المبيعات (إجمالي)" value={formatMoney(totalSales, currency)} />
        <KPI label="صافي بعد المرتجعات" value={formatMoney(netSales, currency)} />
        <KPI label="إجمالي المرتجعات" value={formatMoney(totalRefunds, currency)} />
        <KPI label="الربح الصافي" value={formatMoney(profit, currency)} />
        <KPI label="المصروفات" value={formatMoney(totalExpenses, currency)} />
        <KPI label="قيمة المخزون" value={formatMoney(inventoryValue, currency)} />
        <KPI label="الديون المستحقة" value={formatMoney(outstandingDebts, currency)} />
        <KPI label="عدد الفواتير" value={String(sales.length)} />
      </div>

      <Card>
        <CardHeader><CardTitle>المبيعات اليومية (الصافي)</CardTitle></CardHeader>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>تقرير المبيعات اليومي حسب طريقة الدفع</CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(
            pmDaily.map(r => ({
              "اليوم": r.day,
              "كاش": r.cash, "كارت": r.card, "مختلط": r.mixed, "آجل": r.deferred,
              "الإجمالي": r.gross, "المرتجعات": r.refunds, "الصافي": r.net,
            })), "daily-by-payment.xlsx", "daily")}>
            <Download className="h-4 w-4 ml-2" />تصدير
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>اليوم</TableHead>
              <TableHead>كاش</TableHead>
              <TableHead>كارت</TableHead>
              <TableHead>مختلط</TableHead>
              <TableHead>آجل</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>المرتجعات</TableHead>
              <TableHead>الصافي</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pmDaily.map(r => (
                <TableRow key={r.day}>
                  <TableCell>{r.day}</TableCell>
                  <TableCell>{formatMoney(r.cash, currency)}</TableCell>
                  <TableCell>{formatMoney(r.card, currency)}</TableCell>
                  <TableCell>{formatMoney(r.mixed, currency)}</TableCell>
                  <TableCell>{formatMoney(r.deferred, currency)}</TableCell>
                  <TableCell>{formatMoney(r.gross, currency)}</TableCell>
                  <TableCell className="text-destructive">- {formatMoney(r.refunds, currency)}</TableCell>
                  <TableCell className="font-bold text-primary">{formatMoney(r.net, currency)}</TableCell>
                </TableRow>
              ))}
              {pmDaily.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">لا توجد بيانات في الفترة المحددة</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
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

      {/* AI dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />تحليل ذكي للبيانات</DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <div>جاري تحليل بيانات متجرك...</div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4">
              <ReactMarkdown>{aiText}</ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>استيراد منتجات من Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              الأعمدة المدعومة: <code>name</code> أو الاسم، <code>barcode</code>، <code>quantity</code>،
              <code>min_quantity</code>، <code>purchase_price</code>، <code>selling_price</code>، <code>category</code>.
              المنتجات الموجودة بنفس الباركود/الاسم سيتم تحديثها.
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 ml-2" />تحميل قالب جاهز
            </Button>
            <div>
              <Label>اختر الملف</Label>
              <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" disabled={importing}
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleImport(f); }} />
            </div>
            {importing && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جاري الاستيراد...</div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (<Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="text-xl font-bold mt-1">{value}</div></CardContent></Card>);
}
