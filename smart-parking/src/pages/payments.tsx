import { useState } from "react";
import {
  useGetSessions,
  useGetCurrentFee,
  getGetSessionsQueryKey,
  getGetCurrentFeeQueryKey,
} from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, CreditCard, Clock, CheckCircle2, Loader2 } from "lucide-react";

type Session = {
  sessionId: number;
  userId: string;
  carNumber: string;
  slotId: string;
  bookingTime: string;
  parkingStartTime?: string | null;
  estimatedFee?: number | null;
  paymentStatus: string;
  slot?: { level: string; slotType: string; isPaid: boolean; pricePerHour: number } | null;
};

function LiveFeeCard({ sessionId }: { sessionId: number }) {
  const { data, isLoading } = useGetCurrentFee(sessionId, {
    query: {
      queryKey: getGetCurrentFeeQueryKey(sessionId),
      refetchInterval: 30000,
    },
  });

  if (isLoading) return <span className="text-slate-400 text-sm">Calculating...</span>;
  if (!data) return null;

  return (
    <div className="text-right">
      <div className="text-xl font-bold text-indigo-700">₹{data.currentFeeInr.toFixed(0)}</div>
      <div className="text-xs text-slate-500">{data.durationMinutes} min · ₹{data.pricePerHour}/hr</div>
    </div>
  );
}

export function Payments() {
  const { toast } = useToast();
  const [carNumber, setCarNumber] = useState("");
  const [searchCarNumber, setSearchCarNumber] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "parked" | "completed">("all");

  const { data: sessions, isLoading } = useGetSessions(
    { userId: searchCarNumber ?? "" },
    { query: { enabled: !!searchCarNumber, queryKey: getGetSessionsQueryKey({ userId: searchCarNumber ?? "" }) } }
  );

  function handleLoad() {
    if (!carNumber.trim()) { toast({ title: "Enter a car number", variant: "destructive" }); return; }
    setSearchCarNumber(carNumber.trim().toUpperCase());
  }

  const allSessions = (sessions as unknown as Session[]) ?? [];
  const filtered = allSessions.filter((s) => {
    if (filter === "all") return true;
    return s.paymentStatus === filter;
  });

  const totalRevenue = allSessions
    .filter((s) => s.paymentStatus === "completed" && s.estimatedFee != null)
    .reduce((sum, s) => sum + (s.estimatedFee ?? 0), 0);

  const activeAmount = allSessions.filter((s) => s.paymentStatus === "parked").length;

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="border-slate-200 shadow-sm max-w-md">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-slate-500">Car Number Plate</Label>
              <Input
                placeholder="e.g. KA 05 AB 1234"
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleLoad} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {searchCarNumber && sessions && (
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-slate-500 flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Total Paid</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalRevenue.toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Active Sessions</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{activeAmount}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{allSessions.filter((s) => s.paymentStatus === "completed").length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      {searchCarNumber && sessions && (
        <div className="flex gap-2">
          {(["all", "parked", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Session cards */}
      {searchCarNumber && (
        isLoading ? (
          <div className="text-slate-500 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed text-center py-10">
            <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No payment records found.</p>
          </Card>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {filtered.map((session) => (
              <Card key={session.sessionId} className="border-slate-200 shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{session.slotId}</span>
                        <span className="text-xs text-slate-500">Level {session.slot?.level}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          session.paymentStatus === "completed"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : session.paymentStatus === "parked"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-yellow-100 text-yellow-800 border-yellow-200"
                        }`}>
                          {session.paymentStatus}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">Car: <span className="font-mono text-slate-700">{session.carNumber}</span></div>
                      <div className="text-xs text-slate-400">Booked: {new Date(session.bookingTime).toLocaleString()}</div>
                      {session.paymentStatus === "parked" && (
                        <div className="text-xs text-amber-600 font-medium mt-1">Pay at exit gate</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {session.paymentStatus === "parked" ? (
                        <LiveFeeCard sessionId={session.sessionId} />
                      ) : session.estimatedFee != null ? (
                        <div>
                          <div className="text-xl font-bold text-emerald-700">₹{session.estimatedFee.toFixed(0)}</div>
                          <div className="text-xs text-slate-500">Final charge</div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">Free</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
