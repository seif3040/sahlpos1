import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";

export const Route = createFileRoute("/purchases")({
  component: () => (
    <RequireAuth level={2}>
      <PurchasesPage />
    </RequireAuth>
  ),
});

interface Product { id: string; name: string; purchase_price: number }
interface Supplier { id: string; name: string }
interface Purchase { id: string; total: number; created_at: string; suppliers: { name: string } | null }

function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<{ product_id: string; quantity: number; unit_cost: number }[]>([]);
  const [currency, setCurrency] = useState("ج.م");

  const load = async () => {
    const [{ data: pu }, { data: pr }, { data: su }, { data: s }] = await Promise.all([
      supabase.from("purchases").select("id,total,created_at,suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("products").select("id,name,purchase_price").order("name"),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setPurchases((pu ?? []) as unknown as Purchase[]);
    setProducts(pr ?? []);
    setSuppliers(su ?? []);
    if (s?.currency) setCurrency(s.currency);
  };
  useEffect(() => { void load(); }, []);

  const addRow = () => setItems([...items, { product_id: "", quantity: 1, unit_cost: 0 }]);
  const total = items.reduce((a, i) => a + i.quantity * i.unit_cost, 0);

  const save = async () => {
    if (items.length === 0) return toast.error("أضف منتجات");
    const { data: pu, error } = await supabase.from("purchases").insert({ supplier_id: supplierId || null, total }).select("id").single();
    if (error || !pu) return toast.error(error?.message || "فشل");
    const payload = items.filter(i => i.product_id).map(i => ({
      purchase_id: pu.id, product_id: i.product_id, quantity: i.quantity,
      unit_cost: i.unit_cost, line_total: i.quantity * i.unit_cost,
    }));
    if (payload.length) await supabase.from("purchase_items").insert(payload);
    toast.success("تم حفظ فاتورة الشراء");
    setOpen(false); setItems([]); setSupplierId(""); void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المشتريات</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 ml-2" />فاتورة شراء</Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>التاريخ</TableHead><TableHead>المورد</TableHead><TableHead>الإجمالي</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {purchases.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">لا توجد فواتير شراء</TableCell></TableRow> :
            purchases.map(p => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.created_at)}</TableCell>
                <TableCell>{p.suppliers?.name ?? "-"}</TableCell>
                <TableCell className="font-bold">{formatMoney(Number(p.total), currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>فاتورة شراء جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>المورد</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <Select value={it.product_id} onValueChange={v => {
                      const prod = products.find(p => p.id === v);
                      setItems(items.map((x, i) => i === idx ? { ...x, product_id: v, unit_cost: prod?.purchase_price || x.unit_cost } : x));
                    }}>
                      <SelectTrigger><SelectValue placeholder="المنتج" /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input type="number" placeholder="كمية" value={it.quantity} onChange={e => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x))} /></div>
                  <div className="col-span-3"><Input type="number" placeholder="سعر الوحدة" value={it.unit_cost} onChange={e => setItems(items.map((x, i) => i === idx ? { ...x, unit_cost: Number(e.target.value) || 0 } : x))} /></div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={addRow}><Plus className="h-4 w-4 ml-2" />إضافة منتج</Button>
            </div>
            <div className="text-lg font-bold text-left">الإجمالي: {formatMoney(total, currency)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
