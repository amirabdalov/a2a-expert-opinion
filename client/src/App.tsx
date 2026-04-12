import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/landing";
import { LoginPage, RegisterPage } from "@/pages/auth";
import ClientDashboard from "@/pages/client-dashboard";
import ExpertDashboard from "@/pages/expert-dashboard";
import ExpertOnboarding from "@/pages/expert-onboarding";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import { TermsPage, PrivacyPage, CookiesPage } from "@/pages/legal";
import PaymentsPage from "@/pages/payments";
import ExpertPublicProfile from "@/pages/expert-public-profile";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/expert/onboarding" component={ExpertOnboarding} />
      <Route path="/expert/profile/:expertId" component={ExpertPublicProfile} />
      <Route path="/expert" component={ExpertDashboard} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/cookies" component={CookiesPage} />
      {/* Payments page removed from public nav for Stripe submission — standby access only */}
      <Route path="/payments-standby" component={PaymentsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
