import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabel } from "@/lib/format";
import { createEmployee, deactivateEmployee, updateEmployeePin } from "@/server/bootstrap.functions";

export const Route = createFileRoute("/settings")({
  component: () => (<RequireAuth level={3}><SettingsPage /></RequireAuth>),
});

interface Employee { id: string; name: string; role: string; pin: string; active: boolean }

function SettingsPage() {
  const [shop, setShop] = useState({ shop_name: "", shop_phone: "", shop_address: "", currency: "ج.م", tax_percent: 14, receipt_header: "", receipt_footer: "", logo_url: "" as string | null });
  const [emps, setEmps] = useState<Employee[]>([]);
  const [newEmp, setNewEmp] = useState({ name: "", pin: "", role: "cashier" as "owner" | "manager" | "cashier" });
  const [pinDialog, setPinDialog] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("employees").select("id,name,role,pin,active").eq("active", true).order("name"),
    ]);
    if (s) setShop({
      shop_name: s.shop_name, shop_phone: s.shop_phone ?? "", shop_address: s.shop_address ?? "",
      currency: s.currency, tax_percent: Number(s.tax_percent),
      receipt_header: s.receipt_header ?? "", receipt_footer: s.receipt_footer ?? "", logo_url: s.logo_url,
    });
    setEmps((e ?? []) as Employee[]);
  };
  useEffect(() => { void load(); }, []);

  const saveShop = async () => {
    const { error } = await supabase.from("settings").update({
      shop_name: shop.shop_name, shop_phone: shop.shop_phone || null, shop_address: shop.shop_address || null,
      currency: shop.currency, tax_percent: shop.tax_percent,
      receipt_header: shop.receipt_header || null, receipt_footer: shop.receipt_footer || null, logo_url: shop.logo_url,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
  };

  const uploadLogo = async (file: File) => {
    const path = `logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("shop").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("shop").getPublicUrl(path);
    setShop({ ...shop, logo_url: data.publicUrl });
    toast.success("تم رفع الشعار");
  };

  const addEmp = async () => {
    try {
      await createEmployee({ data: newEmp });
      toast.success("تم إضافة الموظف"); setNewEmp({ name: "", pin: "", role: "cashier" }); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  };
  const removeEmp = async (id: string) => {
    if (!confirm("إلغاء تنشيط الموظف؟")) return;
    try { await deactivateEmployee({ data: { employeeId: id } }); void load(); } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  };
  const changePin = async () => {
    if (!pinDialog) return;
    try {
      await updateEmployeePin({ data: { employeeId: pinDialog.id, pin: newPin } });
      toast.success("تم تغيير الرقم السري"); setPinDialog(null); setNewPin(""); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">المحل</TabsTrigger>
          <TabsTrigger value="employees">الموظفون</TabsTrigger>
        </TabsList>
        <TabsContent value="shop">
          <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>اسم المحل</Label><Input value={shop.shop_name} onChange={e => setShop({ ...shop, shop_name: e.target.value })} /></div>
            <div><Label>الهاتف</Label><Input value={shop.shop_phone} onChange={e => setShop({ ...shop, shop_phone: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>العنوان</Label><Input value={shop.shop_address} onChange={e => setShop({ ...shop, shop_address: e.target.value })} /></div>
            <div><Label>العملة</Label><Input value={shop.currency} onChange={e => setShop({ ...shop, currency: e.target.value })} /></div>
            <div><Label>نسبة الضريبة %</Label><Input type="number" value={shop.tax_percent} onChange={e => setShop({ ...shop, tax_percent: Number(e.target.value) || 0 })} /></div>
            <div className="md:col-span-2"><Label>رأس الفاتورة</Label><Input value={shop.receipt_header} onChange={e => setShop({ ...shop, receipt_header: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>تذييل الفاتورة</Label><Input value={shop.receipt_footer} onChange={e => setShop({ ...shop, receipt_footer: e.target.value })} /></div>
            <div className="md:col-span-2">
              <Label>الشعار</Label>
              <div className="flex items-center gap-3">
                {shop.logo_url && <img src={shop.logo_url} alt="" className="h-16 w-16 rounded object-cover" />}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>رفع شعار</Button>
              </div>
            </div>
            <div className="md:col-span-2"><Button onClick={saveShop}>حفظ</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card><CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div><Label>الاسم</Label><Input value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} /></div>
              <div><Label>الرقم السري (4 أرقام)</Label><Input maxLength={4} value={newEmp.pin} onChange={e => setNewEmp({ ...newEmp, pin: e.target.value.replace(/\D/g, "") })} /></div>
              <div><Label>الدور</Label>
                <Select value={newEmp.role} onValueChange={v => setNewEmp({ ...newEmp, role: v as typeof newEmp.role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">كاشير</SelectItem>
                    <SelectItem value="manager">مدير</SelectItem>
                    <SelectItem value="owner">صاحب المحل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addEmp}><Plus className="h-4 w-4 ml-2" />إضافة</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الدور</TableHead><TableHead>PIN</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {emps.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{roleLabel(e.role)}</TableCell>
                    <TableCell className="font-mono">{e.pin}</TableCell>
                    <TableCell className="text-left">
                      <Button size="icon" variant="ghost" onClick={() => { setPinDialog(e); setNewPin(""); }}><KeyRound className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeEmp(e.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!pinDialog} onOpenChange={v => !v && setPinDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تغيير الرقم السري - {pinDialog?.name}</DialogTitle></DialogHeader>
          <div><Label>الرقم السري الجديد</Label><Input maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPinDialog(null)}>إلغاء</Button><Button onClick={changePin}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
