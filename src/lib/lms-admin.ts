import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LmsSettings {
  platformName: string;
  platformTagline: string;
  platformDescription: string;
  logoUrl: string;
  faviconUrl: string;
  bannerUrl: string;
  bannerSubtitle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  socialFacebook: string;
  socialTwitter: string;
  socialLinkedin: string;
  socialYoutube: string;
  socialInstagram: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  footerText: string;
  defaultLanguage: string;
  defaultCurrency: string;
  timezone: string;
  allowRegistration: string;
  requireEmailVerification: string;
  maintenanceMode: string;
  mvolaNom: string;
  mvolaNumero: string;
  orangeMoneyNom: string;
  orangeMoneyNumero: string;
  airtelMoneyNom: string;
  airtelMoneyNumero: string;
}

export interface NavItem {
  id: string;
  label: string;
  url: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  openInTab: boolean;
  roles: string[];
  parentId: string | null;
  children: NavItem[];
  createdAt: string;
}

export interface HomeSection {
  id: string;
  type: string;
  title: string | null;
  isActive: boolean;
  order: number;
  config: Record<string, unknown> | null;
}

export interface OnlineCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  children: OnlineCategory[];
  _count: { courses: number };
}

export interface MediaFile {
  id: string;
  name: string;
  originalName: string | null;
  url: string;
  type: string;
  size: number | null;
  mimeType: string | null;
  createdAt: string;
  uploader?: { id: string; firstName: string; lastName: string };
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  avatar: string | null;
  content: string;
  rating: number;
  isActive: boolean;
  order: number;
  createdAt: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminCourse {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  isFeatured: boolean;
  level: string | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  category: { id: string; name: string } | null;
  _count: { modules: number; enrollments: number };
}

export interface AdminTeacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  systemRole: string;
  isActive: boolean;
  createdAt: string;
  _count: { onlineCourses: number };
}

export interface AdminDashboard {
  courses: number;
  students: number;
  teachers: number;
  enrollments: number;
  certificates: number;
  coursesByStatus: { published: number; draft: number; archived: number };
  recentEnrollments: Array<{
    id: string;
    createdAt: string;
    progress: number;
    course: { title: string };
  }>;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function useLmsSettings() {
  return useQuery<LmsSettings>({
    queryKey: ["lms", "settings"],
    queryFn: () => api("/lms-admin/settings"),
  });
}

export function usePublicSettings() {
  return useQuery<LmsSettings>({
    queryKey: ["lms", "public-settings"],
    queryFn: () => api("/online/public/settings", { auth: false }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation<LmsSettings, Error, Partial<LmsSettings>>({
    mutationFn: (data) => api("/lms-admin/settings", { method: "PUT", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms", "settings"] });
      qc.invalidateQueries({ queryKey: ["lms", "public-settings"] });
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation<{ url: string }, Error, FormData>({
    mutationFn: (fd) => api("/lms-admin/upload-logo", { method: "POST", body: fd, raw: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms", "settings"] });
      qc.invalidateQueries({ queryKey: ["lms", "public-settings"] });
    },
  });
}

export function useUploadBanner() {
  const qc = useQueryClient();
  return useMutation<{ url: string }, Error, FormData>({
    mutationFn: (fd) => api("/lms-admin/upload-banner", { method: "POST", body: fd, raw: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms", "settings"] });
      qc.invalidateQueries({ queryKey: ["lms", "public-settings"] });
    },
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

export function useAdminNav() {
  return useQuery<NavItem[]>({
    queryKey: ["lms", "nav"],
    queryFn: () => api("/lms-admin/nav"),
  });
}

export function usePublicNav() {
  return useQuery<NavItem[]>({
    queryKey: ["lms", "public-nav"],
    queryFn: () => api("/online/public/nav", { auth: false }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateNavItem() {
  const qc = useQueryClient();
  return useMutation<NavItem, Error, Partial<NavItem>>({
    mutationFn: (data) => api("/lms-admin/nav", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "nav"] }),
  });
}

export function useUpdateNavItem() {
  const qc = useQueryClient();
  return useMutation<NavItem, Error, { id: string; data: Partial<NavItem> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/nav/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "nav"] }),
  });
}

export function useDeleteNavItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/nav/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "nav"] }),
  });
}

// ── Homepage Sections ─────────────────────────────────────────────────────────

export function useHomeSections() {
  return useQuery<HomeSection[]>({
    queryKey: ["lms", "home-sections"],
    queryFn: () => api("/lms-admin/home-sections"),
  });
}

export function useUpdateHomeSection() {
  const qc = useQueryClient();
  return useMutation<HomeSection, Error, { id: string; data: Partial<HomeSection> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/home-sections/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "home-sections"] }),
  });
}

export function useReorderHomeSections() {
  const qc = useQueryClient();
  return useMutation<HomeSection[], Error, Array<{ id: string; order: number }>>({
    mutationFn: (items) => api("/lms-admin/home-sections/reorder", { method: "PUT", body: items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "home-sections"] }),
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useAdminCategories() {
  return useQuery<OnlineCategory[]>({
    queryKey: ["lms", "categories"],
    queryFn: () => api("/lms-admin/categories"),
  });
}

export function usePublicCategories() {
  return useQuery<OnlineCategory[]>({
    queryKey: ["lms", "public-categories"],
    queryFn: () => api("/online/public/categories", { auth: false }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation<OnlineCategory, Error, Partial<OnlineCategory>>({
    mutationFn: (data) => api("/lms-admin/categories", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation<OnlineCategory, Error, { id: string; data: Partial<OnlineCategory> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/categories/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "categories"] }),
  });
}

// ── Admin Courses ─────────────────────────────────────────────────────────────

export function useAdminCourses(params: { page?: number; q?: string; status?: string; categoryId?: string } = {}) {
  return useQuery<{ items: AdminCourse[]; total: number; page: number; limit: number }>({
    queryKey: ["lms", "admin-courses", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.q) qs.set("q", params.q);
      if (params.status) qs.set("status", params.status);
      if (params.categoryId) qs.set("categoryId", params.categoryId);
      return api(`/lms-admin/courses?${qs}`);
    },
  });
}

export function useAdminCreateCourse() {
  const qc = useQueryClient();
  return useMutation<AdminCourse, Error, Partial<AdminCourse> & { teacherId: string }>({
    mutationFn: (data) => api("/lms-admin/courses", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "admin-courses"] }),
  });
}

export function useAdminUpdateCourse() {
  const qc = useQueryClient();
  return useMutation<AdminCourse, Error, { id: string; data: Partial<AdminCourse> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/courses/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms", "admin-courses"] });
      qc.invalidateQueries({ queryKey: ["online", "courses"] });
    },
  });
}

