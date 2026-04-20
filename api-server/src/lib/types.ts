export type SlotType = "standard" | "ev" | "accessible" | "premium";
export type PaymentStatus = "pending" | "parked" | "completed";

/** Site category — used for defaults, copy, and future rules. */
export type ParkingAreaKind = "mall" | "metro" | "office";

export type ParkingSlot = {
  areaId: string;
  slotId: string;
  level: string;
  slotType: SlotType;
  available: boolean;
  isPaid: boolean;
  pricePerHour: number;
  nearLift: boolean;
};

export type ParkingSession = {
  sessionId: number;
  areaId: string;
  userId: string;
  carNumber: string;
  slotId: string;
  bookingTime: string;
  parkingStartTime: string | null;
  exitTime: string | null;
  estimatedFee: number | null;
  paymentStatus: PaymentStatus;
  routeSteps: string | null;
  qrData: string | null;
};

export type ParkingAreaRow = {
  areaId: string;
  slug: string;
  name: string;
  kind: ParkingAreaKind;
};
