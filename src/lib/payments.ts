import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus = "PENDING" | "VALIDATED" | "REFUSED" | "REFUND_REQUESTED" | "REFUNDED";
export type PaymentMethod = "MVOLA" | "ORANGE_MONEY" | "AIRTEL_MONEY" | "CARD";

export type CoursePayment = {
  id: string;
  studentId: string;
  courseId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  senderNumber: string;
  transactionRef: string;
  screenshotUrl: string | null;
  remark: string | null;
  reference: string;
  status: PaymentStatus;
  validatedAt: string | null;
  validatedBy: string | null;
  refusedAt: string | null;
  refusedReason: string | null;
  couponCode: string | null;
  discountAmount: number | null;
  refundRequestedAt: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  course?: { id: string; title: string; thumbnail: string | null; price: number | null };
  student?: { id: string; firstName: string; lastName: string; email: string };
};

export type CouponPreview = {
  couponId: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
};

export type Coupon = {
  id: string;
  code: string;
  courseId: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  course?: { id: string; title: string } | null;
  _count?: { redemptions: number };
};

export type MobileMoneySettings = {
  mvola: { numero: string; nom: string };
  orangeMoney: { numero: string; nom: string };
  airtelMoney: { numero: string; nom: string };
};

export type PaymentStats = {
  pending: number;
  validated: number;
  refused: number;
  refundRequested: number;
  refunded: number;
  totalValidated: number;
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };

// ─── Query keys ───────────────────────────────────────────────────────────────

export const pqk = {
  list: (status?: string) => ["online", "payments", status ?? "all"] as const,
  mine: () => ["online", "payments", "mine"] as const,
  stats: () => ["online", "payments", "stats"] as const,
  settings: () => ["online", "payments", "momo-settings"] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMobileMoneySettings() {
  return useQuery<MobileMoneySettings>({
    queryKey: pqk.settings(),
    queryFn: () => api("/online/payments/settings"),
    staleTime: 5 * 60_000,
  });
}

export function useMyPayments() {
  return useQuery<CoursePayment[]>({
    queryKey: pqk.mine(),
    queryFn: () => api("/online/payments/mine"),
  });
}

export function useAdminPayments(params: { page?: number; status?: string; q?: string } = {}) {
  return useQuery<Paginated<CoursePayment>>({
    queryKey: pqk.list(params.status),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params.page) sp.set("page", String(params.page));
      if (params.status) sp.set("status", params.status);
      if (params.q) sp.set("q", params.q);
      return api(`/online/payments?${sp}`);
    },
  });
}

export function usePaymentStats() {
  return useQuery<PaymentStats>({
    queryKey: pqk.stats(),
    queryFn: () => api("/online/payments/stats"),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation<CoursePayment, Error, {
    courseId: string;
    method: PaymentMethod;
    senderNumber: string;
    transactionRef: string;
    amount: number;
    currency?: string;
    remark?: string;
    screenshotUrl?: string;
    couponCode?: string;
  }>({
    mutationFn: (data) => api("/online/payments", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pqk.mine() });
    },
  });
}

// Preview a coupon before paying (does not consume it).
export function useApplyCoupon() {
  return useMutation<CouponPreview, Error, { code: string; courseId: string }>({
    mutationFn: (body) => api("/online/payments/preview-coupon", { method: "POST", body }),
  });
}

