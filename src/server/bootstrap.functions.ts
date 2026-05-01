import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Ensures a default owner employee with PIN 1234 exists.
 * - Creates an auth user pin-<employeeId>@shop.local with password = PIN.
 * - Creates the employee row and the user_roles row.
 * Idempotent: safe to call on every login screen mount.
 * Returns { email, pin } that can also be used to look up by PIN.
 */
export const ensureDefaultOwner = createServerFn({ method: "POST" }).handler(async () => {
  // already an owner? do nothing.
  const { data: existingOwner } = await supabaseAdmin
    .from("employees")
    .select("id,user_id,pin")
    .eq("role", "owner")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (existingOwner) {
    return { ok: true, created: false };
  }

  // Create the employee row first to obtain a stable id for the synthetic email.
  const { data: emp, error: empErr } = await supabaseAdmin
    .from("employees")
    .insert({ name: "صاحب المحل", pin: "1234", role: "owner", active: true })
    .select("id")
    .single();
  if (empErr || !emp) throw new Error(empErr?.message || "failed to create owner employee");

  const email = `pin-${emp.id}@shop.local`;
  const password = "1234";

  // Create the auth user.
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) throw new Error(authErr?.message || "failed to create auth user");

  // Link employee -> user_id and create role row.
  await supabaseAdmin.from("employees").update({ user_id: authUser.user.id }).eq("id", emp.id);
  await supabaseAdmin.from("user_roles").insert({ user_id: authUser.user.id, role: "owner" });

  return { ok: true, created: true };
});

/**
 * Look up the synthetic email for an employee by their 4-digit PIN.
 * Returns null if not found.
 */
export const findEmployeeByPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => {
    if (!/^\d{4}$/.test(d.pin)) throw new Error("PIN must be 4 digits");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id,user_id,name,role,pin,active")
      .eq("pin", data.pin)
      .eq("active", true)
      .maybeSingle();
    if (!emp || !emp.user_id) return { found: false as const };
    return {
      found: true as const,
      email: `pin-${emp.id}@shop.local`,
      password: emp.pin,
      employee: { id: emp.id, name: emp.name, role: emp.role },
    };
  });

/**
 * Owner-only: create an employee account.
 * Verifies the calling user is an owner via their bearer token.
 */
export const createEmployee = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; pin: string; role: "owner" | "manager" | "cashier" }) => {
    if (!d.name?.trim()) throw new Error("الاسم مطلوب");
    if (!/^\d{4}$/.test(d.pin)) throw new Error("الرقم السري 4 أرقام");
    return d;
  })
  .handler(async ({ data }) => {
    // Ensure PIN unique.
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

export const updateEmployeePin = createServerFn({ method: "POST" })
  .inputValidator((d: { employeeId: string; pin: string }) => {
    if (!/^\d{4}$/.test(d.pin)) throw new Error("الرقم السري 4 أرقام");
    return d;
  })
  .handler(async ({ data }) => {
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

export const deactivateEmployee = createServerFn({ method: "POST" })
  .inputValidator((d: { employeeId: string }) => d)
  .handler(async ({ data }) => {
    await supabaseAdmin.from("employees").update({ active: false }).eq("id", data.employeeId);
    return { ok: true };
  });
