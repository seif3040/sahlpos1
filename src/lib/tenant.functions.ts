import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Plan = "basic" | "pro" | "enterprise";
const PLAN_PRICE: Record<Plan, number> = { basic: 299, pro: 599, enterprise: 999 };
const PLAN_NAME: Record<Plan, string> = { basic: "Basic", pro: "Pro", enterprise: "Enterprise" };

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "shop";
}

const SubmitSchema = z.object({
  companyName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(8).max(20),
  plan: z.enum(["basic", "pro", "enterprise"]),
  method: z.enum(["vodafone_cash", "instapay", "bank_transfer"]),
  screenshotBase64: z.string().min(100).max(10_000_000),
  screenshotMime: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

interface AiResult {
  status: "approved" | "rejected" | "needs_review";
  notes: string;
  extracted: { amount?: number; reference?: string; recipient?: string };
}

async function aiVerifyScreenshot(
  imageUrl: string,
  expected: { amount: number; method: string; recipient: string },
): Promise<AiResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { status: "needs_review", notes: "AI not configured", extracted: {} };

  const prompt = `أنت مراجع مدفوعات. ستحصل على صورة إيصال تحويل مصري (${expected.method}).
المطلوب: تحقق أن المبلغ المرسل = ${expected.amount} ج.م وأن المستلم/الرقم/الحساب يطابق "${expected.recipient}".
أعد JSON فقط بالشكل:
{"status":"approved|rejected|needs_review","notes":"سطر بالعربية","extracted":{"amount":رقم,"reference":"...","recipient":"..."}}
- approved فقط لو المبلغ مطابق والمستلم مطابق والصورة واضحة.
- rejected لو المبلغ مختلف بوضوح أو الصورة مزورة.
- needs_review لو الصورة غير واضحة.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      return { status: "needs_review", notes: `AI error ${res.status}`, extracted: {} };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return {
      status: ["approved", "rejected", "needs_review"].includes(parsed.status) ? parsed.status : "needs_review",
      notes: String(parsed.notes ?? ""),
      extracted: parsed.extracted ?? {},
    };
  } catch (e) {
    return { status: "needs_review", notes: e instanceof Error ? e.message : "AI parse error", extracted: {} };
  }
}

export const submitPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => SubmitSchema.parse(d))
  .handler(async ({ data }) => {
    const expectedAmount = PLAN_PRICE[data.plan];

    // 1) load platform settings for recipient
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("vodafone_cash_number, instapay_handle, bank_account")
      .eq("id", 1)
      .maybeSingle();
    const recipient =
      data.method === "vodafone_cash"
        ? settings?.vodafone_cash_number ?? "01000000000"
        : data.method === "instapay"
          ? settings?.instapay_handle ?? "sahlpos@instapay"
          : settings?.bank_account ?? "bank";

    // 2) Upload screenshot
    const buf = Buffer.from(data.screenshotBase64, "base64");
    const ext = data.screenshotMime === "image/png" ? "png" : data.screenshotMime === "image/webp" ? "webp" : "jpg";
    const path = `submissions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("payment-screenshots")
      .upload(path, buf, { contentType: data.screenshotMime });
    if (upErr) throw new Error("فشل رفع الصورة: " + upErr.message);

    const { data: signed } = await supabaseAdmin.storage
      .from("payment-screenshots")
      .createSignedUrl(path, 60 * 60);
    const signedUrl = signed?.signedUrl ?? "";

    // 3) Insert submission
    const desiredSlug = slugify(data.companyName);
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        company_name: data.companyName,
        contact_email: data.email,
        contact_phone: data.phone,
        desired_slug: desiredSlug,
        plan: data.plan,
        method: data.method,
        amount: expectedAmount,
        screenshot_url: path,
        status: "pending",
      })
      .select("id")
      .single();
    if (subErr || !sub) throw new Error(subErr?.message || "فشل تسجيل الطلب");

    // 4) AI verify
    const ai = await aiVerifyScreenshot(signedUrl, {
      amount: expectedAmount,
      method: data.method,
      recipient,
    });
    await supabaseAdmin
      .from("payment_submissions")
      .update({ ai_status: ai.status, ai_notes: ai.notes, ai_extracted: ai.extracted })
      .eq("id", sub.id);

    if (ai.status !== "approved") {
      return {
        ok: true,
        status: ai.status,
        notes: ai.notes || "في انتظار مراجعة الفريق (خلال 24 ساعة).",
        submissionId: sub.id,
      };
    }

    // 5) Approved → create tenant + owner
    let slug = desiredSlug;
    for (let i = 0; i < 8; i++) {
      const { data: exists } = await supabaseAdmin
        .from("tenants").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${desiredSlug}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.companyName,
        slug,
        contact_email: data.email,
        contact_phone: data.phone,
        plan: data.plan,
        status: "active",
        subscription_ends_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (tErr || !tenant) throw new Error(tErr?.message || "فشل إنشاء الشركة");

    // owner employee row with PIN 0000 + must_reset
    const { data: emp, error: eErr } = await supabaseAdmin
      .from("employees")
      .insert({
        tenant_id: tenant.id,
        name: "صاحب الشركة",
        pin: "0000",
        role: "owner",
        active: true,
        must_reset_pin: true,
      })
      .select("id")
      .single();
    if (eErr || !emp) throw new Error(eErr?.message || "فشل إنشاء حساب المالك");

    // auth user
    const ownerEmail = `pin-${emp.id}@shop.local`;
    const { data: authUser, error: aErr } = await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail, password: "0000", email_confirm: true,
    });
    if (aErr || !authUser?.user) throw new Error(aErr?.message || "فشل إنشاء المستخدم");

    await supabaseAdmin.from("employees").update({ user_id: authUser.user.id }).eq("id", emp.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: authUser.user.id, role: "owner" });
    await supabaseAdmin.from("tenants").update({ owner_user_id: authUser.user.id }).eq("id", tenant.id);

    await supabaseAdmin.from("tenant_subscriptions").insert({
      tenant_id: tenant.id,
      plan: data.plan,
      amount: expectedAmount,
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      payment_id: sub.id,
    });

    await supabaseAdmin
      .from("payment_submissions")
      .update({ tenant_id: tenant.id, status: "approved", account_created: true, reviewed_at: new Date().toISOString() })
      .eq("id", sub.id);

    return {
      ok: true,
      status: "approved" as const,
      notes: `تم تفعيل حسابك! ادخل من /pos/${slug} بالرقم 0000 ثم غيّره فوراً.`,
      slug,
      submissionId: sub.id,
    };
  });

