export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cash_register_shifts: {
        Row: {
          closed_at: string | null
          closing_cash: number | null
          employee_id: string | null
          id: string
          notes: string | null
          opened_at: string
          opening_cash: number
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_cash?: number | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          tenant_id?: string
        }
        Update: {
          closed_at?: string | null
          closing_cash?: number | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_debts: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          is_settled: boolean
          paid: number
          remaining: number | null
          sale_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          id?: string
          is_settled?: boolean
          paid?: number
          remaining?: number | null
          sale_id?: string | null
          tenant_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          is_settled?: boolean
          paid?: number
          remaining?: number | null
          sale_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_debts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_debts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_debts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          debt_id: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id?: string | null
          id?: string
          tenant_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "customer_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          id: string
          must_reset_pin: boolean
          name: string
          pin: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          must_reset_pin?: boolean
          name: string
          pin: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          must_reset_pin?: boolean
          name?: string
          pin?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          employee_id: string | null
          id: string
          note: string | null
          shift_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          note?: string | null
          shift_id?: string | null
          tenant_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          note?: string | null
          shift_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_register_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_submissions: {
        Row: {
          account_created: boolean
          admin_notes: string | null
          admin_status:
            | Database["public"]["Enums"]["payment_review_status"]
            | null
          ai_extracted: Json | null
          ai_notes: string | null
          ai_status: Database["public"]["Enums"]["payment_review_status"] | null
          amount: number
          company_name: string
          contact_email: string
          contact_phone: string
          created_at: string
          desired_slug: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method_type"]
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          reviewed_at: string | null
          screenshot_url: string
          status: Database["public"]["Enums"]["payment_review_status"]
          tenant_id: string | null
        }
        Insert: {
          account_created?: boolean
          admin_notes?: string | null
          admin_status?:
            | Database["public"]["Enums"]["payment_review_status"]
            | null
          ai_extracted?: Json | null
          ai_notes?: string | null
          ai_status?:
            | Database["public"]["Enums"]["payment_review_status"]
            | null
          amount: number
          company_name: string
          contact_email: string
          contact_phone: string
          created_at?: string
          desired_slug?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method_type"]
          owner_user_id?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          reviewed_at?: string | null
          screenshot_url: string
          status?: Database["public"]["Enums"]["payment_review_status"]
          tenant_id?: string | null
        }
        Update: {
          account_created?: boolean
          admin_notes?: string | null
          admin_status?:
            | Database["public"]["Enums"]["payment_review_status"]
            | null
          ai_extracted?: Json | null
          ai_notes?: string | null
          ai_status?:
            | Database["public"]["Enums"]["payment_review_status"]
            | null
          amount?: number
          company_name?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          desired_slug?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method_type"]
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          reviewed_at?: string | null
          screenshot_url?: string
          status?: Database["public"]["Enums"]["payment_review_status"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          bank_account: string | null
          basic_price: number
          currency: string
          enterprise_price: number
          id: number
          instapay_handle: string
          pro_price: number
          updated_at: string
          vodafone_cash_number: string
        }
        Insert: {
          bank_account?: string | null
          basic_price?: number
          currency?: string
          enterprise_price?: number
          id?: number
          instapay_handle?: string
          pro_price?: number
          updated_at?: string
          vodafone_cash_number?: string
        }
        Update: {
          bank_account?: string | null
          basic_price?: number
          currency?: string
          enterprise_price?: number
          id?: number
          instapay_handle?: string
          pro_price?: number
          updated_at?: string
          vodafone_cash_number?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          image_url: string | null
          is_low_stock: boolean
          min_quantity: number
          name: string
          purchase_price: number
          quantity: number
          selling_price: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_low_stock?: boolean
          min_quantity?: number
          name: string
          purchase_price?: number
          quantity?: number
          selling_price?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_low_stock?: boolean
          min_quantity?: number
          name?: string
          purchase_price?: number
          quantity?: number
          selling_price?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          line_total: number
          product_id: string | null
          purchase_id: string | null
          quantity: number
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          id?: string
          line_total: number
          product_id?: string | null
          purchase_id?: string | null
          quantity: number
          tenant_id?: string
          unit_cost: number
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string | null
          purchase_id?: string | null
          quantity?: number
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          paid: number
          supplier_id: string | null
          tenant_id: string
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          paid?: number
          supplier_id?: string | null
          tenant_id?: string
          total?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          paid?: number
          supplier_id?: string | null
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          refunded_quantity: number
          sale_id: string | null
          tenant_id: string
          unit_price: number
        }
        Insert: {
          cost_price?: number
          id?: string
          line_total: number
          product_id?: string | null
          product_name: string
          quantity: number
          refunded_quantity?: number
          sale_id?: string | null
          tenant_id?: string
          unit_price: number
        }
        Update: {
          cost_price?: number
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          refunded_quantity?: number
          sale_id?: string | null
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          card_part: number
          cash_part: number
          cash_received: number
          cashier_id: string | null
          change_amount: number
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          invoice_number: number
          is_refunded: boolean
          payment_method: string
          shift_id: string | null
          subtotal: number
          tax: number
          tenant_id: string
          total: number
        }
        Insert: {
          card_part?: number
          cash_part?: number
          cash_received?: number
          cashier_id?: string | null
          change_amount?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          invoice_number?: number
          is_refunded?: boolean
          payment_method?: string
          shift_id?: string | null
          subtotal?: number
          tax?: number
          tenant_id?: string
          total?: number
        }
        Update: {
          card_part?: number
          cash_part?: number
          cash_received?: number
          cashier_id?: string | null
          change_amount?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          invoice_number?: number
          is_refunded?: boolean
          payment_method?: string
          shift_id?: string | null
          subtotal?: number
          tax?: number
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_register_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          currency: string
          id: number
          logo_url: string | null
          receipt_footer: string | null
          receipt_header: string | null
          shop_address: string | null
          shop_name: string
          shop_phone: string | null
          tax_percent: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          currency?: string
          id?: number
          logo_url?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          shop_address?: string | null
          shop_name?: string
          shop_phone?: string | null
          tax_percent?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          currency?: string
          id?: number
          logo_url?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          shop_address?: string | null
          shop_name?: string
          shop_phone?: string | null
          tax_percent?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          shift_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          shift_id?: string | null
          tenant_id?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          shift_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_movements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_register_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          payment_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          started_at: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          id?: string
          payment_id?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          started_at?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          subscription_ends_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          subscription_ends_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          subscription_ends_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_level: { Args: never; Returns: number }
      current_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      refund_sale_item: {
        Args: { _item_id: string; _qty: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "cashier"
      payment_method_type:
        | "vodafone_cash"
        | "instapay"
        | "fawry"
        | "bank_transfer"
      payment_review_status:
        | "pending"
        | "ai_approved"
        | "ai_rejected"
        | "needs_review"
        | "admin_approved"
        | "admin_rejected"
      plan_tier: "basic" | "pro" | "enterprise"
      tenant_status: "active" | "suspended" | "pending_payment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "cashier"],
      payment_method_type: [
        "vodafone_cash",
        "instapay",
        "fawry",
        "bank_transfer",
      ],
      payment_review_status: [
        "pending",
        "ai_approved",
        "ai_rejected",
        "needs_review",
        "admin_approved",
        "admin_rejected",
      ],
      plan_tier: ["basic", "pro", "enterprise"],
      tenant_status: ["active", "suspended", "pending_payment"],
    },
  },
} as const
