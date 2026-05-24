// ────────────────────────────────────────────────────────────────────────
// LANDING V2 — Alternative prototype (per OB website-description.docx spec)
// Route: /v2 (parallel to v1 at /)
// Backup of v1 lives at: landing-v1-backup.tsx
// Reuses: LandingNav (from landing.tsx). FAQ removed. Custom V2 Footer below.
// ────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
  FileSignature,
  Quote,
  GraduationCap,
  Award,
} from "lucide-react";
import heroMapPath from "@assets/hero-map.png";
import logoSrc from "@assets/a2a-blue-logo.svg";
import logoGoldmanSachs from "@assets/v2-logos/goldman-sachs.svg";
import logoJPMorgan from "@assets/v2-logos/jp-morgan.svg";
import logoMcKinsey from "@assets/v2-logos/mckinsey.svg";
import logoBoA from "@assets/v2-logos/bank-of-america.svg";
import logoDeloitte from "@assets/v2-logos/deloitte.svg";
import logoAccenture from "@assets/v2-logos/accenture.svg";
import logoMorganStanley from "@assets/v2-logos/morgan-stanley.svg";
import logoICICI from "@assets/v2-logos/icici-bank.svg";
import logoMicrosoft from "@assets/v2-logos/microsoft.svg";
import logoEY from "@assets/v2-logos/ernst-young.svg";
import logoFlipkart from "@assets/v2-logos/flipkart.svg";
import logoKPMG from "@assets/v2-logos/kpmg.svg";
import logoBP from "@assets/v2-logos/bp.svg";
import logoOla from "@assets/v2-logos/ola.svg";
import logoSocGen from "@assets/v2-logos/societe-generale.svg";
import logoDell from "@assets/v2-logos/dell.svg";
import logoKotak from "@assets/v2-logos/kotak-life.png";
import logoInfosys from "@assets/v2-logos/infosys.svg";
import { LandingNav } from "./landing";

