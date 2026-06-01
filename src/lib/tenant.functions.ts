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
  password: z.string().min(8).max(72),
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

/**
 * Find an existing auth user by email or create one with the given password.
 * If the user already exists, the supplied password is rejected (do not silently
 * overwrite someone else's password).
 */
async function findOrCreateAuthUser(
  email: string,
  password: string,
): Promise<{ userId: string; created: boolean }> {
  const lower = email.toLowerCase();

  // Try to create first
  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email: lower,
    password,
    email_confirm: true,
  });
  if (created?.user) return { userId: created.user.id, created: true };

  // Existing user → verify the password matches by attempting a sign-in
  if (cErr && /already|registered|exists/i.test(cErr.message)) {
    const { data: sess, error: sErr } = await supabaseAdmin.auth.signInWithPassword({
      email: lower,
      password,
    });
    if (sErr || !sess.user) {
      throw new Error(
        "هذا الإيميل مستخدم بالفعل وكلمة المرور مختلفة. سجّل دخول أو استخدم إيميل آخر.",
      );
    }
    return { userId: sess.user.id, created: false };
  }
  throw new Error(cErr?.message || "فشل إنشاء الحساب");
}

export const submitPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => SubmitSchema.parse(d))
  .handler(async ({ data }) => {
    const expectedAmount = PLAN_PRICE[data.plan];

    // 0) Pre-create the owner auth user with their real email + chosen password.
    //    They can sign in immediately at /login, even while the request is pending.
    const { userId: ownerUserId } = await findOrCreateAuthUser(data.email, data.password);

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

    // 3) Insert submission (linked to the pre-created owner user)
    const desiredSlug = slugify(data.companyName);
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        company_name: data.companyName,
        contact_email: data.email.toLowerCase(),
        contact_phone: data.phone,
        desired_slug: desiredSlug,
        plan: data.plan,
        method: data.method,
        amount: expectedAmount,
        screenshot_url: path,
        status: "pending",
        owner_user_id: ownerUserId,
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
    const aiDbStatus =
      ai.status === "approved" ? "ai_approved" :
      ai.status === "rejected" ? "ai_rejected" : "needs_review";
    await supabaseAdmin
      .from("payment_submissions")
      .update({ ai_status: aiDbStatus, ai_notes: ai.notes, ai_extracted: ai.extracted })
      .eq("id", sub.id);

    if (ai.status !== "approved") {
      return {
        ok: true,
        status: ai.status,
        notes: ai.notes || "في انتظار مراجعة الفريق (خلال 24 ساعة).",
        submissionId: sub.id,
      };
    }

    // 5) AI approved → activate tenant immediately
    const slug = await activateTenantForSubmission(sub.id);
    return {
      ok: true,
      status: "approved" as const,
      notes: `تم تفعيل حسابك! سجّل الدخول بنفس الإيميل وكلمة المرور.`,
      slug,
      submissionId: sub.id,
    };
  });

/**
 * Shared activation routine — used by AI auto-approve and by the platform
 * admin's manual approve. Idempotent: re-running on an already-active
 * submission returns the existing slug.
 */
