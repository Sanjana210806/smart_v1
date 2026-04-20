import { useEffect, useMemo, useState } from "react";
import { useGetSlots, getGetSlotsQueryKey } from "@/lib/api-client";
import { useParkingArea } from "@/lib/parking-area-context";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BatteryCharging,
  Accessibility,
  ArrowUpDown,
  IndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<string, string> = {
  B1: "Basement 1",
  B2: "Basement 2",
  GF: "Ground Floor",
  L1: "Level 1",
  L2: "Level 2",
  P1: "Platform 1",
  P2: "Platform 2",
  P3: "Platform 3",
  G: "Ground",
};

type ParkingSlot = {
  slotId: string;
  level: string;
  slotType: string;
  available: boolean;
  isPaid: boolean;
  pricePerHour: number;
  nearLift: boolean;
};

function slotColors(slot: ParkingSlot): string {
  if (!slot.available) return "bg-rose-100 border-rose-200 text-rose-800";
  if (slot.slotType === "ev")
    return "bg-blue-100 border-blue-200 text-blue-800";
  if (slot.slotType === "accessible")
    return "bg-sky-100 border-sky-200 text-sky-800";
  if (slot.slotType === "premium")
    return "bg-amber-100 border-amber-200 text-amber-800";
  return "bg-emerald-100 border-emerald-200 text-emerald-800";
}

function SlotCard({ slot }: { slot: ParkingSlot }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 text-center transition-all hover:shadow-sm",
        slotColors(slot),
      )}
    >
      <div className="font-mono font-bold text-xs leading-tight">
        {slot.slotId}
      </div>

      <div className="flex justify-center gap-0.5 mt-1">
        {slot.slotType === "ev" && <BatteryCharging className="h-3 w-3" />}
        {slot.slotType === "accessible" && (
          <Accessibility className="h-3 w-3" />
        )}
        {slot.nearLift && <ArrowUpDown className="h-2.5 w-2.5 opacity-60" />}
      </div>

      {slot.isPaid && (
        <div className="text-[9px] mt-0.5 flex items-center justify-center gap-0.5 opacity-75">
          <IndianRupee className="h-2 w-2" />
          {slot.pricePerHour}
        </div>
      )}

      {!slot.available && (
        <div className="text-[9px] font-semibold uppercase tracking-wide opacity-60 mt-0.5">
          Taken
        </div>
      )}
    </div>
  );
}

export function Levels() {
  const { selectedAreaId, selectedArea } = useParkingArea();
  const levels = selectedArea?.levels ?? [];
  const [activeLevel, setActiveLevel] = useState<string>("");

  useEffect(() => {
    if (levels.length === 0) {
      setActiveLevel("");
      return;
    }
    setActiveLevel((prev) => (prev && levels.includes(prev) ? prev : levels[0]));
  }, [selectedArea?.areaId, levels]);

  const { data: slots, isLoading, isError, error } = useGetSlots(
    selectedAreaId,
    { level: activeLevel },
    {
      query: {
        enabled: Boolean(selectedAreaId && activeLevel),
        queryKey: getGetSlotsQueryKey(selectedAreaId, { level: activeLevel }),
      },
    },
  );

  const safeSlots: ParkingSlot[] = useMemo(
    () =>
      Array.isArray(slots)
        ? slots
        : Array.isArray((slots as { slots?: unknown })?.slots)
          ? ((slots as { slots: ParkingSlot[] }).slots)
          : [],
    [slots],
  );

  const available = safeSlots.filter((s) => s.available).length;
  const total = safeSlots.length;
  const evCount = safeSlots.filter(
    (s) => s.slotType === "ev" && s.available,
  ).length;
  const accessibleCount = safeSlots.filter(
    (s) => s.slotType === "accessible" && s.available,
  ).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Level map for <strong>{selectedArea?.name ?? "…"}</strong> — switch parking site in the header to view another layout.
      </p>

      {/* Level Tabs */}
      <div className="flex gap-2 flex-wrap">
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setActiveLevel(level)}
            className={cn(
              "px-5 py-2.5 rounded-xl font-medium text-sm transition-all border",
              activeLevel === level
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
            )}
          >
            {level}
            <span className="hidden md:inline ml-2 text-xs opacity-70">
              — {LEVEL_LABELS[level] ?? level}
            </span>
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="font-bold text-slate-900 text-lg">
          {available}/{total} available
        </span>
        <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs">
          {evCount} EV free
        </span>
        <span className="text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full text-xs">
          {accessibleCount} accessible free
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "Free Standard",
            cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
          },
          {
            label: "EV Charging",
            cls: "bg-blue-100 text-blue-700 border-blue-200",
          },
          {
            label: "Accessible",
            cls: "bg-sky-100 text-sky-700 border-sky-200",
          },
          {
            label: "Premium Paid",
            cls: "bg-amber-100 text-amber-700 border-amber-200",
          },
          {
            label: "Occupied",
            cls: "bg-rose-100 text-rose-700 border-rose-200",
          },
        ].map((l) => (
          <span
            key={l.label}
            className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${l.cls}`}
          >
            {l.label}
          </span>
        ))}
      </div>

      {/* Slot Grid */}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Could not load slots from the API.</p>
          <p className="mt-1 text-destructive/90">
            {error instanceof Error ? error.message : "Request failed"}
          </p>
          <p className="mt-2 text-slate-600 text-xs">
            Start the backend (e.g. <code className="rounded bg-white px-1">api-server</code> on port{" "}
            <code className="rounded bg-white px-1">8080</code>) or set{" "}
            <code className="rounded bg-white px-1">VITE_API_BASE_URL</code> in{" "}
            <code className="rounded bg-white px-1">.env.local</code>.
          </p>
        </div>
      )}

      {!isError && isLoading ? (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from({ length: 34 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !isError ? (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {safeSlots.map((slot) => (
            <SlotCard key={slot.slotId} slot={slot} />
          ))}
        </div>
      ) : null}

      {!isLoading && !isError && safeSlots.length === 0 && activeLevel && (
        <p className="text-sm text-slate-500">
          No slots available for this level
        </p>
      )}
    </div>
  );
}
