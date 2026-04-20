import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetParkingAreas, type ParkingAreaDto } from "@/lib/api-client";

const STORAGE_KEY = "smart-parking-area-id";

export type ParkingAreaSummary = ParkingAreaDto;

type ParkingAreaContextValue = {
  areas: ParkingAreaSummary[];
  isLoading: boolean;
  isError: boolean;
  /** Empty until areas load and a valid site is chosen. */
  selectedAreaId: string;
  setSelectedAreaId: (areaId: string) => void;
  selectedArea: ParkingAreaSummary | undefined;
};

const ParkingAreaContext = createContext<ParkingAreaContextValue | null>(null);

export function ParkingAreaProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: areas = [], isLoading, isError } = useGetParkingAreas();

  const [selectedAreaId, setSelectedAreaIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const validIds = useMemo(() => new Set(areas.map((a) => a.areaId)), [areas]);

  useEffect(() => {
    if (areas.length === 0) return;
    if (!selectedAreaId || !validIds.has(selectedAreaId)) {
      const next = areas[0].areaId;
      setSelectedAreaIdState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    }
  }, [areas, selectedAreaId, validIds]);

  const setSelectedAreaId = useCallback(
    (areaId: string) => {
      setSelectedAreaIdState(areaId);
      try {
        localStorage.setItem(STORAGE_KEY, areaId);
      } catch {
        /* ignore */
      }
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const selectedArea = useMemo(
    () => areas.find((a) => a.areaId === selectedAreaId),
    [areas, selectedAreaId],
  );

  const value = useMemo<ParkingAreaContextValue>(
    () => ({
      areas,
      isLoading,
      isError,
      selectedAreaId: selectedAreaId || (areas[0]?.areaId ?? ""),
      setSelectedAreaId,
      selectedArea,
    }),
    [areas, isLoading, isError, selectedAreaId, setSelectedAreaId, selectedArea],
  );

  return <ParkingAreaContext.Provider value={value}>{children}</ParkingAreaContext.Provider>;
}

export function useParkingArea(): ParkingAreaContextValue {
  const ctx = useContext(ParkingAreaContext);
  if (!ctx) {
    throw new Error("useParkingArea must be used within ParkingAreaProvider");
  }
  return ctx;
}
