import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyCars,
  useAddMyCar,
  useDeleteMyCar,
  getMyCarsQueryKey,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Tags, Trash2, Plus, ArrowRight } from "lucide-react";

export function MyCarsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPlate, setNewPlate] = useState("");

  const { data: cars = [], isLoading, isError, error } = useGetMyCars();
  const addMutation = useAddMyCar();
  const deleteMutation = useDeleteMyCar();

  function handleAdd() {
    const plate = newPlate.trim().toUpperCase();
    if (!plate) {
      toast({ title: "Enter a plate number", variant: "destructive" });
      return;
    }
    addMutation.mutate(
      { carNumber: plate },
      {
        onSuccess: () => {
          setNewPlate("");
          void queryClient.invalidateQueries({ queryKey: getMyCarsQueryKey() });
          toast({ title: "Car added", description: `${plate} is now linked to your account.` });
        },
        onError: (e: unknown) =>
          toast({
            title: "Could not add car",
            description: e instanceof Error ? e.message : "Request failed.",
            variant: "destructive",
          }),
      },
    );
  }

  function handleDelete(carNumber: string) {
    deleteMutation.mutate(
      { carNumber },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getMyCarsQueryKey() });
          toast({ title: "Removed", description: `${carNumber} unlinked.` });
        },
        onError: (e: unknown) =>
          toast({
            title: "Could not remove",
            description: e instanceof Error ? e.message : "Request failed.",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Tags className="h-7 w-7 text-indigo-600" />
          My cars
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Only plates listed here can be used when you book a slot (account{" "}
          <span className="font-mono text-slate-700">{user?.username}</span>
          {user?.role === "admin" ? " — admins can still type any plate on Book for support." : ""}).
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Add a car</CardTitle>
          <CardDescription>
            Use the same format you will book with (spaces optional). Duplicates are ignored.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="newPlate" className="sr-only">
              Plate number
            </Label>
            <Input
              id="newPlate"
              placeholder="e.g. KA 05 AB 1234"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button type="button" onClick={handleAdd} disabled={addMutation.isPending} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            {addMutation.isPending ? "Adding…" : "Add car"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Linked plates</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/book" className="gap-1">
              Book slot
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load cars."}
            </p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isLoading && !isError && cars.length === 0 && (
            <p className="text-sm text-slate-600 py-4">
              No cars yet. Add one above, then go to{" "}
              <Link href="/book" className="text-indigo-600 font-medium hover:underline">
                Book slot
              </Link>{" "}
              — you must pick a linked plate to search and book.
            </p>
          )}
          {!isLoading && cars.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
              {cars.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-slate-50/80"
                >
                  <span className="font-mono font-semibold text-slate-900">{c.carNumber}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-600 shrink-0"
                    onClick={() => handleDelete(c.carNumber)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Remove ${c.carNumber}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
