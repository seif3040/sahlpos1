import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Role = "owner" | "manager" | "cashier";
export interface AuthEmployee {
  id: string;
  name: string;
  role: Role;
  userId: string;
}

interface AuthCtx {
  loading: boolean;
  employee: AuthEmployee | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  loading: true,
  employee: null,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<AuthEmployee | null>(null);

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      setEmployee(null);
      setLoading(false);
      return;
    }
    const { data: emp } = await supabase
      .from("employees")
      .select("id,name,role")
      .eq("user_id", userId)
      .maybeSingle();
    if (emp) setEmployee({ id: emp.id, name: emp.name, role: emp.role as Role, userId });
    else setEmployee(null);
    setLoading(false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    void load();
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        loading,
        employee,
        refresh: load,
        signOut: async () => {
          await supabase.auth.signOut();
          setEmployee(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

export function canAccess(role: Role | undefined, level: 1 | 2 | 3): boolean {
  if (!role) return false;
  const lvl = role === "owner" ? 3 : role === "manager" ? 2 : 1;
  return lvl >= level;
}
