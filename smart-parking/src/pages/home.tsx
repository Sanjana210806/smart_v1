import { Link } from "wouter";
import { useGetDashboard } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Car,
  BatteryCharging,
  Accessibility,
  CreditCard,
  Clock,
  ParkingSquare,
  TrendingUp,
  Layers,
} from "lucide-react";

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  iconColor,
  href,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  href?: string;
}) {
  const inner = (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-slate-500">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${iconColor} bg-opacity-15`}>
          <Icon className={`h-4 w-4 ${iconColor.replace("bg-", "text-")}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
          {value}
        </div>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Home() {
  const { data: dashboard, isLoading } = useGetDashboard();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time parking status across all levels
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/book"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <ParkingSquare className="h-4 w-4" />
            Book Slot
          </Link>
          <Link
            href="/my-car"
            className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Car className="h-4 w-4" />
            Find My Car
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : dashboard ? (
          <>
            <StatCard
              title="Available Slots"
              value={dashboard.availableSlots}
              sub={`of ${dashboard.totalSlots} total`}
              icon={ParkingSquare}
              iconColor="bg-emerald-500"
              href="/book"
            />
            <StatCard
              title="Cars Parked Now"
              value={dashboard.activeSessions}
              sub="Vehicles inside campus"
              icon={Car}
              iconColor="bg-blue-500"
              href="/my-car"
            />
            <StatCard
              title="EV Charging"
              value={dashboard.evAvailable}
              sub={`available of ${dashboard.evSlots}`}
              icon={BatteryCharging}
              iconColor="bg-cyan-500"
              href="/levels"
            />
            <StatCard
              title="Accessible"
              value={dashboard.accessibleAvailable}
              sub={`available of ${dashboard.accessibleSlots}`}
              icon={Accessibility}
              iconColor="bg-sky-500"
              href="/levels"
            />
            <StatCard
              title="Paid Slots"
              value={dashboard.paidSlots}
              sub="premium slots available"
              icon={CreditCard}
              iconColor="bg-amber-500"
              href="/levels"
            />
            <StatCard
              title="Occupied"
              value={dashboard.occupiedSlots}
              sub="currently in use"
              icon={TrendingUp}
              iconColor="bg-red-500"
              href="/history"
            />
            <StatCard
              title="Avg. Duration"
              value={`${dashboard.averageDurationMinutes} min`}
              sub="per session"
              icon={Clock}
              iconColor="bg-purple-500"
              href="/history"
            />
          </>
        ) : (
          <p className="text-sm text-slate-500">No dashboard data available</p>
        )}
      </div>

      {/* Level Breakdown */}
      {dashboard && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Layers className="h-5 w-5 text-slate-500" />
            <CardTitle className="text-base">Level Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(dashboard?.levelBreakdown || []).map((l) => {
                const pct =
                  l.total > 0 ? Math.round((l.available / l.total) * 100) : 0;

                return (
                  <div key={l.level}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800 w-8">
                          {l.level}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-0.5 ${
                            pct > 50
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : pct > 20
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {pct}% free
                        </Badge>
                      </div>
                      <span className="text-sm text-slate-500">
                        {l.available} / {l.total} available
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}

              {(dashboard?.levelBreakdown || []).length === 0 && (
                <p className="text-sm text-slate-500">
                  No level breakdown data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
