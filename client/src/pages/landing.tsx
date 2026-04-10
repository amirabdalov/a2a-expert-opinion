import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Brain, Shield, DollarSign, Users, CheckCircle, Clock, Star,
  MessageSquare, Send, ArrowRight, Lock, Briefcase, TrendingUp,
  Lightbulb, ChevronRight, Globe, Award, Zap, ShieldCheck, CreditCard,
  AlertTriangle, BookOpen, MapPin, Calculator, ThumbsUp, EyeOff,
  FileSearch, Scale, ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { setUser } from "@/lib/auth";
import { setPrefillData } from "@/lib/prefill-state";
import { useToast } from "@/hooks/use-toast";
import heroMapPath from "@assets/hero-map.png";
import logoSrc from "@assets/a2a-blue-logo.svg";
import promoVideoPath from "@assets/a2a-promo.mp4";

// ─── Hero ───
function Hero() {
  return (
    <section id="section-hero" className="relative min-h-[600px] flex items-center overflow-hidden" data-testid="section-hero">
      <div className="absolute inset-0">
        <img src={heroMapPath} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#081F6B]/80 via-[#0F3DD1]/70 to-[#0F3DD1]/60" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
          Don't Trust AI? Great.
        </h1>
        <p className="text-blue-200 text-lg md:text-xl mb-3 font-medium">
          76% of people don't fully trust AI.
        </p>
        <p className="text-blue-100/80 text-base md:text-lg max-w-2xl mx-auto mb-8">
          Get an AI-powered first draft, then have it verified by a real industry expert.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <Link href="/register">
            <Button size="lg" className="bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90 px-8 text-base font-semibold" data-testid="button-get-opinion">
              Get Expert Opinion <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/register?role=expert">
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-8 text-base font-semibold" data-testid="button-become-expert">
              Become an Expert
            </Button>
          </Link>
        </div>
        <p className="text-white font-medium text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
          $5 free credits for new users
        </p>
        <p className="text-white/70 text-sm mt-2" data-testid="hero-login-link">
          Already have an account?{" "}
          <Link href="/login">
            <span className="text-white underline font-medium cursor-pointer hover:text-blue-200">Log in</span>
          </Link>
        </p>
      </div>
    </section>
  );
}

