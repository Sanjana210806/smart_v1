import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminUsers,
  useCreateAdminUser,
  getAdminUsersQueryKey,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, User } from "lucide-react";

function parseCarLines(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [carsText, setCarsText] = useState("");

  const { data: users = [], isLoading, isError, error, refetch } = useListAdminUsers({
    query: { enabled: isAdmin },
  });

  const createMutation = useCreateAdminUser();

  const carsPayload = useMemo(() => parseCarLines(carsText), [carsText]);

  if (!isAdmin) {
    return (
      <Card className="max-w-lg border-amber-200 bg-amber-50/60">
        <CardHeader>
          <CardTitle>Admins only</CardTitle>
          <CardDescription>
            Sign in as <span className="font-mono">admin</span> to create accounts.{" "}
            <Link href="/" className="text-indigo-600 font-medium hover:underline">
              Back to home
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!u) {
      toast({ title: "Username required", variant: "destructive" });
      return;
    }
    if (!password || password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (role === "user" && carsPayload.length === 0) {
      toast({
        title: "Car plates required",
        description: "Driver accounts need at least one plate (comma or newline separated).",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(
      { username: u, password, role, cars: carsPayload },
      {
        onSuccess: (res) => {
          void queryClient.invalidateQueries({ queryKey: getAdminUsersQueryKey() });
          setUsername("");
          setPassword("");
          setRole("user");
          setCarsText("");
          void refetch();
          toast({
            title: "User created",
            description: res.warning
              ? `${res.user.username} — ${res.warning}`
              : `${res.user.username} (${res.user.role}) with ${res.cars.length} linked car(s).`,
          });
        },
        onError: (err: unknown) =>
          toast({
            title: "Create failed",
            description: err instanceof Error ? err.message : "Request failed.",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <UserPlus className="h-7 w-7 text-indigo-600" />
          Create users
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Only admins can call this API. New <strong>driver</strong> accounts must include at least one car plate so
          they can book slots.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">New account</CardTitle>
          <CardDescription>
            Username is stored lowercase. Password is hashed on the server (never stored plain).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="au-username">Username</Label>
                <Input
                  id="au-username"
                  className="font-mono"
                  placeholder="e.g. priya"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="au-password">Password (min 8)</Label>
                <Input
                  id="au-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Driver (user)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="au-cars">Linked car plates</Label>
              <Textarea
                id="au-cars"
                className="font-mono min-h-[100px]"
                placeholder={role === "user" ? "KA05AB1234\nKA05AB5678" : "Optional for admin — one plate per line or comma-separated"}
                value={carsText}
                onChange={(e) => setCarsText(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-slate-500">
                {role === "user"
                  ? "Required: at least one plate. Same rules as My cars (letters and digits; spaces/hyphens stripped when matching)."
                  : "Optional. Leave empty for an admin with no linked demo cars."}
              </p>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">All accounts</CardTitle>
          <CardDescription>Usernames and number of cars linked in `user_cars`.</CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load users."}</p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isLoading && !isError && users.length === 0 && (
            <p className="text-sm text-slate-500">No users found.</p>
          )}
          {!isLoading && users.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Linked cars</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row, i) => (
                    <tr
                      key={row.username}
                      className={`border-t border-slate-100 ${i % 2 ? "bg-slate-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{row.username}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium capitalize">
                          {row.role === "admin" ? (
                            <Shield className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-slate-500" />
                          )}
                          {row.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.carCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
