import { useGetSessions, getGetSessionsQueryKey } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";

type Session = {
  sessionId: number;
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    parked: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status] ?? styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function HistoryPage() {
  const { data: sessions, isLoading } = useGetSessions(
    {},
    { query: { queryKey: getGetSessionsQueryKey({}) } }
  );

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed text-center py-16">
          <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No booking history yet.</p>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-sm font-medium">
              {sessions.length} booking{sessions.length !== 1 ? "s" : ""} total
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Car</th>
                  <th className="px-4 py-3 text-left">Slot</th>
                  <th className="px-4 py-3 text-left">Level</th>
                  <th className="px-4 py-3 text-left">Booked</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-right">Fee (₹)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {(sessions as unknown as Session[]).map((session, i) => (
                  <tr
                    key={session.sessionId}
                    className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{session.carNumber}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{session.slotId}</td>
                    <td className="px-4 py-3 text-slate-600">{session.slot?.level ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{new Date(session.bookingTime).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {session.parkingStartTime
                        ? new Date(session.parkingStartTime).toLocaleTimeString()
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {session.durationMinutes != null
                        ? `${session.durationMinutes} min`
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {session.estimatedFee != null
                        ? `₹${session.estimatedFee.toFixed(0)}`
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={session.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
