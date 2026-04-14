import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyCar,
  useGetCurrentFee,
  useExitParking,
  getGetDashboardQueryKey,
  getGetMyCarQueryKey,
  getGetSlotsQueryKey,
  getGetCurrentFeeQueryKey,
} from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  MapPin,
  Clock,
  IndianRupee,
  Navigation,
  LogOut,
  CheckCircle2,
  Search,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export function MyCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState<{ carNumber?: string } | null>(null);
  const [exited, setExited] = useState(false);
  const [exitData, setExitData] = useState<{ fee: number; slotId: string } | null>(null);

  const { data: myCarData, isLoading } = useGetMyCar(
    searchQuery ?? {},
    { query: { enabled: !!searchQuery, queryKey: getGetMyCarQueryKey(searchQuery ?? {}) } }
  );

  const session = myCarData?.session;

  const { data: feeData } = useGetCurrentFee(
    session?.sessionId ?? 0,
    { query: { enabled: !!session?.sessionId && session?.paymentStatus === "parked", queryKey: getGetCurrentFeeQueryKey(session?.sessionId ?? 0), refetchInterval: 30000 } }
  );

  const exitMutation = useExitParking();

  function handleSearch() {
    if (!searchValue.trim()) { toast({ title: "Please enter your car number", variant: "destructive" }); return; }
    setExited(false);
    setSearchQuery({ carNumber: searchValue.trim().toUpperCase() });
  }

  function handleExit() {
    if (!session) return;
    exitMutation.mutate({ sessionId: session.sessionId }, {
      onSuccess: (data) => {
        const d = data as unknown as { estimatedFee?: number; slotId: string };
        setExited(true);
        setExitData({ fee: d.estimatedFee ?? 0, slotId: d.slotId });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSlotsQueryKey() });
        toast({ title: "Exit complete!", description: `Total fee: ₹${d.estimatedFee ?? 0}` });
      },
      onError: () => toast({ title: "Exit failed", variant: "destructive" }),
    });
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    parked: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Search */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-500" />
            Find Your Car
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. KA 05 AB 1234"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? "..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exit success */}
      {exited && exitData && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <h3 className="text-xl font-bold text-slate-900">Exit Successful</h3>
            <p className="text-slate-600">Slot <strong>{exitData.slotId}</strong> is now free</p>
            <div className="text-3xl font-bold text-emerald-700">₹{exitData.fee.toFixed(0)}</div>
            <p className="text-sm text-slate-500">Total fee charged. Thank you for parking!</p>
          </CardContent>
        </Card>
      )}

      {/* Session card */}
      {searchQuery && !exited && (
        isLoading ? (
          <Card className="border-slate-200 animate-pulse"><CardContent className="pt-6 h-32" /></Card>
        ) : !myCarData?.found ? (
          <Card className="border-dashed text-center py-10">
            <Car className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{myCarData?.message ?? "No active session found."}</p>
          </Card>
        ) : session ? (
          <div className="space-y-4">
            {/* Main info */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-mono font-bold text-slate-900">{session.slotId}</div>
                    <div className="text-sm text-slate-500 mt-0.5">Level {session.slot?.level}</div>
                  </div>
                  <Badge className={`text-xs ${statusColors[session.paymentStatus] ?? statusColors.pending}`}>
                    {session.paymentStatus.charAt(0).toUpperCase() + session.paymentStatus.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Car className="h-3 w-3" /> Car Number</div>
                    <div className="font-mono font-semibold text-slate-900">{session.carNumber}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500 text-xs mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Slot Type</div>
                    <div className="font-medium text-slate-900 capitalize">{session.slot?.slotType ?? "standard"}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Booked At</div>
                    <div className="font-medium text-slate-900 text-xs">{new Date(session.bookingTime).toLocaleTimeString()}</div>
                  </div>
                  {session.parkingStartTime && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-slate-500 text-xs mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Parking Started</div>
                      <div className="font-medium text-slate-900 text-xs">{new Date(session.parkingStartTime).toLocaleTimeString()}</div>
                    </div>
                  )}
                </div>

                {/* Live fee */}
                {feeData && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-indigo-600 font-medium uppercase tracking-wide">Current Charges</div>
                        <div className="text-3xl font-bold text-indigo-700 mt-1">₹{feeData.currentFeeInr.toFixed(0)}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {feeData.durationMinutes} min parked · ₹{feeData.pricePerHour}/hr
                        </div>
                      </div>
                      <IndianRupee className="h-10 w-10 text-indigo-200" />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{feeData.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Route directions */}
            {session.routeSteps && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <Navigation className="h-4 w-4 text-indigo-600" />
                  <CardTitle className="text-sm font-medium">Directions to Slot</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 leading-relaxed">{session.routeSteps}</p>
                </CardContent>
              </Card>
            )}

            {/* QR Code */}
            {session.qrData && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <QrCode className="h-4 w-4 text-slate-600" />
                  <CardTitle className="text-sm font-medium">Exit QR Code</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-2">
                  <QRCodeSVG value={session.qrData} size={180} level="M" />
                  <p className="text-xs text-slate-500">Scan at the exit barrier for quick checkout</p>
                </CardContent>
              </Card>
            )}

            {/* Exit button */}
            {session.paymentStatus !== "completed" && (
              <Button
                size="lg"
                variant="destructive"
                className="w-full h-12"
                onClick={handleExit}
                disabled={exitMutation.isPending}
              >
                <LogOut className="mr-2 h-5 w-5" />
                {exitMutation.isPending ? "Processing Exit..." : "Exit Parking — Pay & Leave"}
              </Button>
            )}
          </div>
        ) : null
      )}
    </div>
  );
}
