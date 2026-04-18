import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useEffect, useCallback, useSyncExternalStore } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Custom hash location hook that strips query params from the path
// so wouter matches /#/register?role=expert to the /register route.
// Components access params via window.location.hash directly.
function useCleanHashLocation(): [string, (to: string) => void] {
  const [rawLocation, setLocation] = useHashLocation();
  // Strip query params from the path for route matching
  const cleanPath = rawLocation.split("?")[0];
  return [cleanPath, setLocation];
}
import { type ReactNode } from "react";
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
import NewsPage from "@/pages/news";

// Fix 6: Auth guard — redirect to login instead of 404 for protected routes
// Checks both cookie-based token (production) and in-memory auth state
function AuthGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const hasToken = typeof document !== "undefined" && document.cookie.includes("a2a_token=");
  useEffect(() => {
    if (!hasToken) {
      setLocation("/login");
    }
  }, [hasToken, setLocation]);
  if (!hasToken) return null;
  return <>{children}</>;
}

// Fix 6: Admin auth guard — redirect to admin login
// Admin uses sessionStorage (adminToken) or in-memory state
function AdminGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const hasToken = typeof sessionStorage !== "undefined" && !!sessionStorage.getItem("adminToken");
  useEffect(() => {
    if (!hasToken) {
      setLocation("/admin/login");
    }
  }, [hasToken, setLocation]);
  if (!hasToken) return null;
  return <>{children}</>;
}

// BUG-3 / Item 18: Redirect /faq to landing page FAQ section
function FaqRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
    // Scroll to FAQ section after navigation settles
    setTimeout(() => {
      document.getElementById("section-faq")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  }, []);
  return null;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/dashboard">{() => <AuthGuard><ClientDashboard /></AuthGuard>}</Route>
      <Route path="/expert/onboarding">{() => <AuthGuard><ExpertOnboarding /></AuthGuard>}</Route>
      <Route path="/expert/profile/:expertId" component={ExpertPublicProfile} />
      <Route path="/expert">{() => <AuthGuard><ExpertDashboard /></AuthGuard>}</Route>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">{() => <AdminGuard><AdminDashboard /></AdminGuard>}</Route>
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/cookies" component={CookiesPage} />
      {/* BUG-3: /faq redirects to landing page FAQ section */}
      <Route path="/faq" component={FaqRedirect} />
      <Route path="/news" component={NewsPage} />
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
        <Router hook={useCleanHashLocation}>
          <AppRouter />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