export const getPlanInfo = createServerFn({ method: "GET" })
  .inputValidator((d: { plan: string }) => {
    if (!["basic", "pro", "enterprise"].includes(d.plan)) throw new Error("Invalid plan");
    return { plan: d.plan as Plan };
  })
  .handler(async ({ data }) => {
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("vodafone_cash_number, instapay_handle, bank_account, currency")
      .eq("id", 1)
      .maybeSingle();
    return {
      plan: data.plan,
      name: PLAN_NAME[data.plan],
      price: PLAN_PRICE[data.plan],
      currency: settings?.currency ?? "EGP",
      vodafone: settings?.vodafone_cash_number ?? "01000000000",
      instapay: settings?.instapay_handle ?? "sahlpos@instapay",
      bank: settings?.bank_account ?? "—",
    };
  });

/** Public: lookup tenant by slug + auth as employee with matching PIN in that tenant */
export const findTenantEmployeeByPin = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; pin: string }) => {
    if (!/^\d{4}$/.test(d.pin)) throw new Error("الرقم السري 4 أرقام");
    if (!d.slug?.trim()) throw new Error("الشركة غير محددة");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("id,name,status").eq("slug", data.slug).maybeSingle();
    if (!tenant) return { found: false as const, reason: "no_tenant" };
    if (tenant.status !== "active") return { found: false as const, reason: "inactive" };

    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select("id,user_id,name,role,pin,active,must_reset_pin")
      .eq("tenant_id", tenant.id)
      .eq("pin", data.pin)
      .eq("active", true)
      .not("user_id", "is", null)
      .limit(1);
    const emp = emps?.[0];
    if (!emp || !emp.user_id) return { found: false as const, reason: "no_pin" };
    return {
      found: true as const,
      email: `pin-${emp.id}@shop.local`,
      password: emp.pin,
      mustResetPin: emp.must_reset_pin,
      employee: { id: emp.id, name: emp.name, role: emp.role },
      tenant: { name: tenant.name },
    };
  });

export const getPublicTenant = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("name,status").eq("slug", data.slug).maybeSingle();
    return tenant ? { found: true, name: tenant.name, status: tenant.status } : { found: false };
  });

/** Owner only: replace 0000 PIN with new PIN, clear must_reset_pin */
export const setupOwnerPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; newPin: string }) => {
    if (!/^\d{4}$/.test(d.newPin)) throw new Error("الرقم السري 4 أرقام");
    if (d.newPin === "0000") throw new Error("لا يمكن استخدام 0000");
    if (!d.name?.trim()) throw new Error("الاسم مطلوب");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id,tenant_id,must_reset_pin")
      .eq("user_id", userId)
      .maybeSingle();
    if (!emp) throw new Error("الموظف غير موجود");

    // ensure PIN unique within tenant
    const { data: clash } = await supabaseAdmin
      .from("employees")
      .select("id").eq("tenant_id", emp.tenant_id).eq("pin", data.newPin).eq("active", true).neq("id", emp.id).maybeSingle();
    if (clash) throw new Error("الرقم مستخدم بالفعل");

    await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.newPin });
    await supabaseAdmin.from("employees")
      .update({ pin: data.newPin, name: data.name.trim(), must_reset_pin: false })
      .eq("id", emp.id);
    return { ok: true };
  });
