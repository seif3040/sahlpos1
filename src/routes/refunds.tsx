import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";
import { printThermalReceipt } from "@/lib/thermal-receipt";

export const Route = createFileRoute("/refunds")({
  component: () => (
    <RequireAuth>
      <RefundsPage />
    </RequireAuth>
  ),
});

interface SettingsRow {
  shop_name: string;
  shop_phone: string | null;
  shop_address: string | null;
  currency: string;
  tax_percent: number;
  receipt_header: string | null;
  receipt_footer: string | null;
}

interface ItemRow {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  refunded_quantity: number;
}

interface SaleWithItems {
  id: string;
  invoice_number: number;
  created_at: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  is_refunded: boolean;
  sale_items: ItemRow[];
}

interface RefundRow {
  id: string;
  invoice_number: number;
  created_at: string;
  payment_method: string;
  is_refunded: boolean;
  // computed
  refundedQty: number;
  refundedAmount: number;
  netSubtotal: number;
  netDiscount: number;
  netTax: number;
  netTotal: number;
  netItems: { product_name: string; quantity: number; unit_price: number; line_total: number }[];
  rawSubtotal: number;
  rawTotal: number;
}

function computeNet(sale: SaleWithItems): RefundRow {
  const items = sale.sale_items ?? [];
  let refundedQty = 0;
  let refundedAmount = 0;
  const netItems: RefundRow["netItems"] = [];
  for (const it of items) {
    const ref = Number(it.refunded_quantity ?? 0);
    refundedQty += ref;
    refundedAmount += ref * Number(it.unit_price);
    const net = Number(it.quantity) - ref;
    if (net > 0) {
      netItems.push({
        product_name: it.product_name,
        quantity: net,
        unit_price: Number(it.unit_price),
        line_total: net * Number(it.unit_price),
      });
    }
  }
  const netSubtotal = netItems.reduce((a, x) => a + x.line_total, 0);
  const origSub = Number(sale.subtotal) || 1;
  const ratio = netSubtotal / origSub;
  const netDiscount = Number(sale.discount) * ratio;
  const netTax = Number(sale.tax) * ratio;
  const netTotal = Math.max(0, netSubtotal - netDiscount + netTax);
  return {
    id: sale.id,
    invoice_number: Number(sale.invoice_number),
    created_at: sale.created_at,
    payment_method: sale.payment_method,
    is_refunded: sale.is_refunded,
    refundedQty,
    refundedAmount,
    netSubtotal,
    netDiscount,
    netTax,
    netTotal,
    netItems,
    rawSubtotal: Number(sale.subtotal),
    rawTotal: Number(sale.total),
  };
}

const payText = (m: string) =>
  m === "cash" ? "نقدي" : m === "card" ? "بطاقة" : m === "mixed" ? "مختلط" : m === "deferred" ? "آجل" : m;

function RefundsPage() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: sales }, { data: s }] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "id,invoice_number,created_at,payment_method,subtotal,discount,tax,total,is_refunded,sale_items(product_name,quantity,unit_price,line_total,refunded_quantity)",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const all = ((sales ?? []) as unknown as SaleWithItems[]).map(computeNet);
    // Only sales that had at least one refund
    setRows(all.filter((r) => r.refundedQty > 0));
    setSettings(s as SettingsRow);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("refunds-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => String(r.invoice_number).includes(q) || payText(r.payment_method).includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.refunded += r.refundedAmount;
        acc.net += r.netTotal;
        acc.gross += r.rawTotal;
        return acc;
      },
      { refunded: 0, net: 0, gross: 0 },
    );
  }, [filtered]);

  const reprintNet = (r: RefundRow) => {
    if (!settings) return;
    if (r.netItems.length === 0) {
      toast.error("الفاتورة مرتجعة بالكامل - لا يوجد صافي للطباعة");
      return;
    }
    printThermalReceipt(
      {
        invoice_number: r.invoice_number,
        created_at: r.created_at,
        payment_method: r.payment_method,
        items: r.netItems,
        subtotal: r.netSubtotal,
        discount: r.netDiscount,
        tax: r.netTax,
        total: r.netTotal,
      },
      settings,
      "thermal",
    );
  };

  const reprintNetA4 = (r: RefundRow) => {
    if (!settings) return;
    if (r.netItems.length === 0) {
      toast.error("الفاتورة مرتجعة بالكامل - لا يوجد صافي للطباعة");
      return;
    }
    printThermalReceipt(
      {
        invoice_number: r.invoice_number,
        created_at: r.created_at,
        payment_method: r.payment_method,
        items: r.netItems,
        subtotal: r.netSubtotal,
        discount: r.netDiscount,
        tax: r.netTax,
        total: r.netTotal,
      },
      settings,
      "a4",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex-1">سجل المرتجعات</h1>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">إجمالي قيمة المرتجعات</div>
            <div className="text-xl font-bold text-destructive">
              {formatMoney(totals.refunded, settings?.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">صافي بعد المرتجعات</div>
            <div className="text-xl font-bold text-primary">
              {formatMoney(totals.net, settings?.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">إجمالي قبل المرتجعات</div>
            <div className="text-xl font-bold">{formatMoney(totals.gross, settings?.currency)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث برقم الفاتورة أو طريقة الدفع..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">رقم الفاتورة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الدفع</TableHead>
                <TableHead className="text-right">قيمة المرتجع</TableHead>
                <TableHead className="text-right">صافي بعد المرتجع</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    لا يوجد مرتجعات
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold">#{r.invoice_number}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payText(r.payment_method)}</Badge>
                    </TableCell>
                    <TableCell className="text-destructive font-medium">
                      - {formatMoney(r.refundedAmount, settings?.currency)}
                    </TableCell>
                    <TableCell className="text-primary font-bold">
                      {formatMoney(r.netTotal, settings?.currency)}
                    </TableCell>
                    <TableCell>
                      {r.is_refunded || r.netItems.length === 0 ? (
                        <Badge variant="destructive">مرتجعة بالكامل</Badge>
                      ) : (
                        <Badge variant="secondary">مرتجع جزئي</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reprintNet(r)}
                          disabled={r.netItems.length === 0}
                        >
                          <Printer className="h-3 w-3 ml-1" />
                          80mm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reprintNetA4(r)}
                          disabled={r.netItems.length === 0}
                        >
                          <Printer className="h-3 w-3 ml-1" />
                          A4
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
