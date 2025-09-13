import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import StatusCorrection from "@/pages/StatusCorrection";
import AdminDashboard from "@/pages/AdminDashboard";
import InvitationAccept from "@/pages/InvitationAccept";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <Switch>
      <Route path="/invite/:code" component={InvitationAccept} />
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/notifications" component={Notifications} />
          <Route path="/status-correction" component={StatusCorrection} />
          {user?.role === 'admin' ? (
            <Route path="/" component={AdminDashboard} />
          ) : (
            <Route path="/" component={Home} />
          )}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
