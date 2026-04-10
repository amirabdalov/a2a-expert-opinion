import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useSSE } from "@/hooks/use-sse";
import { InfoTooltip } from "@/components/info-tooltip";
import { NotificationBell } from "@/components/notification-bell";
import { OnboardingTour, CLIENT_TOUR_STEPS } from "@/components/onboarding-tour";
import { FloatingHelp } from "@/components/floating-help";
import { getPrefillData, clearPrefillData } from "@/lib/prefill-state";
import {
  PRICING_TIERS, getTierFromRate, getSliderValueFromRate, getRateFromSliderValue,
  getAISuggestedClientPrice, LLM_PROVIDERS,
} from "@/lib/pricing-tiers";
import {
  LayoutDashboard, PlusCircle, List, CreditCard, Settings, LogOut,
  Send, Clock, CheckCircle, AlertCircle, Coins, ArrowRight, ArrowLeft, MessageSquare,
  Star, Search, Wrench, Paperclip, X, FileText, User, DollarSign, RefreshCcw,
  ChevronDown, ChevronUp, ShieldCheck, Briefcase, Timer, FileBarChart, Circle,
  Upload, Camera, Bot,
} from "lucide-react";
import type { Request as ExpertRequest, Message, CreditTransaction, ExpertReview, Expert, RequestEvent } from "@shared/schema";

// ─── Tier Sample Data ───
interface TierSample {
  clientRequest: string;
  expertResponse: string;
  expertResponseHtml?: string;
  expertProfile: string;
  delivery: string;
  length: string;
  responseFormat: string;
}

const TIER_SAMPLES: Record<string, TierSample> = {
  standard: {
    clientRequest: `AI recommended I max out my Roth IRA before contributing more to my 401k beyond the employer match. Here's the full AI response — is the logic sound? I'm 34, making $95K.`,
    expertResponse: `The AI's recommendation is generally correct for your income level and age, but misses two important factors:\n\n**What's correct:** Prioritizing Roth IRA after capturing the employer match is standard advice for your income bracket. The tax-free growth argument is valid.\n\n**What's missing:**\n1. Your current marginal tax rate matters — at $95K single, you're in the 22% bracket. If you expect to be in a higher bracket at retirement, Roth is ideal. But if you anticipate lower income, traditional contributions might save more.\n2. The AI didn't mention the income phase-out for Roth IRA contributions ($146K-$161K for 2024). You have headroom now, but a raise could change this.\n\n**Recommendation:** Continue the current strategy, but reassess if income exceeds $120K.`,
    expertProfile: "CPA, 5 years, Mid-size accounting firm",
    delivery: "1-4 hours",
    length: "150-250 words",
    responseFormat: "Structured analysis with recommendations",
  },
  pro: {
    clientRequest: `I have a $500K portfolio, currently 70% US stocks. AI suggested I diversify into international markets and fixed income. Can you review the specific allocation percentages and fund recommendations? I'm 42, moderate risk tolerance, targeting retirement at 62.`,
    expertResponse: `Comprehensive review of the AI's portfolio diversification strategy:\n\n**Executive Summary:** The AI's directional advice is sound, but the specific allocations contain three material errors that could cost you $40K-80K over 20 years.\n\n**Detailed Analysis:**\n\n**1. Asset Allocation (AI vs. Recommended)**\n\n<table><thead><tr><th>Asset Class</th><th>AI Suggested</th><th>My Recommendation</th><th>Rationale</th></tr></thead><tbody><tr><td>US Large Cap</td><td>45%</td><td>35%</td><td>AI overweights; home bias risk</td></tr><tr><td>US Small Cap</td><td>5%</td><td>10%</td><td>Higher expected returns at your horizon</td></tr><tr><td>International Dev.</td><td>15%</td><td>20%</td><td>AI underweights; EAFE valuations attractive</td></tr><tr><td>Emerging Markets</td><td>10%</td><td>8%</td><td>Slightly reduce — geopolitical premium warranted</td></tr><tr><td>US Bonds</td><td>20%</td><td>15%</td><td>Duration risk at current yield curve</td></tr><tr><td>TIPS</td><td>0%</td><td>7%</td><td>AI completely missed inflation protection</td></tr><tr><td>Alternatives</td><td>5%</td><td>5%</td><td>Agree — REITs appropriate</td></tr></tbody></table>\n\n**2. Fund Selection Issues:**\n- The AI recommended VXUS for international but at your portfolio size, splitting into VEA (developed) + VWO (emerging) gives better tax-loss harvesting opportunities\n- Bond recommendation of BND is too generic — at current rates, VTIP + VGSH barbell strategy reduces duration risk\n- AI missed tax location optimization — keep bonds in tax-deferred, equities in taxable\n\n**3. Rebalancing Strategy:**\nThe AI suggested annual rebalancing. For a $500K portfolio, threshold-based rebalancing (5% drift bands) historically outperforms calendar-based by 0.2-0.4% annually.\n\n**Risk-Adjusted Projection:** With these corrections, expected CAGR improves from 7.2% (AI plan) to 7.8-8.1%, translating to ~$65K additional at retirement.`,
    expertProfile: "CFA, CFP, 10 years, Former VP at Vanguard Personal Advisor Services",
    delivery: "15-60 min",
    length: "500-800 words",
    responseFormat: "Detailed report with tables & data",
  },
  guru: {
    clientRequest: `We're a PE fund evaluating a $200M buyout of a healthcare IT company. Need a complete investment memo with market sizing, competitive moat analysis, management assessment framework, 5-year financial model review, and exit scenario analysis. AI produced a first draft — need expert validation and enhancement.`,
    expertResponse: `**INVESTMENT COMMITTEE MEMORANDUM — REVIEW & ENHANCEMENT**\n*Classification: Confidential | Expert Response Time: Immediate*\n\n[Full 15-page investment memo with sections:]\n\n**I. INVESTMENT THESIS VALIDATION**\nThe AI's core thesis — 'healthcare IT consolidation play with regulatory tailwinds' — is sound but incomplete. Three additional thesis pillars strengthen the case:\n[Detailed analysis with primary market data]\n\n**II. MARKET SIZING (CORRECTED)**\nAI's TAM of $12B is overstated. Bottom-up analysis using CMS data + hospital survey:\n- Serviceable TAM: $4.8B (not $12B)\n- Target's addressable segment: $1.2B\n- Current penetration: 6.7% → room for 3-4x growth\n[Charts, data tables, methodology notes]\n\n**III. COMPETITIVE MOAT — PORTER'S + HAMILTON HELMER FRAMEWORK**\n[Deep competitive analysis with switching cost quantification, network effects assessment]\n\n**IV. MANAGEMENT SCORECARD**\n[12-criteria evaluation framework applied to leadership team, with 360-degree reference check findings]\n\n**V. FINANCIAL MODEL AUDIT**\n27 errors/adjustments identified in AI model:\n[Line-by-line corrections with impact quantification]\nCorrected IRR: 22-28% (vs AI's 31-35%)\nCorrected MOIC: 2.4-3.1x (vs AI's 3.5-4.2x)\n\n**VI. EXIT ANALYSIS**\nThree scenarios with probability-weighted returns:\n- Strategic sale (60% probability): 3.0x MOIC\n- Secondary PE (25%): 2.2x MOIC\n- IPO (15%): 3.5x MOIC\n- **Blended expected return: 2.8x / 26% IRR**\n\n**VII. KEY RISKS & MITIGANTS**\n[Risk matrix with probability/impact scoring]\n\n**VIII. RECOMMENDATION**\nProceed with acquisition at $180-195M. Proposed structure: 60% term loan, 25% equity, 15% seller note.`,
    expertProfile: "MBA/JD Harvard, 28 years, Former Senior Partner at KKR Healthcare, Board member at 3 health-tech companies",
    delivery: "Immediate (dedicated)",
    length: "4000-6000 words",
    responseFormat: "Full investment committee memo",
  },
};

