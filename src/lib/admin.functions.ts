import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activateTenantForSubmission } from "@/lib/tenant.functions";

const EmailPass = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
});

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Sign in admin. Returns session tokens. Throws if not a platform admin. */
export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((d) => EmailPass.parse(d))
  .handler(async ({ data }) => {
    const failDelay = () => new Promise((r) => setTimeout(r, 400));
    const { data: sess, error } = await supabaseAdmin.auth.signInWithPassword({
      email: data.email.toLowerCase(),
      password: data.password,
    });
    if (error || !sess.session) {
      await failDelay();
      throw new Error("بيانات الدخول غير صحيحة");
    }
    const userId = sess.user!.id;
    const ok = await isAdmin(userId);
    if (!ok) {
      await failDelay();
      throw new Error("هذا الحساب ليس مدير منصة");
    }
    return {
      accessToken: sess.session.access_token,
      refreshToken: sess.session.refresh_token,
      email: data.email,
    };
  });

/** Register the FIRST platform admin. Only works while platform_admins is empty. */
export const adminBootstrap = createServerFn({ method: "POST" })
  .inputValidator((d) => EmailPass.parse(d))
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      throw new Error("يوجد مدير منصة بالفعل. اطلب من المدير إضافتك.");
    }
    const email = data.email.toLowerCase();
    let userId: string | null = null;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (created?.user) userId = created.user.id;
    else if (cErr && /already/i.test(cErr.message)) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!found) throw new Error(cErr.message);
      userId = found.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.password });
    } else if (cErr) {
      throw new Error(cErr.message);
    }
    if (!userId) throw new Error("فشل إنشاء المستخدم");
    const { error: insErr } = await supabaseAdmin
      .from("platform_admins")
      .insert({ user_id: userId });
    if (insErr) throw new Error(insErr.message);

    const { data: sess } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (!sess.session) throw new Error("تم الإنشاء ولكن فشل تسجيل الدخول");
    return {
      accessToken: sess.session.access_token,
      refreshToken: sess.session.refresh_token,
      email,
    };
  });

export const adminBootstrapNeeded = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  return { needed: (count ?? 0) === 0 };
});

interface SubmissionRow {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string;
  desired_slug: string | null;
  plan: string;
  method: string;
  amount: number;
  status: string;
  ai_status: string | null;
  ai_notes: string | null;
  screenshot_url: string;
  signed_url: string | null;
  account_created: boolean;
  tenant_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: "pending" | "all" }) => d ?? {})
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("غير مصرح");
    let q = supabaseAdmin
      .from("payment_submissions")
      .select(
        "id,company_name,contact_email,contact_phone,desired_slug,plan,method,amount,status,ai_status,ai_notes,screenshot_url,account_created,tenant_id,owner_user_id,created_at,reviewed_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status === "pending") {
      q = q.in("status", ["pending"]);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const enriched: SubmissionRow[] = [];
    for (const r of rows ?? []) {
      let signed: string | null = null;
      if (r.screenshot_url) {
        const { data: s } = await supabaseAdmin.storage
          .from("payment-screenshots")
          .createSignedUrl(r.screenshot_url, 60 * 60);
        signed = s?.signedUrl ?? null;
      }
      enriched.push({ ...(r as Omit<SubmissionRow, "signed_url">), signed_url: signed });
    }
    return { rows: enriched };
  });

/** Manually approve a submission — links the existing owner user to a fresh tenant. */
export const approveSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => {
    if (!d.id) throw new Error("missing id");
    return d;
  })
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("غير مصرح");

    const slug = await activateTenantForSubmission(data.id);

    await supabaseAdmin
      .from("payment_submissions")
      .update({
        status: "admin_approved",
        admin_status: "admin_approved",
        admin_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return { ok: true, slug };
  });

export const rejectSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => {
    if (!d.id) throw new Error("missing id");
    return d;
  })
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("غير مصرح");
    const { error } = await supabaseAdmin
      .from("payment_submissions")
      .update({
        status: "admin_rejected",
        admin_status: "admin_rejected",
        admin_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ok = await isAdmin(context.userId);
    return { isAdmin: ok };
  });
