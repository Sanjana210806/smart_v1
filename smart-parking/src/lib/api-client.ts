import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getAuthToken } from "./auth-storage";

/** Matches `GET /api/areas` rows from the API. */
export type ParkingAreaDto = {
  areaId: string;
  slug: string;
  name: string;
  kind: "mall" | "metro" | "office";
  levels: string[];
};

/** Matches `GET /api/me/cars`. */
export type UserCarDto = {
  id: number;
  userId: string;
  carNumber: string;
};

let baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

/** Local dev: default to same host as typical api-server (no SQL — API uses in-memory slots). */
const DEV_DEFAULT_API = "http://localhost:8080";

export function setBaseUrl(url: string): void {
  baseUrl = url.trim();
}

export function getResolvedApiBaseUrl(): string {
  let resolved = baseUrl.replace(/\/$/, "");
  if (!resolved && import.meta.env.DEV) {
    resolved = DEV_DEFAULT_API.replace(/\/$/, "");
  }
  return resolved;
}

function areaBase(areaId: string): string {
  return `/api/areas/${encodeURIComponent(areaId)}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getResolvedApiBaseUrl();
  if (!base) {
    throw new Error(
      "VITE_API_BASE_URL is not set. For production builds (e.g. GitHub Pages), set it to your API origin. For local dev, run the api-server on port 8080 or set VITE_API_BASE_URL in .env.local.",
    );
  }

  const token = getAuthToken();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = errorText;
    try {
      const j = JSON.parse(errorText) as { error?: unknown; message?: unknown };
      if (typeof j.error === "string") msg = j.error;
      else if (typeof j.message === "string") msg = j.message;
    } catch {
      /* use raw body */
    }
    throw new Error(msg || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getParkingAreasQueryKey() {
  return ["parking-areas"] as const;
}

export function useGetParkingAreas(
  options?: { query?: Omit<UseQueryOptions<ParkingAreaDto[]>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getParkingAreasQueryKey(),
    queryFn: () => apiRequest<ParkingAreaDto[]>("/api/areas"),
    staleTime: 5 * 60 * 1000,
    ...(options?.query ?? {}),
  });
}

export function getGetDashboardQueryKey(areaId?: string) {
  return ["dashboard", areaId] as const;
}

export function useGetDashboard(
  areaId: string | undefined,
  options?: { query?: Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getGetDashboardQueryKey(areaId),
    queryFn: () => apiRequest(`${areaBase(areaId!)}/dashboard`),
    enabled: Boolean(areaId),
    ...(options?.query ?? {}),
  });
}

export function getGetSlotsQueryKey(areaId: string | undefined, params?: { level?: string; slotType?: string }) {
  return ["slots", areaId, params ?? {}] as const;
}

export function useGetSlots(
  areaId: string | undefined,
  params?: { level?: string; slotType?: string },
  options?: { query?: Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn"> },
) {
  const search = new URLSearchParams();
  if (params?.level) search.set("level", params.level);
  if (params?.slotType) search.set("slotType", params.slotType);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: getGetSlotsQueryKey(areaId, params),
    queryFn: () => apiRequest(`${areaBase(areaId!)}/slots${suffix}`),
    enabled: Boolean(areaId),
    ...(options?.query ?? {}),
  });
}

export function getGetSessionsQueryKey(
  areaId: string | undefined,
  params?: { userId?: string; status?: string },
) {
  return ["sessions", areaId, params ?? {}] as const;
}

export function useGetSessions(
  areaId: string | undefined,
  params?: { userId?: string; status?: string },
  options?: { query?: Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn"> },
) {
  const search = new URLSearchParams();
  if (params?.userId) search.set("userId", params.userId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: getGetSessionsQueryKey(areaId, params),
    queryFn: () => apiRequest(`${areaBase(areaId!)}/sessions${suffix}`),
    enabled: Boolean(areaId),
    ...(options?.query ?? {}),
  });
}

export function getGetCurrentFeeQueryKey(areaId: string | undefined, sessionId: number) {
  return ["current-fee", areaId, sessionId] as const;
}

export function useGetCurrentFee(
  areaId: string | undefined,
  sessionId: number,
  options?: { query?: Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getGetCurrentFeeQueryKey(areaId, sessionId),
    queryFn: () => apiRequest(`${areaBase(areaId!)}/sessions/${sessionId}/fee`),
    enabled: Boolean(areaId && sessionId > 0),
    ...(options?.query ?? {}),
  });
}

export function getGetMyCarQueryKey(
  areaId: string | undefined,
  params?: { userId?: string; carNumber?: string },
) {
  return ["my-car", areaId, params ?? {}] as const;
}

export function useGetMyCar(
  areaId: string | undefined,
  params?: { userId?: string; carNumber?: string },
  options?: { query?: Omit<UseQueryOptions<unknown>, "queryKey" | "queryFn"> },
) {
  const search = new URLSearchParams();
  if (params?.userId) search.set("userId", params.userId);
  if (params?.carNumber) search.set("carNumber", params.carNumber);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: getGetMyCarQueryKey(areaId, params),
    queryFn: () => apiRequest(`${areaBase(areaId!)}/my-car${suffix}`),
    enabled: Boolean(areaId),
    ...(options?.query ?? {}),
  });
}

export function useRecommendSlots(areaId: string | undefined) {
  return useMutation({
    mutationFn: (payload: { data: Record<string, unknown> }) =>
      apiRequest(`${areaBase(areaId!)}/recommend`, {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

export function useBookSlot(areaId: string | undefined) {
  return useMutation({
    mutationFn: (payload: { data: Record<string, unknown> }) =>
      apiRequest(`${areaBase(areaId!)}/book`, {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

export function useStartParking(areaId: string | undefined) {
  return useMutation({
    mutationFn: (payload: { sessionId: number }) =>
      apiRequest(`${areaBase(areaId!)}/sessions/${payload.sessionId}/start`, { method: "POST" }),
  });
}

export function useExitParking(areaId: string | undefined) {
  return useMutation({
    mutationFn: (payload: { sessionId: number }) =>
      apiRequest(`${areaBase(areaId!)}/sessions/${payload.sessionId}/exit`, { method: "POST" }),
  });
}

export function getMyCarsQueryKey() {
  return ["my-cars"] as const;
}

/** Matches `GET /api/me/bookings` rows (all sites for the signed-in user). */
export type MyBookingDto = {
  sessionId: number;
  areaId: string;
  areaName: string;
  userId: string;
  carNumber: string;
  slotId: string;
  bookingTime: string;
  parkingStartTime?: string | null;
  exitTime?: string | null;
  estimatedFee?: number | null;
  paymentStatus: string;
  durationMinutes?: number | null;
  slot?: { level: string; slotType: string } | null;
};

export function getMyBookingsQueryKey() {
  return ["my-bookings"] as const;
}

export function useGetMyBookings(
  options?: { query?: Omit<UseQueryOptions<MyBookingDto[]>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getMyBookingsQueryKey(),
    queryFn: () => apiRequest<MyBookingDto[]>("/api/me/bookings"),
    staleTime: 30 * 1000,
    ...(options?.query ?? {}),
  });
}

export function useGetMyCars(
  options?: { query?: Omit<UseQueryOptions<UserCarDto[]>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getMyCarsQueryKey(),
    queryFn: () => apiRequest<UserCarDto[]>("/api/me/cars"),
    staleTime: 60 * 1000,
    ...(options?.query ?? {}),
  });
}

export function useAddMyCar() {
  return useMutation({
    mutationFn: (payload: { carNumber: string }) =>
      apiRequest<UserCarDto>("/api/me/cars", {
        method: "POST",
        body: JSON.stringify({ carNumber: payload.carNumber }),
      }),
  });
}

export function useDeleteMyCar() {
  return useMutation({
    mutationFn: (payload: { carNumber: string }) =>
      apiRequest<{ ok: boolean; removed: number }>(
        `/api/me/cars/${encodeURIComponent(payload.carNumber)}`,
        { method: "DELETE" },
      ),
  });
}

export type AdminUserSummaryDto = {
  username: string;
  role: "admin" | "user";
  carCount: number;
};

export function getAdminUsersQueryKey() {
  return ["admin-users"] as const;
}

export function useListAdminUsers(
  options?: { query?: Omit<UseQueryOptions<AdminUserSummaryDto[]>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getAdminUsersQueryKey(),
    queryFn: () => apiRequest<AdminUserSummaryDto[]>("/api/admin/users"),
    ...(options?.query ?? {}),
  });
}

export function useCreateAdminUser() {
  return useMutation({
    mutationFn: (payload: {
      username: string;
      password: string;
      role: "admin" | "user";
      cars: string[];
    }) =>
      apiRequest<{ user: { username: string; role: string }; cars: UserCarDto[]; warning?: string }>(
        "/api/admin/users",
        { method: "POST", body: JSON.stringify(payload) },
      ),
  });
}
