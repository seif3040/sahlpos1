import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { MarketingShell } from "@/components/marketing-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "الأسعار — sahl pos" },
      { name: "description", content: "ثلاث باقات تناسب كل حجم: من المحلات الصغيرة للسلاسل. أسعار شفافة بالجنيه المصري." },
      { property: "og:title", content: "أسعار sahl pos بالجنيه المصري" },
      { property: "og:description", content: "Basic / Pro / Enterprise — اختر اللي يناسبك." },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    tag: "للمحلات الصغيرة",
    price: 299,
    features: [
      "حتى 200 منتج",
      "حتى موظفين اثنين",
      "فواتير غير محدودة",
      "مخزون + باركود",
      "تقارير أساسية",
      "نسخ احتياطي تلقائي",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    tag: "الأكثر طلباً",
    price: 599,
    popular: true,
    features: [
      "منتجات غير محدودة",
      "حتى 10 موظفين",
      "كل مميزات Basic",
      "إدارة عملاء وديون",
      "تقارير متقدمة + تحليل AI",
      "صندوق وورديات + مصروفات",
      "طباعة فواتير حرارية",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    tag: "للسلاسل والشركات",
    price: 999,
    features: [
      "كل مميزات Pro",
      "موظفين غير محدودين",
      "أولوية الدعم الفني",
      "تكامل مع موردين متعددين",
      "تقارير مخصصة",
      "API للتكامل مع أنظمتك",
      "مدير حساب مخصص",
    ],
  },
];

function PricingPage() {
  return (
    <MarketingShell>
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">أسعار بسيطة وشفافة</h1>
          <p className="text-muted-foreground">
            اختر الباقة المناسبة لشركتك. الدفع شهرياً بالجنيه المصري عبر فودافون كاش، إنستاباي، أو تحويل بنكي.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PLANS.map((p) => (
            <Card key={p.id} className={p.popular ? "border-primary border-2 relative shadow-xl" : ""}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  الأكثر طلباً
                </div>
              )}
              <CardContent className="p-6">
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground">{p.tag}</div>
                  <div className="text-2xl font-bold mt-1">{p.name}</div>
                </div>
                <div className="mb-5">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground"> ج.م / شهرياً</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full" variant={p.popular ? "default" : "outline"}>
                  <Link to="/checkout/$plan" params={{ plan: p.id }}>
                    اشترك في {p.name}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          كل الأسعار شاملة. يمكنك الترقية أو الإلغاء في أي وقت.
        </p>
      </section>
    </MarketingShell>
  );
}