// ─── V2-specific slim nav (logo + Sign Up + login icon only) ───
function LandingNavV2() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 h-16 sm:h-20 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center flex-shrink-0 gap-2">
          <img src={logoSrc} alt="A2A Global" className="h-8 sm:h-10 w-auto" />
          <span className="font-semibold text-[#0F3DD1] text-sm md:text-base hidden sm:inline">Expert Opinion</span>
        </a>
        <div className="flex items-center gap-2">
          <Link href="/register">
            <span
              className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-gray-300 hover:border-[#0F3DD1] text-[#686868] hover:text-[#0F3DD1] text-[15px] font-medium cursor-pointer transition-colors whitespace-nowrap"
              data-testid="v2-nav-signup"
            >
              <span className="flex items-center gap-2">
                Sign Up
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </span>
            </span>
          </Link>
          <Link href="/login">
            <span
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#0F3DD1] text-white cursor-pointer hover:opacity-90 transition"
              data-testid="v2-nav-login"
              aria-label="Login"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── 1. Hero ───
function HeroV2() {
  const [, setLocation] = useLocation();
  return (
    <section
      id="section-hero"
      className="relative min-h-[560px] sm:min-h-[640px] flex items-center overflow-hidden"
      data-testid="section-hero-v2"
    >
      <div className="absolute inset-0 z-0">
        <img src={heroMapPath} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F3DD1]/85 via-[#0F3DD1]/70 to-[#171717]/85" />
      </div>
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 py-20 sm:py-24">
        <div className="w-full">
          <h1
            className="font-display text-[clamp(1.875rem,6vw,4.5rem)] font-bold leading-[1.1] text-white mb-6 w-full"
            data-testid="hero-headline-v2"
          >
            From pitch deck to term sheet — reviewed by those who've done it.
          </h1>
          <p
            className="text-[clamp(1rem,1.8vw,1.5rem)] text-white/90 leading-relaxed mb-8 w-full"
            data-testid="hero-subhead-v2"
          >
            Upload your pitch deck, financial model, or term sheet. Get
            brutally honest feedback from professionals who've closed $100bn+
            in deals — not an AI, not a consultant, someone who's actually
            been on the other side of the table.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              onClick={() => setLocation("/register")}
              className="bg-white text-[#0F3DD1] hover:bg-white/90 px-8 text-base font-semibold"
              data-testid="button-get-opinion-v2"
            >
              Get expert opinion
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 2. How A2A helped other founders — artifact + matched testimonial pairs ───
function HowA2AHelped() {
  const items = [
    {
      icon: FileText,
      title: "Pitch deck",
      body:
        "Catch the slide your VC will roast 30 seconds in. Reviewed by founders and partners who've sat on both sides of the deck.",
      testimonial: {
        quote:
          "Asked for a pitch-deck red-team. Got back 20 questions I had no answer for. Practised them. Closed my Series A 5 weeks later.",
        name: "Series A founder · Cleantech",
        city: "Pune",
      },
    },
    {
      icon: TrendingUp,
      title: "Financial model",
      body:
        "Stress-test your assumptions before your VC does it for free. Unit economics, sensitivities, and the question you forgot to model.",
      testimonial: {
        quote:
          "The model review forced me to re-cut the LTV/CAC slide. My next VC opened with 'this is the cleanest unit-economics page I've seen this quarter.'",
        name: "Seed-stage founder · Fintech",
        city: "Pune",
      },
    },
    {
      icon: FileSignature,
      title: "Term sheet",
      body:
        "Clause-by-clause read. Spot the liquidation preference, anti-dilution, and control terms that will cost you on the next round.",
      testimonial: {
        quote:
          "Spent $500 on the term-sheet review. Caught a 2x participating-preferred clause buried on page 4. Saved me ~$3.2M at exit.",
        name: "Pre-Series A founder · SaaS",
        city: "Pune",
      },
    },
  ];
  return (
    <section
      id="section-how-a2a-helped"
      className="py-16 sm:py-20 px-4 sm:px-6 bg-white dark:bg-background"
      data-testid="section-how-a2a-helped"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[clamp(0.75rem,1vw,0.875rem)] font-semibold uppercase tracking-wider text-[#0F3DD1] mb-3">
            How A2A Global helped other founders
          </p>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold leading-tight">
            Invest $300-$700. Save millions in fundraising.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((a) => (
            <div
              key={a.title}
              className="flex flex-col gap-4"
              data-testid={`artifact-${a.title.toLowerCase().replace(/ /g, "-")}`}
            >
              <div className="border border-border rounded-lg p-6 hover:border-[#0F3DD1] transition-colors">
                <a.icon className="h-8 w-8 text-[#0F3DD1] mb-4" />
                <h3 className="font-semibold text-[clamp(1rem,1.4vw,1.125rem)] mb-2">{a.title}</h3>
                <p className="text-[clamp(0.8125rem,1.1vw,0.875rem)] text-muted-foreground leading-relaxed">
                  {a.body}
                </p>
              </div>
              <div
                className="bg-muted/30 border border-border rounded-lg p-6"
                data-testid={`testimonial-${a.title.toLowerCase().replace(/ /g, "-")}`}
              >
                <Quote className="h-5 w-5 text-[#0F3DD1]/40 mb-3" />
                <p className="text-[clamp(0.8125rem,1.1vw,0.875rem)] leading-relaxed mb-4 italic">
                  "{a.testimonial.quote}"
                </p>
                <p className="text-xs font-semibold">{a.testimonial.name}</p>
                <p className="text-xs text-muted-foreground">{a.testimonial.city}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. AI vs A2A Expert comparison (top 3 rows only) ───
function AiVsExpertTable() {
  const rows = [
    {
      capability: "Non-public VC insights",
      detail: "Mandate changes, internal fund dynamics, partner-specific theses",
      ai: false,
      expert: true,
    },
    {
      capability: "Pattern recognition at partner level",
      detail:
        "Gut-feel read on what's wrong with your pitch — the kind only earned over hundreds of decks",
      ai: false,
      expert: true,
    },
    {
      capability: "Real-time VC trends — this quarter, not last",
      detail:
        "What's actually getting funded right now, not last-quarter TechCrunch headlines",
      ai: false,
      expert: true,
    },
  ];
  return (
    <section
      id="section-ai-vs-expert"
      className="py-16 sm:py-20 px-4 sm:px-6 bg-[#F8FAFC]"
      data-testid="section-ai-vs-expert"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[clamp(0.75rem,1vw,0.875rem)] font-semibold uppercase tracking-wider text-[#0F3DD1] mb-3">
            What exclusive knowledge you get with A2A experts
          </p>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold leading-tight">
            What AI misses. What an A2A expert flags.
          </h2>
        </div>
        <div className="bg-white border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="grid grid-cols-[1fr_70px_100px] sm:grid-cols-[1fr_120px_160px] bg-muted/40 border-b border-border">
            <div className="px-3 sm:px-6 py-3 text-[clamp(0.6875rem,1vw,0.875rem)] font-semibold uppercase tracking-wider">
              Capability
            </div>
            <div className="px-1 sm:px-4 py-3 text-[clamp(0.625rem,0.9vw,0.875rem)] font-semibold uppercase tracking-wider text-center">
              AI alone
            </div>
            <div className="px-1 sm:px-4 py-3 text-[clamp(0.625rem,0.9vw,0.875rem)] font-semibold uppercase tracking-wider text-center text-[#0F3DD1]">
              A2A expert
            </div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.capability}
              className={`grid grid-cols-[1fr_70px_100px] sm:grid-cols-[1fr_120px_160px] items-center ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
              data-testid={`row-comparison-${i}`}
            >
              <div className="px-3 sm:px-6 py-4">
                <p className="font-semibold text-[clamp(0.8125rem,1.2vw,1rem)]">
                  {r.capability}
                </p>
                <p className="text-[clamp(0.6875rem,0.95vw,0.8125rem)] text-muted-foreground mt-0.5">
                  {r.detail}
                </p>
              </div>
              <div className="px-1 sm:px-4 py-4 flex justify-center">
                {r.ai ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500/70" />
                )}
              </div>
              <div className="px-1 sm:px-4 py-4 flex justify-center">
                {r.expert ? (
                  <CheckCircle2 className="h-5 w-5 text-[#0F3DD1]" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. Where experts have worked — 3-row horizontal marquee ───
const EMPLOYER_LOGOS: { name: string; url: string }[] = [
  { name: "Goldman Sachs", url: logoGoldmanSachs },
  { name: "JP Morgan", url: logoJPMorgan },
  { name: "McKinsey", url: logoMcKinsey },
  { name: "Bank of America", url: logoBoA },
  { name: "Deloitte", url: logoDeloitte },
  { name: "Accenture", url: logoAccenture },
  { name: "Morgan Stanley", url: logoMorganStanley },
  { name: "ICICI Bank", url: logoICICI },
  { name: "Microsoft", url: logoMicrosoft },
  { name: "Ernst & Young", url: logoEY },
  { name: "Flipkart", url: logoFlipkart },
  { name: "KPMG", url: logoKPMG },
  { name: "BP", url: logoBP },
  { name: "Ola", url: logoOla },
  { name: "Societe Generale", url: logoSocGen },
  { name: "Dell", url: logoDell },
  { name: "Kotak Life", url: logoKotak },
  { name: "Infosys", url: logoInfosys },
];

function LogoMarqueeRow({
  logos,
  reverse = false,
  duration = 60,
}: {
  logos: { name: string; url: string }[];
  reverse?: boolean;
  duration?: number;
}) {
  // Duplicate the row twice so the translate -50% loop is seamless
  const doubled = [...logos, ...logos];
  return (
    <div className="overflow-hidden w-full">
      <div
        className="flex items-center gap-8 sm:gap-12 whitespace-nowrap"
        style={{
          animation: `${reverse ? "v2-marquee-reverse" : "v2-marquee"} ${duration}s linear infinite`,
          width: "max-content",
        }}
      >
        {doubled.map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className="flex-shrink-0 h-12 sm:h-16 w-28 sm:w-36 flex items-center justify-center transition-all opacity-100"
            title={logo.name}
          >
            <img
              src={logo.url}
              alt={logo.name}
              className="max-h-10 sm:max-h-12 max-w-full object-contain"
              loading="lazy"
              onError={(e) => {
                // Fallback to text if image fails
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent && !parent.querySelector(".logo-fallback")) {
                  const span = document.createElement("span");
                  span.className =
                    "logo-fallback text-xs font-semibold text-muted-foreground text-center px-2";
                  span.textContent = logo.name;
                  parent.appendChild(span);
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpertEmployers() {
  // Split 18 logos into 3 rows of 6
  const row1 = EMPLOYER_LOGOS.slice(0, 6);
  const row2 = EMPLOYER_LOGOS.slice(6, 12);
  const row3 = EMPLOYER_LOGOS.slice(12, 18);
  return (
    <section
      id="section-employers"
      className="py-16 sm:py-20 px-4 sm:px-6 bg-white dark:bg-background overflow-hidden"
      data-testid="section-employers"
    >
      <style>{`
        @keyframes v2-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes v2-marquee-reverse {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[clamp(0.75rem,1vw,0.875rem)] font-semibold uppercase tracking-wider text-[#0F3DD1] mb-3">
            Where our experts have worked
          </p>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold mb-3 leading-tight">
            From Goldman Sachs to Flipkart — experts who've seen it from the inside.
          </h2>
          <p className="text-[clamp(0.875rem,1.2vw,1rem)] text-muted-foreground max-w-2xl mx-auto">
            Average 12yrs+ of experience in top class companies.
          </p>
        </div>
        <div className="space-y-4 sm:space-y-6">
          <LogoMarqueeRow logos={row1} duration={55} />
          <LogoMarqueeRow logos={row2} reverse duration={65} />
          <LogoMarqueeRow logos={row3} duration={75} />
        </div>
      </div>
    </section>
  );
}

// ─── 5. Credentials & Education + Experience Chart ───
const CREDENTIALS = ["CFA", "CA", "CAIA", "ACCA", "IFRS"];
const EDUCATION = [
  "Indian Institute of Science",
  "Jawaharlal Nehru University (JNU)",
  "University of Delhi",
  "Indian Institute of Technology Madras (IIT Madras)",
  "Manipal Academy of Higher Education",
  "Jamia Millia Islamia (JMI)",
];
// Experience-band distribution (illustrative cohort shape — coded, not image)
const EXPERIENCE_BUCKETS = [
  { band: "5-9 yrs", pct: 14 },
  { band: "10-14 yrs", pct: 28 },
  { band: "15-19 yrs", pct: 22 },
  { band: "20-24 yrs", pct: 18 },
  { band: "25-29 yrs", pct: 11 },
  { band: "30+ yrs", pct: 7 },
];

function CredentialsAndExperience() {
  const maxPct = Math.max(...EXPERIENCE_BUCKETS.map((b) => b.pct));
  return (
    <section
      id="section-credentials"
      className="py-16 sm:py-20 px-4 sm:px-6 bg-[#F8FAFC]"
      data-testid="section-credentials"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[clamp(0.75rem,1vw,0.875rem)] font-semibold uppercase tracking-wider text-[#0F3DD1] mb-3">
            Meet the experts behind every review
          </p>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold leading-tight">
            Credentials and track record verified by A2A platform.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT: credentials + education */}
          <div
            className="bg-white border border-border rounded-lg p-6 sm:p-8 shadow-sm"
            data-testid="credentials-left"
          >
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-[#0F3DD1]" />
                <h3 className="font-semibold text-[clamp(1rem,1.3vw,1.125rem)]">
                  Credentials our experts hold
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {CREDENTIALS.map((c) => (
                  <div
                    key={c}
                    className="bg-[#0F3DD1] text-white rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
                    data-testid={`credential-${c.toLowerCase()}`}
                  >
                    {c}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-5 w-5 text-[#0F3DD1]" />
                <h3 className="font-semibold text-[clamp(1rem,1.3vw,1.125rem)]">
                  Top 6 institutions (education)
                </h3>
              </div>
              <ul className="space-y-2">
                {EDUCATION.map((e) => (
                  <li
                    key={e}
                    className="flex items-start gap-2 text-[clamp(0.8125rem,1.1vw,0.9375rem)]"
                    data-testid={`edu-${e.slice(0, 12).toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <span className="text-[#0F3DD1] flex-shrink-0 mt-1">•</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT: experience distribution chart (coded, not image) */}
          <div
            className="bg-white border border-border rounded-lg p-6 sm:p-8 shadow-sm flex flex-col"
            data-testid="experience-chart"
          >
            <h3 className="font-semibold text-[clamp(1rem,1.3vw,1.125rem)] mb-2">
              Years of experience — expert cohort
            </h3>
            <p className="text-[clamp(0.75rem,1vw,0.8125rem)] text-muted-foreground mb-6">
              Distribution across the active expert pool (% of experts in each band)
            </p>
            <div className="flex-1 flex items-end justify-between gap-2 sm:gap-3 min-h-[180px] sm:min-h-[220px]">
              {EXPERIENCE_BUCKETS.map((b) => {
                const heightPct = (b.pct / maxPct) * 100;
                return (
                  <div
                    key={b.band}
                    className="flex flex-col items-center justify-end flex-1 h-full"
                    data-testid={`bucket-${b.band}`}
                  >
                    <span className="text-[clamp(0.625rem,0.9vw,0.75rem)] font-semibold text-[#0F3DD1] mb-1">
                      {b.pct}%
                    </span>
                    <div
                      className="w-full bg-gradient-to-t from-[#0F3DD1] to-[#3a6ae8] rounded-t-md min-h-[8px] transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2 sm:gap-3 mt-2">
              {EXPERIENCE_BUCKETS.map((b) => (
                <span
                  key={`l-${b.band}`}
                  className="flex-1 text-center text-[clamp(0.5625rem,0.85vw,0.6875rem)] text-muted-foreground"
                >
                  {b.band}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 6. Key stats — light squares, 2 lines each ───
function KeyStats() {
  const stats = [
    { value: "$120bn+", label: "Deals done by experts" },
    { value: "$12.4M", label: "Real savings for founders" },
    { value: "300+", label: "Years of combined experience" },
  ];
  return (
    <section
      id="section-key-stats"
      className="py-16 sm:py-20 px-4 sm:px-6 bg-white dark:bg-background"
      data-testid="section-key-stats"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {stats.map((s, i) => (
            <div
              key={i}
              className="bg-[#F1F4FB] border border-[#0F3DD1]/15 rounded-2xl py-8 sm:py-10 px-4 text-center hover:border-[#0F3DD1]/40 transition-colors"
              data-testid={`stat-${i}`}
            >
              <p className="font-display text-[clamp(2rem,5vw,3.5rem)] font-bold mb-2 tracking-tight text-[#0F3DD1] leading-none">
                {s.value}
              </p>
              <p className="text-[clamp(0.875rem,1.2vw,1rem)] font-semibold text-[#171717]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───
function FinalCTA() {
  const [, setLocation] = useLocation();
  return (
    <section
      className="py-16 sm:py-20 px-4 sm:px-6 bg-[#F8FAFC]"
      data-testid="section-final-cta-v2"
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold mb-4 leading-tight">
          Send your deck. Get your review in 24 hours.
        </h2>
        <p className="text-[clamp(0.9375rem,1.3vw,1rem)] text-muted-foreground mb-8">
          $300-700 fixed-price. No retainer. No subscription.
        </p>
        <Button
          size="lg"
          onClick={() => setLocation("/register")}
          className="bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90 px-10 text-base font-semibold"
          data-testid="button-final-cta-v2"
        >
          Get expert opinion
        </Button>
      </div>
    </section>
  );
}

// ─── V2 Footer — updated section headers matching V2 sections ───
function scrollToV2(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function FooterV2() {
  return (
    <footer
      className="py-8 sm:py-10 px-4 sm:px-6 border-t bg-background"
      data-testid="section-footer-v2"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={logoSrc} alt="A2A Global" className="h-8" />
              <span className="font-display font-bold text-base">Expert Opinion</span>
            </div>
            <p className="text-xs text-muted-foreground">
              From pitch deck to term sheet — reviewed by those who've done it.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-xs">
            <div>
              <p className="font-semibold mb-2">Product</p>
              <div className="space-y-1.5 text-muted-foreground">
                <a
                  href="#section-how-a2a-helped"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToV2("section-how-a2a-helped");
                  }}
                  className="block hover:text-primary transition-colors"
                >
                  How A2A helps founders
                </a>
                <a
                  href="#section-ai-vs-expert"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToV2("section-ai-vs-expert");
                  }}
                  className="block hover:text-primary transition-colors"
                >
                  AI vs A2A experts
                </a>
                <a
                  href="#section-employers"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToV2("section-employers");
                  }}
                  className="block hover:text-primary transition-colors"
                >
                  Where experts have worked
                </a>
                <a
                  href="#section-credentials"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToV2("section-credentials");
                  }}
                  className="block hover:text-primary transition-colors"
                >
                  Credentials and education
                </a>
                <a
                  href="#section-key-stats"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToV2("section-key-stats");
                  }}
                  className="block hover:text-primary transition-colors"
                >
                  Key facts
                </a>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Portals</p>
              <div className="space-y-1.5 text-muted-foreground">
                <Link href="/login" className="block hover:text-primary transition-colors">
                  Client Portal
                </Link>
                <a
                  href="#/login?role=expert"
                  className="block hover:text-primary transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = "/login?role=expert";
                  }}
                >
                  Expert Portal
                </a>
                <a
                  href="#/register?role=expert"
                  className="block hover:text-primary transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = "/register?role=expert";
                  }}
                >
                  Become an Expert
                </a>
                <Link href="/news" className="block hover:text-primary transition-colors">
                  News & Insights
                </Link>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">Company</p>
              <div className="space-y-1.5 text-muted-foreground">
                <a
                  href="tel:+13026210214"
                  className="block hover:text-primary transition-colors"
                >
                  +1 (302) 621-0214
                </a>
                <a
                  href="mailto:support@a2a.global"
                  className="block hover:text-primary transition-colors"
                >
                  support@a2a.global
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
          <p>© 2026 A2A Global Inc. — Delaware C-Corp</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="hover:text-primary transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page composition ───
export default function LandingV2Page() {
  useEffect(() => {
    if (window.location.hash === "#/" || window.location.hash === "") {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return (
    <div className="min-h-screen" data-testid="page-landing-v2">
      <LandingNavV2 />
      <HeroV2 />
      <HowA2AHelped />
      <AiVsExpertTable />
      <ExpertEmployers />
      <CredentialsAndExperience />
      <KeyStats />
      <FinalCTA />
      <FooterV2 />
    </div>
  );
}