export function useValidatePayment() {
  const qc = useQueryClient();
  return useMutation<CoursePayment, Error, string>({
    mutationFn: (id) => api(`/online/payments/${id}/validate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "payments"] });
    },
  });
}

export function useRefusePayment() {
  const qc = useQueryClient();
  return useMutation<CoursePayment, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => api(`/online/payments/${id}/refuse`, { method: "POST", body: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "payments"] });
    },
  });
}

export function useUploadScreenshot() {
  return useMutation<{ url: string }, Error, FormData>({
    mutationFn: (fd) => api("/online/payments/upload-screenshot", { method: "POST", body: fd, raw: true }),
  });
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export function useRequestRefund() {
  const qc = useQueryClient();
  return useMutation<CoursePayment, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => api(`/online/payments/${id}/request-refund`, { method: "POST", body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "payments"] }),
  });
}

export function useApproveRefund() {
  const qc = useQueryClient();
  return useMutation<CoursePayment, Error, string>({
    mutationFn: (id) => api(`/online/payments/${id}/refund`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "payments"] }),
  });
}

export function useRejectRefund() {
  const qc = useQueryClient();
  return useMutation<CoursePayment, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => api(`/online/payments/${id}/reject-refund`, { method: "POST", body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "payments"] }),
  });
}

// ─── Coupon management (teacher / admin) ──────────────────────────────────────

export function useCoupons(courseId?: string) {
  return useQuery<Coupon[]>({
    queryKey: ["online", "coupons", courseId ?? "all"],
    queryFn: () => api(`/online/coupons${courseId ? `?courseId=${courseId}` : ""}`),
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation<Coupon, Error, {
    code: string; courseId?: string | null; discountType: "PERCENT" | "FIXED";
    discountValue: number; maxRedemptions?: number | null; expiresAt?: string | null;
  }>({
    mutationFn: (body) => api("/online/coupons", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "coupons"] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation<Coupon, Error, { id: string; isActive?: boolean; maxRedemptions?: number | null; expiresAt?: string | null }>({
    mutationFn: ({ id, ...body }) => api(`/online/coupons/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "coupons"] }),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => api(`/online/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "coupons"] }),
  });
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export type SubscriptionStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "REFUSED";

export type SubscriptionPlan = {
  features?: string[];
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  durationDays: number;
  scope: string;
  isFeatured: boolean;
  isActive: boolean;
  _count?: { subscriptions: number };
};

export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  amount: number;
  reference: string;
  method: string;
  createdAt: string;
  plan: { id: string; name: string; durationDays: number; price: number; currency: string };
  student?: { id: string; firstName: string; lastName: string; email: string };
};

export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ["online", "sub-plans"],
    queryFn: () => api("/online/subscription/plans"),
  });
}

export function useMyActiveSubscription() {
  return useQuery<Subscription | null>({
    queryKey: ["online", "my-subscription"],
    queryFn: () => api("/online/subscription/me"),
  });
}

export function useMySubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ["online", "my-subscriptions"],
    queryFn: () => api("/online/subscription/mine"),
  });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation<Subscription, Error, {
    planId: string; method: PaymentMethod; senderNumber: string; transactionRef: string; screenshotUrl?: string;
  }>({
    mutationFn: (body) => api("/online/subscription/subscribe", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online", "my-subscription"] });
      qc.invalidateQueries({ queryKey: ["online", "my-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["online", "course"] });
    },
  });
}

// ── Admin ──
export function useAllPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ["online", "sub-plans", "all"],
    queryFn: () => api("/online/subscription/plans/all"),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation<SubscriptionPlan, Error, {
    name: string; description?: string; price: number; durationDays: number; scope?: string; isFeatured?: boolean;
  }>({
    mutationFn: (body) => api("/online/subscription/plans", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "sub-plans"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation<SubscriptionPlan, Error, { id: string; [k: string]: unknown }>({
    mutationFn: ({ id, ...body }) => api(`/online/subscription/plans/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "sub-plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api(`/online/subscription/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "sub-plans"] }),
  });
}

export function useAdminSubscriptions(params: { status?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  return useQuery<Paginated<Subscription>>({
    queryKey: ["online", "admin-subscriptions", params],
    queryFn: () => api(`/online/subscription/admin/list?${qs}`),
  });
}

export function useSubscriptionStats() {
  return useQuery<{ active: number; pendingValidation: number; expired: number; revenue: number }>({
    queryKey: ["online", "subscription-stats"],
    queryFn: () => api("/online/subscription/admin/stats"),
  });
}

export function useValidateSubscription() {
  const qc = useQueryClient();
  return useMutation<Subscription, Error, string>({
    mutationFn: (id) => api(`/online/subscription/admin/${id}/validate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "admin-subscriptions"] }),
  });
}

export function useRefuseSubscription() {
  const qc = useQueryClient();
  return useMutation<Subscription, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => api(`/online/subscription/admin/${id}/refuse`, { method: "POST", body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "admin-subscriptions"] }),
  });
}
