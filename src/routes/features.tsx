import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShoppingCart, Package, Users, BarChart3, Receipt, Wallet,
  Undo2, Smartphone, Cloud, Shield, Zap, Truck,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "المميزات — sahl pos" },
      { name: "description", content: "اكتشف كل ما يقدمه sahl pos: مبيعات سريعة، مخزون ذكي، تقارير AI، عزل بيانات الشركات." },
      { property: "og:title", content: "مميزات sahl pos" },
      { property: "og:description", content: "كل ما تحتاجه لإدارة محلك بكفاءة." },
    ],
  }),
  component: FeaturesPage,
});

const ITEMS = [
  { icon: ShoppingCart, title: "نقطة بيع سريعة", desc: "بحث بالاسم/الباركود، خصومات، دفع مختلط (كاش + فيزا)، طباعة فاتورة." },
  { icon: Package, title: "إدارة المخزون", desc: "تحديث تلقائي، تنبيهات نفاد، تواريخ صلاحية، صور وفئات." },
  { icon: Truck, title: "المشتريات والموردين", desc: "سجل فواتير الشراء، حدّث المخزون والسعر، تابع كل مورد." },
  { icon: Users, title: "العملاء والديون", desc: "كشف حساب تفصيلي، دفعات جزئية، إشعارات الديون." },
  { icon: Undo2, title: "المرتجعات", desc: "ارجاع جزئي/كلي، تحديث الصافي تلقائياً، سجل مرتجعات شامل." },
  { icon: Wallet, title: "الصندوق والورديات", desc: "افتح/اقفل وردية، حركات صندوق، تطابق الكاش." },
  { icon: Receipt, title: "المصروفات", desc: "صنّف مصروفاتك، اربطها بالورديات، تتبع كل قرش." },
  { icon: BarChart3, title: "تقارير + AI", desc: "صافي مبيعات، أرباح، أفضل المنتجات، وتحليل ذكي يقترح خطوات نمو." },
  { icon: Smartphone, title: "موبايل أولاً", desc: "تصميم RTL مُحسّن للهاتف، يعمل من أي جهاز." },
  { icon: Cloud, title: "سحابي وآمن", desc: "نسخ احتياطي تلقائي، تشغيل من أي مكان." },
  { icon: Shield, title: "عزل بيانات الشركات", desc: "كل شركة بياناتها معزولة 100%، صلاحيات للموظفين." },
  { icon: Zap, title: "تحقق دفع ذكي", desc: "ارفع سكرين شوت التحويل، AI يقرأ المبلغ ويفعّل حسابك." },
];

function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">مميزات sahl pos</h1>
          <p className="text-muted-foreground">منظومة متكاملة لإدارة شركتك من البيع للمخزون للتقارير.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ITEMS.map((it) => (
            <div key={it.title} className="rounded-xl border bg-card p-5">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="font-bold mb-1">{it.title}</div>
              <p className="text-sm text-muted-foreground">{it.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Button asChild size="lg">
            <Link to="/pricing">ابدأ تجربتك الآن</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