// ─── Tier Sample Preview Component ───
function TierSamplePreview({ tierId }: { tierId: string }) {
  const [expanded, setExpanded] = useState(false);
  const sample = TIER_SAMPLES[tierId];
  if (!sample) return null;

  // Determine if response needs truncation (Pro+ and above)
  const TRUNCATE_THRESHOLD = 300;
  const needsTruncation = sample.expertResponse.length > TRUNCATE_THRESHOLD;
  const isHighTier = ["pro", "guru"].includes(tierId);
  const shouldTruncate = needsTruncation && isHighTier;

  // Format expert response text — render markdown-style bold, newlines, and HTML tables
  function renderFormattedText(text: string) {
    // Split on HTML table tags to handle them separately
    const parts = text.split(/(<table[\s\S]*?<\/table>)/);
    return parts.map((part, i) => {
      if (part.startsWith("<table")) {
        return (
          <div key={i} className="my-3 overflow-x-auto rounded-lg border border-border/60">
            <div
              className="tier-sample-table"
              dangerouslySetInnerHTML={{ __html: part }}
            />
          </div>
        );
      }
      // Process text: bold markers and line breaks (handle both \n and literal \\n)
      const lines = part.split(/\n|\\n/);
      return lines.map((line, j) => {
        if (line.trim() === "") return <div key={`${i}-${j}`} className="h-2" />;
        // Process **bold** markers
        const segments = line.split(/(\*\*[^*]+\*\*)/);
        const rendered = segments.map((seg, k) => {
          if (seg.startsWith("**") && seg.endsWith("**")) {
            return <strong key={k} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>;
          }
          // Process *italic* markers
          const italicParts = seg.split(/(\*[^*]+\*)/);
          return italicParts.map((ip, m) => {
            if (ip.startsWith("*") && ip.endsWith("*") && !ip.startsWith("**")) {
              return <em key={`${k}-${m}`} className="italic text-muted-foreground">{ip.slice(1, -1)}</em>;
            }
            return <span key={`${k}-${m}`}>{ip}</span>;
          });
        });
        return <div key={`${i}-${j}`} className="leading-relaxed">{rendered}</div>;
      });
    });
  }

  // Get truncated text (cut at word boundary near TRUNCATE_THRESHOLD)
  function getTruncatedText(text: string): string {
    // Remove HTML tables for truncation preview
    const flatText = text.replace(/<table[\s\S]*?<\/table>/g, "");
    const plain = flatText.replace(/\*\*/g, "").replace(/\n/g, " ").replace(/\s+/g, " ");
    if (plain.length <= TRUNCATE_THRESHOLD) return flatText;
    const cutoff = plain.lastIndexOf(" ", TRUNCATE_THRESHOLD);
    // Find corresponding position in original
    let charCount = 0;
    let origPos = 0;
    for (let idx = 0; idx < flatText.length && charCount < cutoff; idx++) {
      if (flatText.substring(idx).startsWith("**")) { idx += 1; continue; }
      if (flatText[idx] === "\n") { charCount++; continue; }
      charCount++;
      origPos = idx;
    }
    let result = flatText.substring(0, origPos + 1);
    // Clean up any orphaned ** markers (odd number means unclosed bold)
    const boldCount = (result.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      // Remove the last orphaned **
      const lastBold = result.lastIndexOf("**");
      result = result.substring(0, lastBold).trimEnd();
    }
    return result;
  }

  const displayText = shouldTruncate && !expanded
    ? getTruncatedText(sample.expertResponse)
    : sample.expertResponse;

  return (
    <div className="mt-6 space-y-4" data-testid="tier-sample-preview">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">What You Get at This Tier</h3>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Two cards side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Client Request Card */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 p-4" data-testid="card-client-request">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Client Request</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                Example
              </Badge>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
            "{sample.clientRequest}"
          </p>
        </div>

        {/* Expert Response Card */}
        <div className="rounded-xl bg-white dark:bg-slate-800/60 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-700/50 p-4" data-testid="card-expert-response">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expert Response</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                <CheckCircle className="h-2.5 w-2.5" /> Verified
              </span>
            </div>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {renderFormattedText(displayText)}
            {shouldTruncate && !expanded && (
              <span className="text-muted-foreground">…</span>
            )}
          </div>
          {shouldTruncate && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              data-testid="button-toggle-response"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show full response</>
              )}
            </button>
          )}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400">
              ~{sample.length}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info pills row */}
      <div className="flex flex-wrap gap-2 justify-center">
        <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-3 py-1.5 text-xs" data-testid="pill-expert-profile">
          <Briefcase className="h-3 w-3 text-slate-500" />
          {sample.expertProfile}
        </div>
        <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full px-3 py-1.5 text-xs" data-testid="pill-delivery-time">
          <Timer className="h-3 w-3" />
          {sample.delivery}
        </div>
        <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1.5 text-xs" data-testid="pill-response-format">
          <FileBarChart className="h-3 w-3" />
          {sample.responseFormat}
        </div>
      </div>
    </div>
  );
}

// Expert review with profile data from the detailed endpoint
interface DetailedReview extends ExpertReview {
  expert?: Expert & { userName: string };
}

type ClientView = "overview" | "new-request" | "my-requests" | "request-detail" | "credits" | "settings" | "chat-ai";
type ServiceType = "sense_check" | "prompt_calibration" | "full_review" | "other";
type ExpertTierOverride = "standard" | "pro" | "guru";

function statusColor(s: string) {
  switch (s) {
    case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "completed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "draft": return "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400";
    default: return "bg-gray-100 text-gray-800";
  }
}

function serviceTypeBadge(t: string) {
  switch (t) {
    case "rate": case "sense_check": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "review": case "full_review": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "custom": case "other": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "prompt_calibration": return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
    default: return "bg-gray-100 text-gray-800";
  }
}

function serviceTypeLabel(t: string) {
  switch (t) {
    case "sense_check": return "Sense Check";
    case "prompt_calibration": return "Prompt Calibration";
    case "full_review": return "Full Review";
    case "other": return "Other";
    case "rate": return "Rate";
    case "review": return "Review";
    case "custom": return "Custom";
    default: return t;
  }
}

// Pricing helpers for new single-page flow
const SERVICE_BASE_TIMES: Record<string, number> = {
  sense_check: 5,
  prompt_calibration: 10,
  full_review: 30,
  other: 15,
};
const SERVICE_DEFAULT_TIER: Record<string, ExpertTierOverride> = {
  sense_check: "standard",
  prompt_calibration: "pro",
  full_review: "pro",
  other: "standard",
};
const SERVICE_COMPLETION_TIME: Record<string, string> = {
  sense_check: "1–4 hours",
  prompt_calibration: "2–6 hours",
  full_review: "4–12 hours",
  other: "2–8 hours",
};
const TIER_RATES: Record<ExpertTierOverride, number> = {
  standard: 0.50,
  pro: 5.00,
  guru: 20.00,
};
function calcEstimatedPrice(serviceType: ServiceType, tier: ExpertTierOverride): number {
  const baseTime = SERVICE_BASE_TIMES[serviceType] || 15;
  const rate = TIER_RATES[tier];
  return baseTime * rate;
}

