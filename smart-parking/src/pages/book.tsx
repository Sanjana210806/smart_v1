import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRecommendSlots,
  useBookSlot,
  useStartParking,
  getGetDashboardQueryKey,
  getMyBookingsQueryKey,
  useGetMyCars,
} from "@/lib/api-client";
import { useParkingArea } from "@/lib/parking-area-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BatteryCharging,
  Accessibility,
  MapPin,
  ArrowUpDown,
  IndianRupee,
  CheckCircle2,
  Navigation,
  PlayCircle,
  Star,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type ParkingSlot = {
  areaId?: string;
  slotId: string;
  level: string;
  slotType: string;
  available: boolean;
  isPaid: boolean;
  pricePerHour: number;
  nearLift: boolean;
};

type ParkingSession = {
  sessionId: number;
  userId: string;
  carNumber: string;
  slotId: string;
  bookingTime: string;
  parkingStartTime?: string | null;
  paymentStatus: string;
  routeSteps?: string | null;
  qrData?: string | null;
  slot?: ParkingSlot | null;
};

function SlotTypeBadge({ slotType }: { slotType: string }) {
  const styles: Record<string, string> = {
    ev: "bg-blue-100 text-blue-800 border-blue-200",
    accessible: "bg-sky-100 text-sky-800 border-sky-200",
    premium: "bg-amber-100 text-amber-800 border-amber-200",
    standard: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const labels: Record<string, string> = {
    ev: "EV Charging",
    accessible: "Accessible",
    premium: "Premium",
    standard: "Standard",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[slotType] ?? styles.standard}`}>
      {slotType === "ev" && <BatteryCharging className="h-3 w-3" />}
      {slotType === "accessible" && <Accessibility className="h-3 w-3" />}
      {labels[slotType] ?? slotType}
    </span>
  );
}

const LEVEL_LABELS: Record<string, string> = {
  B1: "Basement 1",
  B2: "Basement 2",
  GF: "Ground Floor",
  L1: "Level 1",
  L2: "Level 2",
  P1: "Platform deck 1",
  P2: "Platform deck 2",
  P3: "Platform deck 3",
  G: "Ground",
};

export function Book() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selectedAreaId, selectedArea } = useParkingArea();

  const { data: myCars = [], isLoading: loadingMyCars } = useGetMyCars();

  const [carNumber, setCarNumber] = useState("");
  const [needsEv, setNeedsEv] = useState(false);
  const [needsAccessible, setNeedsAccessible] = useState(false);
  const [needsEasy, setNeedsEasy] = useState(false);
  const [parkingPreference, setParkingPreference] = useState<"free" | "paid" | "best">("best");
  const [preferredLevel, setPreferredLevel] = useState<string>("");

  const [recommendations, setRecommendations] = useState<ParkingSlot[]>([]);
  const [recommendSummary, setRecommendSummary] = useState<string>("");
  const [searchDone, setSearchDone] = useState(false);
  const [activeBooking, setActiveBooking] = useState<ParkingSession | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);

  const recommendMutation = useRecommendSlots(selectedAreaId);
  const bookMutation = useBookSlot(selectedAreaId);
  const startMutation = useStartParking(selectedAreaId);

  useEffect(() => {
    if (isAdmin) return;
    if (loadingMyCars || myCars.length === 0) return;
    const stillValid = myCars.some((c) => c.carNumber === carNumber);
    if (!carNumber || !stillValid) {
      setCarNumber(myCars[0].carNumber);
    }
  }, [isAdmin, loadingMyCars, myCars, carNumber]);

  function handleSearch() {
    if (!isAdmin && myCars.length === 0) {
      toast({
        title: "Add a car first",
        description: "Link at least one plate under My cars before booking.",
        variant: "destructive",
      });
      return;
    }
    if (!carNumber.trim()) {
      toast({ title: "Car number required", variant: "destructive" });
      return;
    }

    recommendMutation.mutate({
      data: {
        needsEv,
        needsAccessible,
        needsEasy,
        parkingPreference,
        preferredLevel: (preferredLevel && preferredLevel !== "any") ? preferredLevel : undefined,
      }
    }, {
      onSuccess: (res: { found?: boolean; message?: string; slots?: ParkingSlot[] }) => {
        setRecommendations(Array.isArray(res.slots) ? res.slots : []);
        setRecommendSummary(typeof res.message === "string" ? res.message : "");
        setSearchDone(true);
        if (!res.found) {
          toast({
            title: "No matching slots",
            description: res.message ?? "Adjust your filters and try again.",
            variant: "destructive",
          });
        }
      },
      onError: (e: unknown) =>
        toast({
          title: "Could not get recommendations",
          description: e instanceof Error ? e.message : "Request failed.",
          variant: "destructive",
        }),
    });
  }

  function handleBook(slot: ParkingSlot) {
    setSelectedSlot(slot);
    bookMutation.mutate({
      data: { carNumber, slotId: slot.slotId }
    }, {
      onSuccess: (session) => {
        setActiveBooking(session as unknown as ParkingSession);
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey(selectedAreaId) });
        queryClient.invalidateQueries({ queryKey: ["slots", selectedAreaId] });
        void queryClient.invalidateQueries({ queryKey: getMyBookingsQueryKey() });
        toast({ title: "Slot booked!", description: `Slot ${slot.slotId} reserved. Press Start Parking when you arrive.` });
      },
      onError: (e: unknown) =>
        toast({
          title: "Booking failed",
          description: e instanceof Error ? e.message : "Slot may already be taken.",
          variant: "destructive",
        }),
    });
  }

  function handleStartParking() {
    if (!activeBooking) return;
    startMutation.mutate({ sessionId: activeBooking.sessionId }, {
      onSuccess: (session) => {
        setActiveBooking(session as unknown as ParkingSession);
        void queryClient.invalidateQueries({ queryKey: getMyBookingsQueryKey() });
        toast({ title: "Parking started!", description: "Billing has started from now." });
      },
      onError: () => toast({ title: "Error", description: "Could not start parking.", variant: "destructive" }),
    });
  }

  // After start parking — show QR and final confirmation
  if (activeBooking?.parkingStartTime) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Parking Active</h2>
          <p className="text-slate-500 mt-1">Billing started. Show QR at exit gate.</p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-6 text-center space-y-2">
            <div className="text-4xl font-mono font-bold text-slate-900">{activeBooking.slotId}</div>
            <div className="text-sm text-slate-600">Level: <strong>{activeBooking.slot?.level ?? selectedSlot?.level}</strong></div>
            <div className="text-sm text-slate-600">Car: <strong>{activeBooking.carNumber}</strong></div>
            <div className="text-sm text-slate-600">
              Parking started: <strong>{new Date(activeBooking.parkingStartTime).toLocaleTimeString()}</strong>
            </div>
            {activeBooking.slot?.isPaid && (
              <div className="text-sm text-indigo-600 font-medium">
                Rate: ₹{activeBooking.slot.pricePerHour}/hr
              </div>
            )}
          </CardContent>
        </Card>

        {activeBooking.qrData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600 text-center">Exit QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <QRCodeSVG value={activeBooking.qrData} size={200} level="M" />
              <p className="text-xs text-slate-500 text-center">Scan at exit barrier for quick checkout</p>
            </CardContent>
          </Card>
        )}

        {activeBooking.routeSteps && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Navigation className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-medium">Route Directions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 leading-relaxed">{activeBooking.routeSteps}</p>
            </CardContent>
          </Card>
        )}

        <Button variant="outline" className="w-full" onClick={() => { setActiveBooking(null); setRecommendations([]); setSearchDone(false); }}>
          Book Another Slot
        </Button>
      </div>
    );
  }

  // After booking but before start parking
  if (activeBooking && !activeBooking.parkingStartTime) {
    const slot = activeBooking.slot ?? selectedSlot;
    return (
      <div className="max-w-lg mx-auto space-y-5">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">1</div>
            <span className="font-medium text-indigo-700">Booked</span>
          </div>
          <div className="h-px w-8 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full border-2 border-slate-300 text-slate-400 flex items-center justify-center font-bold text-xs">2</div>
            <span className="text-slate-400">Start Parking</span>
          </div>
          <div className="h-px w-8 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full border-2 border-slate-300 text-slate-400 flex items-center justify-center font-bold text-xs">3</div>
            <span className="text-slate-400">Exit & Pay</span>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Slot Reserved!</h2>
          <p className="text-slate-500 text-sm mt-1">Drive to your slot. Press "Start Parking" when you arrive to begin billing.</p>
        </div>

        {/* Slot details + QR side by side */}
        <Card className="border-indigo-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex gap-5 items-start">
              {/* Slot info */}
              <div className="flex-1 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Slot</span>
                  <span className="font-mono font-bold text-lg text-slate-900">{activeBooking.slotId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Level</span>
                  <Badge variant="outline">{slot?.level}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <SlotTypeBadge slotType={slot?.slotType ?? "standard"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Car</span>
                  <span className="font-mono text-xs text-slate-900">{activeBooking.carNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Rate</span>
                  <span className="font-semibold text-slate-900">
                    {slot?.isPaid ? `₹${slot.pricePerHour}/hr` : "Free"}
                  </span>
                </div>
              </div>
              {/* QR code */}
              {activeBooking.qrData && (
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <QRCodeSVG value={activeBooking.qrData} size={110} level="M" />
                  <span className="text-[10px] text-slate-400 text-center">Booking QR</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {activeBooking.routeSteps && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2 pt-4 px-4">
              <Navigation className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-medium">Route to Slot</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-slate-700 leading-relaxed">{activeBooking.routeSteps}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 text-base font-semibold"
            onClick={handleStartParking}
            disabled={startMutation.isPending}
          >
            <PlayCircle className="mr-2 h-5 w-5" />
            {startMutation.isPending ? "Starting..." : "Start Parking — Begin Billing"}
          </Button>
          <p className="text-center text-xs text-slate-400">
            Tap this when you park your car. Billing starts from this moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Form */}
      <Card className="border-slate-200 shadow-sm max-w-2xl">
        <CardHeader>
          <CardTitle>Find a Parking Slot</CardTitle>
          <CardDescription>
            Booking for <strong>{selectedArea?.name ?? "…"}</strong> — change site in the header for another property.
            We return up to <strong>5</strong> best-matching slots (never padded with unrelated levels).
            {!isAdmin && (
              <> You may only book with a plate from <Link href="/my-cars" className="text-indigo-600 font-medium hover:underline">My cars</Link>.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-sm space-y-2">
            <Label htmlFor={isAdmin ? "carNumber" : "carNumberSelect"}>Car number</Label>
            {isAdmin ? (
              <Input
                id="carNumber"
                placeholder="e.g. KA 05 AB 1234"
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
                className="font-mono"
              />
            ) : loadingMyCars ? (
              <p className="text-sm text-slate-500">Loading your cars…</p>
            ) : myCars.length === 0 ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No linked plates yet. Go to{" "}
                <Link href="/my-cars" className="font-semibold text-indigo-700 underline">
                  My cars
                </Link>{" "}
                and add your vehicle before booking.
              </p>
            ) : (
              <Select value={carNumber} onValueChange={setCarNumber}>
                <SelectTrigger id="carNumberSelect" className="font-mono">
                  <SelectValue placeholder="Choose a linked plate" />
                </SelectTrigger>
                <SelectContent>
                  {myCars.map((c) => (
                    <SelectItem key={c.id} value={c.carNumber} className="font-mono">
                      {c.carNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parking Preference</Label>
              <Select value={parkingPreference} onValueChange={(v) => setParkingPreference(v as "free" | "paid" | "best")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best">Best Available</SelectItem>
                  <SelectItem value="free">Free Only</SelectItem>
                  <SelectItem value="paid">Premium (Paid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Level</Label>
              <Select value={preferredLevel} onValueChange={setPreferredLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Any Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Level</SelectItem>
                  {(selectedArea?.levels ?? []).map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                      {LEVEL_LABELS[lvl] ? ` — ${LEVEL_LABELS[lvl]}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 border rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-colors">
              <Checkbox checked={needsEv} onCheckedChange={(v) => setNeedsEv(!!v)} />
              <div className="flex items-center gap-2">
                <BatteryCharging className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">EV Charging</span>
              </div>
            </label>
            <label className="flex items-center gap-3 border rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-colors">
              <Checkbox checked={needsAccessible} onCheckedChange={(v) => setNeedsAccessible(!!v)} />
              <div className="flex items-center gap-2">
                <Accessibility className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-medium">Accessible</span>
              </div>
            </label>
            <label className="flex items-center gap-3 border rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-colors">
              <Checkbox checked={needsEasy} onCheckedChange={(v) => setNeedsEasy(!!v)} />
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">Easy</span>
              </div>
            </label>
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            Easy = near lift / quick to reach. Combine with Accessible for bays that are both accessible and easy access.
          </p>

          <Button
            size="lg"
            className="w-full"
            onClick={handleSearch}
            disabled={
              recommendMutation.isPending ||
              !selectedAreaId ||
              (!isAdmin && (loadingMyCars || myCars.length === 0 || !carNumber))
            }
          >
            {recommendMutation.isPending ? "Searching..." : "Find top 5 slots"}
          </Button>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {searchDone && (
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900">
                {recommendations.length > 0 ? "Top 5 recommendations" : "No slots match"}
              </h3>
            </div>
            {recommendSummary ? (
              <p className="text-sm text-slate-600 sm:ml-1">{recommendSummary}</p>
            ) : null}
          </div>

          {recommendations.length === 0 ? (
            <Card className="border-dashed border-amber-200 bg-amber-50/40 text-center py-10 px-4">
              <p className="text-slate-800 font-medium">No available slots for this search</p>
              <p className="text-slate-600 text-sm mt-2">
                {recommendSummary ||
                  "Try another level, switch between free and premium, or uncheck EV, Accessible, or Easy if you do not need them."}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map((slot, i) => (
                <Card key={slot.slotId} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-2xl font-mono font-bold text-slate-900">{slot.slotId}</div>
                        <div className="text-sm text-slate-500 mt-0.5">Level {slot.level}</div>
                      </div>
                      {i === 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Best Match</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <SlotTypeBadge slotType={slot.slotType} />
                      {slot.nearLift && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-700 border-slate-200">
                          <ArrowUpDown className="h-3 w-3" /> Near Lift
                        </span>
                      )}
                      {slot.isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                          <IndianRupee className="h-3 w-3" /> {slot.pricePerHour}/hr
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Free
                        </span>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      variant={i === 0 ? "default" : "outline"}
                      onClick={() => handleBook(slot)}
                      disabled={bookMutation.isPending && selectedSlot?.slotId === slot.slotId}
                    >
                      {bookMutation.isPending && selectedSlot?.slotId === slot.slotId
                        ? "Booking..."
                        : "Book This Slot"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
