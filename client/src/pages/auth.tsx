import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Mail, User, Briefcase, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import logoSrc from "@assets/a2a-blue-logo.svg";

type Role = "expert" | "client";
type Mode = "register" | "login";
type Step = "email" | "otp";

// ─── Shared OTP Page ───────────────────────────────────────────────────────

function AuthPage({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>("client");
  const [step, setStep] = useState<Step>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // BUG-2: Only show terms error after the user has tried to submit
  const [submitted, setSubmitted] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [existingEmailLogin, setExistingEmailLogin] = useState(false);
  // Build 45 (AA bugs #1/#6): session-expired banner (set by queryClient.ts when a
  // 401 TOKEN_INVALID/EXPIRED is intercepted anywhere in the app).
  const [sessionBanner, setSessionBanner] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("a2a_session_expired");
      if (raw) {
        const { message } = JSON.parse(raw);
        if (message) setSessionBanner(message);
        sessionStorage.removeItem("a2a_session_expired");
      }
    } catch {}
  }, []);
  // Resend code timer
  const [resendTimer, setResendTimer] = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // BUG-009: Force light theme
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  // BUG-1 + BUG-005: Read URL params for role pre-selection and prefill data
  // Parse hash manually (for window.location.hash = '/register?role=expert' navigations)
  // Also check window.location.search as fallback (for wouter Link navigations)
  const urlPrefill = (() => {
    try {
      // First try hash query params (e.g. #/register?role=expert)
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        if (params.get('role') || params.get('prefill') || params.get('request')) {
          return {
            role: params.get('role') as Role | null,
            request: params.get('request'),
            prefill: params.get('prefill'),
          };
        }
      }
      // Fallback: check window.location.search (for wouter Link-based navigation)
      if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        return {
          role: params.get('role') as Role | null,
          request: params.get('request'),
          prefill: params.get('prefill'),
        };
      }
      return null;
    } catch {
      return null;
    }
  })();

  // BUG-1: Apply URL role param on mount
  useEffect(() => {
    // Check hash params first
    const hashParts = window.location.hash.split('?');
    const hashParams = new URLSearchParams(hashParts[1] || '');
    const roleFromHash = hashParams.get('role');
    // Fallback to search params
    const searchParams = new URLSearchParams(window.location.search);
    const roleFromSearch = searchParams.get('role');
    const roleParam = roleFromHash || roleFromSearch;
    if (roleParam === 'expert') setRole('expert');
    else if (roleParam === 'client') setRole('client');
  }, []);

  // Cleanup resend timer on unmount
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    };
  }, []);

  const isRegister = mode === "register";

  function startResendTimer() {
    setResendTimer(60);
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // BUG-2: Mark as submitted so terms error shows
    setSubmitted(true);
    // Validate form fields
    const errors: Record<string, string> = {};
    if (isRegister && !name.trim()) errors.name = "Full name is required";
    if (!email.trim()) errors.email = "Email address is required";
    if (isRegister && !termsAccepted) errors.terms = "Please accept the Terms to continue";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    if (isRegister && !termsAccepted) return;
    setLoading(true);
    try {
      if (isRegister) {
        // Pass UTM params from URL for acquisition tracking
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const utmSource = hashParams.get('utm_source') || undefined;
        const utmMedium = hashParams.get('utm_medium') || undefined;
        const utmCampaign = hashParams.get('utm_campaign') || undefined;
        // Build 45 (AA bug #2): call the register endpoint directly so we can
        // intercept the 409 EMAIL_ROLE_MISMATCH response and show a targeted error,
        // instead of apiRequest throwing a generic "409: {...}" toast.
        const regRes = await fetch(`/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, email, role,
            utmSource, utmMedium, utmCampaign,
            referrer: document.referrer || undefined,
            landingPage: window.location.hash.split('?')[0] || undefined,
          }),
        });
        const data = await regRes.json().catch(() => ({}));
        if (regRes.status === 409 && data?.code === "EMAIL_ROLE_MISMATCH") {
          setFormErrors({
            email: data.message || `This email is already registered as a different role.`,
          });
          toast({
            title: "Email already registered as a different role",
            description: data.message,
            variant: "destructive",
          });
          return;
        }
        if (!regRes.ok) {
          const msg = data?.message || `Registration failed (${regRes.status})`;
          toast({ title: "Failed to send code", description: msg, variant: "destructive" });
          return;
        }
        if (data.existing) {
          // Email already registered with SAME role — server sent login OTP, switch to OTP step
          setExistingEmailLogin(true);
          setStep("otp");
          startResendTimer();
          toast({ title: "Email already registered", description: "Please type 2FA code – check your email inbox" });
          return;
        }
      } else {
        await apiRequest("POST", "/api/auth/login", { email });
      }
      setStep("otp");
      startResendTimer();
      toast({ title: "Code sent", description: `Check ${email} for your 6-digit code.` });
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      if (isRegister && !existingEmailLogin) {
        await apiRequest("POST", "/api/auth/register", { name, email, role });
      } else {
        await apiRequest("POST", "/api/auth/login", { email });
      }
      startResendTimer();
      toast({ title: "Code resent", description: `Check ${email} for a new 6-digit code.` });
    } catch (err: any) {
      toast({ title: "Failed to resend code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      // If email was already registered (existing user on signup), use login verify endpoint
      const endpoint = (isRegister && !existingEmailLogin) ? "/api/auth/verify-otp" : "/api/auth/verify-login";
      const res = await apiRequest("POST", endpoint, { email, otp });
      const user = await res.json();
      login(user);
      if (user.role === "expert") {
        setLocation("/expert");
      } else {
        // BUG-005: Preserve prefill param across auth if present
        const prefill = urlPrefill?.prefill;
        if (prefill) {
          // Navigate to dashboard with prefill param in URL hash
          window.location.hash = `/dashboard?prefill=${encodeURIComponent(prefill)}`;
        } else {
          setLocation("/dashboard");
        }
      }
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetToEmail() {
    setStep("email");
    setOtp("");
    setExistingEmailLogin(false);
    setSubmitted(false);
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    setResendTimer(0);
  }

  // UX-18: Update URL when switching tabs
  function switchToLogin() {
    setMode("login");
    setStep("email");
    setOtp("");
    setSubmitted(false);
    window.history.replaceState(null, '', '#/login');
  }

  function switchToRegister() {
    setMode("register");
    setStep("email");
    setOtp("");
    setSubmitted(false);
    window.history.replaceState(null, '', '#/register');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
          </Button>
        </Link>

        <Card>
          {/* Build 45 (AA bugs #1/#6): one-shot banner if we got kicked here by a dead JWT */}
          {sessionBanner && (
            <div className="mx-4 mt-4 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/40 p-3 text-sm text-amber-900 dark:text-amber-200" data-testid="session-expired-banner">
              {sessionBanner}
            </div>
          )}
          <CardHeader className="text-center pb-4">
            <img src={logoSrc} alt="A2A Global" className="h-10 mx-auto mb-3" />

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border bg-muted/40 p-1 mb-2">
              <button
                type="button"
                onClick={switchToLogin}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${mode === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={switchToRegister}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${mode === "register" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sign Up
              </button>
            </div>

            {step === "email" && (
              <>
                <CardTitle className="text-xl mt-1">
                  {isRegister ? "Create your account" : (role === "expert" ? "Welcome back, Expert" : "Welcome back")}
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  {isRegister
                    ? "No password needed — we'll send you a code"
                    : "Enter your email to receive a sign-in code"}
                </CardDescription>
              </>
            )}

            {step === "otp" && (
              <>
                <CardTitle className="text-xl mt-1">Check your email</CardTitle>
                <CardDescription className="text-sm mt-1">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {/* ─ Email step ─ */}
            {step === "email" && (
              <form onSubmit={handleSendCode} className="space-y-4">
                {/* Role toggle — only on register */}
                {isRegister && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("client")}
                      className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                        role === "client"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                      data-testid="toggle-role-client"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className={`h-4 w-4 ${role === "client" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium">I'm a Client</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Get expert opinion on AI decisions. De-risk your strategies.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("expert")}
                      className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                        role === "expert"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10 shadow-sm"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                      data-testid="toggle-role-expert"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Star className={`h-4 w-4 ${role === "expert" ? "text-amber-500" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium">I'm an Expert</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Get matched with clients. Validate AI output. Get paid.
                      </p>
                    </button>
                  </div>
                )}

                {/* Name — register only */}
                {isRegister && (
                  <div>
                    <Label htmlFor="name" className="text-sm">Full Name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setFormErrors((prev) => ({ ...prev, name: '' })); }}
                        placeholder="Jane Smith"
                        className={`pl-9 ${formErrors.name ? 'border-destructive' : ''}`}
                        data-testid="input-name"
                      />
                    </div>
                    {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
                  </div>
                )}

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-sm">Email address</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFormErrors((prev) => ({ ...prev, email: '' })); }}
                      placeholder="you@example.com"
                      className={`pl-9 ${formErrors.email ? 'border-destructive' : ''}`}
                      data-testid="input-email"
                    />
                  </div>
                  {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
                </div>

                {/* UX-5: "Create Account" for signup, "Send Verification Code" for login */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  data-testid="button-send-code"
                >
                  {loading ? "Sending..." : isRegister ? "Create Account" : "Send Verification Code"}
                </Button>

                {/* BUG-2: Only show terms error after attempted submit */}
                {isRegister && submitted && !termsAccepted && (
                  <p className="text-xs text-destructive text-center">{formErrors.terms || "Please accept the Terms of Use and Privacy Policy to continue."}</p>
                )}

                {/* Terms Acceptance — mandatory checkbox */}
                {isRegister && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms-accept"
                      checked={termsAccepted}
                      onCheckedChange={(c: any) => setTermsAccepted(!!c)}
                      className="mt-0.5"
                      data-testid="checkbox-terms"
                    />
                    <label htmlFor="terms-accept" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      I have read and accept the{" "}
                      <a href="/terms-of-use.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline">Terms of Use</a>{" "}
                      and{" "}
                      <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline">Privacy Policy</a>.
                      <span className="block mt-0.5 text-[10px] text-muted-foreground/70">Your acceptance date, time, and IP address will be recorded for compliance.</span>
                    </label>
                  </div>
                )}

                {/* UX-17: Sign up link below login form */}
                {!isRegister && (
                  <p className="text-sm text-center text-muted-foreground">
                    Don't have an account?{" "}
                    <button type="button" onClick={switchToRegister} className="text-primary font-medium hover:underline">
                      Sign up
                    </button>
                  </p>
                )}
              </form>
            )}

            {/* ─ OTP step ─ */}
            {step === "otp" && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <Label htmlFor="otp" className="text-sm">Verification code</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                    autoFocus
                    data-testid="input-otp"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Expires in 10 minutes.</p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || otp.length !== 6}
                  data-testid="button-verify"
                >
                  {loading ? "Verifying..." : "Verify"}
                </Button>

                {/* Resend Code button with cooldown */}
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading || resendTimer > 0}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-resend-code"
                >
                  {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : "Resend Code"}
                </button>

                <button
                  type="button"
                  onClick={resetToEmail}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
                >
                  ← Use a different email
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Named exports matching existing App.tsx routes ───────────────────────

export function LoginPage() {
  return <AuthPage initialMode="login" />;
}

export function RegisterPage() {
  return <AuthPage initialMode="register" />;
}
