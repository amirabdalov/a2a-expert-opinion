import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import {
  Menu,
  LogIn,
  X,
  ChevronDown,
  Globe,
  CreditCard,
  ArrowDown,
  Search,
  Shield,
  ChevronRight,
  CheckCircle,
  Briefcase,
  Clock,
  ArrowRight,
  ChevronUp,
} from "lucide-react";

// ─── Asset imports ───────────────────────────────────────────────────────────
import mainBgImg from "@assets/payments/main-home-page-bg.png";
import logoSvg from "@assets/payments/a2a-blue-logo.svg";
import blurCircleSvg from "@assets/payments/blur-circle.svg";
import arrowBlackSvg from "@assets/payments/arrow-black.svg";
import arrowWhiteSvg from "@assets/payments/arrow-white.svg";
import rbiApprovedSvg from "@assets/payments/RBI-approved-icon.svg";
import bankSecuritySvg from "@assets/payments/bank-grade-security.svg";
import trustedSvg from "@assets/payments/trusted-by-freelancers-icon.svg";
import billboardImg from "@assets/payments/billboard-mockup.png";

// ─── Brand constants ──────────────────────────────────────────────────────────
const REGISTER_URL =
  "https://a2a-registration-506299896481.us-central1.run.app/#/auth/signup";
const LOGIN_URL =
  "https://a2a-registration-506299896481.us-central1.run.app/#/auth/login";

// ─── Geography data ───────────────────────────────────────────────────────────
const GEOGRAPHY_COLORS = {
  liveCorridor: { marker: "#0F3DD1", fill: "#0F3DD1" },
  globalReach: { marker: "#10B981", fill: "#10B981" },
  plannedExpansion: { marker: "#F59E0B", fill: "#F59E0B", stroke: "#F59E0B" },
};

type FilterType = "all" | "live_corridor" | "global_reach" | "planned_expansion";

const LEGEND_ITEMS = [
  { category: "live_corridor", label: "Live Corridors", color: GEOGRAPHY_COLORS.liveCorridor.marker, markerType: "pulse" },
  { category: "global_reach", label: "Global Reach (70+)", color: GEOGRAPHY_COLORS.globalReach.marker, markerType: "solid" },
  { category: "planned_expansion", label: "Coming Soon (20+)", color: GEOGRAPHY_COLORS.plannedExpansion.stroke, markerType: "outline" },
];

// ─── Calculator helpers ───────────────────────────────────────────────────────
const MIN_AMOUNT = 20;

const paymentMethods = [
  { value: "global-bank", label: "Global Bank Account", icon: Globe },
  { value: "card", label: "Cards", icon: CreditCard },
];

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

interface ComparisonResult {
  name: string;
  logo?: string;
  time: string;
  loss: number;
  rate: number;
  receive: number;
  lossVsA2A?: number;
  savingsVsOthers?: number;
  isA2A?: boolean;
  notApplicable?: boolean;
}

function calculateComparisons(
  amount: number,
  exchangeRate: number,
  paymentMethod: string = "global-bank"
): ComparisonResult[] {
  const isCard = paymentMethod === "card";
  const a2aReceive = amount * exchangeRate;

  if (isCard) {
    const stripeRate = exchangeRate * (1 - 0.063);
    const stripeReceive = amount * stripeRate;
    const stripeLoss = a2aReceive - stripeReceive;

    const paypalFeeUSD = amount * 0.044 + 0.3;
    const paypalFeeWithGST = paypalFeeUSD * 1.18;
    const paypalRate = exchangeRate * (1 - 0.04);
    const paypalReceive = (amount - paypalFeeWithGST) * paypalRate;
    const paypalLoss = a2aReceive - paypalReceive;

    const ibRate = exchangeRate * (1 - 0.055);
    const ibFeeINR = 10 * exchangeRate * 1.18;
    const ibReceive = amount * ibRate - ibFeeINR;
    const ibLoss = a2aReceive - ibReceive;

    const losses = [stripeLoss, paypalLoss, ibLoss].filter((l) => l > 0);
    const maxSavings = losses.length ? Math.max(...losses) : 0;

    return [
      { name: "A2A Global", logo: logoSvg, time: "Few hours", loss: 0, rate: exchangeRate, receive: a2aReceive, savingsVsOthers: Math.round(maxSavings), isA2A: true },
      { name: "Stripe", time: "2-5 Days", loss: Math.round(stripeLoss), rate: Number(stripeRate.toFixed(2)), receive: stripeReceive, lossVsA2A: Math.round(stripeLoss), notApplicable: stripeReceive <= 0 },
      { name: "PayPal", time: "1-3 Days", loss: Math.round(paypalLoss), rate: Number(paypalRate.toFixed(2)), receive: paypalReceive, lossVsA2A: Math.round(paypalLoss), notApplicable: paypalReceive <= 0 },
      { name: "Indian banks", time: "3-5 Days", loss: Math.round(ibLoss), rate: Number(ibRate.toFixed(2)), receive: ibReceive, lossVsA2A: Math.round(ibLoss), notApplicable: ibReceive <= 0 },
    ];
  } else {
    let skydoFee = 0;
    if (amount < 2000) skydoFee = 19;
    else if (amount <= 5000) skydoFee = amount * 0.019;
    else skydoFee = amount * 0.003;
    const skydoFeeINR = skydoFee * exchangeRate * 1.18;
    const skydoReceive = a2aReceive - skydoFeeINR;
    const skydoLoss = a2aReceive - skydoReceive;

    const wiseRate = exchangeRate * (1 - 0.006);
    const wiseReceive = amount * wiseRate;
    const wiseLoss = a2aReceive - wiseReceive;

    const ibRate = exchangeRate * (1 - 0.045);
    const ibFeeINR = 15 * exchangeRate * 1.18;
    const ibReceive = amount * ibRate - ibFeeINR;
    const ibLoss = a2aReceive - ibReceive;

    const losses = [skydoLoss, wiseLoss, ibLoss].filter((l) => l > 0);
    const maxSavings = losses.length ? Math.max(...losses) : 0;

    return [
      { name: "A2A Global", logo: logoSvg, time: "Few hours", loss: 0, rate: exchangeRate, receive: a2aReceive, savingsVsOthers: Math.round(maxSavings), isA2A: true },
      { name: "Skydo", time: "1-2 Days", loss: Math.round(skydoFeeINR), rate: exchangeRate, receive: skydoReceive, lossVsA2A: Math.round(skydoLoss), notApplicable: skydoReceive <= 0 },
      { name: "Wise", time: "1-2 Days", loss: Math.round(wiseLoss), rate: Number(wiseRate.toFixed(2)), receive: wiseReceive, lossVsA2A: Math.round(wiseLoss), notApplicable: wiseReceive <= 0 },
      { name: "Indian banks", time: "3-5 Days", loss: Math.round(ibLoss), rate: Number(ibRate.toFixed(2)), receive: ibReceive, lossVsA2A: Math.round(ibLoss), notApplicable: ibReceive <= 0 },
    ];
  }
}

// ─── AI Tasks data ────────────────────────────────────────────────────────────
const TASKS = [
  { id: "A2A-001", category: "Low-Expert Data Labeling", categoryKey: "labeling", title: "Image & Object Annotation Tasker", company: "Clickworker", companyInitial: "C", rate: "$0.02–$0.25 per task", rateType: "per-task", status: "Verified" as const, description: "Label and annotate images, draw bounding boxes, segment objects, and categorize visual data. Tasks are simple, short, and paid per completion.", skills: "No formal qualifications; attention to detail", accent: "#0369A1" },
  { id: "A2A-008", category: "Data Annotation & AI Training", categoryKey: "annotation", title: "General AI Training / Annotation Projects", company: "DataAnnotation Tech", companyInitial: "D", rate: "$20+/hr", rateType: "hourly", status: "Verified" as const, description: "Evaluate chatbot responses, compare AI outputs, test image generation. Includes survey-style work, chatbot interaction, and creative writing tasks.", skills: "Bachelor's degree or equivalent, writing/reasoning skills", accent: "#7C3AED" },
  { id: "A2A-016", category: "AI Evaluation & Red Teaming", categoryKey: "redteam", title: "AI Red-Teamer – Adversarial AI Testing", company: "Mercor", companyInitial: "M", rate: "$50.50/hr", rateType: "hourly", status: "Verified" as const, description: "Red team conversational AI models: jailbreaks, prompt injections, misuse cases, bias exploration. Generate high-quality human data, annotate failures, flag risks.", skills: "Red teaming experience, native English fluency", accent: "#B91C1C" },
  { id: "A2A-021", category: "Expert AI Training", categoryKey: "expert", title: "Professional Domain Prompt Writers", company: "Mercor", companyInitial: "M", rate: "$60–$80/hr", rateType: "hourly", status: "Verified" as const, description: "Write realistic prompts for domain-specific guidance. Evaluate AI responses for factual accuracy, identify fabricated claims. Score and rank using structured rubrics.", skills: "Master's+ in Finance, Accounting, Law, Medicine", accent: "#B45309" },
  { id: "A2A-026", category: "AI Software Development", categoryKey: "software", title: "Coding AI Trainer – Software Developer Projects", company: "DataAnnotation Tech", companyInitial: "D", rate: "$40+/hr", rateType: "hourly", status: "Verified" as const, description: "Code evaluation, debugging AI-generated code, fixing broken code, defining standards, writing coding challenges. Assess AI chatbot performance on coding tasks.", skills: "Python, JavaScript, C++, Java; LeetCode-level ability", accent: "#1D4ED8" },
  { id: "A2A-032", category: "AI Graphic Design & Content", categoryKey: "design", title: "Graphic Designer Specialist – Freelance AI Trainer", company: "Invisible Technologies", companyInitial: "I", rate: "$20–$35/hr", rateType: "hourly", status: "Verified" as const, description: "Analyze AI-generated graphics, evaluate composition and visual reasoning, provide structured feedback to improve AI image generation.", skills: "Graphic design portfolio, visual reasoning skills", accent: "#BE185D" },
];

