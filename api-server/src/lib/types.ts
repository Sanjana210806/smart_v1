export type SlotType = "standard" | "ev" | "accessible" | "premium";
export type PaymentStatus = "pending" | "parked" | "completed";

export type ParkingSlot = {
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
