import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Component, useEffect, useCallback, useSyncExternalStore } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";

// Custom hash location hook that strips query params from the path
// so wouter matches /#/register?role=expert to the /register route.
// Components access params via window.location.hash directly.
function useCleanHashLocation(): [string, (to: string) => void] {
  const [rawLocation, setLocation] = useHashLocation();
  // Strip query params from the path for route matching
  const cleanPath = rawLocation.split("?")[0];
  return [cleanPath, setLocation];
}
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

// ─── Error Boundary ───
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background" data-testid="error-boundary">
          <div className="text-center max-w-md px-6">
            <h1 className="text-5xl font-bold text-destructive mb-4">Oops!</h1>
            <p className="text-lg font-semibold mb-2">Something went wrong</p>
            <p className="text-sm text-muted-foreground mb-8">
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/#/">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <Home className="h-5 w-5" /> Return to Home Page
                </Button>
              </a>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2"
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router hook={useCleanHashLocation}>
            <AppRouter />
          </Router>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
