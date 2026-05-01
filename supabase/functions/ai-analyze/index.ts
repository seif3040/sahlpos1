// AI business analysis edge function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { summary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const systemPrompt = `أنت محلل أعمال خبير في قطاع التجزئة. ستحصل على ملخص بيانات متجر بصيغة JSON (مبيعات، مصروفات، أرباح، أفضل المنتجات، طرق الدفع، الديون، المخزون). قدم تحليلاً عميقاً وتوصيات عملية باللغة العربية بصيغة Markdown منظم تحت العناوين التالية:

## 📊 ملخص الأداء
## 💡 رؤى رئيسية
## ⚠️ تحذيرات ومخاطر
## 🚀 توصيات للنمو
## 🎯 خطوات عملية لهذا الأسبوع

كن محدداً وذكر أرقاماً ونسباً. تجنب العموميات.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "حلّل بيانات المتجر التالية:\n\n```json\n" + JSON.stringify(summary, null, 2) + "\n```" },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول لاحقاً" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "الرصيد غير كافٍ، أضف رصيداً للـ AI من الإعدادات" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ analysis: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