export function useAdminDeleteCourse() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "admin-courses"] }),
  });
}

export function useAdminDuplicateCourse() {
  const qc = useQueryClient();
  return useMutation<AdminCourse, Error, string>({
    mutationFn: (id) => api(`/lms-admin/courses/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "admin-courses"] }),
  });
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export function useAdminTeachers(params: { page?: number; q?: string } = {}) {
  return useQuery<{ items: AdminTeacher[]; total: number }>({
    queryKey: ["lms", "teachers", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.q) qs.set("q", params.q);
      return api(`/lms-admin/teachers?${qs}`);
    },
  });
}

export function useAdminUpdateTeacher() {
  const qc = useQueryClient();
  return useMutation<AdminTeacher, Error, { id: string; data: Partial<AdminTeacher> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/teachers/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "teachers"] }),
  });
}

// ── Students ──────────────────────────────────────────────────────────────────

export function useAdminStudents(params: { page?: number; q?: string } = {}) {
  return useQuery<{ items: Array<{
    id: string; firstName: string; lastName: string; email: string;
    avatarUrl: string | null; isActive: boolean; createdAt: string;
    _count: { learningActivities: number };
  }>; total: number }>({
    queryKey: ["lms", "students", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.q) qs.set("q", params.q);
      return api(`/lms-admin/students?${qs}`);
    },
  });
}

// ── Media ─────────────────────────────────────────────────────────────────────

export function useAdminMedia(params: { page?: number; q?: string; type?: string } = {}) {
  return useQuery<{ items: MediaFile[]; total: number; page: number; limit: number }>({
    queryKey: ["lms", "media", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.q) qs.set("q", params.q);
      if (params.type) qs.set("type", params.type);
      return api(`/lms-admin/media?${qs}`);
    },
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation<MediaFile, Error, FormData>({
    mutationFn: (formData) => api("/lms-admin/media/upload", { method: "POST", body: formData, raw: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "media"] }),
  });
}

export function useAddMediaLink() {
  const qc = useQueryClient();
  return useMutation<MediaFile, Error, { name: string; url: string; type: string }>({
    mutationFn: (data) => api("/lms-admin/media/link", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "media"] }),
  });
}

export function useUpdateMedia() {
  const qc = useQueryClient();
  return useMutation<MediaFile, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) => api(`/lms-admin/media/${id}`, { method: "PUT", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "media"] }),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/media/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "media"] }),
  });
}

// ── Testimonials ──────────────────────────────────────────────────────────────

export function useTestimonials() {
  return useQuery<Testimonial[]>({
    queryKey: ["lms", "testimonials"],
    queryFn: () => api("/lms-admin/testimonials"),
  });
}

export function useCreateTestimonial() {
  const qc = useQueryClient();
  return useMutation<Testimonial, Error, Partial<Testimonial>>({
    mutationFn: (data) => api("/lms-admin/testimonials", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "testimonials"] }),
  });
}

export function useUpdateTestimonial() {
  const qc = useQueryClient();
  return useMutation<Testimonial, Error, { id: string; data: Partial<Testimonial> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/testimonials/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "testimonials"] }),
  });
}

export function useDeleteTestimonial() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/testimonials/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "testimonials"] }),
  });
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export function useFaqItems() {
  return useQuery<FaqItem[]>({
    queryKey: ["lms", "faq"],
    queryFn: () => api("/lms-admin/faq"),
  });
}

export function useCreateFaqItem() {
  const qc = useQueryClient();
  return useMutation<FaqItem, Error, Partial<FaqItem>>({
    mutationFn: (data) => api("/lms-admin/faq", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "faq"] }),
  });
}

export function useUpdateFaqItem() {
  const qc = useQueryClient();
  return useMutation<FaqItem, Error, { id: string; data: Partial<FaqItem> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/faq/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "faq"] }),
  });
}

export function useDeleteFaqItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/faq/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "faq"] }),
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery<AdminDashboard>({
    queryKey: ["lms", "dashboard"],
    queryFn: () => api("/lms-admin/dashboard"),
    staleTime: 30 * 1000,
  });
}

// ── User Management ───────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  systemRole: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  tempPassword?: string;
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export const userKeys = {
  list: (p: Record<string, unknown>) => ["lms", "users", p] as const,
};

export function useAdminUsers(params: { page?: number; limit?: number; q?: string; role?: string; status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page)   qs.set("page",   String(params.page));
  if (params.limit)  qs.set("limit",  String(params.limit));
  if (params.q)      qs.set("q",      params.q);
  if (params.role)   qs.set("role",   params.role);
  if (params.status) qs.set("status", params.status);
  return useQuery<AdminUsersPage>({
    queryKey: userKeys.list(params),
    queryFn: () => api(`/lms-admin/users?${qs}`),
  });
}

export function useAdminCreateUser() {
  const qc = useQueryClient();
  return useMutation<AdminUser & { tempPassword: string }, Error, Partial<AdminUser>>({
    mutationFn: (data) => api("/lms-admin/users", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "users"] }),
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation<AdminUser, Error, { id: string; data: Partial<AdminUser> }>({
    mutationFn: ({ id, data }) => api(`/lms-admin/users/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "users"] }),
  });
}