const CATEGORIES = [
  { key: "all", label: "All Tasks" },
  { key: "labeling", label: "Data Labeling" },
  { key: "annotation", label: "Annotation" },
  { key: "redteam", label: "Red Teaming" },
  { key: "expert", label: "Expert AI" },
  { key: "software", label: "AI Dev" },
  { key: "design", label: "Design" },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const faqs = [
  { question: "How does A2A Global work?", answer: "A2A Global allows you to create payment links that your US clients can pay via card or bank transfer. We convert USD to INR at live rates with zero FX margin and transfer directly to your Indian bank account." },
  { question: "How long does it take to receive money?", answer: "Once your client completes the payment, funds are typically transferred to your Indian bank account within a few hours during business days." },
  { question: "Is KYC mandatory?", answer: "Yes, KYC is mandatory for all users. We require only five basic documents: full name, date of birth, phone number or email, PAN ID, and UPI ID." },
  { question: "What payment methods do clients support?", answer: "Your clients can pay using credit cards, debit cards, or bank transfers. We support all major card networks including Visa, Mastercard, and American Express." },
];

// ─── Referral data ────────────────────────────────────────────────────────────
const referralTiers = [
  { freelancers: "100", cashback: "$50", perReferral: "$0.50" },
  { freelancers: "1,000", cashback: "$750", perReferral: "$0.75" },
  { freelancers: "10,000", cashback: "$10,000", perReferral: "$1.00" },
  { freelancers: "100,000", cashback: "$125,000", perReferral: "$1.25" },
];

const referralSteps = [
  { number: "01", title: "Register Yourself As A Freelancer" },
  { number: "02", title: "Click On The Referral Button On Your A2A Global Online Portal" },
  { number: "03", title: "Share the Referral Link with Potential Freelancers" },
];

// ─── Why A2A features ─────────────────────────────────────────────────────────
const features = [
  { number: "01", title: "You Receive 100%", subtitle: "Of Your Invoice Amount", backDescription: "No deductions, no FX margin, no platform fees" },
  { number: "02", title: "Your Client Pays For The", subtitle: "Transaction Fee", backDescription: "The payer covers the fee — not you. Transparent for them, effortless for you" },
  { number: "03", title: "Fast Registration + Instant", subtitle: "Payment Links", backDescription: "Only 5 basic KYC requirements: 1) Full name; 2) Date of birth; 3) Phone number or email; 4) PAN ID; 5) UPI ID. Create a payment link in seconds" },
  { number: "04", title: "Transparent,", subtitle: "Real-Time FX Rates", backDescription: "We use live market exchange rates with zero markup" },
  { number: "05", title: "Faster Than Traditional", subtitle: "Bank Transfers", backDescription: "Skip SWIFT delays. Get your funds in hours or even minutes depending on your country" },
  { number: "06", title: "Secure & Fully", subtitle: "Compliant", backDescription: "All payments are encrypted and are in line with the best industry standards" },
];

// ─── How It Works steps ───────────────────────────────────────────────────────
const steps = [
  { number: "01", title: "Register And Send Docs For KYC", description: "Complete the process in a few minutes with only 5 basic KYC requirements - 1) Full name; 2) Date of birth; 3) Phone number or email; 4) PAN ID; 5) UPI ID." },
  { number: "02", title: "Create Your Unique Payment Link", description: "Enter the amount, enter the payer's full legal name, generate a personalized payment link and share with your client." },
  { number: "03", title: "You Receive 100% Of The Amount", description: "Once your client accepts your work and pays, Funds arrive directly to your bank account at real-time FX rate, without any deductions." },
];

// ─── Testimonials data ────────────────────────────────────────────────────────
const testimonials = [
  { quote: "The way A2A explains fees and payouts feels clear and upfront. It looks like a better experience for working with global clients.", name: "Priya", role: "Graphic Designer" },
  { quote: "The checkout flow seems simple and easy to follow. I like that everything is explained clearly without surprises.", name: "Ahmed", role: "Web Developer" },
  { quote: "A2A's approach to team payments feels structured and predictable. It's the kind of clarity agencies usually look for.", name: "Rahul", role: "Agency Owner" },
];

// ─── Mission beliefs ──────────────────────────────────────────────────────────
const beliefs = [
  { title: "Simple", subtitle: "like AI" },
  { title: "Instant", subtitle: "like software" },
  { title: "Low-cost", subtitle: "like the internet" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlippableCard({ feature }: { feature: typeof features[0] }) {
  const [isFlipped, setIsFlipped] = useState(false);
  return (
    <div
      className="relative w-full cursor-pointer group"
      style={{ aspectRatio: "1.029 / 1" }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-[1rem] lg:rounded-[1.25rem] xl:rounded-[1.5rem] p-5 md:p-3 lg:p-4 xl:p-5 2xl:p-6 flex flex-col justify-between transition-shadow duration-300 group-hover:shadow-lg"
          style={{ backfaceVisibility: "hidden", background: "linear-gradient(to bottom, rgba(218,227,255,1) 0%, rgba(218,227,255,0.27) 100%)" }}
        >
          <div className="flex justify-end">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="w-10 h-10 md:w-7 md:h-7 lg:w-9 lg:h-9 xl:w-10 xl:h-10">
              <circle cx="24" cy="24" r="23" stroke="#0F3DD1" strokeWidth="2"/>
              <path d="M16 32L32 16M32 16H20M32 16V28" stroke="#0F3DD1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="text-lg md:text-sm lg:text-lg xl:text-[1.375rem] 2xl:text-[1.75rem] font-medium text-[#686868] leading-snug">{feature.title}</h3>
            <p className="text-lg md:text-sm lg:text-lg xl:text-[1.375rem] 2xl:text-[1.75rem] font-medium text-[#686868] leading-snug">{feature.subtitle}</p>
          </div>
          <div className="flex items-end justify-between">
            <span
              className="text-[4rem] md:text-[2.5rem] lg:text-[4rem] xl:text-[5rem] font-medium leading-none text-[#0F3DD1]"
              style={{ maskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)" }}
            >{feature.number}</span>
            <button className="px-4 py-1.5 md:px-2.5 md:py-0.5 lg:px-4 lg:py-1.5 rounded-full border-2 border-[#0F3DD1] text-[#0F3DD1] text-sm md:text-[0.65rem] lg:text-xs font-medium hover:border-[#686868] hover:text-[#686868] transition-colors">
              Explore
            </button>
          </div>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 rounded-[1rem] lg:rounded-[1.25rem] xl:rounded-[1.5rem] p-5 md:p-3 lg:p-4 xl:p-5 2xl:p-6 flex flex-col overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(to bottom, rgba(15,61,209,1) 0%, rgba(0,13,54,0.92) 100%)" }}
        >
          <div className="flex justify-end">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="w-10 h-10 md:w-7 md:h-7 lg:w-9 lg:h-9 xl:w-10 xl:h-10">
              <circle cx="24" cy="24" r="23" stroke="white" strokeWidth="2"/>
              <path d="M16 32L32 16M32 16H20M32 16V28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 flex flex-col pt-2 overflow-hidden">
            <h3 className="text-lg md:text-sm lg:text-lg xl:text-[1.375rem] font-medium text-white leading-snug">{feature.title}</h3>
            <p className="text-lg md:text-sm lg:text-lg xl:text-[1.375rem] font-medium text-white leading-snug mb-3">{feature.subtitle}</p>
            <p className="text-base md:text-[0.65rem] lg:text-xs xl:text-[0.9375rem] text-white/80 leading-relaxed line-clamp-4 lg:line-clamp-none">{feature.backDescription}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlippableStepCard({ step, addShadow = false }: { step: typeof steps[0]; addShadow?: boolean }) {
  const [isFlipped, setIsFlipped] = useState(false);
  return (
    <div
      className="relative w-full cursor-pointer group aspect-square"
      style={{ perspective: "1000px" }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-[1rem] md:rounded-[1.25rem] lg:rounded-[1.5rem] p-4 md:p-4 lg:p-5 xl:p-6 2xl:p-8 flex flex-col transition-shadow duration-300 group-hover:shadow-xl ${addShadow ? "shadow-lg bg-white" : ""}`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden" as any,
            ...(!addShadow ? { background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.6)" } : {}),
          }}
        >
          <div className="inline-flex items-center justify-center w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-full text-xs md:text-sm font-semibold bg-[#0F3DD1] text-white mb-4">
            {step.number}
          </div>
          <div className="flex-1 flex items-center" style={{ marginTop: "-20%" }}>
            <h3 className="text-sm md:text-base lg:text-lg xl:text-[1.375rem] font-semibold leading-snug" style={{ color: "#0F3DD1" }}>{step.title}</h3>
          </div>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 rounded-[1rem] md:rounded-[1.25rem] lg:rounded-[1.5rem] p-4 md:p-4 lg:p-5 xl:p-6 2xl:p-8 flex flex-col overflow-hidden"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as any, transform: "rotateY(180deg)", background: "linear-gradient(135deg, rgba(15,61,209,1) 0%, rgba(23,23,23,1) 100%)" }}
        >
          <div className="inline-flex items-center justify-center w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-full text-xs md:text-sm font-semibold mb-4 border-2 border-white/30 text-white">
            {step.number}
          </div>
          <h3 className="text-sm md:text-base lg:text-lg font-semibold text-white leading-snug mb-3">{step.title}</h3>
          <p className="text-[0.65rem] sm:text-xs md:text-[0.7rem] lg:text-sm text-white/80 leading-normal line-clamp-6 lg:line-clamp-none">{step.description}</p>
        </div>
      </div>
    </div>
  );
}

function MobileComparisonCard({ item, isFirst, amount }: { item: ComparisonResult; isFirst?: boolean; amount: number }) {
  const isNA = item.notApplicable && !item.isA2A;
  return (
    <div className={`rounded-[16px] p-4 ${isFirst ? "bg-white shadow-lg border border-[#0F3DD1]" : "bg-[#F4F4F4]"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {item.logo && (
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
              <img src={item.logo} alt={item.name} className="h-8 w-auto object-contain" />
            </div>
          )}
          {!item.logo && (
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                {item.name.substring(0, 2)}
              </div>
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-[#686868] block">{item.name}</span>
            <span className={`text-xs ${item.isA2A ? "text-[#0F3DD1]" : "text-gray-500"}`}>{item.time}</span>
          </div>
        </div>
        <div className="text-right">
          {isNA ? (
            <>
              <span className="text-lg font-bold block text-gray-400 italic">N/A</span>
              {amount > 0 && <span className="text-xs text-gray-400 italic">Fee exceeds amount</span>}
            </>
          ) : (
            <>
              <span className={`text-lg font-bold block ${item.isA2A ? "text-[#27AE60]" : "text-[#686868]"}`}>
                ₹{formatINR(item.receive)}
              </span>
              {item.lossVsA2A && item.lossVsA2A > 0 ? (
                <div className="flex items-center justify-end gap-1 text-[#E74C3C]">
                  <ArrowDown className="w-3 h-3" />
                  <span className="text-xs font-medium">-₹{formatINR(item.lossVsA2A)}</span>
                </div>
              ) : item.isA2A && item.savingsVsOthers ? (
                <span className="text-xs text-[#27AE60] font-medium">Save ₹{formatINR(item.savingsVsOthers)}</span>
              ) : (
                <span className="text-xs text-[#27AE60] font-medium">Best rate</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DesktopComparisonCard({ item, isFirst, amount }: { item: ComparisonResult; isFirst?: boolean; amount: number }) {
  const isNA = item.notApplicable && !item.isA2A;
  return (
    <div className={`rounded-[12px] lg:rounded-[16px] ${isFirst ? "bg-white shadow-lg p-3 md:p-4 lg:p-5 xl:p-6 border-2 border-[#0F3DD1]" : "bg-[#F4F4F4] p-1.5 md:p-2 lg:p-3 xl:p-4"}`}>
      <div className="flex items-center gap-2 lg:gap-4">
        <div className="w-[55px] md:w-[65px] lg:w-[80px] xl:w-[100px] flex flex-col items-center justify-center flex-shrink-0">
          {item.logo ? (
            <img src={item.logo} alt={item.name} className="h-5 md:h-6 lg:h-7 xl:h-8 w-auto object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
              {item.name.substring(0, 2)}
            </div>
          )}
          {item.name === "Indian banks" && (
            <span className="text-[8px] md:text-[10px] lg:text-xs font-medium text-[#686868] mt-0.5">Indian banks</span>
          )}
        </div>
        <div className="w-[40px] md:w-[50px] lg:w-[60px] xl:w-[70px] flex-shrink-0">
          <span className="text-[8px] md:text-[10px] lg:text-xs text-[#E74C3C] block mb-0.5">Cost</span>
          {isNA ? (
            <span className="text-[10px] md:text-xs lg:text-sm font-semibold text-gray-400 italic">N/A</span>
          ) : (
            <span className="text-[10px] md:text-xs lg:text-sm font-semibold text-[#686868]">₹{item.loss === 0 ? "0.00" : formatINR(item.loss)}</span>
          )}
          <span className={`text-[8px] md:text-[10px] lg:text-xs block mt-0.5 ${item.isA2A ? "text-[#0F3DD1]" : "text-[#686868]"}`}>{item.time}</span>
        </div>
        <div className="w-[40px] md:w-[50px] lg:w-[60px] xl:w-[70px] flex-shrink-0">
          <span className="text-[8px] md:text-[10px] lg:text-xs text-[#686868] block mb-0.5">Rate</span>
          {isNA ? (
            <span className="text-[10px] md:text-xs lg:text-sm font-semibold text-gray-400 italic">N/A</span>
          ) : (
            <span className="text-[10px] md:text-xs lg:text-sm font-semibold text-[#686868]">₹{item.rate.toFixed(2)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[8px] md:text-[10px] lg:text-xs text-[#686868] block mb-0.5">You Receive</span>
          {isNA ? (
            <span className="text-xs md:text-sm lg:text-base xl:text-lg font-bold text-gray-400 italic">N/A</span>
          ) : (
            <span className={`text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-2xl font-bold ${item.isA2A ? "text-[#27AE60]" : "text-[#686868]"}`}>
              ₹{formatINR(item.receive)}
            </span>
          )}
        </div>
        <div className="w-auto min-w-[70px] md:min-w-[90px] lg:min-w-[110px] xl:min-w-[140px] text-right flex-shrink-0">
          {isNA ? (
            amount > 0 ? <span className="text-[8px] md:text-[10px] lg:text-xs text-gray-400 italic whitespace-nowrap">Fee exceeds amount</span> : null
          ) : item.lossVsA2A && item.lossVsA2A > 0 ? (
            <div className="flex items-center justify-end gap-0.5 text-[#E74C3C] whitespace-nowrap">
              <ArrowDown className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3" />
              <span className="text-[8px] md:text-[10px] lg:text-xs font-medium">
                Lose ₹{formatINR(item.lossVsA2A)} vs <span className="text-[#0F3DD1] font-bold">A2A</span>
              </span>
            </div>
          ) : item.isA2A && item.savingsVsOthers ? (
            <span className="text-[8px] md:text-[10px] lg:text-xs font-semibold text-[#27AE60] whitespace-nowrap">You Save ₹{formatINR(item.savingsVsOthers)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PaymentsPage() {
  // Navbar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<"get-started" | "login" | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Calculator state
  const [amount, setAmount] = useState(2500);
  const [inputValue, setInputValue] = useState("2500");
  const [paymentMethod, setPaymentMethod] = useState("global-bank");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(83.5);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const mobilePaymentRef = useRef<HTMLDivElement>(null);

  // Why A2A / How it works flipped state handled inside sub-components

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // AI Tasks state
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Connectivity state
  const [activeFilter, setActiveFilter] = useState<FilterType>("live_corridor");
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistRegion, setWaitlistRegion] = useState("new regions");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  // Load Poppins font
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Scroll listener
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile menu body lock
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [mobileMenuOpen]);

  // Fetch exchange rate
  useEffect(() => {
    async function fetchRate() {
      try {
        const res = await fetch("/api/exchange-rate");
        const data = await res.json();
        if (data.rate) {
          setExchangeRate(data.rate);
          setLastFetched(data.timestamp || new Date().toISOString());
        }
      } catch {}
    }
    fetchRate();
  }, []);

  // Click outside for payment dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      const isMob = window.innerWidth < 768;
      if (isMob) {
        if (mobilePaymentRef.current && !mobilePaymentRef.current.contains(t)) setIsPaymentOpen(false);
      } else {
        if (paymentRef.current && !paymentRef.current.contains(t)) setIsPaymentOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const comparisons = useMemo(() => calculateComparisons(amount, exchangeRate, paymentMethod), [amount, exchangeRate, paymentMethod]);

  const filteredTasks = TASKS.filter((t) => {
    const matchCat = activeCategory === "all" || t.categoryKey === activeCategory;
    const matchSearch = searchQuery === "" || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.company.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  const handleCalcInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") { setInputValue(""); setAmount(0); return; }
    const clean = v.replace(/^0+(?=\d)/, "");
    setInputValue(clean);
    const n = Number(clean);
    if (!isNaN(n) && n >= 0) setAmount(n);
  };
  const handleCalcBlur = () => {
    const n = Number(inputValue) || MIN_AMOUNT;
    const final = Math.max(n, MIN_AMOUNT);
    setAmount(final);
    setInputValue(String(final));
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistSubmitting(true);
    setWaitlistError(null);
    try {
      const res = await fetch("/api/freelancer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail, referall_id: null }),
      });
      const data = await res.json();
      if (data.status === "ok" || data.status === "Ok" || res.ok) {
        setWaitlistSubmitted(true);
      } else {
        setWaitlistError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setWaitlistError("Failed to join waitlist. Please try again later.");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const closeWaitlistModal = () => {
    setWaitlistModalOpen(false);
    setWaitlistSubmitted(false);
    setWaitlistEmail("");
    setWaitlistError(null);
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const poppinsStyle: React.CSSProperties = { fontFamily: "'Poppins', sans-serif" };
  const gradientText: React.CSSProperties = { backgroundImage: "linear-gradient(to right, #0F3DD1, #686868)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
  const blueGradient = "linear-gradient(135deg, #0F3DD1 0%, #171717 100%)";

  return (
    <div className="min-h-screen bg-white" style={poppinsStyle}>
      {/* ── Injected styles ── */}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        .animate-heartbeat { animation: heartbeat 1.5s ease-in-out infinite; }
        .glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════
          NAVBAR
      ════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 px-4 md:px-6 lg:px-8 pt-2">
        <div className="max-w-[1800px] mx-auto">
          <div className={`w-full transition-all duration-300 rounded-full ${scrolled ? "bg-white/70 backdrop-blur-md shadow-lg" : "bg-white"}`}>
            <div className="max-w-full px-4 md:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16 md:h-20">
                {/* Logo */}
                <a href="/" className="flex items-center flex-shrink-0">
                  <img src={logoSvg} alt="A2A Global" className="h-10 sm:h-12 md:h-14 lg:h-12 xl:h-14 w-auto" />
                </a>

                {/* Center line */}
                <div className="hidden lg:block flex-1 mx-8">
                  <div className="h-[1px] bg-[#0F3DD1]" />
                </div>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                  {[["how-it-works", "How it works"], ["pricing", "Pricing"], ["faq", "FAQ"]].map(([id, label]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      onClick={(e) => scrollToSection(e, id)}
                      className="flex items-center gap-2 text-[15px] font-medium hover:opacity-80 transition-opacity cursor-pointer text-[#686868]"
                    >
                      <img src={blurCircleSvg} alt="" className="w-2 h-2" />
                      {label}
                    </a>
                  ))}

                  {/* Button container */}
                  <div
                    className="flex items-center gap-2 relative min-w-[200px] justify-end"
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    {/* Register */}
                    <a
                      href={REGISTER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setHoveredButton("get-started")}
                      className={`relative z-10 inline-flex items-center justify-center text-[15px] font-medium transition-all duration-300 ease-in-out h-11 rounded-full border border-gray-700 hover:bg-gray-100 text-[#686868] ${hoveredButton === "login" ? "w-11 px-0" : "px-5"}`}
                    >
                      {hoveredButton === "login" ? (
                        <img src={arrowBlackSvg} alt="" className="w-5 h-5" />
                      ) : (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          Register
                          <img src={arrowBlackSvg} alt="" className="w-5 h-5" />
                        </span>
                      )}
                    </a>

                    {/* Login */}
                    <a
                      href={LOGIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setHoveredButton("login")}
                      className={`relative z-10 inline-flex items-center justify-center transition-all duration-300 ease-in-out bg-[#0F3DD1] text-white h-11 rounded-full ${hoveredButton === "login" ? "px-5" : "w-11 px-0"}`}
                    >
                      {hoveredButton === "login" ? (
                        <span className="flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold">
                          <LogIn className="w-5 h-5" />
                          Login
                        </span>
                      ) : (
                        <LogIn className="w-5 h-5" />
                      )}
                    </a>
                  </div>
                </div>

                {/* Mobile menu button */}
                {!mobileMenuOpen && (
                  <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(true)}>
                    <Menu className="w-6 h-6 text-[#686868]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      <div className={`md:hidden fixed inset-0 z-40 transition-all duration-500 ease-in-out ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div
          className={`absolute inset-0 transition-all duration-500 ${mobileMenuOpen ? "backdrop-blur-xl" : "backdrop-blur-none"}`}
          style={{ background: mobileMenuOpen ? "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,245,255,0.95) 50%, rgba(255,255,255,0.9) 100%)" : "transparent" }}
          onClick={() => setMobileMenuOpen(false)}
        />
        <button className="absolute top-6 right-6 p-2 z-10" onClick={() => setMobileMenuOpen(false)}>
          <X className="w-7 h-7 text-[#686868]" />
        </button>
        <div className={`relative h-full flex flex-col pt-24 px-8 transition-all duration-500 ${mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`}>
          <div className="space-y-2">
            {[["how-it-works", "How it works", 100], ["pricing", "Pricing", 150], ["faq", "FAQ", 200]].map(([id, label, delay]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => scrollToSection(e as any, id as string)}
                className={`flex items-center gap-3 py-4 text-xl font-medium text-[#686868] hover:text-[#0F3DD1] transition-all duration-300 border-b border-gray-100 ${mobileMenuOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
                style={{ transitionDelay: mobileMenuOpen ? `${delay}ms` : "0ms" }}
              >
                <img src={blurCircleSvg} alt="" className="w-2.5 h-2.5" />
                {label}
              </a>
            ))}
            <a
              href={LOGIN_URL}
              className={`flex items-center gap-3 py-4 text-xl font-medium text-[#686868] hover:text-[#0F3DD1] transition-all duration-300 border-b border-gray-100 ${mobileMenuOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`}
              style={{ transitionDelay: mobileMenuOpen ? "250ms" : "0ms" }}
            >
              <LogIn className="w-5 h-5" />
              Login
            </a>
          </div>
          <div className={`mt-8 transition-all duration-500 ${mobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`} style={{ transitionDelay: mobileMenuOpen ? "350ms" : "0ms" }}>
            <a
              href={REGISTER_URL}
              className="block w-full h-14 rounded-full text-lg font-semibold text-white text-center leading-[56px]"
              style={{ background: blueGradient }}
            >
              Get Started
            </a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          HERO SLIDER
      ════════════════════════════════════════════════════════════════ */}
      <section className="px-4 md:px-6 lg:px-8 pt-4 pb-4 md:pb-6">
        <div className="w-full max-w-[1800px] mx-auto">
          <div className="relative rounded-[24px] overflow-hidden">
            <div className="relative" style={{ height: "calc(100vh - 70px - 22vh - 48px)", minHeight: "280px" }}>
              <img src={mainBgImg} alt="Hero background" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ backgroundColor: "rgba(255,255,255,0.7)" }} />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 sm:px-8 pointer-events-none z-10">
              <h1
                className="text-[1.75rem] sm:text-4xl md:text-5xl xl:text-6xl font-light mb-2 bg-clip-text text-transparent leading-tight"
                style={gradientText}
              >
                UPI-Like Global Payouts From The US
              </h1>
              <h2
                className="text-[1.75rem] sm:text-4xl md:text-5xl xl:text-6xl font-light mb-8 bg-clip-text text-transparent leading-tight"
                style={gradientText}
              >
                100% Free For Freelancers
              </h2>
              <div className="pointer-events-auto">
                <a
                  href={REGISTER_URL}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-gray-700 text-base font-medium hover:bg-gray-100 transition-colors text-[#686868]"
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          MARQUEE SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col justify-center overflow-hidden py-2 md:py-4" style={{ height: "22vh", minHeight: "140px" }}>
        <div className="text-center mb-2 px-4 md:px-6 max-w-[1800px] mx-auto">
          <p className="text-[#0F3DD1] font-medium leading-snug" style={{ fontSize: "clamp(0.875rem, 2vw, 1.5rem)" }}>
            Are You Getting Paid From The US?
          </p>
          <p className="text-[#686868] leading-snug" style={{ fontSize: "clamp(0.875rem, 2vw, 1.5rem)" }}>
            We Offer A Truly Free And Fast Service For Indian Freelancers
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center px-2 sm:px-4">
          <div className="flex items-center justify-center flex-nowrap">
            {[
              { prefix: "0", suffix: " Fee" },
              { prefix: "LIVE", suffix: " Fx Rate" },
              { prefix: "10X", suffix: " Faster" },
            ].map((item, index, arr) => (
              <span key={index} className="flex items-center" style={{ margin: "0 clamp(0.25rem, 1vw, 0.75rem)" }}>
                <span className="font-medium tracking-wide whitespace-nowrap" style={{ fontSize: "clamp(1.25rem, 5.5vw, 6rem)" }}>
                  <span className="text-[#0F3DD1]">{item.prefix}</span>
                  <span className="text-[#686868]">{item.suffix}</span>
                </span>
                {index < arr.length - 1 && (
                  <span className="font-medium text-[#686868] tracking-wide" style={{ fontSize: "clamp(1.25rem, 5.5vw, 6rem)", margin: "0 clamp(0.25rem, 1vw, 0.75rem)" }}>
                    /
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          TRUST BADGES
      ════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-4 md:px-6 lg:px-8 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 lg:gap-16">
            {[
              { icon: bankSecuritySvg, title: "Bank-Grade Security" },
              { icon: trustedSvg, title: "Trusted By Freelancers Across India" },
              { icon: rbiApprovedSvg, title: "RBI Approved & PCI-DSS Compliant" },
            ].map((badge, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-full aspect-[1/0.75] rounded-t-[20px] flex items-center justify-center" style={{ background: "linear-gradient(180deg, #DAE3FF 0%, #FFFFFF 100%)" }}>
                  <img src={badge.icon} alt={badge.title} className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28" />
                </div>
                <h3 className="text-xl md:text-2xl font-medium bg-clip-text text-transparent leading-tight text-center pt-4" style={gradientText}>
                  {badge.title}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          MISSION SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section id="mission" className="py-10 md:py-14 lg:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-[1800px] mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-[#0F3DD1]" />
            <span className="text-[#0F3DD1] font-medium text-sm md:text-base">Our Mission</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 md:mb-6 bg-clip-text text-transparent leading-tight" style={gradientText}>
            A2A Global's Mission
          </h2>
          <p className="text-lg md:text-xl lg:text-2xl text-[#686868] mb-6 md:mb-8 max-w-4xl mx-auto">
            A2A Global stands for Account-to-Account payments made globally
          </p>
          <p className="text-base md:text-lg text-[#686868] mb-6 md:mb-8">
            We believe these payments should be
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 lg:gap-8 mb-8 md:mb-12 max-w-4xl mx-auto">
            {beliefs.map((b, i) => (
              <div key={i} className="rounded-2xl p-6 md:p-8 hover:shadow-lg transition-shadow" style={{ background: "linear-gradient(180deg, #DAE3FF 0%, #FFFFFF 100%)" }}>
                <h3 className="text-xl md:text-2xl font-semibold text-[#0F3DD1] mb-1">{b.title}</h3>
                <p className="text-base md:text-lg text-[#686868]">{b.subtitle}</p>
              </div>
            ))}
          </div>
          <p className="text-lg md:text-xl lg:text-2xl text-[#686868] font-medium max-w-4xl mx-auto leading-relaxed">
            A2A Global's mission is to enable global account-to-account payments that are{" "}
            <span className="font-bold text-[#0F3DD1]">simple, instant and low-cost</span>
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          COMPARE & SAVE SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-8 md:py-16 px-4 md:px-6 lg:px-8 overflow-visible">
        <div className="max-w-[1800px] mx-auto">

          {/* ── MOBILE LAYOUT ── */}
          <div className="md:hidden">
            <div className="rounded-[24px] overflow-hidden" style={{ background: "linear-gradient(135deg, #0F3DD1 0%, #1037B4 43%, #171717 100%)" }}>
              <div className="text-center pt-6 pb-4 px-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/60 backdrop-blur-sm mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="text-xs font-medium text-white">Compare & Save</span>
                </div>
                <h2 className="text-lg font-light text-white leading-snug">
                  Enter Your Invoice Amount And Compare What You'd Receive
                </h2>
              </div>
              <div className="mx-4 mb-4">
                <div className="rounded-[16px] overflow-hidden" style={{ background: "rgba(255,255,255,0.95)" }}>
                  {/* Calculator */}
                  <div className="p-5">
                    <CalcForm
                      amount={amount}
                      setAmount={setAmount}
                      inputValue={inputValue}
                      setInputValue={setInputValue}
                      paymentMethod={paymentMethod}
                      setPaymentMethod={setPaymentMethod}
                      isPaymentOpen={isPaymentOpen}
                      setIsPaymentOpen={setIsPaymentOpen}
                      paymentRef={mobilePaymentRef}
                      exchangeRate={exchangeRate}
                      lastFetched={lastFetched}
                      onInputChange={handleCalcInput}
                      onBlur={handleCalcBlur}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3 px-1">
              {comparisons.map((item, i) => (
                <MobileComparisonCard key={i} item={item} isFirst={i === 0} amount={amount} />
              ))}
            </div>
          </div>

          {/* ── DESKTOP LAYOUT ── */}
          <div className="hidden md:block relative">
            <div className="absolute inset-x-0 top-0 rounded-[2rem] overflow-hidden h-[62%] md:h-[65%] lg:h-[70%] xl:h-[75%]" style={{ background: "linear-gradient(135deg, #0F3DD1 0%, #1037B4 43%, #171717 100%)" }} />
            <div className="relative z-10 pt-8 pb-4">
              <div className="text-center mb-10 md:mb-14 lg:mb-10 px-4 md:px-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/60 backdrop-blur-sm mb-4">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-sm font-medium text-white">Compare & Save</span>
                </div>
                <h2 className="text-2xl md:text-2xl lg:text-4xl font-light text-white leading-tight">
                  See The Difference, Enter Your Invoice Amount And Compare What You'd Receive
                </h2>
              </div>
              {/* White card area */}
              <div className="mx-[3%] rounded-[1.5rem] bg-white/80 backdrop-blur-md p-4 md:p-6 lg:p-8">
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                  <div className="w-full md:w-[45%] lg:w-[40%] flex-shrink-0">
                    <CalcForm
                      amount={amount}
                      setAmount={setAmount}
                      inputValue={inputValue}
                      setInputValue={setInputValue}
                      paymentMethod={paymentMethod}
                      setPaymentMethod={setPaymentMethod}
                      isPaymentOpen={isPaymentOpen}
                      setIsPaymentOpen={setIsPaymentOpen}
                      paymentRef={paymentRef}
                      exchangeRate={exchangeRate}
                      lastFetched={lastFetched}
                      onInputChange={handleCalcInput}
                      onBlur={handleCalcBlur}
                    />
                  </div>
                  <div className="flex-1 space-y-2 lg:space-y-3 w-full">
                    {comparisons.map((item, i) => (
                      <DesktopComparisonCard key={i} item={item} isFirst={i === 0} amount={amount} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          WHY A2A SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section id="why-a2a" className="py-10 md:py-14 lg:py-20 px-4 md:px-6 lg:px-8 bg-white">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-[#0F3DD1]" />
            <span className="text-[#0F3DD1] font-medium text-sm md:text-base">Why A2A Global</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-5xl font-medium text-[#686868] mb-6 md:mb-8 lg:mb-12">
            Why Freelancers Choose A2A Global
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-4 md:gap-4 lg:gap-6 xl:gap-8 px-0 md:px-4 lg:px-16 xl:px-24">
            {features.map((f, i) => (
              <FlippableCard key={i} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="overflow-hidden px-4 md:px-6 lg:px-8 pt-4 pb-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Desktop */}
          <div className="hidden md:block relative w-full">
            <div className="relative w-full rounded-[24px] overflow-hidden">
              <img src={billboardImg} alt="How A2A Global Works" className="w-full h-auto object-cover" style={{ minHeight: "65vh", maxHeight: "80vh", objectFit: "cover" }} />
            </div>
            <div className="absolute left-0 right-0 z-10 px-4 md:px-6 lg:px-8" style={{ bottom: "-30%" }}>
              <div className="max-w-[900px] lg:max-w-[1100px] xl:max-w-[1300px] mx-auto">
                <div className="grid grid-cols-3 gap-3 md:gap-4 lg:gap-5 xl:gap-6">
                  {steps.map((step, i) => <FlippableStepCard key={i} step={step} />)}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block h-[20vh] 2xl:h-[22vh]" />

          {/* Mobile */}
          <div className="md:hidden">
            <div className="relative w-full rounded-[24px] overflow-hidden">
              <img src={billboardImg} alt="How A2A Global Works" className="w-full h-auto object-cover" style={{ minHeight: "40vh", objectFit: "cover" }} />
            </div>
            <div className="px-4 -mt-24 relative z-10">
              <div className="max-w-[280px] mx-auto">
                <FlippableStepCard step={steps[0]} />
              </div>
            </div>
            <div className="px-4 mt-4">
              <div className="max-w-[280px] mx-auto space-y-4">
                {steps.slice(1).map((step, i) => <FlippableStepCard key={i + 1} step={step} addShadow />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CONNECTIVITY / GEOGRAPHIES
      ════════════════════════════════════════════════════════════════ */}
      <section id="geographies" className="relative overflow-hidden py-12 md:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 xl:gap-8 mb-6 md:mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-[#0F3DD1]" />
                <span className="text-[#0F3DD1] font-medium">Global Coverage</span>
              </div>
              <h2 className="text-3xl md:text-[2.5rem] lg:text-5xl font-medium text-[#686868]">A2A Global Geographies</h2>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mt-4 text-sm md:text-base text-gray-600">
                {[
                  { color: "#0F3DD1", text: "Already live in USA and India" },
                  { color: GEOGRAPHY_COLORS.globalReach.marker, text: "Global reach to 70+ countries via our partners" },
                  { color: GEOGRAPHY_COLORS.plannedExpansion.stroke, text: "20 countries coming soon" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 md:gap-6">
              {LEGEND_ITEMS.map((item) => {
                const isActive = activeFilter === item.category;
                return (
                  <button
                    key={item.category}
                    onClick={() => setActiveFilter(isActive ? "all" : item.category as FilterType)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 ${isActive ? "bg-[#0F3DD1]/10 ring-2 ring-[#0F3DD1]/30" : "hover:bg-gray-100"}`}
                  >
                    {item.markerType === "pulse" ? (
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ backgroundColor: item.color }} />
                        <div className="relative w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      </div>
                    ) : item.markerType === "outline" ? (
                      <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: item.color }} />
                    ) : (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    )}
                    <span className={`text-sm whitespace-nowrap text-[#686868] ${isActive ? "font-semibold" : ""}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simple map placeholder */}
          <div className="relative bg-gradient-to-b from-blue-50/50 to-white rounded-2xl md:rounded-3xl overflow-hidden p-4 md:p-8 min-h-[400px] flex flex-col items-center justify-center">
            <div className="text-center mb-6">
              <p className="text-[#0F3DD1] font-semibold text-lg mb-2">A2A Global Geographies</p>
              <p className="text-gray-500 text-sm">Interactive world map showing live corridors, global reach, and expansion countries</p>
            </div>
            {/* World map SVG placeholder */}
            <div className="w-full max-w-3xl">
              <svg viewBox="0 0 800 400" className="w-full h-auto opacity-30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="400" fill="#DAE3FF" rx="16"/>
                <text x="400" y="200" textAnchor="middle" fill="#0F3DD1" fontSize="24" fontWeight="600">🌍 World Map</text>
                <text x="400" y="230" textAnchor="middle" fill="#686868" fontSize="14">Live: USA ↔ India | 70+ countries via partners</text>
              </svg>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 mt-6">
            {[
              { label: "Live Corridors", count: "2", color: GEOGRAPHY_COLORS.liveCorridor.marker, clickable: false },
              { label: "Global Reach", count: "70+", color: GEOGRAPHY_COLORS.globalReach.marker, clickable: false },
              { label: "Coming Soon", count: "20+", color: GEOGRAPHY_COLORS.plannedExpansion.stroke, clickable: true },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-100 ${stat.clickable ? "cursor-pointer hover:bg-white hover:shadow-md transition-all" : ""}`}
                onClick={stat.clickable ? () => { setWaitlistRegion("new regions"); setWaitlistModalOpen(true); } : undefined}
              >
                <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: stat.color }} />
                <div className="text-2xl md:text-3xl font-semibold text-[#686868]">{stat.count}</div>
                <div className="text-xs md:text-sm text-gray-500">Countries</div>
                <div className="text-xs md:text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Waitlist Modal */}
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${waitlistModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${waitlistModalOpen ? "opacity-100" : "opacity-0"}`} onClick={closeWaitlistModal} />
          <div className={`relative bg-white rounded-[24px] p-6 w-full max-w-md mx-4 shadow-2xl transition-all duration-200 ${waitlistModalOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`} onClick={(e) => e.stopPropagation()}>
            <button onClick={closeWaitlistModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            {!waitlistSubmitted ? (
              <>
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <span className="text-2xl">🌍</span>
                </div>
                <h3 className="text-2xl font-semibold mb-2 text-[#686868]">Coming Soon</h3>
                <p className="text-base mb-6 text-gray-500">
                  We're expanding to <span className="font-medium text-[#0F3DD1]">{waitlistRegion}</span>. Join the waitlist to be notified when this route becomes available.
                </p>
                <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={waitlistEmail}
                      onChange={(e) => { setWaitlistEmail(e.target.value); setWaitlistError(null); }}
                      className="w-full px-4 py-3 rounded-[12px] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0F3DD1]/20 focus:border-[#0F3DD1]"
                      required
                    />
                  </div>
                  {waitlistError && <p className="text-sm text-red-500 text-center">{waitlistError}</p>}
                  <button
                    type="submit"
                    disabled={waitlistSubmitting || !waitlistEmail}
                    className="w-full py-3 rounded-[12px] bg-[#0F3DD1] text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {waitlistSubmitting ? "Joining..." : "Join Waitlist"}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#686868] mb-2">You're on the list!</h3>
                <p className="text-gray-500 text-sm mb-6">Thanks for joining! We'll notify you when <span className="font-medium text-[#0F3DD1]">{waitlistRegion}</span> becomes available.</p>
                <button onClick={closeWaitlistModal} className="px-6 py-2 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ════════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="px-4 sm:px-6 md:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-[1800px] mx-auto">
          <div
            className="w-full rounded-2xl sm:rounded-[24px] p-5 sm:p-8 md:p-10 lg:p-12 xl:p-16"
            style={{ background: "linear-gradient(90deg, #DAE3FF 0%, #9FC0FF 43%, #C4D7FF 100%)", boxShadow: "0px 4px 20px rgba(0,0,0,0.1)" }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-medium text-[#686868] text-center mb-6 sm:mb-8 md:mb-12 lg:mb-16">
              What Our Users Say
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 lg:gap-10">
              {testimonials.map((t, i) => (
                <div key={i} className={`flex flex-col h-full bg-white/30 backdrop-blur-sm rounded-2xl p-5 sm:p-6 md:p-0 md:bg-transparent md:backdrop-blur-none md:rounded-none ${i === 2 ? "sm:col-span-2 sm:max-w-md sm:mx-auto md:col-span-1 md:max-w-none" : ""}`}>
                  <div className="mb-3 sm:mb-4">
                    <svg width={28} height={23} viewBox="0 0 28 23" fill="none" className="w-8 h-8 text-[#686868]">
                      <path d="M6.94084 0H13.093C11.3052 2.25029 9.80657 4.6314 8.59718 7.14335C7.44037 9.60296 6.96714 11.8532 7.17746 13.8942L6.23099 10.2833C8.07136 10.2833 9.59624 10.8851 10.8056 12.0887C12.0676 13.2924 12.6986 14.7838 12.6986 16.5631C12.6986 18.3948 12.1202 19.9386 10.9634 21.1945C9.80657 22.3982 8.30798 23 6.46761 23C4.57465 23 3.02347 22.3458 1.81408 21.0375C0.604695 19.7292 0 17.9238 0 15.6212C0 13.1092 0.604695 10.5188 1.81408 7.84983C3.07606 5.18089 4.78498 2.56428 6.94084 0ZM21.8479 0H28C26.2122 2.25029 24.7136 4.6314 23.5042 7.14335C22.3474 9.60296 21.8742 11.8532 22.0845 13.8942L21.138 10.2833C22.9784 10.2833 24.5033 10.8851 25.7127 12.0887C26.9746 13.2924 27.6056 14.7838 27.6056 16.5631C27.6056 18.3948 27.0272 19.9386 25.8704 21.1945C24.7136 22.3982 23.215 23 21.3746 23C19.4817 23 17.9305 22.3458 16.7211 21.0375C15.5117 19.7292 14.907 17.9238 14.907 15.6212C14.907 13.1092 15.5117 10.5188 16.7211 7.84983C17.9831 5.18089 19.692 2.56428 21.8479 0Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <p className="text-sm sm:text-base md:text-lg lg:text-base xl:text-lg text-[#686868] leading-relaxed mb-4 sm:mb-6 flex-1">{t.quote}</p>
                  <div className="flex items-center gap-3 mt-auto">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#DAE3FF] to-[#9FC0FF] flex items-center justify-center flex-shrink-0 text-[#0F3DD1] font-bold text-sm">
                      {t.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#686868] text-sm sm:text-base">
                        {t.name}, {t.role}
                      </p>
                      <div className="w-6 h-1 bg-[#686868] rounded-full mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          REFERRAL SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section id="referral" className="relative px-4 sm:px-6 md:px-6 lg:px-8 py-6 sm:py-8 overflow-hidden">
        <div className="max-w-[1800px] mx-auto">
          <div className="w-full bg-white rounded-2xl sm:rounded-[24px]" style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.1)" }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch">
              {/* Left */}
              <div className="p-5 sm:p-6 md:p-8 lg:p-10 xl:p-12 flex flex-col h-full">
                <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#0F3DD1]" />
                  <span className="text-sm sm:text-base font-medium text-[#0F3DD1]">Referral Promo</span>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl xl:text-4xl font-medium text-[#686868] mb-5 sm:mb-6 lg:mb-8">
                  Refer Freelancers And<br className="hidden sm:block" /> Get Paid
                </h2>
                <div className="mb-6 sm:mb-8">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 pb-2 border-b border-gray-100">
                    {["Referrals", "Cashback", "Per Referral"].map((h) => (
                      <div key={h} className="text-[#0F3DD1] font-medium text-xs sm:text-sm md:text-base">{h}</div>
                    ))}
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {referralTiers.map((tier, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 sm:gap-4">
                        <div className="text-[#686868] font-semibold text-sm sm:text-base md:text-lg">{tier.freelancers}</div>
                        <div className="text-[#686868] font-semibold text-sm sm:text-base md:text-lg">{tier.cashback}</div>
                        <div className="text-[#686868] font-semibold text-sm sm:text-base md:text-lg">{tier.perReferral}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-auto">
                  <p className="text-[#686868] font-medium text-sm sm:text-base mb-3 sm:mb-4">Your Unique Referral Link</p>
                  <div
                    className="flex items-center justify-between w-full sm:max-w-lg rounded-full p-1 sm:p-1.5 pl-4 sm:pl-6"
                    style={{ background: blueGradient }}
                  >
                    <span className="text-white text-xs sm:text-sm truncate mr-2 sm:mr-4 flex-1 min-w-0">
                      https://a2a.global/ref/YOUR-CODE
                    </span>
                    <a
                      href={REGISTER_URL}
                      className="bg-white text-[#0F3DD1] px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-medium text-xs sm:text-sm hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      Generate your link
                    </a>
                  </div>
                </div>
              </div>
              {/* Right - gradient placeholder */}
              <div className="hidden lg:flex items-center justify-center rounded-tr-[24px] rounded-br-[24px] overflow-hidden min-h-[400px]" style={{ background: "linear-gradient(135deg, #DAE3FF 0%, #9FC0FF 50%, #0F3DD1 100%)" }}>
                <div className="text-center p-8">
                  <div className="text-5xl mb-4">💸</div>
                  <p className="text-white text-xl font-semibold">Refer &amp; Earn</p>
                  <p className="text-white/80 text-sm mt-2">Up to $1.25 per referral</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          HOW REFERRAL WORKS
      ════════════════════════════════════════════════════════════════ */}
      <section className="relative px-4 md:px-6 lg:px-8 py-16 md:py-24 overflow-hidden bg-white">
        <div className="max-w-[1800px] mx-auto">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-center mb-8 tracking-wide bg-clip-text text-transparent" style={gradientText}>
            How Referral Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16">
            {referralSteps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#0F3DD1] flex items-center justify-center mb-6">
                  <span className="text-white text-xl md:text-2xl font-semibold">{step.number}</span>
                </div>
                <h3 className="text-[#0F3DD1] text-lg md:text-xl font-medium leading-relaxed max-w-[280px]">{step.title}</h3>
              </div>
            ))}
          </div>
          <div className="text-center space-y-4">
            <p className="text-gray-600 text-sm md:text-base">
              Referred Freelancer Means A Newly Registered Freelancer On A2A Global Platform That Makes<br />
              At Least One Transaction <span className="text-red-500">*</span>
            </p>
            <p className="text-[#0F3DD1] text-lg md:text-xl font-medium">
              Minimum Referral Withdrawal Is $50
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          AI TASKS SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section id="ai-tasks" className="relative overflow-hidden px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-[#0F3DD1]/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-[#0F3DD1]/5 to-transparent pointer-events-none" />
        <div className="max-w-[1800px] mx-auto relative">
          {/* Header */}
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-semibold text-[#686868] mb-4">
              AI Tasks &amp; Jobs for Freelancers
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-500 max-w-2xl mx-auto mb-6">
              Fresh AI-focused opportunities from US companies, curated for Indian freelancers via A2A Global. Get paid in USD with zero fees.
            </p>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span><span className="font-semibold text-gray-900">40</span> tasks available</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Updated <span className="font-semibold text-gray-900">March 19, 2026</span></span>
              </div>
            </div>
          </div>

          {/* Info Bar */}
          <div className="flex items-center justify-center gap-4 md:gap-6 flex-wrap px-4 md:px-6 py-3 bg-[#0F3DD1]/5 border border-[#0F3DD1]/10 rounded-2xl mb-8">
            {[
              { icon: <Shield className="w-4 h-4" />, text: "Verified by A2A Global" },
              { icon: <Globe className="w-4 h-4" />, text: "US Companies · Remote" },
              { icon: <CreditCard className="w-4 h-4" />, text: "Paid via A2A Payment Link" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium text-[#0F3DD1]">
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5 mb-8 shadow-sm">
            <div className="flex gap-2 flex-wrap mb-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeCategory === cat.key ? "bg-[#0F3DD1] text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-[#0F3DD1]/10 hover:text-[#0F3DD1] border border-gray-100"}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search title, company, skill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F3DD1]/20 focus:border-[#0F3DD1] transition-all"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  Showing <span className="font-semibold text-gray-900">{filteredTasks.length}</span> tasks
                </span>
              </div>
            </div>
          </div>

          {/* Tasks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {filteredTasks.map((task, i) => (
              <article
                key={task.id}
                className="relative bg-white rounded-2xl p-5 flex flex-col gap-3 border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#0F3DD1]/20 transition-all duration-300 hover:-translate-y-1 group"
                style={{ borderTopColor: task.accent, borderTopWidth: "3px" }}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${task.accent}15`, color: task.accent }}>
                      {task.category}
                    </span>
                    {task.status === "Verified" && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Verified
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${task.accent}15`, color: task.accent }}>
                    {task.rateType === "hourly" ? "Hourly" : "Per Task"}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-gray-900 leading-tight">{task.title}</h3>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: task.accent }}>
                    {task.companyInitial}
                  </div>
                  <span className="text-sm font-medium text-gray-600">{task.company}</span>
                </div>
                <div className="text-xl font-bold" style={{ color: task.accent }}>{task.rate}</div>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{task.description}</p>
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-600">Skills:</span> {task.skills}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <a
                    href={REGISTER_URL}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all duration-200 hover:gap-2.5"
                    style={{ backgroundColor: task.accent }}
                  >
                    Apply Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <span className="text-xs text-gray-400">Sign up to access</span>
                </div>
              </article>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm mb-6">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-gray-600">All listings manually verified by A2A Global moderation team</span>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-[#0F3DD1]/5 border border-gray-200 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-[#0F3DD1]" />
                <span className="text-sm font-semibold text-[#0F3DD1] uppercase tracking-wide">Access Full Job Board</span>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-3">Ready to start earning in USD?</h3>
              <p className="text-sm md:text-base text-gray-500 mb-6 max-w-md mx-auto">
                Create your free A2A account to access all 40+ verified AI tasks, create payment links, and receive payments from US companies with zero fees.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href={REGISTER_URL} className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-white font-semibold shadow-lg transition-all duration-300 hover:shadow-xl" style={{ background: blueGradient }}>
                  Create Free Account
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a href={LOGIN_URL} className="inline-flex items-center px-8 py-3 rounded-full border-2 border-[#0F3DD1] text-[#0F3DD1] font-semibold hover:bg-[#0F3DD1]/5 transition-all duration-300">
                  Already have an account?
                </a>
              </div>
              <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-200 flex-wrap">
                {["Zero fees on all payments", "Instant USD to INR conversion", "Create payment links free"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FAQ SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="px-4 md:px-6 lg:px-8 py-14 md:py-20">
        <div className="max-w-[1800px] mx-auto">
          <div className="mx-auto rounded-[24px] p-8 md:p-12 lg:p-16" style={{ background: "linear-gradient(180deg, #DAE3FF 0%, #FFFFFF 100%)" }}>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#0F3DD1]" />
                <span className="text-[#0F3DD1] font-medium">Frequently Asked Questions</span>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium text-[#686868]">FAQ</h2>
            </div>
            <div className="max-w-3xl mx-auto">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b border-gray-200">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between py-6 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {openFaq === i && <span className="w-2 h-2 rounded-full bg-[#0F3DD1] flex-shrink-0" />}
                      <span className={`text-base md:text-lg font-medium ${openFaq === i ? "text-[#0F3DD1]" : "text-[#686868]"}`}>
                        {faq.question}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-[#0F3DD1] flex items-center justify-center flex-shrink-0 ml-4">
                      {openFaq === i ? <ChevronUp className="w-5 h-5 text-[#0F3DD1]" /> : <ChevronDown className="w-5 h-5 text-[#0F3DD1]" />}
                    </div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96 pb-6" : "max-h-0"}`}>
                    <p className="text-gray-600 text-sm md:text-base leading-relaxed pl-5">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          A2A GLOBAL NAME (decorative) – above footer
      ════════════════════════════════════════════════════════════════ */}
      <section className="relative w-full pointer-events-none mb-0 px-4 md:px-6 lg:px-8">
        <div className="max-w-[1800px] mx-auto">
          <div className="w-full py-6 flex items-center justify-center overflow-hidden">
            <span
              className="text-[12vw] font-bold tracking-wider select-none whitespace-nowrap bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(to right, #DAE3FF, #9FC0FF, #DAE3FF)" }}
            >
              A2A GLOBAL
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════ */}
      <footer className="rounded-tl-[24px] rounded-tr-[24px]" style={{ background: "linear-gradient(135deg, #0F3DD1 0%, #081F6B 100%)" }}>
        <div className="max-w-[1800px] mx-auto px-6 md:px-10 lg:px-12 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:gap-16 lg:gap-24 gap-8 justify-between">
            {/* Brand */}
            <div className="md:max-w-[42rem]">
              <img src={logoSvg} alt="A2A Global" className="h-14 md:h-16 w-auto mb-6 brightness-0 invert" />
              <p className="text-white/80 text-sm leading-relaxed">
                A2A Global Inc is a US based technology platform that enables Indian freelancers to generate payment links and receive cross border payments from the US via licensed payment partners.
              </p>
            </div>
            {/* Links */}
            <div className="flex flex-wrap md:flex-nowrap gap-12 md:gap-20 lg:gap-24">
              {/* Quick Links */}
              <div>
                <h3 className="font-medium text-white text-lg mb-4 whitespace-nowrap">Quick Links</h3>
                <ul className="space-y-3">
                  {[
                    ["#", "Who We Are"],
                    ["#mission", "A2A Global's Mission"],
                    ["#pricing", "Pricing"],
                    ["#why-a2a", "Why A2A Global"],
                    ["#how-it-works", "How It Works"],
                    ["#geographies", "Geographies"],
                    ["#testimonials", "Testimonials"],
                    ["#referral", "Refer & Earn"],
                    ["#faq", "FAQ"],
                  ].map(([href, label]) => (
                    <li key={label}>
                      <a href={href} className="text-white/80 hover:text-white transition-colors text-sm">{label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Legal */}
              <div>
                <h3 className="font-medium text-white text-lg mb-4">Legal</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/legal/TERMS-OF-USE-A2A-Global-Inc-April-2026.pdf" target="_blank" className="text-white/80 hover:text-white transition-colors text-sm">Terms &amp; Conditions</a>
                  </li>
                  <li>
                    <a href="/legal/PRIVACY-POLICY-A2A-Global-Inc-April-2026.pdf" target="_blank" className="text-white/80 hover:text-white transition-colors text-sm">Privacy Policy</a>
                  </li>
                </ul>
              </div>
              {/* Contact */}
              <div>
                <h3 className="font-medium text-white text-lg mb-4">Contact</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="mailto:IT@a2a.global" className="text-white/80 hover:text-white transition-colors text-sm">IT@a2a.global</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 mt-8 pt-5 text-white/60 text-sm">
            <p>© 2026 A2A Global Inc. All rights reserved. File number 10050200, Newark, Delaware, United States.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Calculator form (extracted to avoid duplication) ─────────────────────────
function CalcForm({
  amount,
  setAmount,
  inputValue,
  setInputValue,
  paymentMethod,
  setPaymentMethod,
  isPaymentOpen,
  setIsPaymentOpen,
  paymentRef,
  exchangeRate,
  lastFetched,
  onInputChange,
  onBlur,
}: {
  amount: number;
  setAmount: (v: number) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  isPaymentOpen: boolean;
  setIsPaymentOpen: (v: boolean) => void;
  paymentRef: React.RefObject<HTMLDivElement>;
  exchangeRate: number;
  lastFetched: string | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}) {
  return (
    <div className="p-3 md:p-4 lg:p-5 xl:p-6 w-full">
      <div className="mb-2 md:mb-3">
        <span className="text-xs md:text-sm font-medium text-[#0F3DD1]">Client Pays</span>
      </div>
      <div className="relative mb-4 md:mb-5 lg:mb-6">
        <div className="flex items-center bg-white rounded-[12px] shadow-md overflow-hidden" style={{ border: "1px solid rgba(16,24,40,0.08)" }}>
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={onInputChange}
            onBlur={onBlur}
            className="text-base md:text-lg lg:text-xl font-semibold border-0 outline-none px-3 md:px-4 lg:px-5 py-2.5 md:py-3 bg-transparent text-[#686868] flex-1 min-w-[60px]"
            placeholder={String(MIN_AMOUNT)}
          />
          <div className="border-l border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 lg:px-4 py-2.5 md:py-3">
              <img
                src="https://flagcdn.com/w80/us.png"
                alt="USD"
                className="rounded-[4px] shadow-sm border border-gray-100 w-5 h-3.5 md:w-6 md:h-4 object-cover"
              />
              <span className="font-semibold text-[#686868] text-xs md:text-sm">USD</span>
              <ChevronDown className="h-3 w-3 md:h-4 md:w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 md:mb-3">
        <span className="text-xs md:text-sm font-medium text-[#0F3DD1]">Your Payment Method</span>
      </div>
      <div ref={paymentRef} className="relative mb-4 md:mb-5 lg:mb-6">
        <button
          type="button"
          onClick={() => setIsPaymentOpen(!isPaymentOpen)}
          className="w-full flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 bg-white rounded-[12px] hover:bg-gray-50 shadow-md transition-colors"
          style={{ border: "1px solid rgba(16,24,40,0.08)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {(() => {
              const sel = paymentMethods.find((p) => p.value === paymentMethod);
              const Icon = sel?.icon;
              return Icon ? <Icon className="h-4 w-4 md:h-5 md:w-5 text-[#0F3DD1] flex-shrink-0" /> : null;
            })()}
            <span className="font-medium text-[#686868] text-sm md:text-base">
              {paymentMethods.find((p) => p.value === paymentMethod)?.label}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 md:h-5 md:w-5 text-[#0F3DD1] transition-transform flex-shrink-0 ${isPaymentOpen ? "rotate-180" : ""}`} />
        </button>
        {isPaymentOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg z-50 py-1">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.value}
                  onClick={() => { setPaymentMethod(method.value); setIsPaymentOpen(false); }}
                  className={`w-full text-left px-3 md:px-4 py-2 md:py-2.5 hover:bg-gray-50 font-medium flex items-center gap-2 text-sm md:text-base ${paymentMethod === method.value ? "text-[#0F3DD1] bg-[#0F3DD1]/5" : "text-[#686868]"}`}
                >
                  <Icon className={`h-4 w-4 md:h-5 md:w-5 ${paymentMethod === method.value ? "text-[#0F3DD1]" : "text-gray-500"}`} />
                  {method.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 mb-3 md:mb-4">
        <div className="flex items-center flex-wrap gap-2 text-sm md:text-base">
          <span className="text-[#686868] font-bold whitespace-nowrap">1 USD = {exchangeRate} INR</span>
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#22C55E] animate-heartbeat" />
          <span className="text-[#22C55E] font-medium text-xs md:text-sm">Live</span>
        </div>
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-[10px] md:text-xs text-gray-500">Source: Google</span>
          {lastFetched && (
            <>
              <span className="text-gray-500">•</span>
              <span className="text-[10px] md:text-xs text-gray-500">Updated {formatRelativeTime(lastFetched)}</span>
            </>
          )}
        </div>
      </div>
      <p className="text-[10px] md:text-xs text-gray-500 leading-relaxed">
        Calculator Is Provided For Comparison Purposes Only<span className="text-red-500">*</span>
      </p>
    </div>
  );
}
