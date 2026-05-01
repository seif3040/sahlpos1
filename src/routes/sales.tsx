import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Plus, Minus, Printer, Receipt as ReceiptIcon, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/require-auth";
import { BarcodeScannerButton } from "@/components/barcode-scanner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatMoney, formatDate } from "@/lib/format";
import { printThermalReceipt } from "@/lib/thermal-receipt";

export const Route = createFileRoute("/sales")({
  component: () => (
    <RequireAuth>
      <SalesPage />
    </RequireAuth>
  ),
});

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  image_url: string | null;
}

interface CartItem {
  product: Product;
  qty: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface SettingsRow {
  shop_name: string;
  shop_phone: string | null;
  shop_address: string | null;
  currency: string;
  tax_percent: number;
  receipt_header: string | null;
  receipt_footer: string | null;
}

function SalesPage() {
  const { employee } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "deferred">("cash");
  const [customerId, setCustomerId] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);

  const load = async () => {
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setProducts((p ?? []) as Product[]);
    setCustomers(c ?? []);
    setSettings(s as SettingsRow);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("sales-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q),
    );
  }, [products, search]);

  const handleScan = (code: string) => {
    const found = products.find((p) => p.barcode === code);
    if (found) addToCart(found);
    else toast.error("لم يتم العثور على المنتج");
  };

  const addToCart = (p: Product) => {
    if (p.quantity <= 0) {
      toast.error("نفد المنتج من المخزون");
      return;
    }
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === p.id);
      if (ex) {
        if (ex.qty + 1 > p.quantity) {
          toast.error("الكمية تجاوزت المخزون");
          return prev;
        }
        return prev.map((c) => (c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === id ? { ...c, qty: Math.max(0, qty) } : c))
        .filter((c) => c.qty > 0),
    );
  };

  const removeItem = (id: string) =>
    setCart((prev) => prev.filter((c) => c.product.id !== id));

  const subtotal = cart.reduce((a, c) => a + c.product.selling_price * c.qty, 0);
  const discountAmt =
    discountType === "percent" ? (subtotal * discountValue) / 100 : discountValue;
  const taxableAmt = Math.max(0, subtotal - discountAmt);
  const taxAmt = (taxableAmt * (settings?.tax_percent ?? 0)) / 100;
  const total = taxableAmt + taxAmt;

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    if (paymentMethod === "deferred" && !customerId) {
      toast.error("اختر العميل للبيع الآجل");
      return;
    }

    const { data: sale, error } = await supabase
      .from("sales")
      .insert({
        cashier_id: employee?.id,
        customer_id: customerId || null,
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        payment_method: paymentMethod,
      })
      .select("id,invoice_number,created_at")
      .single();
    if (error || !sale) {
      toast.error(error?.message || "فشل الحفظ");
      return;
    }

    const itemsPayload = cart.map((c) => ({
      sale_id: sale.id,
      product_id: c.product.id,
      product_name: c.product.name,
      quantity: c.qty,
      unit_price: c.product.selling_price,
      cost_price: c.product.purchase_price,
      line_total: c.product.selling_price * c.qty,
    }));
    const { error: itemsErr } = await supabase.from("sale_items").insert(itemsPayload);
    if (itemsErr) {
      toast.error("فشل حفظ المنتجات");
      return;
    }

    if (paymentMethod === "deferred" && customerId) {
      await supabase
        .from("customer_debts")
        .insert({ customer_id: customerId, sale_id: sale.id, amount: total });
    }

    toast.success(`تم الحفظ - فاتورة #${sale.invoice_number}`);

    // Print invoice
    if (settings) {
      const customer = customers.find((c) => c.id === customerId);
      printThermalReceipt(
        {
          invoice_number: Number(sale.invoice_number),
          created_at: sale.created_at,
          cashier_name: employee?.name,
          customer_name: customer?.name,
          payment_method: paymentMethod,
          items: cart.map((c) => ({
            product_name: c.product.name,
            quantity: c.qty,
            unit_price: c.product.selling_price,
            line_total: c.product.selling_price * c.qty,
          })),
          subtotal,
          discount: discountAmt,
          tax: taxAmt,
          total,
        },
        settings,
      );
    }

    setCart([]);
    setDiscountValue(0);
    setCustomerId("");
    setPaymentMethod("cash");
    void load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 h-[calc(100vh-8rem)]">
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-2xl font-bold flex-1">المبيعات</h1>
          <Button variant="outline" onClick={() => { setHistoryOpen(true); void loadRecent(setRecentSales); }}>
            <History className="h-4 w-4 ml-2" />
            الفواتير
          </Button>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <BarcodeScannerButton onDetect={handleScan} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              لا توجد منتجات. أضف منتجات من صفحة المنتجات.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-right rounded-xl border bg-card p-3 hover:border-primary hover:shadow-md transition-all group"
                >
                  <div className="aspect-square rounded-lg bg-muted mb-2 overflow-hidden flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ReceiptIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="font-medium text-sm line-clamp-2 min-h-[2.5em]">{p.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant={p.quantity > 0 ? "secondary" : "destructive"}>
                      {p.quantity}
                    </Badge>
                    <div className="font-bold text-primary text-sm">
                      {formatMoney(p.selling_price, settings?.currency)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card className="flex flex-col min-h-0">
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          <h2 className="font-bold mb-3">السلة ({cart.length})</h2>
          <div className="flex-1 overflow-y-auto space-y-2 mb-3">
            {cart.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                السلة فارغة
              </div>
            ) : (
              cart.map((c) => (
                <div key={c.product.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(c.product.selling_price, settings?.currency)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setQty(c.product.id, c.qty - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      value={c.qty}
                      onChange={(e) => setQty(c.product.id, Number(e.target.value) || 0)}
                      className="h-7 w-12 text-center px-1"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setQty(c.product.id, c.qty + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeItem(c.product.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">نوع الخصم</Label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">نسبة %</SelectItem>
                    <SelectItem value="fixed">قيمة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">قيمة الخصم</Label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cash" | "card" | "deferred")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="deferred">آجل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "deferred" && (
              <div>
                <Label className="text-xs">العميل</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العميل" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1 text-sm">
              <Row label="الفرعي" value={formatMoney(subtotal, settings?.currency)} />
              <Row label="الخصم" value={`- ${formatMoney(discountAmt, settings?.currency)}`} />
              <Row
                label={`ضريبة (${settings?.tax_percent ?? 0}%)`}
                value={formatMoney(taxAmt, settings?.currency)}
              />
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>المجموع</span>
                <span className="text-primary">{formatMoney(total, settings?.currency)}</span>
              </div>
            </div>

            <Button className="w-full h-12 text-base" onClick={checkout}>
              <Printer className="h-4 w-4 ml-2" />
              إتمام البيع وطباعة
            </Button>
          </div>
        </CardContent>
      </Card>

      <RecentSalesDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        sales={recentSales}
        settings={settings}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

interface RecentSale {
  id: string;
  invoice_number: number;
  total: number;
  payment_method: string;
  created_at: string;
  is_refunded: boolean;
}

async function loadRecent(setter: (v: RecentSale[]) => void) {
  const { data } = await supabase
    .from("sales")
    .select("id,invoice_number,total,payment_method,created_at,is_refunded")
    .order("created_at", { ascending: false })
    .limit(50);
  setter((data ?? []) as RecentSale[]);
}

function RecentSalesDialog({
  open,
  onOpenChange,
  sales,
  settings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sales: RecentSale[];
  settings: SettingsRow | null;
}) {
  const reprint = async (id: string) => {
    if (!settings) return;
    const { data: sale } = await supabase
      .from("sales")
      .select(
        "invoice_number,created_at,payment_method,subtotal,discount,tax,total,sale_items(product_name,quantity,unit_price,line_total)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!sale) return;
    printThermalReceipt(
      {
        invoice_number: Number(sale.invoice_number),
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        items: (sale.sale_items ?? []) as { product_name: string; quantity: number; unit_price: number; line_total: number }[],
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        total: Number(sale.total),
      },
      settings,
    );
  };

  const refund = async (id: string) => {
    if (!confirm("هل تريد استرجاع هذه الفاتورة؟ سيتم إعادة المنتجات للمخزون.")) return;
    const { data: items } = await supabase
      .from("sale_items")
      .select("product_id,quantity")
      .eq("sale_id", id);
    for (const it of items ?? []) {
      if (it.product_id) {
        const { data: p } = await supabase
          .from("products")
          .select("quantity")
          .eq("id", it.product_id)
          .maybeSingle();
        if (p) {
          await supabase
            .from("products")
            .update({ quantity: Number(p.quantity) + Number(it.quantity) })
            .eq("id", it.product_id);
        }
      }
    }
    await supabase.from("sales").update({ is_refunded: true }).eq("id", id);
    toast.success("تم الاسترجاع");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>آخر الفواتير</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 border rounded-lg flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold">#{s.invoice_number}</div>
                <div className="text-xs text-muted-foreground">{formatDate(s.created_at)}</div>
              </div>
              <Badge variant="outline">{s.payment_method}</Badge>
              {s.is_refunded && <Badge variant="destructive">مسترجعة</Badge>}
              <div className="font-bold text-primary">
                {formatMoney(Number(s.total), settings?.currency)}
              </div>
              <Button size="sm" variant="outline" onClick={() => reprint(s.id)}>
                طباعة
              </Button>
              {!s.is_refunded && (
                <Button size="sm" variant="destructive" onClick={() => refund(s.id)}>
                  استرجاع
                </Button>
              )}
            </div>
          ))}
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
