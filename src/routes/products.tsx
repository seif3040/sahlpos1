import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, Download, AlertTriangle, Image as ImageIcon, Barcode } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/format";
import { exportToExcel, readExcel } from "@/lib/excel";

export const Route = createFileRoute("/products")({
  component: () => (
    <RequireAuth level={2}>
      <ProductsPage />
    </RequireAuth>
  ),
});

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  min_quantity: number;
  image_url: string | null;
  expiry_date: string | null;
  is_low_stock: boolean;
}

const blank: Omit<Product, "id" | "is_low_stock"> = {
  name: "",
  barcode: "",
  category_id: null,
  purchase_price: 0,
  selling_price: 0,
  quantity: 0,
  min_quantity: 0,
  image_url: null,
  expiry_date: null,
};

function ProductsPage() {
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [currency, setCurrency] = useState("ج.م");
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
    ]);
    setProducts((p ?? []) as Product[]);
    setCategories(c ?? []);
    if (s?.currency) setCurrency(s.currency);
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...blank });
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      barcode: p.barcode ?? "",
      category_id: p.category_id,
      purchase_price: Number(p.purchase_price),
      selling_price: Number(p.selling_price),
      quantity: Number(p.quantity),
      min_quantity: Number(p.min_quantity),
      image_url: p.image_url,
      expiry_date: p.expiry_date,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    const payload = {
      ...form,
      barcode: form.barcode?.toString().trim() || null,
      category_id: form.category_id || null,
      expiry_date: form.expiry_date || null,
    };
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("تم الحفظ");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("تم الإضافة");
    }
    setOpen(false);
    void load();
  };

  const del = async (id: string) => {
    if (!confirm("هل تريد حذف هذا المنتج؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    void load();
  };

  const uploadImage = async (file: File) => {
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("products").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    toast.success("تم رفع الصورة");
  };

  const exportProducts = () => {
    exportToExcel(
      products.map((p) => ({
        الاسم: p.name,
        الباركود: p.barcode ?? "",
        "سعر الشراء": p.purchase_price,
        "سعر البيع": p.selling_price,
        الكمية: p.quantity,
        "الحد الأدنى": p.min_quantity,
      })),
      "products.xlsx",
      "المنتجات",
    );
  };

  const importProducts = async (file: File) => {
    try {
      const rows = await readExcel<Record<string, unknown>>(file);
      const payload = rows
        .filter((r) => r["الاسم"] || r["name"])
        .map((r) => ({
          name: String(r["الاسم"] ?? r["name"] ?? "").trim(),
          barcode: r["الباركود"] || r["barcode"] ? String(r["الباركود"] ?? r["barcode"]) : null,
          purchase_price: Number(r["سعر الشراء"] ?? r["purchase_price"] ?? 0),
          selling_price: Number(r["سعر البيع"] ?? r["selling_price"] ?? 0),
          quantity: Number(r["الكمية"] ?? r["quantity"] ?? 0),
          min_quantity: Number(r["الحد الأدنى"] ?? r["min_quantity"] ?? 0),
        }));
      if (payload.length === 0) return toast.error("لا توجد بيانات");
      const { error } = await supabase.from("products").insert(payload);
      if (error) return toast.error(error.message);
      toast.success(`تم استيراد ${payload.length} منتج`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستيراد");
    }
  };

  const filtered = products.filter(
    (p) =>
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? "").includes(search),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المنتجات والمخزون</h1>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importProducts(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="h-4 w-4 ml-2" />
            استيراد
          </Button>
          <Button variant="outline" onClick={exportProducts}>
            <Download className="h-4 w-4 ml-2" />
            تصدير
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 ml-2" />
            منتج جديد
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="products">المنتجات</TabsTrigger>
          <TabsTrigger value="categories">الأقسام</TabsTrigger>
          <TabsTrigger value="low">منخفض المخزون</TabsTrigger>
          <TabsTrigger value="audit">جرد</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-3">
          <Input
            placeholder="ابحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الباركود</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>الحد الأدنى</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        لا توجد منتجات
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span>{p.name}</span>
                            {p.is_low_stock && (
                              <Badge variant="destructive" className="text-xs">منخفض</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.barcode ?? "-"}</TableCell>
                        <TableCell>{formatMoney(p.selling_price, currency)}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>{p.min_quantity}</TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-1 justify-end">
                            {p.barcode && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => printBarcode(p.barcode!, p.name)}
                              >
                                <Barcode className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => del(p.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab categories={categories} reload={load} />
        </TabsContent>

        <TabsContent value="low">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                {products.filter((p) => p.is_low_stock).length === 0 ? (
                  <div className="text-center text-muted-foreground py-10">
                    لا توجد تنبيهات
                  </div>
                ) : (
                  products
                    .filter((p) => p.is_low_stock)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-destructive/5 border-destructive/20"
                      >
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div className="flex-1">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            الكمية: {p.quantity} / الحد الأدنى: {p.min_quantity}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab products={products} reload={load} />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل المنتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>الاسم</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>الباركود</Label>
              <Input
                value={form.barcode ?? ""}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
            <div>
              <Label>القسم</Label>
              <Select
                value={form.category_id ?? "none"}
                onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>سعر الشراء</Label>
              <Input
                type="number"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>سعر البيع</Label>
              <Input
                type="number"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>الكمية</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>الحد الأدنى</Label>
              <Input
                type="number"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>تاريخ الانتهاء</Label>
              <Input
                type="date"
                value={form.expiry_date ?? ""}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value || null })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>الصورة</Label>
              <div className="flex items-center gap-2">
                {form.image_url && (
                  <img src={form.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  رفع صورة
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoriesTab({ categories, reload }: { categories: Category[]; reload: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    void reload();
  };
  const save = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("categories").update({ name: editName.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    void reload();
  };
  const del = async (id: string) => {
    if (!confirm("حذف القسم؟ لن يتم حذف المنتجات لكن ستفقد التصنيف.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void reload();
  };
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="اسم القسم" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="h-4 w-4 ml-2" />إضافة</Button>
        </div>
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">لا توجد أقسام</div>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                {editingId === c.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                    <Button size="sm" onClick={() => save(c.id)}>حفظ</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>إلغاء</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{c.name}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTab({ products, reload }: { products: Product[]; reload: () => Promise<void> }) {
  const [counts, setCounts] = useState<Record<string, string>>({});

  const apply = async (id: string) => {
    const v = Number(counts[id]);
    if (!Number.isFinite(v)) return;
    const { error } = await supabase.from("products").update({ quantity: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم التحديث");
    setCounts((c) => ({ ...c, [id]: "" }));
    void reload();
  };

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>المسجل</TableHead>
              <TableHead>الفعلي</TableHead>
              <TableHead>الفرق</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const v = counts[p.id] ?? "";
              const diff = v === "" ? null : Number(v) - Number(p.quantity);
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={v}
                      onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    {diff === null ? (
                      "-"
                    ) : (
                      <Badge variant={diff === 0 ? "secondary" : diff > 0 ? "default" : "destructive"}>
                        {diff > 0 ? `+${diff}` : diff}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" disabled={v === ""} onClick={() => apply(p.id)}>
                      تحديث
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function printBarcode(code: string, name: string) {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, code, { format: "CODE128", displayValue: true });
  } catch {
    toast.error("باركود غير صالح");
    return;
  }
  const dataUrl = canvas.toDataURL("image/png");
  const w = window.open("", "_blank", "width=400,height=300");
  if (!w) return;
  w.document.write(
    `<html dir="rtl"><body style="text-align:center;font-family:sans-serif"><h3>${name}</h3><img src="${dataUrl}"/><script>window.print();</script></body></html>`,
  );
  w.document.close();
}