export function useAdminToggleActive() {
  const qc = useQueryClient();
  return useMutation<AdminUser, Error, string>({
    mutationFn: (id) => api(`/lms-admin/users/${id}/toggle-active`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "users"] }),
  });
}

export function useAdminResetPassword() {
  return useMutation<{ tempPassword: string }, Error, string>({
    mutationFn: (id) => api(`/lms-admin/users/${id}/reset-password`, { method: "POST" }),
  });
}

export function useAdminDeleteUser() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api(`/lms-admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "users"] }),
  });
}


// ── Certificates registry ─────────────────────────────────────────────────────

export interface AdminCertificate {
  id: string;
  code: string;
  issuedAt: string;
  progress: number | null;
  course: { id: string; title: string };
  student: { id: string; firstName: string; lastName: string; email: string };
}

export function useAdminCertificates(params: { page?: number; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.q) qs.set("q", params.q);
  return useQuery<{ items: AdminCertificate[]; total: number; page: number; limit: number }>({
    queryKey: ["lms", "certificates", params],
    queryFn: () => api(`/lms-admin/certificates?${qs}`),
  });
}

// ── Live sessions registry ────────────────────────────────────────────────────

export interface AdminLiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMin: number;
  status: string;
  link: string | null;
  course: { id: string; title: string };
  teacher: { id: string; firstName: string; lastName: string };
}

export function useAdminLiveSessions(params: { page?: number; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.q) qs.set("q", params.q);
  return useQuery<{ items: AdminLiveSession[]; total: number; page: number; limit: number }>({
    queryKey: ["lms", "live-sessions", params],
    queryFn: () => api(`/lms-admin/live-sessions?${qs}`),
  });
}

// ── Announcements registry ────────────────────────────────────────────────────

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  course: { id: string; title: string };
  author: { id: string; firstName: string; lastName: string } | null;
}

export function useAdminAnnouncements(params: { page?: number; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.q) qs.set("q", params.q);
  return useQuery<{ items: AdminAnnouncement[]; total: number; page: number; limit: number }>({
    queryKey: ["lms", "announcements", params],
    queryFn: () => api(`/lms-admin/announcements?${qs}`),
  });
}

export function useAdminDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/lms-admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "announcements"] }),
  });
}

// ── Reviews moderation ────────────────────────────────────────────────────────

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  isHidden: boolean;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  course: { id: string; title: string };
}

export function useAdminReviews(params: { page?: number; q?: string; hidden?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.q) qs.set("q", params.q);
  if (params.hidden !== undefined) qs.set("hidden", String(params.hidden));
  return useQuery<{ items: AdminReview[]; total: number; page: number; limit: number }>({
    queryKey: ["lms", "reviews", params],
    queryFn: () => api(`/lms-admin/reviews?${qs}`),
  });
}

export function useAdminSetReviewHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
      api(`/lms-admin/reviews/${id}/hidden`, { method: "PATCH", body: { isHidden } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "reviews"] }),
  });
}

export function useAdminDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/lms-admin/reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lms", "reviews"] }),
  });
}
