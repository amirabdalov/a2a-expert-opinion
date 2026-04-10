import { useState, useEffect } from "react";
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
  const [existingEmailLogin, setExistingEmailLogin] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // BUG-009: Force light theme
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  // BUG-005: Read URL params for role pre-selection and prefill data
  const urlPrefill = (() => {
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx === -1) return null;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      return {
        role: params.get('role') as Role | null,
        request: params.get('request'),
        prefill: params.get('prefill'),
      };
    } catch {
      return null;
    }
  })();

  // Apply URL role param
  useEffect(() => {
    if (urlPrefill?.role === 'expert') setRole('expert');
    else if (urlPrefill?.role === 'client') setRole('client');
  }, []);

  const isRegister = mode === "register";

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const res = await apiRequest("POST", "/api/auth/register", { name, email, role });
        const data = await res.json();
        if (data.existing) {
          // Email already registered — server already sent OTP, switch to OTP step
          setExistingEmailLogin(true);
          setStep("otp");
          toast({ title: "Email already registered", description: "Please type 2FA code – check your email inbox" });
          return;
        }
      } else {
        await apiRequest("POST", "/api/auth/login", { email });
      }
      setStep("otp");
      toast({ title: "Code sent", description: `Check ${email} for your 6-digit code.` });
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
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
          <CardHeader className="text-center pb-4">
            <img src={logoSrc} alt="A2A Global" className="h-10 mx-auto mb-3" />

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border bg-muted/40 p-1 mb-2">
              <button
                type="button"
                onClick={() => { setMode("login"); setStep("email"); setOtp(""); }}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${mode === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setStep("email"); setOtp(""); }}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${mode === "register" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Sign Up
              </button>
            </div>

            {step === "email" && (
              <>
                <CardTitle className="text-xl mt-1">
                  {isRegister ? "Create your account" : "Welcome back"}
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
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        className="pl-9"
                        required
                        data-testid="input-name"
                      />
                    </div>
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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-9"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || (isRegister && !termsAccepted)}
                  data-testid="button-send-code"
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </Button>
                {isRegister && !termsAccepted && (
                  <p className="text-xs text-destructive text-center">Please accept the Terms of Use and Privacy Policy to continue.</p>
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