// ─── Video Section ───
function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }

  return (
    <section className="py-12 px-4 sm:px-6 bg-white dark:bg-background" data-testid="section-video">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8" style={{ background: 'linear-gradient(to right, #0F3DD1, #686868)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>One Click from Hallucination to Real Human Input</h2>
      </div>
      <div className="max-w-3xl mx-auto relative group">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="w-full rounded-xl shadow-lg"
          data-testid="video-promo"
        >
          <source src={promoVideoPath} type="video/mp4" />
        </video>
        <button
          onClick={toggleMute}
          className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 transition-all backdrop-blur-sm"
          data-testid="button-toggle-mute"
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          )}
        </button>
        {isMuted && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={toggleMute}>
            <div className="bg-black/50 backdrop-blur-sm rounded-full p-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── How It Works ───
function HowItWorks() {
  const clientSteps = [
    { icon: Brain, title: "Ask AI", desc: "Describe your question and get an instant AI analysis" },
    { icon: Shield, title: "Expert Reviews", desc: "A verified expert reviews the AI output for accuracy" },
    { icon: CheckCircle, title: "Get Verified Answer", desc: "Receive a human-verified, trustworthy response" },
  ];
  const expertSteps = [
    { icon: Zap, title: "Get Matched", desc: "Receive requests matching your expertise" },
    { icon: MessageSquare, title: "Review AI Output", desc: "Validate and enhance the AI-generated analysis" },
    { icon: DollarSign, title: "Get Paid", desc: "Earn credits for every verified response" },
  ];
  return (
    <section id="section-how-it-works" className="py-12 sm:py-16 px-4 sm:px-6 bg-white dark:bg-background" data-testid="section-how-it-works">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-6">For Clients</h3>
            <div className="space-y-6">
              {clientSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{`${i + 1}. ${s.title}`}</p>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-6">For Experts</h3>
            <div className="space-y-6">
              {expertSteps.map((s, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{`${i + 1}. ${s.title}`}</p>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Categories ───
function Categories() {
  const activeCats = [
    { name: "Finance", desc: "Investment analysis, tax planning, risk management, portfolio strategy" },
    { name: "Business & Strategy", desc: "Market entry, growth strategy, M&A, competitive analysis, operations" },
    { name: "Entrepreneurship", desc: "Startup fundraising, product-market fit, scaling, pitch review" },
  ];
  const comingSoon = ["Legal", "Medical", "Sports", "Technology", "Real Estate"];
  return (
    <section id="section-categories" className="py-12 sm:py-16 px-4 sm:px-6 bg-[#F8FAFC]" data-testid="section-categories">
      <div className="max-w-5xl mx-auto">
        <p className="text-[#0F3DD1] text-sm font-semibold text-center tracking-wide mb-2">EXPERT CATEGORIES</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#111827] mb-4">Verified Professionals Across Industries</h2>
        <p className="text-[#6B7280] text-center text-sm mb-10 max-w-lg mx-auto">Each expert is reviewed and rated for every completed task</p>
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {activeCats.map((c) => (
            <div key={c.name} className="bg-white rounded-xl border border-[#E5E7EB] p-6 hover:border-[#0F3DD1]/30 hover:shadow-lg transition-all">
              <h3 className="font-semibold text-[#111827] mb-3">{c.name}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs text-[#6B7280] mr-2">Coming soon:</span>
          {comingSoon.map((c) => (
            <span key={c} className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-3 py-1.5 rounded-full">{c}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Expert Review CTA (AI Chat → Request Pipeline) ───
function ExpertReviewCTA({ chatHistory, category }: { chatHistory: Array<{ role: string; content: string }>; category: string }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const lastAiResponse = chatHistory.filter((m) => m.role === "assistant").pop()?.content || "";
  const lastUserQuestion = chatHistory.filter((m) => m.role === "user").pop()?.content || "";
  const autoTitle = lastUserQuestion.substring(0, 60) + (lastUserQuestion.length > 60 ? "..." : "");

  function handleGetExpertReview() {
    // BUG-004: Set prefill data and navigate correctly
    setPrefillData({
      aiResponse: lastAiResponse,
      category,
      title: autoTitle,
      llmProvider: "Groq",
      llmModel: "Llama 3.3 70B",
    });
    if (user) {
      setLocation("/dashboard");
    } else {
      // BUG-004: Navigate to signup with role=client and pass the AI query as URL param
      const prefillParam = encodeURIComponent(lastUserQuestion.substring(0, 200));
      window.location.hash = `/register?role=client&prefill=${prefillParam}`;
    }
  }

  return (
    <div className="mt-4" data-testid="expert-review-cta">
      <div className="p-5 bg-gradient-to-r from-primary/10 via-primary/5 to-green-50 dark:from-primary/20 dark:via-primary/10 dark:to-green-900/10 border border-primary/20 rounded-xl">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Want a verified expert to review this?</p>
            <p className="text-xs text-muted-foreground">AI gave you a response — now get a human expert to verify accuracy, find errors, and add insights.</p>
          </div>
        </div>

        <Button onClick={handleGetExpertReview} className="w-full bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90" data-testid="button-get-expert-review">
          <ShieldCheck className="mr-2 h-4 w-4" />
          {user ? "Get Expert Review" : "Create Account & Get Expert Review"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {!user && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">$5 free credits included — no card required</p>
        )}
      </div>
    </div>
  );
}

// ─── AI Try-It ───
function AiTryIt() {
  const [category, setCategory] = useState("finance");
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);

  const categories = [
    { id: "finance", label: "Finance" },
    { id: "business", label: "Business & Strategy" },
    { id: "entrepreneurship", label: "Entrepreneurship" },
  ];

  async function handleSend() {
    if (!message.trim() || loading) return;
    const userMsg = message.trim();
    setMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/chat/try", { message: userMsg, category });
      const data = await res.json();
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.content }]);
      setHasResponse(true);
    } catch {
      setChatHistory((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="section-try-it" className="py-12 sm:py-16 px-4 sm:px-6 bg-white dark:bg-background" data-testid="section-try-it">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-3">Try AI Analysis — Free</h2>
        <p className="text-muted-foreground text-center mb-8 text-sm">Get an instant AI response. Want expert verification? Sign up free.</p>

        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 mb-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-4 py-2 text-xs font-medium rounded-full transition ${
                  category === c.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`tab-category-${c.id}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="min-h-[200px] max-h-[300px] overflow-y-auto mb-4 space-y-3">
                {chatHistory.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Ask any question about {categories.find((c) => c.id === category)?.label}...
                  </p>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
                      msg.role === "user" ? "bg-primary text-white" : "bg-muted"
                    }`}>
                      {msg.role === "user" ? msg.content : (
                        <div className="space-y-2 [&_p]:leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.content
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/^### (.+)$/gm, '<p class="font-semibold text-sm mt-3 mb-1">$1</p>')
                          .replace(/^## (.+)$/gm, '<p class="font-bold text-sm mt-3 mb-1">$1</p>')
                          .replace(/^# (.+)$/gm, '<p class="font-bold text-base mt-3 mb-1">$1</p>')
                          .replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
                          .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
                          .replace(/\n\n/g, '</p><p class="text-sm">')
                          .replace(/\n/g, '<br/>')
                        }} />
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                      Analyzing...
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type your question..."
                  className="flex-1"
                  data-testid="input-try-it-message"
                />
                <Button onClick={handleSend} disabled={loading || !message.trim()} size="sm" className="bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90" data-testid="button-try-it-send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed" data-testid="text-ai-disclaimer">
                AI responses are for informational purposes only. Not professional advice. Results may contain errors. Get an expert to verify.
              </p>
            </CardContent>
          </Card>

          {hasResponse && (
            <ExpertReviewCTA
              chatHistory={chatHistory}
              category={category}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Collapsible Sample Component ───
function CollapsibleSample({ label, isPremium, variant, children }: { label: string; isPremium: boolean; variant: "request" | "report"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const isReport = variant === "report";
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
          isPremium
            ? isReport ? "bg-white/5 hover:bg-white/10 text-amber-400" : "bg-white/5 hover:bg-white/10 text-gray-400"
            : isReport ? "bg-green-50 hover:bg-green-100 text-green-700" : "bg-slate-50 hover:bg-slate-100 text-slate-600"
        }`}
        data-testid={`toggle-${variant}`}
      >
        <span className="flex items-center gap-1.5">
          {isReport ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
          )}
          {label}
        </span>
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className={`mt-2 rounded-lg p-3 animate-in slide-in-from-top-2 duration-200 ${
          isPremium
            ? isReport ? "bg-white/5 border border-amber-400/20" : "bg-white/5 border border-white/10"
            : isReport ? "bg-green-50 border-l-4 border-green-500" : "bg-slate-50 border border-slate-200"
        }`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── 3-Tier Pricing with Sample Reports ───
function TierPricing() {
  const tiers = [
    {
      name: "Standard",
      badge: "bg-blue-500",
      priceRange: "$0.90 — $90/hr",
      cardStyle: "border border-[#E5E7EB] bg-white dark:bg-card",
      headerStyle: "",
      clientRequest: `I'm co-founding a startup with two friends. We're splitting equity 33/33/33. ChatGPT said this is fine and common for early-stage startups.\n\nWhat AI Told Them:\nAI confirmed that equal splits are very common among co-founders and reflect equal commitment and trust. It mentioned vesting schedules as something to consider eventually and noted that investor preference for clean cap tables makes equal splits straightforward.`,
      expertResponse: `Equal splits aren't wrong, but "33/33/33 with no vesting" is a ticking clock. What happens if one co-founder leaves in six months? Without a vesting schedule — typically four years with a one-year cliff — they walk away with a permanent third of your company, which makes you essentially uninvestable.\n\nEvery serious seed investor will ask about vesting on the first call, and "we don't have it" is a red flag that signals founder naivety. Set up a standard 4-year/1-year cliff agreement now, before anyone's contributed anything significant, when it's still emotionally easy.\n\nUse a simple SAFE note or founder stock purchase agreement from Clerky or Stripe Atlas — it costs under $500 and takes a day. Do it this week.\n\nWhat Was at Stake:\nA co-founder departure without vesting in place can permanently freeze 33% of your cap table, blocking future funding rounds entirely.`,
      expertProfile: "BA Finance, 3-5 yrs experience, VC fund analyst",
      delivery: "1-4 hours",
      features: ["Quick reviews & ratings", "Basic analysis", "1 paragraph response", "Includes 2 follow-up questions"],
    },
    {
      name: "Pro",
      badge: "bg-indigo-500",
      priceRange: "$78 — $780/hr",
      cardStyle: "border-2 border-primary shadow-lg ring-1 ring-primary bg-gradient-to-b from-[#DAE3FF] to-white dark:from-primary/10 dark:to-card",
      headerStyle: "popular",
      clientRequest: `We're a profitable $4M ARR B2B SaaS company. A private equity firm approached us about a minority recapitalization \u2014 taking 30% for $2.5M. AI says this is a good deal for liquidity without losing control. Should we take it?\n\nWhat AI Told Them:\nAI framed minority recaps as a clean liquidity event that lets founders diversify personal wealth while retaining majority control and operational independence. It noted that PE firms bring networks and operational expertise and suggested negotiating board representation carefully.`,
      expertResponse: `The liquidity logic is sound, but "minority stake" doesn't mean "minority influence" in private equity deals \u2014 it means you need to read the term sheet with extreme care.\n\nThe critical provisions to interrogate are:\n\n(1) Information rights and approval rights \u2014 minority PE investors routinely require consent for any transaction over a threshold (e.g., $100K capex, hiring above VP level, new debt), which functionally gives them veto power over operations.\n\n(2) Drag-along rights \u2014 if the PE firm wants to exit in 3\u20135 years and you don't, drag-along clauses in minority deals can force a sale at a price you don't control.\n\n(3) Liquidation preferences \u2014 if the $2.5M comes with a 1.5x liquidation preference, they get $3.75M back before you see a dollar in any future exit below ~$12M.\n\nAt $4M ARR, you should be getting 4\u20136x revenue from a strategic buyer in 2\u20133 years; taking PE money now at a 3x ARR valuation ($12M implied) when a strategic might pay 5\u20137x ($20\u201328M) may be leaving $8\u201316M on the table. Get an M&A advisor to run a quiet process before you say yes to the first check.\n\nWhat Was at Stake:\nFounders who accept the first minority PE offer without running a parallel process routinely discover they could have achieved 40\u201360% higher valuations \u2014 on this deal, that's a $3M\u2013$5M difference in founder proceeds.`,
      expertProfile: "CFA, Harvard BA, Private Equity Vice President",
      delivery: "15-60 minutes",
      features: ["Detailed analysis with citations", "500-800 word reports", "Alternative approaches", "Includes 2 follow-up questions"],
    },
    {
      name: "Guru",
      badge: "bg-amber-500",
      priceRange: "$690 — $2,070/hr",
      cardStyle: "border border-[#E5E7EB] bg-[#171717] text-white",
      headerStyle: "premium",
      clientRequest: `I'm the CFO of a healthcare staffing company doing $80M revenue. We're finalizing a $15M debt facility with a regional bank. The covenants look standard to me. Our outside counsel reviewed the contract and said it looks fine. I just want a second set of eyes.\n\nWhat AI Told Them:\nAI reviewed the summary terms provided and confirmed that EBITDA-based covenants, debt service coverage ratios, and MAC (material adverse change) clauses are standard in commercial lending. It noted the 3.5x leverage covenant and 1.2x DSCR looked reasonable for a company at this revenue level.`,
      expertResponse: `Two things stand out that I'd push back on hard before you close.\n\nFirst, in healthcare staffing specifically, your revenue is highly concentrated in government reimbursement rates — Medicare and Medicaid rate adjustments happen annually, and a 3–5% reimbursement reduction can materially move your EBITDA without any operational failure on your part. Your MAC clause as described is broad enough that the bank could call the loan a "material adverse change" based on a CMS rate announcement alone. You want explicit carve-outs for industry-wide reimbursement changes in your MAC definition.\n\nSecond, your DSCR covenant is measured quarterly — that's aggressive. Healthcare staffing companies have seasonal cash flow patterns (Q4 is typically tightest due to holiday absences and year-end client budget freezes). A quarterly DSCR test in Q4 at 1.2x minimum leaves almost no buffer. Push for semi-annual measurement, or at minimum get a Q4 DSCR holiday built into the agreement.\n\nYour outside counsel flagged nothing wrong — but counsel looks for illegality, not financial risk. These are operational landmines, not legal ones.\n\nWhat Was at Stake:\nHealthcare companies that trigger MAC clauses on debt facilities face forced repayment demands during the exact periods they're most cash-constrained — one CMS rate cut could have accelerated $15M in debt during a cash trough, forcing a distressed sale.`,
      expertProfile: "MBA Harvard, CFA, 20+ yrs, Former MD Lazard",
      delivery: "5-20 min (dedicated expert)",
      features: ["Executive-grade deliverables", "Financial modeling & scenarios", "Primary data research", "Includes 2 follow-up questions"],
    },
  ];

  return (
    <section id="section-pricing" className="py-12 sm:py-16 px-4 sm:px-6 bg-muted/30" data-testid="section-pricing">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-3">
          <span className="bg-gradient-to-r from-[#0F3DD1] to-[#686868] bg-clip-text text-transparent">Expert Tiers — Sample Reports</span>
        </h2>
        <p className="text-muted-foreground text-center mb-4 text-sm">See what you get at each tier.</p>
        <p className="text-muted-foreground text-center mb-10 text-xs">Price includes 2 follow-up clarification questions with the expert</p>

        <div className="grid lg:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const isPremium = tier.headerStyle === "premium";
            const isPopular = tier.headerStyle === "popular";

            return (
              <div key={tier.name} className={`rounded-xl overflow-hidden ${tier.cardStyle} flex flex-col`} data-testid={`tier-card-${tier.name.toLowerCase()}`}>
                {isPopular && (
                  <div className="text-center py-1.5 bg-primary text-white text-xs font-semibold">
                    Most Popular
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  {/* Header */}
                  <div className="mb-4">
                    <Badge className={`${tier.badge} text-white text-xs mb-2`}>{tier.name}</Badge>
                    <p className={`text-lg font-bold ${isPremium ? "text-white" : ""}`}>{tier.priceRange}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5 mb-5">
                    {tier.features.map((f, i) => (
                      <li key={i} className={`flex items-center gap-2 text-xs ${isPremium ? "text-gray-300" : "text-muted-foreground"}`}>
                        <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${isPremium ? "text-amber-400" : "text-green-500"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Sample Request - Collapsible */}
                  <CollapsibleSample
                    label="View Sample Client Request"
                    isPremium={isPremium}
                    variant="request"
                  >
                    <p className={`text-xs leading-relaxed ${isPremium ? "text-gray-300" : "text-muted-foreground"}`}>{tier.clientRequest}</p>
                  </CollapsibleSample>

                  {/* Sample Expert Report - Collapsible */}
                  <CollapsibleSample
                    label="View Sample Expert Report"
                    isPremium={isPremium}
                    variant="report"
                  >
                    <p className={`text-xs leading-relaxed whitespace-pre-line ${isPremium ? "text-gray-200" : "text-foreground"}`}>{tier.expertResponse}</p>
                  </CollapsibleSample>

                  {/* Expert Profile + Delivery */}
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className={`h-3.5 w-3.5 ${isPremium ? "text-gray-400" : "text-muted-foreground"}`} />
                      <span className={`text-xs ${isPremium ? "text-gray-300" : "text-muted-foreground"}`}>{tier.expertProfile}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className={`h-3.5 w-3.5 ${isPremium ? "text-gray-400" : "text-muted-foreground"}`} />
                      <span className={`text-xs ${isPremium ? "text-gray-300" : "text-muted-foreground"}`}>Delivery: {tier.delivery}</span>
                    </div>

                    <Link href="/register">
                      <Button
                        className={`w-full mt-3 ${isPremium ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:opacity-90 font-semibold" : "bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90"}`}
                        size="sm"
                        data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                      >
                        Get Started
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── AI Mistakes Flippable Cards ───
const AI_MISTAKES = [
  {
    icon: AlertTriangle,
    title: "Confident Hallucinations",
    description: "AI never says 'I don't know.' It fabricates sources, cites non-existent studies, and delivers fiction with the tone of fact. Grok 3 fabricated 154 out of 200 source URLs in testing.",
    youFeel: "This sounds right, I'll go with it.",
    risk: "You act on fiction and quote fake sources in reports or filings.",
  },
  {
    icon: BookOpen,
    title: "Outdated & Incomplete",
    description: "AI's knowledge has a cutoff. It presents old rules as current and gives correct facts wrapped in incomplete pictures — the deduction is valid, but it skips the exception that changes everything.",
    youFeel: "This matches what I've heard before.",
    risk: "You follow a rule that was repealed, or miss the one detail that matters.",
  },
  {
    icon: MapPin,
    title: "Wrong Context",
    description: "AI mixes up rules from different countries, states, and situations. It tells you California law when your contract says Delaware. It answers the question you typed, not the situation you're actually in.",
    youFeel: "The legal framework looks solid.",
    risk: "Your entire strategy is built on laws that don't apply to you.",
  },
  {
    icon: Calculator,
    title: "Bad Math & Bias",
    description: "AI makes mathematical errors in 20–40% of multi-step financial calculations. It also leans toward popular answers and Western markets — a study found AI portfolios put 93% in US equities vs. a 59% benchmark.",
    youFeel: "It showed its work — the math checks out.",
    risk: "You present wrong numbers to investors or make biased decisions.",
  },
  {
    icon: ThumbsUp,
    title: "False Confidence",
    description: "AI presents one option as 'standard' when better alternatives exist. It generates contract clauses that look professional but contain unenforceable terms. It connects true dots with invented lines to create plausible but fictional narratives.",
    youFeel: "If it's standard, it must be safe.",
    risk: "You accept default terms, sign flawed contracts, or base decisions on assembled fiction.",
  },
  {
    icon: EyeOff,
    title: "Critical Blind Spots",
    description: "AI defaults to optimistic framing, gives generic strategies, and misses industry-specific regulations. 28% of compliance officers have made risky decisions based on AI-hallucinated regulations.",
    youFeel: "The opportunity sounds great.",
    risk: "You walk into deals without seeing traps, execute template strategies, and violate rules AI never mentioned.",
  },
];

const EXPERT_SOLUTIONS = [
  {
    icon: MessageSquare,
    title: "Prompt Calibration",
    subtitle: "Expert tells you what are the right questions to ask AI",
    description: "Most AI errors start with the wrong prompt. An expert restructures your question to get accurate, specific answers instead of generic advice.",
  },
  {
    icon: FileSearch,
    title: "Real Document Review",
    subtitle: "Expert flags risks and makes comments as redline",
    description: "Upload contracts, reports, or analyses. An expert reviews what AI called 'standard' and identifies the clauses, numbers, and terms that could cost you.",
  },
  {
    icon: Scale,
    title: "Objectivity Check",
    subtitle: "Sense-check the results, remove the bias",
    description: "AI defaults to popular answers. An expert brings industry-specific judgment, challenges assumptions, and ensures your decision isn't built on AI's blind spots.",
  },
];

function FlipCard({ mistake }: { mistake: typeof AI_MISTAKES[0] }) {
  const [flipped, setFlipped] = useState(false);
  const Icon = mistake.icon;
  return (
    <div
      className="cursor-pointer [perspective:1000px] min-h-[240px]"
      onClick={() => setFlipped(!flipped)}
      data-testid={`flip-card-${mistake.title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className={`relative w-full h-full transition-transform duration-[600ms] [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-white dark:bg-card border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <Icon className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="font-semibold text-base">{mistake.title}</h3>
          <p className="text-xs text-muted-foreground">Click to learn more</p>
        </div>
        {/* Back */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white dark:bg-card border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-5 flex flex-col justify-center overflow-y-auto">
          <p className="text-sm leading-relaxed mb-3">{mistake.description}</p>
          <p className="text-sm italic text-muted-foreground mb-2">
            <span className="font-medium">You feel:</span> "{mistake.youFeel}"
          </p>
          <p className="text-sm">
            <span className="font-bold text-red-500">Risk:</span> {mistake.risk}
          </p>
        </div>
      </div>
    </div>
  );
}

function AIMistakes() {
  return (
    <section id="section-ai-mistakes" className="py-12 sm:py-16 px-4 sm:px-6" data-testid="section-ai-mistakes">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-3">
          <span className="bg-gradient-to-r from-red-500 to-[#0F3DD1] bg-clip-text text-transparent">Key AI Mistakes & How Experts Fix Them</span>
        </h2>
        <p className="text-muted-foreground text-center mb-10 text-sm max-w-2xl mx-auto">
          AI is powerful but unreliable for high-stakes decisions. Here are the six most dangerous failure modes — and how human experts solve them.
        </p>

        {/* 6 Mistake Cards: 3x2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {AI_MISTAKES.map((mistake) => (
            <FlipCard key={mistake.title} mistake={mistake} />
          ))}
        </div>

        {/* Solution Cards */}
        <h3 id="section-solutions" className="font-display text-xl font-bold text-center mb-6">How Experts Solve These Problems</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {EXPERT_SOLUTIONS.map((sol) => {
            const SolIcon = sol.icon;
            return (
              <div key={sol.title} className="bg-gradient-to-b from-[#DAE3FF] to-white dark:from-primary/10 dark:to-card border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6" data-testid={`solution-card-${sol.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="w-10 h-10 rounded-lg bg-[#0F3DD1] flex items-center justify-center mb-3">
                  <SolIcon className="h-5 w-5 text-white" />
                </div>
                <h4 className="font-semibold text-sm mb-1">{sol.title}</h4>
                <p className="text-xs text-muted-foreground font-medium mb-2">{sol.subtitle}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{sol.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Press Citations ───
const PRESS_CITATIONS = [
  {
    publication: "Financial Times",
    badge: "FT",
    badgeColor: "bg-[#FCD8BA] text-[#33302E]",
    quote: "First, the output from an AI tool might be wrong, because the input was flawed or the model faulty. Second, the output might be misinterpreted. Or third, AI may not be doing enough work to meet the standard required of a human auditor.",
    link: "https://www.ft.com/content/14062aaa-251d-414f-8978-8d7d8f5311e3",
  },
  {
    publication: "Pew Research Center",
    badge: "PEW",
    badgeColor: "bg-[#1A3664] text-white",
    quote: "Half of U.S. adults say the increased use of AI in daily life makes them feel more concerned than excited. Just 10% say they are more excited than concerned.",
    link: "https://www.pewresearch.org/short-reads/2026/03/12/key-findings-about-how-americans-view-artificial-intelligence/",
  },
  {
    publication: "McKinsey & Company",
    badge: "McKinsey",
    badgeColor: "bg-[#2251FF] text-white",
    quote: "44% of organizations have faced at least one adverse effect from generative AI, with inaccuracies and hallucinations being among the most frequently reported concerns.",
    link: "https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/superagency-in-the-workplace-empowering-people-to-unlock-ais-full-potential-at-work",
  },
  {
    publication: "Forbes",
    badge: "Forbes",
    badgeColor: "bg-[#171717] text-white",
    quote: "Global enterprise losses from AI hallucinations reached over $67 billion. The average model hallucinates 18.7% of the time.",
    link: "https://www.forbes.com/councils/forbesbusinesscouncil/2025/12/18/the-hallucination-tax-generative-ais-accuracy-problem/",
  },
  {
    publication: "Deloitte",
    badge: "Deloitte",
    badgeColor: "bg-[#86BC25] text-[#171717]",
    quote: "47% of business executives have made major decisions based on unverified AI content.",
    link: "",
  },
  {
    publication: "Quinnipiac University",
    badge: "Quinnipiac",
    badgeColor: "bg-[#002B5C] text-white",
    quote: "76% of Americans say they trust AI-generated information only 'sometimes' or 'hardly ever.' Only 21% trust it most of the time.",
    link: "https://www.yahoo.com/news/articles/more-americans-adopt-ai-tools-202453651.html",
  },
];

function PressCitations() {
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;
    const pause = () => { el.style.animationPlayState = "paused"; };
    const resume = () => { el.style.animationPlayState = "running"; };
    el.addEventListener("mousedown", pause);
    el.addEventListener("mouseup", resume);
    el.addEventListener("touchstart", pause);
    el.addEventListener("touchend", resume);
    return () => {
      el.removeEventListener("mousedown", pause);
      el.removeEventListener("mouseup", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, []);

  // Duplicate cards for seamless loop
  const allCards = [...PRESS_CITATIONS, ...PRESS_CITATIONS];

  return (
    <section id="section-press" className="py-12 sm:py-16 px-4 sm:px-6" data-testid="section-press">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-3">
          <span className="bg-gradient-to-r from-[#0F3DD1] to-[#686868] bg-clip-text text-transparent">What the Press Says About AI</span>
        </h2>
        <p className="text-muted-foreground text-center mb-10 text-sm">Leading publications highlight the risks of relying on AI without expert oversight.</p>

        <div className="overflow-hidden" data-testid="marquee-container">
          <div
            ref={marqueeRef}
            className="flex gap-6 marquee-track"
            style={{ width: "max-content" }}
          >
            {allCards.map((cite, i) => (
              <div key={`${cite.publication}-${i}`} className="shrink-0 w-[350px]">
                <CitationCard cite={cite} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CitationCard({ cite }: { cite: typeof PRESS_CITATIONS[0] }) {
  return (
    <div className="bg-white dark:bg-card border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6 flex flex-col justify-between min-h-[200px]" data-testid={`citation-card-${cite.publication.toLowerCase().replace(/\s+/g, "-")}`}>
      <div>
        <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 ${cite.badgeColor}`}>
          {cite.badge}
        </span>
        <p className="text-sm italic leading-relaxed text-foreground">
          "{cite.quote}"
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{cite.publication}</span>
        {cite.link ? (
          <a
            href={cite.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Read source <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Deloitte 2025 AI Survey</span>
        )}
      </div>
    </div>
  );
}

// ─── FAQ ───
function FAQ() {
  const faqs = [
    { q: "How does A2A Expert Opinion work?", a: "You submit a question, our AI generates an initial analysis, then a verified human expert reviews, validates, and enhances the response. You get the best of both AI speed and human judgment." },
    { q: "Who are the experts?", a: "Our experts are vetted professionals with proven credentials in their fields — former executives, consultants, PhDs, and industry leaders. Each expert undergoes a rigorous verification process." },
    { q: "How long does a response take?", a: "AI analysis is instant. Expert verification typically takes minutes to hours depending on your tier. Guru tier experts are on standby for near-immediate response." },
    { q: "What if I'm not satisfied?", a: "We offer a satisfaction guarantee. If the expert response doesn't meet your expectations, contact support and we'll either match you with a different expert or refund your credits." },
    { q: "How do follow-up questions work?", a: "Every tier includes 2 follow-up clarification questions with the expert at no additional cost. This ensures you get the depth of understanding you need." },
    { q: "Is my data kept confidential?", a: "Absolutely. All conversations are encrypted in transit and at rest. Experts sign confidentiality agreements as part of our verification process. We implement industry-standard data protection measures and are committed to GDPR compliance and SOC 2 readiness." },
    { q: "What categories are available?", a: "Currently Finance, Business & Strategy, and Entrepreneurship. Legal, Medical, and Sports categories are coming soon. We're adding new categories monthly." },
    { q: "Do credits expire?", a: "No. Credits roll over indefinitely." },
  ];
  return (
    <section id="section-faq" className="py-12 sm:py-16 px-4 sm:px-6 bg-muted/30" data-testid="section-faq">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4 bg-white dark:bg-card">
              <AccordionTrigger className="text-sm font-medium text-left hover:no-underline" data-testid={`faq-trigger-${i}`}>
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

// ─── Trust ───
function Trust() {
  const stats = [
    { value: "1,000+", label: "Access to Verified Experts", icon: Users },
    { value: "70+", label: "Countries", icon: Globe },
    { value: "98%", label: "Satisfaction Rate", icon: Star },
  ];
  return (
    <section id="section-trust" className="py-10 sm:py-12 px-4 sm:px-6 bg-white dark:bg-background" data-testid="section-trust">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-3 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Become Expert CTA ───
function BecomeExpert() {
  return (
    <section id="section-become-expert" className="py-12 sm:py-16 px-4 sm:px-6 bg-white dark:bg-background" data-testid="section-become-expert">
      <div className="max-w-4xl mx-auto text-center">
        <Award className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold mb-3">Share Your Expertise, Get Paid</h2>
        <p className="text-muted-foreground text-sm mb-8 max-w-xl mx-auto">
          Join our network of verified experts. Review AI-generated analyses, provide your professional insight, and earn credits for every completed review.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 mb-8">
          {[
            { title: "Earn up to $2,000", desc: "Per verified response" },
            { title: "Flexible Hours", desc: "Work on your schedule" },
            { title: "Verification Badge", desc: "Build your reputation" },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-lg bg-muted/50">
              <p className="font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
        <Link href="/register?role=expert">
          <Button size="lg" className="px-8 bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90" data-testid="button-apply-expert">
            Apply as Expert <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        <p className="text-sm text-[#6B7280] mt-4">Sign up free. Get immediate notification once a relevant request is submitted</p>
      </div>
    </section>
  );
}

// ─── Footer ───
function Footer() {
  return (
    <footer className="py-8 sm:py-10 px-4 sm:px-6 border-t bg-background" data-testid="section-footer">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={logoSrc} alt="A2A Global" className="h-8" />
              <span className="font-display font-bold text-base">Expert Opinion</span>
            </div>
            <p className="text-xs text-muted-foreground">AI-powered analysis, human-verified answers.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-xs">
            <div>
              <p className="font-semibold mb-2">Product</p>
              <div className="space-y-1.5 text-muted-foreground">
                <button onClick={() => scrollTo("section-how-it-works")} className="block hover:text-primary transition-colors cursor-pointer">How it Works</button>
                <button onClick={() => scrollTo("section-ai-mistakes")} className="block hover:text-primary transition-colors cursor-pointer">AI Mistakes</button>
                <button onClick={() => scrollTo("section-pricing")} className="block hover:text-primary transition-colors cursor-pointer">Expert Tiers</button>
                <button onClick={() => scrollTo("section-categories")} className="block hover:text-primary transition-colors cursor-pointer">Categories</button>
                <Link href="/payments" className="block hover:text-primary transition-colors">Payments</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Portals</p>
              <div className="space-y-1.5 text-muted-foreground">
                <Link href="/login" className="block hover:text-primary transition-colors">Client Portal</Link>
                <Link href="/login" className="block hover:text-primary transition-colors">Expert Portal</Link>
                <Link href="/register?role=expert" className="block hover:text-primary transition-colors">Become an Expert</Link>
                <button onClick={() => scrollTo("section-faq")} className="block hover:text-primary transition-colors cursor-pointer">FAQ</button>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Company</p>
              <div className="space-y-1.5 text-muted-foreground">
                <button onClick={() => scrollTo("section-solutions")} className="block hover:text-primary transition-colors cursor-pointer">How Experts Solve</button>
                <button onClick={() => scrollTo("section-press")} className="block hover:text-primary transition-colors cursor-pointer">The Press</button>
                <button onClick={() => scrollTo("section-try-it")} className="block hover:text-primary transition-colors cursor-pointer">Try AI Free</button>
                <a href="tel:+13026210214" className="block hover:text-primary transition-colors">Contact</a>
                <a href="https://a2a.global" target="_blank" rel="noopener" className="block hover:text-primary transition-colors">A2A Global</a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
          <p>© 2026 A2A Global Inc. — Delaware C-Corp</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Scroll helper ───
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── Landing Nav ───
function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="A2A Global" className="h-6 sm:h-8 brightness-0 invert" />
          <span className="font-bold text-white text-sm sm:text-base">Expert Opinion</span>
        </div>
        {/* Desktop nav */}
        <div className="hidden lg:flex items-center justify-end flex-1 ml-8">
          <div className="flex items-center" style={{ gap: '2rem' }}>
            <button onClick={() => scrollTo("section-how-it-works")} className="text-white/70 hover:text-white text-sm whitespace-nowrap" data-testid="nav-how-it-works">How it Works</button>
            <button onClick={() => scrollTo("section-pricing")} className="text-white/70 hover:text-white text-sm whitespace-nowrap" data-testid="nav-pricing">Pricing</button>
            <Link href="/payments"><span className="text-white/70 hover:text-white text-sm whitespace-nowrap cursor-pointer" data-testid="nav-payments">Payments</span></Link>
            <Link href="/login"><span className="text-white/70 hover:text-white text-sm whitespace-nowrap cursor-pointer" data-testid="button-nav-login">Client Portal</span></Link>
            <Link href="/login"><span className="text-white/70 hover:text-white text-sm whitespace-nowrap cursor-pointer" data-testid="button-nav-expert-login">Expert Portal</span></Link>
            <Link href="/login"><Button size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:text-white text-sm font-semibold whitespace-nowrap" data-testid="button-nav-login">Login</Button></Link>
            <Link href="/register"><Button size="sm" className="bg-white text-primary hover:bg-white/90 text-sm font-semibold whitespace-nowrap" data-testid="button-nav-signup">Sign Up Free</Button></Link>
          </div>
        </div>
        {/* Mobile: Login + Sign Up + hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <Link href="/login"><Button size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:text-white text-xs font-semibold px-3 py-1" data-testid="button-nav-login-mobile">Login</Button></Link>
          <Link href="/register"><Button size="sm" className="bg-white text-primary hover:bg-white/90 text-xs font-semibold px-3 py-1" data-testid="button-nav-signup-mobile">Sign Up</Button></Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-1.5" data-testid="button-mobile-menu" aria-label="Menu">
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>
      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden mt-3 bg-[#081F6B]/95 backdrop-blur-lg rounded-xl p-4 space-y-1 border border-white/10">
          <button onClick={() => { scrollTo("section-how-it-works"); setMobileOpen(false); }} className="block w-full text-left text-white/80 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-white/10">How it Works</button>
          <button onClick={() => { scrollTo("section-pricing"); setMobileOpen(false); }} className="block w-full text-left text-white/80 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-white/10">Pricing</button>
          <Link href="/payments"><span className="block w-full text-white/80 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-white/10 cursor-pointer" onClick={() => setMobileOpen(false)}>Payments</span></Link>
          <div className="border-t border-white/10 my-2" />
          <Link href="/login"><span className="block w-full text-white/80 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-white/10 cursor-pointer" onClick={() => setMobileOpen(false)}>Client Portal</span></Link>
          <Link href="/login"><span className="block w-full text-white/80 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-white/10 cursor-pointer" onClick={() => setMobileOpen(false)}>Expert Portal</span></Link>
          <div className="border-t border-white/10 my-2" />
          <Link href="/login"><span className="block w-full text-center border border-white/40 text-white font-semibold text-sm py-2.5 px-3 rounded-lg cursor-pointer" onClick={() => setMobileOpen(false)} data-testid="button-mobile-login">Login</span></Link>
          <Link href="/register"><span className="block w-full text-center bg-white text-primary font-semibold text-sm py-2.5 px-3 rounded-lg mt-2 cursor-pointer" onClick={() => setMobileOpen(false)}>Sign Up Free</span></Link>
        </div>
      )}
    </nav>
  );
}

// ─── Landing Page ───
export default function LandingPage() {
  // BUG-015: Remove /#/ from main URL when on root route
  useEffect(() => {
    if (window.location.hash === '#/' || window.location.hash === '') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen" data-testid="page-landing">
      <LandingNav />
      <Hero />
      <VideoSection />
      <HowItWorks />
      <Categories />
      <AiTryIt />
      <AIMistakes />
      <TierPricing />
      <PressCitations />
      <FAQ />
      <Trust />
      <BecomeExpert />
      <Footer />
    </div>
  );
}
