import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import MapTab from "./pages/MapTab";
import DeployTab from "./pages/DeployTab";
import GardenTab from "./pages/GardenTab";
import NotificationTab from "./pages/NotificationTab";
import ProfileTab from "./pages/ProfileTab";
import { useAuth } from "./_core/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import SetupHomeBase from "@/pages/SetupHomeBase";

function ProtectedRoute({
  component: Component,
  requireProfile = false,
}: {
  component: React.ComponentType;
  requireProfile?: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();
  const {
    profile,
    loading: profileLoading,
  } = useProfile();

  if (loading || (requireProfile && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (requireProfile && (!profile || !profile.home_location)) {
    return <Redirect to="/setup-home-base" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={MapTab} requireProfile />
      </Route>
      <Route path="/deploy">
        <ProtectedRoute component={DeployTab} requireProfile />
      </Route>
      <Route path="/garden">
        <ProtectedRoute component={GardenTab} requireProfile />
      </Route>
      <Route path="/notifications">
        <ProtectedRoute component={NotificationTab} requireProfile />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfileTab} requireProfile />
      </Route>
      <Route path="/setup-home-base">
        <ProtectedRoute component={SetupHomeBase} />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
