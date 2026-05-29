import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShoppingCart, Package, Users, BarChart3, Receipt, Smartphone,
  CheckCircle2, Zap, Shield, Cloud, ArrowLeft,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "sahl pos — نظام نقاط البيع السحابي للشركات المصرية" },
      { name: "description", content: "إدارة مبيعاتك ومخزونك وموظفيك من أي مكان. أسعار بالجنيه المصري، دعم عربي كامل، تحقق آمن من الدفع." },
      { property: "og:title", content: "sahl pos — نظام نقاط البيع للشركات المصرية" },
      { property: "og:description", content: "حل متكامل لإدارة المبيعات والمخزون مع تحقق ذكي من المدفوعات." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/15 via-background to-accent/30 -z-10" />
        <div className="container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-6">
            نظام نقاط بيع سحابي • صُنع للسوق المصري
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">
            بيع أسرع، إدارة أسهل،<br />نمو بلا صداع
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            sahl pos حل متكامل لإدارة محلك أو شركتك: مبيعات، مخزون، ديون عملاء، تقارير، ومراقبة موظفين — كل ده من المتصفح أو الموبايل.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/pricing">
                اشترك الآن
                <ArrowLeft className="h-4 w-4 mr-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/features">شوف المميزات</Link>
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-3 max-w-md mx-auto gap-4 text-center">
            <Stat n="100%" l="عربي" />
            <Stat n="EGP" l="بالجنيه" />
            <Stat n="24/7" l="سحابي" />
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          كل اللي محتاجه عشان تدير محلك
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feat icon={ShoppingCart} title="فاتورة في ثوانٍ" desc="بيع سريع بالباركود، دفع نقدي أو فيزا أو مختلط، طباعة فاتورة حرارية." />
          <Feat icon={Package} title="مخزون ذكي" desc="تنبيهات للمنتجات اللي قاربت تخلص، تحديث تلقائي مع كل بيع/شراء/مرتجع." />
          <Feat icon={Users} title="عملاء وديون" desc="كشف حساب لكل عميل، متابعة الديون، تحصيل دفعات جزئية." />
          <Feat icon={BarChart3} title="تقارير لحظية" desc="مبيعات، أرباح، صافي بعد المرتجعات، أفضل المنتجات — بـ AI تحليلي." />
          <Feat icon={Receipt} title="صندوق ومصروفات" desc="افتح/اقفل وردية، سجل المصروفات، تطابق الكاش الفعلي." />
          <Feat icon={Smartphone} title="موبايل قبل أي حاجة" desc="يشتغل من أي جهاز، مصمم للهاتف قبل الكمبيوتر." />
        </div>
      </section>

      {/* Why us */}
      <section className="bg-muted/40 py-12 md:py-16">
        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-6">
          <Pillar icon={Zap} title="سهل تستخدمه" desc="واجهة عربية بالكامل، RTL، بدون تدريب طويل." />
          <Pillar icon={Shield} title="آمن وخاص" desc="كل شركة بياناتها معزولة، صلاحيات للموظفين، تشفير من الطرفين." />
          <Pillar icon={Cloud} title="سحابي 100%" desc="نسخ احتياطي تلقائي، شغّال أونلاين وأوفلاين." />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">جاهز تبدأ؟</h2>
        <p className="text-muted-foreground mb-6">اختار الباقة المناسبة لشركتك وابدأ خلال دقائق.</p>
        <Button asChild size="lg">
          <Link to="/pricing">شوف الأسعار</Link>
        </Button>
      </section>
    </MarketingShell>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-primary">{n}</div>
      <div className="text-xs text-muted-foreground">{l}</div>
    </div>
  );
}

function Feat({ icon: I, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
          <I className="h-5 w-5" />
        </div>
        <div className="font-bold mb-1">{title}</div>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Pillar({ icon: I, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-3">
        <I className="h-6 w-6" />
      </div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <CheckCircle2 className="hidden" />
    </div>
  );
}
