import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import StatusCorrection from "@/pages/StatusCorrection";
import MinistryLegitimation from "@/pages/MinistryLegitimation";
import AdminDashboard from "@/pages/AdminDashboard";
import UserManagement from "@/pages/UserManagement";
import SystemSettings from "@/pages/SystemSettings";
import InvitationAccept from "@/pages/InvitationAccept";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/not-found";
import ProfileSettings from "@/pages/ProfileSettings";
import ChatPage from "@/pages/ChatPage";

function Router() {
  const { isAuthenticated, isLoading, user, canAccessAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/invite/:code" component={InvitationAccept} />
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/profile" component={ProfileSettings} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/status-correction" component={StatusCorrection} />
          <Route path="/ministry-legitimation" component={MinistryLegitimation} />
          {canAccessAdmin() ? (
            <>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/users" component={UserManagement} />
              <Route path="/admin/settings" component={SystemSettings} />
            </>
          ) : null}
          <Route path="/" component={Home} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