function ClientSidebar({ view, setView, onLogout, onResetDraft }: { view: ClientView; setView: (v: ClientView) => void; onLogout: () => void; onResetDraft?: () => void }) {
  const items = [
    { id: "overview" as const, icon: LayoutDashboard, label: "Overview" },
    { id: "new-request" as const, icon: PlusCircle, label: "New Request" },
    { id: "chat-ai" as const, icon: Bot, label: "Chat with AI" },
    { id: "my-requests" as const, icon: List, label: "My Requests" },
    { id: "credits" as const, icon: CreditCard, label: "Credits & Billing" },
    { id: "settings" as const, icon: Settings, label: "Settings" },
  ];
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sidebar-primary rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">A2A</span>
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground">Client Portal</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton onClick={() => { if (item.id === "new-request" && onResetDraft) onResetDraft(); setView(item.id); }} isActive={view === item.id} data-testid={`nav-${item.id}`}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onLogout} data-testid="nav-logout">
                  <LogOut className="h-4 w-4" /><span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// ─── Overview ───
function Overview({ userId, setView, setSelectedRequest }: { userId: number; setView: (v: ClientView) => void; setSelectedRequest: (id: number) => void }) {
  const { data: creditData } = useQuery<{ credits: number; transactions: CreditTransaction[] }>({ queryKey: ["/api/credits", userId] });
  const { data: requests } = useQuery<ExpertRequest[]>({ queryKey: ["/api/requests/user", userId] });

  const credits = creditData?.credits ?? 0;
  const active = requests?.filter((r) => r.status === "in_progress").length ?? 0;
  const total = requests?.length ?? 0;

  return (
    <div className="p-6 space-y-6" data-testid="view-overview">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Coins className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">${credits}</p><p className="text-xs text-muted-foreground">$ Credits Available</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{active}</p><p className="text-xs text-muted-foreground">Active Requests</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><List className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{total}</p><p className="text-xs text-muted-foreground">Total Submitted</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">~12h</p><p className="text-xs text-muted-foreground">Avg Response</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Recent Requests</CardTitle></CardHeader>
        <CardContent>
          {(!requests || requests.length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No requests yet. <button onClick={() => setView("new-request")} className="text-primary font-medium">Create one</button></p>
          ) : (
            <div className="space-y-2">
              {requests.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition" onClick={() => { setSelectedRequest(r.id); setView("request-detail"); }} data-testid={`request-row-${r.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <Badge className={`text-[10px] ${serviceTypeBadge(r.serviceType)}`}>{r.serviceType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.category} · {r.tier}</p>
                  </div>
                  <Badge className={`text-xs ${statusColor(r.status)}`}>{r.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── New Request (Single Page) ───
// ─── Request Templates ───
const REQUEST_TEMPLATES = [
  { id: "invest", label: "Review AI Investment Advice", serviceType: "sense_check" as ServiceType, category: "finance", title: "Review AI investment recommendation", description: "Paste your AI's investment advice here..." },
  { id: "contract", label: "Check Contract Clause", serviceType: "full_review" as ServiceType, category: "business", title: "Contract clause review", description: "Paste the contract clause AI analyzed..." },
  { id: "finmodel", label: "Verify Financial Model", serviceType: "full_review" as ServiceType, category: "finance", title: "Financial model verification", description: "Paste the AI's financial projections..." },
  { id: "startup", label: "Startup Strategy Check", serviceType: "sense_check" as ServiceType, category: "entrepreneurship", title: "AI startup strategy review", description: "Paste your AI's go-to-market plan..." },
  { id: "pricing", label: "Pricing Strategy Review", serviceType: "prompt_calibration" as ServiceType, category: "business", title: "Pricing strategy calibration", description: "Describe your pricing challenge..." },
];

function NewRequest({ userId, setView, setSelectedRequest, editDraftId }: { userId: number; setView: (v: ClientView) => void; setSelectedRequest: (id: number) => void; editDraftId?: number }) {
  const prefill = getPrefillData();

  // URL hash param prefill (change #4)
  const urlPrefill = (() => {
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx === -1) return null;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      const pc = params.get('prefill_category');
      const pa = params.get('prefill_ai_response');
      const pt = params.get('prefill_title');
      if (pc || pa || pt) return { category: pc || '', aiResponse: pa ? decodeURIComponent(pa) : '', title: pt ? decodeURIComponent(pt) : '' };
      return null;
    } catch { return null; }
  })();

  const [serviceType, setServiceType] = useState<ServiceType>(prefill ? "full_review" : urlPrefill ? "full_review" : "sense_check");
  const [category, setCategory] = useState(prefill?.category || urlPrefill?.category || "");
  const [title, setTitle] = useState(prefill?.title || urlPrefill?.title || "");
  const [aiResponse, setAiResponse] = useState(prefill?.aiResponse || urlPrefill?.aiResponse || "");
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; size: number; data: string }>>([]);
  const [newAttachName, setNewAttachName] = useState("");
  const [newAttachContent, setNewAttachContent] = useState("");
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instructions, setInstructions] = useState("");
  const [question, setQuestion] = useState("");
  const [llmProvider, setLlmProvider] = useState(prefill ? "groq" : "");
  const [llmModel, setLlmModel] = useState(prefill ? "llama-3.3-70b" : "");
  const [tierOverride, setTierOverride] = useState<ExpertTierOverride | null>(null);
  const [draftId, setDraftId] = useState<number | null>(editDraftId ?? null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Load draft data if editing
  const { data: draftData } = useQuery<ExpertRequest>({
    queryKey: ["/api/requests", editDraftId],
    enabled: !!editDraftId,
  });

  useEffect(() => {
    if (draftData && draftData.status === "draft") {
      setTitle(draftData.title || "");
      setCategory(draftData.category || "");
      setAiResponse(draftData.aiResponse || "");
      setInstructions(draftData.instructions || "");
      setQuestion(draftData.description || "");
      setLlmProvider(draftData.llmProvider || "");
      setLlmModel(draftData.llmModel || "");
      if (draftData.serviceType) setServiceType(draftData.serviceType as ServiceType);
      try { setAttachments(JSON.parse(draftData.attachments || "[]")); } catch { }
    }
  }, [draftData]);

  useEffect(() => {
    if (prefill) clearPrefillData();
  }, []);

  const { data: creditData } = useQuery<{ credits: number }>({ queryKey: ["/api/credits", userId] });
  const balance = creditData?.credits ?? 0;

  const activeTier = tierOverride ?? SERVICE_DEFAULT_TIER[serviceType] ?? "standard";
  const estimatedPrice = calcEstimatedPrice(serviceType, activeTier);
  const completionTime = SERVICE_COMPLETION_TIME[serviceType] || "2–8 hours";
  const hasEnoughBalance = balance >= Math.ceil(estimatedPrice);

  const aiResponseLabel = (() => {
    switch (serviceType) {
      case "sense_check": return "Paste the AI response you want verified";
      case "prompt_calibration": return "Describe what you're trying to accomplish";
      case "full_review": return "Paste the AI response or upload document for review";
      case "other": return "Describe your request";
    }
  })();

  // Draft auto-save
  const saveDraft = useCallback(async (data: any) => {
    try {
      setDraftSaveStatus("saving");
      if (draftId) {
        await apiRequest("PATCH", `/api/requests/${draftId}/draft`, data);
      } else {
        const res = await apiRequest("POST", "/api/requests/draft", { userId, ...data });
        const draft = await res.json();
        setDraftId(draft.id);
      }
      setDraftSaveStatus("saved");
      setTimeout(() => setDraftSaveStatus("idle"), 3000);
    } catch {
      setDraftSaveStatus("idle");
    }
  }, [draftId, userId]);

  const triggerAutoSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveDraft({
        title, category, serviceType, aiResponse,
        attachments: JSON.stringify(attachments),
        instructions, llmProvider, llmModel,
        serviceCategory: serviceType,
        description: question || aiResponse || instructions || title,
      });
    }, 500);
  }, [title, category, serviceType, aiResponse, attachments, instructions, llmProvider, llmModel, question, saveDraft]);

  useEffect(() => {
    if (title || aiResponse || instructions || category || question) {
      triggerAutoSave();
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [title, aiResponse, instructions, category, serviceType, llmProvider, llmModel, question]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/requests", {
        userId,
        title,
        description: question || aiResponse || instructions || title,
        category,
        tier: activeTier,
        serviceType,
        aiResponse: aiResponse || null,
        attachments: JSON.stringify(attachments),
        expertsNeeded: 1,
        instructions: instructions || null,
        llmProvider: llmProvider || null,
        llmModel: llmModel || null,
        pricePerMinute: TIER_RATES[activeTier].toFixed(2),
        priceTier: activeTier,
        serviceCategory: serviceType,
        draftId: draftId || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests/drafts", userId] });
      setSubmittedRequestId(data.id);
      setShowConfirmation(true);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // File upload handlers (FEAT-012: any format, unlimited files, 50MB total)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB total
  const MAX_FILES = Infinity;

  function handleFileUpload(files: FileList | null) {
    if (!files) return;
    // Check total size including existing attachments
    const existingTotal = attachments.reduce((sum, a) => sum + a.size, 0);
    const newFiles = Array.from(files);
    let runningTotal = existingTotal;
    newFiles.forEach((file) => {
      if (runningTotal + file.size > MAX_FILE_SIZE) {
        toast({ title: "Total size limit exceeded", description: `Adding ${file.name} would exceed the 50MB total limit`, variant: "destructive" });
        return;
      }
      runningTotal += file.size;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || reader.result as string;
        setAttachments(prev => [...prev, { name: file.name, type: file.type, size: file.size, data: base64 }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  }

  function fileIcon(type: string) {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    return '📎';
  }

  const addAttachment = () => {
    if (newAttachName.trim() && newAttachContent.trim()) {
      setAttachments([...attachments, { name: newAttachName.trim(), type: 'text/plain', size: newAttachContent.length, data: btoa(newAttachContent.trim()) }]);
      setNewAttachName("");
      setNewAttachContent("");
      setShowAttachForm(false);
    }
  };
  const removeAttachment = (idx: number) => setAttachments(attachments.filter((_, i) => i !== idx));

  // Template handler (change #6)
  function applyTemplate(tpl: typeof REQUEST_TEMPLATES[0]) {
    setServiceType(tpl.serviceType);
    setCategory(tpl.category);
    setTitle(tpl.title);
    setAiResponse(tpl.description);
    setTierOverride(null);
  }

  // Delivery estimate by tier
  function getDeliveryEstimate() {
    if (activeTier === 'guru') return '5-20 min';
    if (activeTier === 'pro') return '15-60 min';
    return '1-4 hours';
  }

  const canSubmit = title && category;

  // Confirmation screen (change #1)
  if (showConfirmation && submittedRequestId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center" data-testid="view-confirmation">
        <div className="mt-12">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Request submitted successfully!</h1>
          <p className="text-sm text-muted-foreground mb-1">An expert typically claims your request within 30 minutes.</p>
          <p className="text-sm text-muted-foreground mb-2">We'll notify you by email when your response is ready.</p>
          <div className="inline-flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2 mb-6">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Estimated delivery: ~{getDeliveryEstimate()}</span>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setSelectedRequest(submittedRequestId); setView("request-detail"); }} data-testid="button-view-request">
              View Request <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => { setShowConfirmation(false); setSubmittedRequestId(null); setTitle(''); setAiResponse(''); setCategory(''); setInstructions(''); setAttachments([]); setDraftId(null); }} data-testid="button-submit-another">
              <PlusCircle className="mr-2 h-4 w-4" /> Submit Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl" data-testid="view-new-request">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">New Request</h1>
          <p className="text-sm text-muted-foreground">All fields on one page. Fill in and submit.</p>
        </div>
        {draftSaveStatus === "saving" && <span className="text-xs text-muted-foreground" data-testid="draft-saving">Saving...</span>}
        {draftSaveStatus === "saved" && <span className="text-xs text-green-600 font-medium" data-testid="draft-saved">Draft saved</span>}
      </div>

      {/* Section A: Service Type Toggle */}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-2 block">Service Type</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="service-type-toggle">
          {([
            { id: "sense_check" as const, label: "Sense Check", desc: "Quick verification of AI output" },
            { id: "prompt_calibration" as const, label: "Prompt Calibration", desc: "Expert helps you ask better questions" },
            { id: "full_review" as const, label: "Full Review", desc: "Detailed expert analysis" },
            { id: "other" as const, label: "Other", desc: "Custom request" },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => { setServiceType(s.id); setTierOverride(null); }}
              className={`p-3 rounded-lg border text-left transition-all ${
                serviceType === s.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30"
              }`}
              data-testid={`toggle-service-${s.id}`}
            >
              <p className="text-xs font-semibold">{s.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Templates (change #6) */}
      <div className="mb-6" data-testid="request-templates">
        <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {REQUEST_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              className="flex-shrink-0 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left w-44"
              data-testid={`template-${tpl.id}`}
            >
              <p className="text-xs font-semibold truncate">{tpl.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{tpl.serviceType.replace('_', ' ')} · {tpl.category}</p>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 mt-1.5">Use</Button>
            </button>
          ))}
        </div>
      </div>

      {/* Section B: Request Details */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex items-center">
            <Label className="text-sm">Title *</Label>
            <InfoTooltip text="A clear, specific title helps experts understand your request quickly" />
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief title for your request" className="mt-1" data-testid="input-request-title" />
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm">Category *</Label>
            <InfoTooltip text="Select the field most relevant to your question" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1" data-testid="select-category"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="business">Business & Strategy</SelectItem>
              <SelectItem value="entrepreneurship">Entrepreneurship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* FEAT-010: My question field */}
        <div>
          <div className="flex items-center">
            <Label className="text-sm">My question *</Label>
            <InfoTooltip text="Describe exactly what you want the expert to answer or verify" />
          </div>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want the expert to answer or verify? Be specific about your concerns..."
            rows={3}
            className="mt-1"
            required
            data-testid="input-question"
          />
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm">{aiResponseLabel}</Label>
            <InfoTooltip text="Provide context for the expert" />
          </div>
          <Textarea
            value={aiResponse}
            onChange={(e) => setAiResponse(e.target.value)}
            placeholder={aiResponseLabel + "..."}
            rows={6}
            className="mt-1 font-mono text-xs"
            data-testid="input-ai-response"
          />
        </div>

        <div>
          <div className="flex items-center mb-2">
            <Label className="text-sm">Which AI generated this? (optional)</Label>
            <InfoTooltip text="Knowing which AI generated this helps us track accuracy patterns" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={llmProvider} onValueChange={setLlmProvider}>
              <SelectTrigger data-testid="select-llm-provider"><SelectValue placeholder="AI Provider" /></SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} placeholder="e.g. GPT-4o, Claude 3.5 Sonnet" data-testid="input-llm-model" />
          </div>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm">Instructions for expert (optional)</Label>
            <InfoTooltip text="Specific guidance for what you want the expert to focus on" />
          </div>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Any specific instructions or focus areas..." rows={3} className="mt-1" data-testid="input-instructions" />
        </div>

        {/* File Upload - Drag & Drop (change #5) */}
        <div data-testid="file-upload-section">
          <Label className="text-sm mb-2 block">Attachments ({attachments.length} file{attachments.length !== 1 ? 's' : ''})</Label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
            data-testid="dropzone"
          >
            <Paperclip className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Any format accepted — 50MB total limit</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
            data-testid="input-file-upload"
          />
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs" data-testid={`attached-file-${i}`}>
                  <span className="text-base">{fileIcon(a.type)}</span>
                  <span className="font-medium flex-1 truncate">{a.name}</span>
                  <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive" data-testid={`button-remove-attachment-${i}`}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section D: Dynamic Pricing */}
      <Card className="mb-6" data-testid="card-dynamic-pricing">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Estimated Price
            <InfoTooltip text="Price is estimated based on request complexity and expert tier. Final price may vary based on actual time spent." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-primary" data-testid="text-estimated-price">${estimatedPrice.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">AI-Determined Price</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <Badge className={`${
                activeTier === "standard" ? "bg-blue-500" : activeTier === "pro" ? "bg-indigo-500" : "bg-amber-500"
              } text-white`} data-testid="badge-expected-tier">
                {activeTier.charAt(0).toUpperCase() + activeTier.slice(1)}
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-1">Expected Expert Category</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-sm font-semibold" data-testid="text-completion-time">{completionTime}</p>
              <p className="text-[10px] text-muted-foreground">Expected Completion</p>
            </div>
          </div>

          {/* Expert Tier Override */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Override Expert Tier</Label>
            <div className="inline-flex bg-muted rounded-lg p-1" data-testid="tier-override-toggle">
              {(["standard", "pro", "guru"] as ExpertTierOverride[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierOverride(t)}
                  className={`px-4 py-1.5 text-xs rounded-md transition font-medium ${
                    activeTier === t ? "bg-background shadow text-foreground" : "text-muted-foreground"
                  }`}
                  data-testid={`tier-override-${t}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section E: Balance & Submit */}
      <Card className="bg-muted/50" data-testid="card-submit">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm">Your balance: <span className="font-bold">${balance.toFixed(2)}</span></p>
            </div>
            {!hasEnoughBalance && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-orange-600 font-medium">Insufficient balance</span>
                <Button size="sm" variant="outline" onClick={() => setView("credits")} data-testid="button-buy-credits">
                  <CreditCard className="h-3 w-3 mr-1" /> Buy Credits
                </Button>
              </div>
            )}
          </div>
          <Button
            className="w-full bg-gradient-to-r from-[#0F3DD1] to-[#171717] text-white"
            size="lg"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !canSubmit}
            data-testid="button-submit-request"
          >
            {submitMutation.isPending ? "Submitting..." : `Submit Request — $${estimatedPrice.toFixed(2)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── My Requests ───
function MyRequests({ userId, setView, setSelectedRequest, onContinueDraft }: { userId: number; setView: (v: ClientView) => void; setSelectedRequest: (id: number) => void; onContinueDraft: (id: number) => void }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  const { data: requests, isLoading } = useQuery<ExpertRequest[]>({ queryKey: ["/api/requests/user", userId] });
  const { data: drafts } = useQuery<ExpertRequest[]>({
    queryKey: ["/api/requests/drafts", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/requests/drafts/${userId}`);
      return res.json();
    },
  });
  const { toast } = useToast();

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftIdToDelete: number) => {
      await apiRequest("DELETE", `/api/requests/${draftIdToDelete}/draft`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests/drafts", userId] });
      toast({ title: "Draft deleted" });
      setShowDeleteDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const nonDraftRequests = requests?.filter((r) => r.status !== "draft" && r.status !== "deleted");
  // FEAT-013: "all" includes drafts too
  const allIncludingDrafts = [...(nonDraftRequests || []), ...(drafts || [])];
  const filtered = statusFilter === "all" ? allIncludingDrafts : statusFilter === "drafts" ? drafts : nonDraftRequests?.filter((r) => r.status === statusFilter);
  // Count helpers for badges
  const pendingCount = nonDraftRequests?.filter((r) => r.status === "pending").length ?? 0;
  const inProgressCount = nonDraftRequests?.filter((r) => r.status === "in_progress").length ?? 0;
  const completedCount = nonDraftRequests?.filter((r) => r.status === "completed").length ?? 0;
  const draftsCount = drafts?.length ?? 0;
  const allCount = (nonDraftRequests?.length ?? 0) + draftsCount;

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="p-6" data-testid="view-my-requests">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">My Requests</h1>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "all", label: `All (${allCount})` },
            { id: "pending", label: `Pending (${pendingCount})` },
            { id: "in_progress", label: `In Progress (${inProgressCount})` },
            { id: "completed", label: `Completed (${completedCount})` },
            { id: "drafts", label: `Drafts (${draftsCount})` },
          ].map((s) => (
            <button key={s.id} onClick={() => setStatusFilter(s.id)} className={`px-3 py-1 text-xs rounded-full ${statusFilter === s.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`} data-testid={`filter-${s.id}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {statusFilter === "drafts" ? (
        <div className="space-y-3" data-testid="drafts-list">
          {(!drafts || drafts.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No drafts</p>
          ) : drafts.map((d) => (
            <Card key={d.id} data-testid={`draft-card-${d.id}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{d.title || "Untitled draft"}</p>
                    <Badge className={`text-[10px] ${serviceTypeBadge(d.serviceType)}`}>{serviceTypeLabel(d.serviceType)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Last saved {timeAgo(d.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onContinueDraft(d.id)} data-testid={`button-continue-draft-${d.id}`}>Continue</Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(d.id)} data-testid={`button-delete-draft-${d.id}`}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {/* Delete confirmation dialog */}
          <Dialog open={showDeleteDialog !== null} onOpenChange={() => setShowDeleteDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Draft?</DialogTitle>
                <DialogDescription>This action cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => showDeleteDialog && deleteDraftMutation.mutate(showDeleteDialog)} disabled={deleteDraftMutation.isPending}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-xs">Date</th>
                  <th className="text-left p-3 font-medium text-xs">Title</th>
                  <th className="text-left p-3 font-medium text-xs">Type</th>
                  <th className="text-left p-3 font-medium text-xs">Category</th>
                  <th className="text-left p-3 font-medium text-xs">Status</th>
                  <th className="text-left p-3 font-medium text-xs">Credits</th>
                </tr>
              </thead>
              <tbody>
                {(!filtered || filtered.length === 0) ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">No requests found</td></tr>
                ) : (filtered as ExpertRequest[]).map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer transition" onClick={() => { setSelectedRequest(r.id); setView("request-detail"); }} data-testid={`request-table-row-${r.id}`}>
                    <td className="p-3 text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-sm font-medium">{r.title}</td>
                    <td className="p-3"><Badge className={`text-[10px] ${serviceTypeBadge(r.serviceType)}`}>{serviceTypeLabel(r.serviceType)}</Badge></td>
                    <td className="p-3 text-xs capitalize">{r.category}</td>
                    <td className="p-3">
                      <Badge className={`text-xs ${statusColor(r.status)}`}>{r.status.replace("_", " ")}</Badge>
                      <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px]">
                          {r.status === 'pending' ? (
                            r.tier === 'guru' ? 'Est. delivery: ~10-20min' : r.tier === 'pro' ? 'Est. delivery: ~30-60min' : 'Est. delivery: ~2-4h'
                          ) : r.status === 'in_progress' ? (
                            'Expert working on it — Est. ~1-2h remaining'
                          ) : r.status === 'completed' && r.createdAt ? (
                            `Completed in ${Math.max(1, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000))} min`
                          ) : ''}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">${r.creditsCost} credits</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ─── Expert Profile Card ───
function ExpertProfileCard({ expert, compact }: { expert: Expert & { userName: string }; compact?: boolean }) {
  const rating = (expert.rating / 10).toFixed(1);
  const categories: string[] = (() => {
    try { return JSON.parse(expert.categories || "[]"); } catch { return []; }
  })();

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg" data-testid={`expert-profile-card-${expert.id}`}>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{expert.userName}</span>
            {expert.verified === 1 && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0">
                <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Verified
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {expert.education && <span>{expert.education}</span>}
            {expert.yearsExperience > 0 && <span>· {expert.yearsExperience}y exp</span>}
            <span>· {rating}/5.0 ★</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/10" data-testid={`expert-profile-card-${expert.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{expert.userName}</span>
              {expert.verified === 1 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0">
                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Verified
                </Badge>
              )}
            </div>
            {expert.education && (
              <p className="text-xs text-muted-foreground mb-1">🎓 {expert.education}</p>
            )}
            <p className="text-xs text-muted-foreground mb-1">{expert.expertise}</p>
            <div className="flex items-center gap-3 mt-2">
              {expert.yearsExperience > 0 && (
                <span className="text-xs text-muted-foreground">{expert.yearsExperience} years experience</span>
              )}
              <span className="text-xs font-medium text-amber-600">{rating}/5.0 ★ ({expert.totalReviews} reviews)</span>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-[10px] capitalize">{cat}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Client Rating Component ───
function ClientRatingSection({ request, userId }: { request: ExpertRequest; userId: number }) {
  const [starRating, setStarRating] = useState(request.clientRating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(request.clientRatingComment ?? "");
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const { toast } = useToast();

  const hasRated = request.clientRating != null && request.clientRating > 0;
  const isRefunded = request.refunded === 1;

  const rateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/requests/${request.id}/rate`, {
        rating: starRating,
        comment: comment || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rating submitted!" });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", request.id] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/requests/${request.id}/refund`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Refund processed!", description: `$${request.creditsCost} credits refunded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", request.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits", userId] });
      setShowRefundDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setShowRefundDialog(false);
    },
  });

  return (
    <Card className="mb-4" data-testid="card-client-rating">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" /> Rate this expert's response
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasRated ? (
          <div>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-6 w-6 ${s <= (request.clientRating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                />
              ))}
              <span className="ml-2 text-sm font-medium">{request.clientRating}/5</span>
            </div>
            {request.clientRatingComment && (
              <p className="text-sm text-muted-foreground">{request.clientRatingComment}</p>
            )}
            {isRefunded && (
              <Badge className="mt-2 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                <RefreshCcw className="h-3 w-3 mr-1" /> Refunded
              </Badge>
            )}
            {!isRefunded && (request.clientRating ?? 0) <= 2 && (
              <div className="mt-3">
                <Button variant="destructive" size="sm" onClick={() => setShowRefundDialog(true)} data-testid="button-request-refund">
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Request Refund
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Not satisfied? You can claim a refund (up to 2 per month).</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setStarRating(s)}
                  data-testid={`star-rating-${s}`}
                >
                  <Star
                    className={`h-7 w-7 cursor-pointer transition ${
                      s <= (hoverRating || starRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"
                    }`}
                  />
                </button>
              ))}
              {starRating > 0 && <span className="ml-2 text-sm font-medium">{starRating}/5</span>}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional feedback about your experience..."
              rows={2}
              className="mb-3 text-sm"
              data-testid="input-client-rating-comment"
            />
            <Button
              size="sm"
              onClick={() => rateMutation.mutate()}
              disabled={starRating === 0 || rateMutation.isPending}
              data-testid="button-submit-client-rating"
            >
              {rateMutation.isPending ? "Submitting..." : "Submit Rating"}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Refund confirmation dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to request a refund of ${request.creditsCost} credits? This action cannot be undone. You can request up to 2 refunds per month.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(false)} data-testid="button-cancel-refund">Cancel</Button>
            <Button variant="destructive" onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending} data-testid="button-confirm-refund">
              {refundMutation.isPending ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Request Detail (type-specific) ───
// ─── Request Timeline Component ───
function RequestTimeline({ requestId, userId, userName }: { requestId: number; userId: number; userName: string }) {
  const { data: events } = useQuery<RequestEvent[]>({
    queryKey: ["/api/requests", requestId, "timeline"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/requests/${requestId}/timeline`);
      return res.json();
    },
  });
  const [msg, setMsg] = useState("");
  const { toast } = useToast();

  const sendMsgMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/requests/${requestId}/message`, {
        actorId: userId,
        actorName: userName,
        message: msg,
      });
    },
    onSuccess: () => {
      setMsg("");
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "timeline"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sortedEvents = [...(events || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  function eventIcon(type: string) {
    switch (type) {
      case "submitted": return <Circle className="h-3 w-3 text-gray-400 fill-gray-400" />;
      case "viewed": return <Circle className="h-3 w-3 text-blue-400 fill-blue-400" />;
      case "claimed": return <Circle className="h-3 w-3 text-green-500 fill-green-500" />;
      case "in_review": return <Circle className="h-3 w-3 text-yellow-500 fill-yellow-500" />;
      case "completed": return <CheckCircle className="h-3 w-3 text-green-600" />;
      case "message": return <MessageSquare className="h-3 w-3 text-blue-500" />;
      default: return <Circle className="h-3 w-3 text-gray-300" />;
    }
  }

  function eventLabel(e: RequestEvent) {
    switch (e.type) {
      case "submitted": return "Request submitted";
      case "viewed": return `Viewed by ${e.actorName || "experts"}`;
      case "claimed": return `Claimed by ${e.actorName || "an expert"}`;
      case "in_review": return `Under review by ${e.actorName || "an expert"}`;
      case "completed": return `Completed by ${e.actorName || "an expert"}`;
      case "message": return `${e.actorName}: ${e.message}`;
      default: return e.type;
    }
  }

  return (
    <Card className="mb-4" data-testid="request-timeline">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Request Timeline</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedEvents.map((e, i) => (
            <div key={e.id || i} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{eventIcon(e.type)}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${e.type === "message" ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/10 p-2 rounded" : ""}`}>{eventLabel(e)}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {sortedEvents.length === 0 && <p className="text-xs text-muted-foreground">No events yet</p>}
        </div>
        {/* Messaging input */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium mb-2">Send a message</p>
          <div className="flex gap-2">
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && msg.trim() && sendMsgMutation.mutate()}
              placeholder="Ask the expert a question..."
              className="flex-1 text-xs"
              data-testid="input-timeline-message"
            />
            <Button size="sm" onClick={() => sendMsgMutation.mutate()} disabled={!msg.trim() || sendMsgMutation.isPending} data-testid="button-send-timeline-message">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestDetail({ requestId, userId, setView }: { requestId: number; userId: number; setView: (v: ClientView) => void }) {
  const { user } = useAuth();
  const { data: request } = useQuery<ExpertRequest>({ queryKey: ["/api/requests", requestId] });
  const { data: reviews } = useQuery<DetailedReview[]>({
    queryKey: ["/api/reviews/request", requestId, "detailed"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reviews/request/${requestId}/detailed`);
      return res.json();
    },
  });
  const [chatInput, setChatInput] = useState("");
  const { data: msgs } = useQuery<Message[]>({ queryKey: ["/api/messages", requestId] });
  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/messages", { requestId, role: "user", content: chatInput });
      const allMsgs = [...(msgs || []), { role: "user", content: chatInput }];
      const res = await apiRequest("POST", "/api/chat", {
        messages: allMsgs.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
        category: request?.category,
      });
      const data = await res.json();
      await apiRequest("POST", "/api/messages", { requestId, role: "assistant", content: data.content });
    },
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", requestId] });
    },
    onError: (err: Error) => {
      toast({ title: "Chat error", description: err.message, variant: "destructive" });
    },
  });

  if (!request) return <div className="p-6"><p className="text-sm text-muted-foreground">Loading...</p></div>;

  const parsedAttachments: Array<{ name: string; content: string }> = (() => {
    try { return JSON.parse(request.attachments || "[]"); } catch { return []; }
  })();

  const completedReviews = reviews?.filter((r) => r.status === "completed") ?? [];
  const totalReviews = reviews?.length ?? 0;
  const avgRating = completedReviews.length > 0
    ? (completedReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / completedReviews.length).toFixed(1)
    : null;

  return (
    <div className="p-6" data-testid="view-request-detail">
      <div className="flex items-center gap-3 mb-1">
        <Button variant="ghost" size="sm" onClick={() => setView("my-requests")} data-testid="button-back-to-list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">{request.title}</h1>
        <Badge className={`text-xs ${serviceTypeBadge(request.serviceType)}`}>{request.serviceType}</Badge>
        <Badge className={`text-xs ${statusColor(request.status)}`}>{request.status.replace("_", " ")}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4 ml-10">
        {request.category} · {request.tier} tier · ${request.creditsCost} credits
        {request.priceTier && <> · <Badge variant="secondary" className="text-[10px] ml-1">{request.priceTier.replace("_", " ")}</Badge></>}
        {request.pricePerMinute && <> · ${request.pricePerMinute}/min</>}
      </p>

      {/* Lifecycle Status Bar */}
      <Card className="mb-4" data-testid="lifecycle-status-bar">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {[
              { key: "submitted", label: "Submitted", icon: <CheckCircle className="h-4 w-4" /> },
              { key: "expert_assigned", label: "Expert Assigned", icon: <User className="h-4 w-4" /> },
              { key: "in_progress", label: "In Progress", icon: <Clock className="h-4 w-4" /> },
              { key: "completed", label: "Delivered", icon: <CheckCircle className="h-4 w-4" /> },
              { key: "follow_ups", label: "Follow-ups", icon: <MessageSquare className="h-4 w-4" /> },
            ].map((step, i, arr) => {
              const statusOrder = ["pending", "in_progress", "completed"];
              const currentIdx = statusOrder.indexOf(request.status);
              let isActive = false;
              if (step.key === "submitted") isActive = currentIdx >= 0;
              else if (step.key === "expert_assigned") isActive = currentIdx >= 1;
              else if (step.key === "in_progress") isActive = currentIdx >= 1;
              else if (step.key === "completed") isActive = currentIdx >= 2;
              else if (step.key === "follow_ups") isActive = currentIdx >= 2;
              return (
                <div key={step.key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 ${
                    isActive ? "text-green-600" : "text-muted-foreground/40"
                  }`}>
                    {step.icon}
                    <span className="text-[10px] font-medium hidden sm:inline">{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`w-6 h-0.5 mx-1 ${isActive ? "bg-green-500" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Request Timeline */}
      <RequestTimeline requestId={requestId} userId={userId} userName={user?.name || ""} />

      {/* AI Response */}
      {request.aiResponse && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">AI Response Submitted</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded text-xs">{request.aiResponse}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed" data-testid="text-ai-response-disclaimer">
              This AI analysis was generated by a third-party AI model and may contain inaccuracies. Expert verification is recommended before making decisions based on this content.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {request.instructions && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Instructions</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{request.instructions}</p></CardContent>
        </Card>
      )}

      {/* Attachments */}
      {parsedAttachments.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parsedAttachments.map((a, i) => (
                <details key={i} className="border rounded p-2">
                  <summary className="text-xs font-medium cursor-pointer flex items-center gap-2">
                    <FileText className="h-3 w-3" /> {a.name}
                  </summary>
                  <pre className="mt-2 text-xs bg-muted/30 p-2 rounded whitespace-pre-wrap">{a.content}</pre>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Type-specific review display */}
      {request.serviceType === "rate" && (
        <div className="space-y-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Expert Ratings Progress</p>
                <p className="text-xs text-muted-foreground">{completedReviews.length} of {totalReviews} experts responded</p>
              </div>
              <Progress value={totalReviews > 0 ? (completedReviews.length / totalReviews) * 100 : 0} className="h-2" data-testid="progress-ratings" />
            </CardContent>
          </Card>

          {avgRating && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30">
              <CardContent className="p-6 text-center">
                <p className="text-4xl font-bold text-amber-700 dark:text-amber-400" data-testid="text-avg-rating">{avgRating}</p>
                <p className="text-sm text-muted-foreground">Average Score out of 10</p>
                <p className="text-xs text-muted-foreground mt-1">Based on {completedReviews.length} expert(s)</p>
              </CardContent>
            </Card>
          )}

          {completedReviews.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {completedReviews.map((rev, i) => {
                const dRev = rev as DetailedReview;
                return (
                  <Card key={rev.id} data-testid={`card-rating-${rev.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-xs font-medium">{dRev.expert?.userName || `Expert #${i + 1}`}</span>
                          {dRev.expert?.verified === 1 && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1 py-0">
                              <CheckCircle className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                        </div>
                        <span className="text-lg font-bold text-amber-600">{rev.rating}/10</span>
                      </div>
                      {dRev.expert && (
                        <ExpertProfileCard expert={dRev.expert} compact />
                      )}
                      {rev.ratingComment && <p className="text-xs text-muted-foreground mt-2">{rev.ratingComment}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {completedReviews.length > 0 && (
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed" data-testid="text-expert-opinion-disclaimer">
              Expert opinions represent the individual expert's professional assessment and do not constitute formal advice from A2A Global Inc.
            </p>
          )}
        </div>
      )}

      {request.serviceType === "review" && completedReviews.length > 0 && (
        <div className="space-y-3 mb-4">
          {completedReviews.map((rev) => {
            const dRev = rev as DetailedReview;
            return (
            <div key={rev.id} className="space-y-3" data-testid={`review-detail-${rev.id}`}>
              {dRev.expert && <ExpertProfileCard expert={dRev.expert} />}
              {rev.correctPoints && (
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> What's Correct</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{rev.correctPoints}</p></CardContent>
                </Card>
              )}
              {rev.incorrectPoints && (
                <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> What's Wrong</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{rev.incorrectPoints}</p></CardContent>
                </Card>
              )}
              {rev.suggestions && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Suggestions</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{rev.suggestions}</p></CardContent>
                </Card>
              )}
            </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed" data-testid="text-expert-opinion-disclaimer">
            Expert opinions represent the individual expert's professional assessment and do not constitute formal advice from A2A Global Inc.
          </p>
        </div>
      )}

      {request.serviceType === "custom" && completedReviews.length > 0 && (
        <div className="mb-4 space-y-3">
          {completedReviews.map((rev) => {
            const dRev = rev as DetailedReview;
            return (
              <div key={rev.id} className="space-y-3">
                {dRev.expert && <ExpertProfileCard expert={dRev.expert} />}
                <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/10 dark:border-purple-900/30" data-testid={`custom-deliverable-${rev.id}`}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-700 dark:text-purple-400 flex items-center gap-2"><Wrench className="h-4 w-4" /> Expert Deliverable</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{rev.deliverable}</p></CardContent>
                </Card>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed" data-testid="text-expert-opinion-disclaimer">
            Expert opinions represent the individual expert's professional assessment and do not constitute formal advice from A2A Global Inc.
          </p>
        </div>
      )}

      {/* Resubmit button (change #3) */}
      {request.status === "completed" && (
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => {
              // Navigate to new-request with pre-filled data
              const hash = `#/dashboard?prefill_category=${encodeURIComponent(request.category)}&prefill_ai_response=${encodeURIComponent(request.aiResponse || '')}&prefill_title=${encodeURIComponent(request.title + ' (resubmit)')}`;
              window.location.hash = hash;
              setView('new-request');
            }}
            data-testid="button-resubmit"
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Resubmit Similar Request
          </Button>
        </div>
      )}

      {/* Client Rating (only on completed requests) */}
      {request.status === "completed" && (
        <ClientRatingSection request={request} userId={userId} />
      )}

      {/* AI Chat */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> AI Conversation</CardTitle></CardHeader>
        <CardContent>
          <div className="min-h-[200px] max-h-[350px] overflow-y-auto space-y-3 mb-4">
            {(!msgs || msgs.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">Start a conversation about your request</p>
            )}
            {msgs?.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-white" : "bg-muted"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex justify-start"><div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Analyzing...</div></div>
            )}
          </div>
          <div className="flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && chatInput.trim() && sendMutation.mutate()}
              placeholder="Ask a follow-up question..." className="flex-1" data-testid="input-chat" />
            <Button onClick={() => chatInput.trim() && sendMutation.mutate()} disabled={sendMutation.isPending || !chatInput.trim()} size="sm" data-testid="button-send-chat">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Credits & Billing (Custom Top-Up) ───
function Credits({ userId, onContinueDraft }: { userId: number; onContinueDraft?: (draftId: number) => void }) {
  const { data, isLoading } = useQuery<{ credits: number; transactions: CreditTransaction[] }>({ queryKey: ["/api/credits", userId] });
  const [topUpAmount, setTopUpAmount] = useState(25);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftIdForBanner, setDraftIdForBanner] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch existing drafts
  const { data: drafts } = useQuery<ExpertRequest[]>({
    queryKey: ["/api/requests/drafts", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/requests/drafts/${userId}`);
      return res.json();
    },
  });

  const topUpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/credits/topup", { userId, amountDollars: topUpAmount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits", userId] });
      toast({ title: "Credits purchased!", description: `$${topUpAmount} added to your account.` });
      // Check for draft requests and show notification
      if (drafts && drafts.length > 0) {
        setShowDraftBanner(true);
        setDraftIdForBanner(drafts[0].id);
        // Also create a notification via API
        apiRequest("POST", "/api/notifications/create", {
          userId,
          title: "Draft request waiting",
          message: "You have a draft request waiting. Continue editing to submit it.",
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/notifications", userId] });
        }).catch(() => {});
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const balance = data?.credits ?? 0;

  function requestBreakdown(amount: number) {
    return {
      standard: Math.floor(amount / 2.50),
      pro: Math.floor(amount / 50),
      guru: Math.floor(amount / 300),
    };
  }

  const topUpBreakdown = requestBreakdown(topUpAmount);
  const balanceBreakdown = requestBreakdown(balance);

  return (
    <div className="p-6 max-w-3xl" data-testid="view-credits">
      <h1 className="text-xl font-bold mb-6">Credits & Billing</h1>

      {/* Draft request banner */}
      {showDraftBanner && draftIdForBanner && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 flex items-center justify-between" data-testid="banner-draft-notification">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">You have an unsaved draft request</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Your credits have been topped up. Continue editing your draft.</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0 ml-3"
            onClick={() => { if (onContinueDraft) onContinueDraft(draftIdForBanner); }}
            data-testid="button-continue-draft"
          >
            Continue editing →
          </Button>
        </div>
      )}

      {/* Also show banner if drafts exist without top-up */}
      {!showDraftBanner && drafts && drafts.length > 0 && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3 flex items-center justify-between" data-testid="banner-existing-draft">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-300">You have {drafts.length} draft request{drafts.length > 1 ? "s" : ""} waiting</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-blue-700 hover:bg-blue-100 shrink-0"
            onClick={() => { if (onContinueDraft) onContinueDraft(drafts[0].id); }}
            data-testid="button-resume-draft"
          >
            Continue editing →
          </Button>
        </div>
      )}

      {/* Current Balance */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Coins className="h-8 w-8 text-primary mb-1" />
              <p className="text-3xl font-bold">${balance.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Available Balance</p>
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-medium mb-2">Your remaining balance can cover approximately:</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-blue-600">{balanceBreakdown.standard}</p>
                <p className="text-[10px] text-muted-foreground">Standard ($2.50 each)</p>
              </div>
              <div>
                <p className="text-lg font-bold text-indigo-600">{balanceBreakdown.pro}</p>
                <p className="text-[10px] text-muted-foreground">Pro ($50 each)</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{balanceBreakdown.guru}</p>
                <p className="text-[10px] text-muted-foreground">Guru ($300 each)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Top-Up */}
      <Card className="mb-6" data-testid="card-custom-topup">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Up Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Enter amount ($5 – $10,000)</Label>
              <div className="flex gap-3 mt-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={5}
                    max={10000}
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(Math.max(5, Math.min(10000, Number(e.target.value) || 5)))}
                    className="pl-8"
                    data-testid="input-topup-amount"
                  />
                </div>
                <Button onClick={() => topUpMutation.mutate()} disabled={topUpMutation.isPending || topUpAmount < 5} data-testid="button-topup">
                  {topUpMutation.isPending ? "Processing..." : `Top Up $${topUpAmount}`}
                </Button>
              </div>
            </div>

            <div>
              <Slider
                value={[topUpAmount]}
                onValueChange={([v]) => setTopUpAmount(v)}
                min={5} max={500} step={5}
                className="mt-1"
                data-testid="slider-topup"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>$5</span><span>$250</span><span>$500</span>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3" data-testid="topup-breakdown">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">With ${topUpAmount}, you can submit approximately:</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-600">{topUpBreakdown.standard}</p>
                  <p className="text-[10px] text-muted-foreground">Standard sense checks ($2.50 each)</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-indigo-600">{topUpBreakdown.pro}</p>
                  <p className="text-[10px] text-muted-foreground">Pro full reviews ($50 each)</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600">{topUpBreakdown.guru}</p>
                  <p className="text-[10px] text-muted-foreground">Guru consultations ($300 each)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mb-6 italic">
        You can also top up at the point of submitting a request if your balance is insufficient.
      </p>

      <h2 className="text-base font-semibold mb-4">Transaction History</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium text-xs">Date</th>
              <th className="text-left p-3 font-medium text-xs">Description</th>
              <th className="text-left p-3 font-medium text-xs">Type</th>
              <th className="text-right p-3 font-medium text-xs">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(!data?.transactions || data.transactions.length === 0) ? (
              <tr><td colSpan={4} className="p-4 text-center text-sm text-muted-foreground">No transactions</td></tr>
            ) : data.transactions.map((tx) => (
              <tr key={tx.id} className="border-t">
                <td className="p-3 text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-sm">{tx.description}</td>
                <td className="p-3"><Badge variant="secondary" className="text-xs capitalize">{tx.type}</Badge></td>
                <td className={`p-3 text-right text-sm font-medium ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>{tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount)} credits</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Settings ───
// ─── FEAT-006: Chat with AI Panel ───
function ChatAIView({ setView, prefillQuery }: { setView: (v: ClientView) => void; prefillQuery?: string }) {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("finance");
  const [hasResponse, setHasResponse] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const categories = [
    { id: "finance", label: "Finance" },
    { id: "business", label: "Business & Strategy" },
    { id: "entrepreneurship", label: "Entrepreneurship" },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  // Pre-fill from URL param
  useEffect(() => {
    if (prefillQuery && prefillQuery.trim()) {
      setMessage(prefillQuery);
    }
  }, [prefillQuery]);

  async function handleSend() {
    const q = message.trim();
    if (!q || loading) return;
    setLastQuery(q);
    setMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/chat", { message: q, category });
      const data = await res.json();
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.content ?? data.message ?? "No response" }]);
      setHasResponse(true);
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
      setChatHistory((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleGetExpertReview() {
    // Navigate to New Request pre-filled with the AI query
    const hash = `#/dashboard?prefill_category=${encodeURIComponent(category)}&prefill_ai_response=${encodeURIComponent(chatHistory.filter(m => m.role === "assistant").pop()?.content ?? "")}&prefill_title=${encodeURIComponent(lastQuery.substring(0, 60))}`;
    window.history.replaceState(null, "", window.location.pathname + hash);
    setView("new-request");
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl" data-testid="view-chat-ai">
      <h1 className="text-xl font-bold mb-2">Chat with AI</h1>
      <p className="text-sm text-muted-foreground mb-4">Ask any question and get an instant AI analysis. Optionally, escalate to a human expert review.</p>

      {/* Category selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
              category === c.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`chat-category-${c.id}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="min-h-[240px] max-h-[400px] overflow-y-auto space-y-3 mb-4">
            {chatHistory.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-10">
                Ask anything about {categories.find((c) => c.id === category)?.label}...
              </p>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
                  msg.role === "user" ? "bg-primary text-white" : "bg-muted"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Analyzing...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your question..."
              className="flex-1"
              data-testid="input-chat-ai-message"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              size="sm"
              data-testid="button-chat-ai-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            AI responses are for informational purposes only and may contain errors. Get an expert to verify.
          </p>
        </CardContent>
      </Card>

      {/* Get Human Expert Review button */}
      {hasResponse && (
        <div className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-green-50 border border-primary/20 rounded-xl" data-testid="chat-ai-cta">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Want a human expert to review this?</p>
              <p className="text-xs text-muted-foreground">Get a verified expert to validate accuracy and provide deeper insights.</p>
            </div>
          </div>
          <Button
            onClick={handleGetExpertReview}
            className="w-full bg-gradient-to-br from-primary to-slate-800 text-white hover:opacity-90"
            data-testid="button-get-human-review"
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Get Human Expert Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SettingsView({ userId }: { userId: number }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // BUG-008: Load existing photo on mount
  useEffect(() => {
    setPhotoUrl(`/api/users/${userId}/photo?t=${Date.now()}`);
  }, [userId]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload a JPEG, PNG, or WebP image.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' });
      return;
    }
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch(`/api/users/${userId}/photo`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      setPhotoUrl(`/api/users/${userId}/photo?t=${Date.now()}`);
      toast({ title: 'Photo updated!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { name, email });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved!" });
    },
  });

  return (
    <div className="p-6 max-w-xl" data-testid="view-settings">
      <h1 className="text-xl font-bold mb-6">Settings</h1>
      <div className="space-y-4">
        {/* BUG-008: Profile photo upload */}
        <div>
          <Label className="text-sm">Profile Photo</Label>
          <div className="mt-2 flex items-center gap-4">
            <div
              className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center cursor-pointer group"
              onClick={() => photoInputRef.current?.click()}
              title="Click to upload photo"
              data-testid="settings-avatar-upload"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover"
                  onError={() => setPhotoUrl(null)}
                />
              ) : (
                <User className="h-7 w-7 text-muted-foreground" />
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {photoUploading ? (
                  <span className="text-white text-[10px]">...</span>
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
                data-testid="input-settings-photo"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Click to upload. JPEG, PNG, or WebP, max 5MB.</p>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-sm">Full Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" data-testid="input-settings-name" />
        </div>
        <div>
          <Label className="text-sm">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1" data-testid="input-settings-email" />
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-settings">
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Client Dashboard ───
// ─── Skeleton Loaders (change #12) ───
function OverviewSkeleton() {
  return (
    <div className="p-6 space-y-6" data-testid="skeleton-overview">
      <div className="h-6 w-32 bg-muted animate-pulse rounded" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
      </div>
      <div className="h-48 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

function MyRequestsSkeleton() {
  return (
    <div className="p-6" data-testid="skeleton-my-requests">
      <div className="h-6 w-40 bg-muted animate-pulse rounded mb-6" />
      <div className="border rounded-lg overflow-hidden">
        {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse border-b" />)}
      </div>
    </div>
  );
}

// ─── Global Search Bar (change #11) ───
function GlobalSearchBar({ userId, onNavigate }: { userId: number; onNavigate: (requestId: number) => void }) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { data: requests } = useQuery<ExpertRequest[]>({ queryKey: ["/api/requests/user", userId] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const filtered = debouncedQuery.trim()
    ? requests?.filter(r => r.status !== 'draft' && r.status !== 'deleted' && (
        r.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        r.status.toLowerCase().includes(debouncedQuery.toLowerCase())
      )).slice(0, 5)
    : [];

  return (
    <div className="relative" data-testid="global-search">
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search requests, experts..."
          className="bg-transparent border-none outline-none text-sm w-40 md:w-56 placeholder:text-muted-foreground/60"
          data-testid="input-global-search"
        />
      </div>
      {showResults && filtered && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-lg shadow-lg z-50 overflow-hidden" data-testid="search-results">
          {filtered.map(r => (
            <button
              key={r.id}
              onMouseDown={() => onNavigate(r.id)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 text-sm border-b last:border-b-0"
              data-testid={`search-result-${r.id}`}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{r.title}</span>
              <Badge className={`text-[10px] shrink-0 ${statusColor(r.status)}`}>{r.status.replace('_', ' ')}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ClientView>(() => getPrefillData() ? "new-request" : "overview");
  const [selectedRequest, setSelectedRequest] = useState<number>(0);
  const [editDraftId, setEditDraftId] = useState<number | undefined>(undefined);
  const [showTour, setShowTour] = useState(true);
  // Check tourCompleted on user load (change #10)
  useEffect(() => {
    if (user?.tourCompleted === 1) setShowTour(false);
  }, [user]);
  // BUG-009: Force light theme — remove dark class
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // SSE real-time notifications
  useSSE(user?.id);

  // Prefill detection from AI chat pipeline
  useEffect(() => {
    const prefill = getPrefillData();
    if (prefill && user) {
      setView("new-request");
    }
  }, [user]);

  // Handle notification deep-link: ?request=ID
  // BUG-005: Also handle ?prefill=<encoded-query> for AI chat → signup → dashboard flow
  useEffect(() => {
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx === -1) return;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      const reqId = params.get('request');
      if (reqId) {
        setSelectedRequest(parseInt(reqId));
        setView('request-detail');
        // Clean the URL
        window.history.replaceState(null, '', window.location.pathname + '#/dashboard');
        return;
      }
      // BUG-005: Check for prefill param from auth redirect
      const prefillParam = params.get('prefill');
      if (prefillParam) {
        // Set as new-request view with URL params handled by NewRequest
        setView('new-request');
        window.history.replaceState(null, '', window.location.pathname + '#/dashboard');
        return;
      }
    } catch {}
  }, []);

  if (!user) {
    setLocation("/login");
    return null;
  }

  function handleLogout() {
    logout();
    setLocation("/");
  }

  const sidebarStyle = { "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full" data-testid="page-dashboard">
        <ClientSidebar view={view} setView={setView} onLogout={handleLogout} onResetDraft={() => setEditDraftId(undefined)} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <GlobalSearchBar userId={user.id} onNavigate={(id) => { setSelectedRequest(id); setView('request-detail'); }} />
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell userId={user.id} onNavigate={(link) => {
                // Parse link for in-page navigation (e.g., /dashboard?request=5)
                if (link.startsWith('/dashboard?request=')) {
                  const reqId = new URLSearchParams(link.split('?')[1]).get('request');
                  if (reqId) {
                    setSelectedRequest(parseInt(reqId));
                    setView('request-detail');
                  }
                } else {
                  setLocation(link);
                }
              }} />
              <Badge variant="secondary" className="text-xs"><Coins className="h-3 w-3 mr-1" />${user.credits} credits</Badge>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {view === "overview" && <Overview userId={user.id} setView={(v) => { if (v === "new-request") setEditDraftId(undefined); setView(v); }} setSelectedRequest={setSelectedRequest} />}
            {view === "new-request" && <NewRequest key={editDraftId ?? "new"} userId={user.id} setView={setView} setSelectedRequest={setSelectedRequest} editDraftId={editDraftId} />}
            {view === "my-requests" && <MyRequests userId={user.id} setView={setView} setSelectedRequest={setSelectedRequest} onContinueDraft={(id) => { setEditDraftId(id); setView("new-request"); }} />}
            {view === "request-detail" && <RequestDetail requestId={selectedRequest} userId={user.id} setView={setView} />}
            {view === "credits" && <Credits userId={user.id} onContinueDraft={(id) => { setEditDraftId(id); setView("new-request"); }} />}
            {view === "settings" && <SettingsView userId={user.id} />}
            {view === "chat-ai" && <ChatAIView setView={setView} />}
          </main>
        </div>
        {showTour && <OnboardingTour steps={CLIENT_TOUR_STEPS} onComplete={() => setShowTour(false)} userId={user.id} />}
        <FloatingHelp />
      </div>
    </SidebarProvider>
  );
}
