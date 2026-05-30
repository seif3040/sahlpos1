import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verify the calling user is an owner using the service-role admin client.
 * The auth middleware has already validated the bearer token and set userId.
 */
async function assertOwner(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Response("Forbidden", { status: 403 });
  if (!data) throw new Response("Forbidden: owner role required", { status: 403 });
}

/**
 * Ensures a default owner employee with PIN 1234 exists.
 * Idempotent: safe to call on every login screen mount.
 * INTENTIONALLY public — required for first-time bootstrap before any auth exists.
 */
export const ensureDefaultOwner = createServerFn({ method: "POST" }).handler(async () => {
  const { data: existingOwners } = await supabaseAdmin
    .from("employees")
    .select("id,user_id,pin")
    .eq("role", "owner")
    .eq("active", true)
    .not("user_id", "is", null)
    .limit(1);
  if (existingOwners && existingOwners.length > 0) {
    return { ok: true, created: false };
  }

  const { data: emp, error: empErr } = await supabaseAdmin
    .from("employees")
    .insert({ name: "صاحب المحل", pin: "1234", role: "owner", active: true })
    .select("id")
    .single();
  if (empErr || !emp) throw new Error(empErr?.message || "failed to create owner employee");

  const email = `pin-${emp.id}@shop.local`;
  const password = "1234";

  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) throw new Error(authErr?.message || "failed to create auth user");

  await supabaseAdmin.from("employees").update({ user_id: authUser.user.id }).eq("id", emp.id);
  await supabaseAdmin.from("user_roles").insert({ user_id: authUser.user.id, role: "owner" });

  return { ok: true, created: true };
});

/**
 * Public PIN login: validates PIN, signs in server-side, returns session tokens.
 * The PIN/password is never returned to the client. Adds a delay on failure.
 */
export const findEmployeeByPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => {
    if (!/^\d{4}$/.test(d.pin)) throw new Error("PIN must be 4 digits");
    return d;
  })
  .handler(async ({ data }) => {
    const failDelay = () => new Promise((r) => setTimeout(r, 400));
    const { data: emps, error } = await supabaseAdmin
      .from("employees")
      .select("id,user_id,name,role,pin,active")
      .eq("pin", data.pin)
      .eq("active", true)
      .not("user_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) {
      await failDelay();
      throw new Error(error.message);
    }
    const emp = emps?.[0];
    if (!emp || !emp.user_id) {
      await failDelay();
      return { found: false as const };
    }
    const { data: session, error: signErr } = await supabaseAdmin.auth.signInWithPassword({
      email: `pin-${emp.id}@shop.local`,
      password: emp.pin,
    });
    if (signErr || !session.session) {
      await failDelay();
      return { found: false as const };
    }
    return {
      found: true as const,
      accessToken: session.session.access_token,
      refreshToken: session.session.refresh_token,
      employee: { id: emp.id, name: emp.name, role: emp.role },
    };
  });

/** Owner-only: create an employee account. */
export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; pin: string; role: "owner" | "manager" | "cashier" }) => {
    if (!d.name?.trim()) throw new Error("الاسم مطلوب");
    if (!/^\d{4}$/.test(d.pin)) throw new Error("الرقم السري 4 أرقام");
    if (!["owner", "manager", "cashier"].includes(d.role)) throw new Error("دور غير صالح");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);

    const { data: clash } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("pin", data.pin)
      .eq("active", true)
      .maybeSingle();
    if (clash) throw new Error("هذا الرقم السري مستخدم بالفعل");

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .insert({ name: data.name.trim(), pin: data.pin, role: data.role, active: true })
      .select("id")
      .single();
    if (empErr || !emp) throw new Error(empErr?.message || "فشل الإنشاء");

    const email = `pin-${emp.id}@shop.local`;
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.pin,
      email_confirm: true,
    });
    if (authErr || !authUser?.user) throw new Error(authErr?.message || "فشل إنشاء الحساب");

    await supabaseAdmin.from("employees").update({ user_id: authUser.user.id }).eq("id", emp.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: authUser.user.id, role: data.role });

    return { ok: true, employeeId: emp.id };
  });

/** Owner-only: change an employee's PIN. */
export const updateEmployeePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { employeeId: string; pin: string }) => {
    if (!/^\d{4}$/.test(d.pin)) throw new Error("الرقم السري 4 أرقام");
    if (!d.employeeId) throw new Error("معرف الموظف مطلوب");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id,user_id")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!emp?.user_id) throw new Error("الموظف غير موجود");

    const { data: clash } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("pin", data.pin)
      .neq("id", data.employeeId)
      .eq("active", true)
      .maybeSingle();
    if (clash) throw new Error("هذا الرقم السري مستخدم بالفعل");

    await supabaseAdmin.auth.admin.updateUserById(emp.user_id, { password: data.pin });
    await supabaseAdmin.from("employees").update({ pin: data.pin }).eq("id", emp.id);
    return { ok: true };
  });

/** Owner-only: deactivate an employee. */
export const deactivateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { employeeId: string }) => {
    if (!d.employeeId) throw new Error("معرف الموظف مطلوب");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    await supabaseAdmin.from("employees").update({ active: false }).eq("id", data.employeeId);
    return { ok: true };
  });
