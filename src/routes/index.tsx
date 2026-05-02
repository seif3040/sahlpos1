import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Banknote,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Truck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, todayBounds } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

interface Stats {
  todaySales: number;
  todayProfit: number;
  todayInvoices: number;
  outstandingDebts: number;
  lowStockCount: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    todaySales: 0,
    todayProfit: 0,
    todayInvoices: 0,
    outstandingDebts: 0,
    lowStockCount: 0,
  });
  const [salesByDay, setSalesByDay] = useState<{ day: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [currency, setCurrency] = useState("ج.م");

  const load = async () => {
    const { startISO, endISO } = todayBounds();

    const [{ data: settings }, { data: salesToday }, { data: items7 }, { data: debts }, { data: lowStock }] =
      await Promise.all([
        supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
        supabase
          .from("sales")
          .select("id,total,created_at,is_refunded,sale_items(quantity,refunded_quantity,unit_price,cost_price,product_name)")
          .eq("is_refunded", false)
          .gte("created_at", startISO)
          .lte("created_at", endISO),
        supabase
          .from("sales")
          .select("created_at,total,is_refunded,sale_items(product_name,quantity,refunded_quantity,unit_price)")
          .eq("is_refunded", false)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
        supabase.from("customer_debts").select("remaining").eq("is_settled", false),
        supabase.from("products").select("id").eq("is_low_stock", true),
      ]);

    if (settings?.currency) setCurrency(settings.currency);

    let sumSales = 0;
    let sumProfit = 0;
    for (const s of salesToday ?? []) {
      sumSales += Number(s.total);
      for (const it of (s as { sale_items?: { quantity: number; unit_price: number; cost_price: number }[] }).sale_items ?? []) {
        sumProfit += (Number(it.unit_price) - Number(it.cost_price)) * Number(it.quantity);
      }
    }
    const debtsSum = (debts ?? []).reduce((a, d) => a + Number(d.remaining), 0);

    setStats({
      todaySales: sumSales,
      todayProfit: sumProfit,
      todayInvoices: salesToday?.length ?? 0,
      outstandingDebts: debtsSum,
      lowStockCount: lowStock?.length ?? 0,
    });

    // last 7 days bar
    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("ar-EG", { weekday: "short" });
      dayMap.set(key, 0);
    }
    for (const s of items7 ?? []) {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString("ar-EG", { weekday: "short" });
      dayMap.set(key, (dayMap.get(key) ?? 0) + Number(s.total));
    }
    setSalesByDay(Array.from(dayMap, ([day, total]) => ({ day, total })));

    // top products
    const prodMap = new Map<string, number>();
    for (const s of items7 ?? []) {
      for (const it of (s as { sale_items?: { product_name: string; quantity: number }[] }).sale_items ?? []) {
        prodMap.set(it.product_name, (prodMap.get(it.product_name) ?? 0) + Number(it.quantity));
      }
    }
    const top = Array.from(prodMap, ([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    setTopProducts(top);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">الرئيسية</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/sales">
              <ShoppingCart className="h-4 w-4 ml-2" />
              بيع جديد
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/products">
              <Plus className="h-4 w-4 ml-2" />
              منتج جديد
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/purchases">
              <Truck className="h-4 w-4 ml-2" />
              شراء
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="مبيعات اليوم"
          value={formatMoney(stats.todaySales, currency)}
          icon={Banknote}
          tone="primary"
        />
        <KpiCard
          title="ربح اليوم"
          value={formatMoney(stats.todayProfit, currency)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          title="فواتير اليوم"
          value={String(stats.todayInvoices)}
          icon={Receipt}
          tone="primary"
        />
        <KpiCard
          title="ديون مستحقة"
          value={formatMoney(stats.outstandingDebts, currency)}
          icon={AlertTriangle}
          tone="warning"
          badge={stats.lowStockCount > 0 ? `${stats.lowStockCount} منتج منخفض` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>مبيعات آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={(v) => formatMoney(Number(v), currency)}
                />
                <Bar dataKey="total" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الأكثر مبيعاً</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {topProducts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                لا توجد بيانات بعد
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProducts}
                    dataKey="qty"
                    nameKey="name"
                    outerRadius={80}
                    label={(e: { name?: string }) => e.name ?? ""}
                  >
                    {topProducts.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  badge,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning";
  badge?: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-primary/10 text-primary";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-xl md:text-2xl font-bold mt-1">{value}</div>
            {badge && (
              <Badge variant="destructive" className="mt-2">
                {badge}
              </Badge>
            )}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
