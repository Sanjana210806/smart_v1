import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";

let baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

export function setBaseUrl(url: string): void {
  baseUrl = url.trim();
}

function getApiBaseUrl(): string {
  return baseUrl ? baseUrl.replace(/\/$/, "") : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getGetDashboardQueryKey() {
  return ["dashboard"];
}

export function useGetDashboard(options?: { query?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn"> }) {
  return useQuery({
    queryKey: getGetDashboardQueryKey(),
    queryFn: () => request("/api/dashboard"),
    ...(options?.query ?? {}),
  });
}

export function getGetSlotsQueryKey(params?: { level?: string; slotType?: string }) {
  return ["slots", params ?? {}];
}

export function useGetSlots(
  params?: { level?: string; slotType?: string },
  options?: { query?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn"> },
) {
  const search = new URLSearchParams();
  if (params?.level) search.set("level", params.level);
  if (params?.slotType) search.set("slotType", params.slotType);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: getGetSlotsQueryKey(params),
    queryFn: () => request(`/api/slots${suffix}`),
    ...(options?.query ?? {}),
  });
}

export function getGetSessionsQueryKey(params?: { userId?: string; status?: string }) {
  return ["sessions", params ?? {}];
}

export function useGetSessions(
  params?: { userId?: string; status?: string },
  options?: { query?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn"> },
) {
  const search = new URLSearchParams();
  if (params?.userId) search.set("userId", params.userId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: getGetSessionsQueryKey(params),
    queryFn: () => request(`/api/sessions${suffix}`),
    ...(options?.query ?? {}),
  });
}

export function getGetCurrentFeeQueryKey(sessionId: number) {
  return ["current-fee", sessionId];
}

export function useGetCurrentFee(
  sessionId: number,
  options?: { query?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn"> },
) {
  return useQuery({
    queryKey: getGetCurrentFeeQueryKey(sessionId),
    queryFn: () => request(`/api/sessions/${sessionId}/fee`),
    ...(options?.query ?? {}),
  });
}

export function getGetMyCarQueryKey(params?: { userId?: string; carNumber?: string }) {
  return ["my-car", params ?? {}];
}

export function useGetMyCar(
  params?: { userId?: string; carNumber?: string },
  options?: { query?: Omit<UseQueryOptions<any>, "queryKey" | "queryFn"> },
) {
  const search = new URLSearchParams();
  if (params?.userId) search.set("userId", params.userId);
  if (params?.carNumber) search.set("carNumber", params.carNumber);
  const suffix = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: getGetMyCarQueryKey(params),
    queryFn: () => request(`/api/my-car${suffix}`),
    ...(options?.query ?? {}),
  });
}

export function useRecommendSlots() {
  return useMutation({
    mutationFn: (payload: { data: Record<string, unknown> }) =>
      request("/api/recommend", {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

export function useBookSlot() {
  return useMutation({
    mutationFn: (payload: { data: Record<string, unknown> }) =>
      request("/api/book", {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

export function useStartParking() {
  return useMutation({
    mutationFn: (payload: { sessionId: number }) =>
      request(`/api/sessions/${payload.sessionId}/start`, { method: "POST" }),
  });
}

export function useExitParking() {
  return useMutation({
    mutationFn: (payload: { sessionId: number }) =>
      request(`/api/sessions/${payload.sessionId}/exit`, { method: "POST" }),
  });
}
