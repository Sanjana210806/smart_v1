import {
  Switch,
  Route,
  Router as WouterRouter,
} from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, RequireAuth } from "@/lib/auth-context";
import { Home } from "@/pages/home";
import { Book } from "@/pages/book";
import { Levels } from "@/pages/levels";
import { MyCar } from "@/pages/my-car";
import { HistoryPage } from "@/pages/history";
import { Payments } from "@/pages/payments";
import { Login } from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book" component={Book} />
      <Route path="/levels" component={Levels} />
      <Route path="/my-car" component={MyCar} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/payments" component={Payments} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Hash routes are `#/login`, `#/book` — the path wouter sees is `/login`, NOT `/smart_v1/login`.
  // Setting `base` to the Vite BASE_URL (`/smart_v1`) breaks matching (path becomes `~/login`).
  // import.meta.env.BASE_URL is still used for asset URLs by Vite; only the Router base stays empty for hash mode.
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base="" hook={useHashLocation}>
            <Switch>
              <Route path="/login" component={Login} />
              <Route>
                <RequireAuth>
                  <Layout>
                    <AppRouter />
                  </Layout>
                </RequireAuth>
              </Route>
            </Switch>
            <Toaster />
          </WouterRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