export async function activateTenantForSubmission(submissionId: string): Promise<string> {
  const { data: sub, error } = await supabaseAdmin
    .from("payment_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !sub) throw new Error("الطلب غير موجود");

  if (sub.account_created && sub.tenant_id) {
    const { data: t } = await supabaseAdmin
      .from("tenants").select("slug").eq("id", sub.tenant_id).maybeSingle();
    return t?.slug ?? "";
  }

  if (!sub.owner_user_id) {
    throw new Error(
      "هذا الطلب قديم وما فيهوش حساب مالك مرتبط. اطلب من العميل يعيد التسجيل بإيميل وكلمة مرور.",
    );
  }

  // Unique slug
  const desired = sub.desired_slug || slugify(sub.company_name);
  let slug = desired;
  for (let i = 0; i < 8; i++) {
    const { data: exists } = await supabaseAdmin
      .from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (!exists) break;
    slug = `${desired}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const { data: tenant, error: tErr } = await supabaseAdmin
    .from("tenants")
    .insert({
      name: sub.company_name,
      slug,
      contact_email: sub.contact_email,
      contact_phone: sub.contact_phone,
      plan: sub.plan,
      status: "active",
      owner_user_id: sub.owner_user_id,
      subscription_ends_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (tErr || !tenant) throw new Error(tErr?.message || "فشل إنشاء الشركة");

  // Owner employee row — PIN 0000, owner can change it later from settings.
  const { data: emp, error: eErr } = await supabaseAdmin
    .from("employees")
    .insert({
      tenant_id: tenant.id,
      name: "صاحب الشركة",
      pin: "0000",
      role: "owner",
      active: true,
      must_reset_pin: true,
      user_id: sub.owner_user_id,
    })
    .select("id")
    .single();
  if (eErr || !emp) throw new Error(eErr?.message || "فشل إنشاء حساب المالك");

  // Ensure owner role exists in user_roles (idempotent)
  const { data: existingRole } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", sub.owner_user_id)
    .eq("role", "owner")
    .maybeSingle();
  if (!existingRole) {
    await supabaseAdmin.from("user_roles").insert({
      user_id: sub.owner_user_id,
      role: "owner",
    });
  }

  await supabaseAdmin.from("tenant_subscriptions").insert({
    tenant_id: tenant.id,
    plan: sub.plan,
    amount: Number(sub.amount) || PLAN_PRICE[sub.plan as Plan],
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    payment_id: sub.id,
  });

  await supabaseAdmin
    .from("payment_submissions")
    .update({
      tenant_id: tenant.id,
      account_created: true,
    })
    .eq("id", sub.id);

  return slug;
}

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

/** Public PIN login per-tenant (in-store cashier/manager flow). */
export const findTenantEmployeeByPin = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; pin: string }) => {
    if (!/^\d{4}$/.test(d.pin)) throw new Error("الرقم السري 4 أرقام");
    if (!d.slug?.trim()) throw new Error("الشركة غير محددة");
    return d;
  })
  .handler(async ({ data }) => {
    const failDelay = () => new Promise((r) => setTimeout(r, 400));
    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("id,name,status").eq("slug", data.slug).maybeSingle();
    if (!tenant) { await failDelay(); return { found: false as const, reason: "no_tenant" }; }
    if (tenant.status !== "active") { await failDelay(); return { found: false as const, reason: "inactive" }; }

    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select("id,user_id,name,role,pin,active,must_reset_pin")
      .eq("tenant_id", tenant.id)
      .eq("pin", data.pin)
      .eq("active", true)
      .not("user_id", "is", null)
      .limit(1);
    const emp = emps?.[0];
    if (!emp || !emp.user_id) { await failDelay(); return { found: false as const, reason: "no_pin" }; }

    // PIN-based sessions still use the legacy fake-email accounts when present;
    // owners signed up via /checkout sign in by email+password at /login instead.
    const { data: session, error: signErr } = await supabaseAdmin.auth.signInWithPassword({
      email: `pin-${emp.id}@shop.local`,
      password: emp.pin,
    });
    if (signErr || !session.session) { await failDelay(); return { found: false as const, reason: "no_pin" }; }

    return {
      found: true as const,
      accessToken: session.session.access_token,
      refreshToken: session.session.refresh_token,
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

    const { data: clash } = await supabaseAdmin
      .from("employees")
      .select("id").eq("tenant_id", emp.tenant_id).eq("pin", data.newPin).eq("active", true).neq("id", emp.id).maybeSingle();
    if (clash) throw new Error("الرقم مستخدم بالفعل");

    await supabaseAdmin.from("employees")
      .update({ pin: data.newPin, name: data.name.trim(), must_reset_pin: false })
      .eq("id", emp.id);
    return { ok: true };
  });

/**
 * Authenticated: figure out where to send the currently signed-in user.
 * - Platform admin → /admin
 * - Owner of an active tenant → /pos/{slug}
 * - Owner of a pending submission → /pending status info
 * - Otherwise → no destination (let UI show "ابدأ الآن")
 */
export const getMyDestination = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: admin } = await supabaseAdmin
      .from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (admin) return { kind: "admin" as const };

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("slug,name,status")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tenant && tenant.status === "active") {
      return { kind: "tenant" as const, slug: tenant.slug, name: tenant.name };
    }

    const { data: sub } = await supabaseAdmin
      .from("payment_submissions")
      .select("status,company_name,created_at,admin_notes,ai_status,ai_notes,account_created")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      return {
        kind: "pending" as const,
        company: sub.company_name,
        status: sub.status,
        adminNotes: sub.admin_notes,
        aiStatus: sub.ai_status,
        aiNotes: sub.ai_notes,
        createdAt: sub.created_at,
      };
    }

    return { kind: "none" as const };
  });
