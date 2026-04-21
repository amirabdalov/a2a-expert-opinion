export interface PricingTier {
  id: string;
  label: string;
  minRate: number;
  maxRate: number;
  color: string;
  // Client info cards
  sampleReport: string;
  sampleExpert: string;
  expectedDelivery: string;
  // Expert info cards
  sampleWork: string;
  expectedVolume: string;
  expectedEarnings: string;
  expectedTime: string;
  requiredSkills: string;
  // Client markup
  clientMarkup: number;
  clientMinRate: number;
  clientMaxRate: number;
}

// Build 45.5: All rates are now PER HOUR. Thresholds = previous per-minute × 60.
// The stored column is still named rate_per_minute / price_per_minute for backward
// compatibility, but the numeric value is interpreted as dollars per hour everywhere.
export const PRICING_TIERS: PricingTier[] = [
  {
    id: "standard",
    label: "Standard",
    minRate: 0.60,        // $0.60/hour
    maxRate: 60.00,       // $60/hour
    color: "bg-blue-500",
    sampleReport: "1 paragraph analysis with key points identified",
    sampleExpert: "3-5 years, Bachelor's/Master's, Mid-level professional",
    expectedDelivery: "1-4 hours",
    sampleWork: "Quick review of AI output. Example: 'Check this AI market analysis for errors.' Expected: 1 paragraph analysis with key points.",
    expectedVolume: "30-120 requests / 12h",
    expectedEarnings: "$2 - $180",
    expectedTime: "1-10 minutes",
    requiredSkills: "Bachelor's degree or equivalent. 2+ years professional experience.",
    clientMarkup: 0.50,
    clientMinRate: 0.90,
    clientMaxRate: 90.00,
  },
  {
    id: "pro",
    label: "Pro",
    minRate: 60.00,       // $60/hour
    maxRate: 600.00,      // $600/hour
    color: "bg-indigo-500",
    sampleReport: "Detailed analysis with citations and alternative approaches, 500-800 words",
    sampleExpert: "8-12 years, MBA/CFA, Manager at top consulting or finance firm",
    expectedDelivery: "15-60 minutes",
    sampleWork: "Detailed critique with alternative approaches and citations. Expected: 500-800 word report with structured sections.",
    expectedVolume: "8-30 requests / 12h",
    expectedEarnings: "$360 - $3,600",
    expectedTime: "10-40 minutes",
    requiredSkills: "MBA or advanced degree from accredited institution. 8+ years in senior roles.",
    clientMarkup: 0.30,
    clientMinRate: 78.00,
    clientMaxRate: 780.00,
  },
  {
    id: "guru",
    label: "Guru",
    minRate: 600.00,      // $600/hour
    maxRate: 1800.00,     // $1800/hour
    color: "bg-amber-500",
    sampleReport: "Comprehensive research report with financial modeling, scenario analysis, executive-grade deliverables",
    sampleExpert: "18-25+ years, MBA from top school, C-suite/Partner, McKinsey/Goldman alumni",
    expectedDelivery: "5-20 minutes (dedicated expert on standby)",
    sampleWork: "Executive-grade report with financial modeling, scenario analysis, and primary data. Expected: 2000+ word deliverable with custom frameworks.",
    expectedVolume: "1-4 requests / 12h",
    expectedEarnings: "$1,800 - $10,800",
    expectedTime: "1.5-3+ hours",
    requiredSkills: "Ivy League MBA or PhD. 18+ years. Partner/C-suite experience at Big 4, MBB, or Fortune 500.",
    clientMarkup: 0.15,
    clientMinRate: 690.00,
    clientMaxRate: 2070.00,
  },
];

export function getTierFromRate(rate: number): PricingTier {
  for (let i = PRICING_TIERS.length - 1; i >= 0; i--) {
    if (rate >= PRICING_TIERS[i].minRate) return PRICING_TIERS[i];
  }
  return PRICING_TIERS[0];
}

// Build 45.5: slider now spans $0.60/hour → $1800/hour (log scale)
export function getSliderValueFromRate(rate: number): number {
  const logMin = Math.log(0.60);
  const logMax = Math.log(1800);
  const logVal = Math.log(Math.max(0.60, Math.min(1800, rate)));
  return Math.round(((logVal - logMin) / (logMax - logMin)) * 100);
}

export function getRateFromSliderValue(val: number): number {
  const logMin = Math.log(0.60);
  const logMax = Math.log(1800);
  const logVal = logMin + (val / 100) * (logMax - logMin);
  const rate = Math.exp(logVal);
  return Math.round(rate * 100) / 100;
}

// Build 45.5: client-facing suggested hourly prices
export function getAISuggestedClientPrice(serviceType: string): number {
  switch (serviceType) {
    case "rate": return 30.00;
    case "review": return 120.00;
    case "custom": return 300.00;
    default: return 30.00;
  }
}

// Build 45.5: hourly suggested expert rates by experience
export function getAISuggestedExpertRate(yearsExperience: number): number {
  if (yearsExperience <= 5) return 30.00;
  if (yearsExperience <= 10) return 120.00;
  if (yearsExperience <= 18) return 360.00;
  return 900.00;
}

export const LLM_PROVIDERS = [
  "ChatGPT",
  "Claude (Anthropic)",
  "Gemini (Google)",
  "Perplexity",
  "Mistral",
  "Meta AI",
  "Copilot (Microsoft)",
  "Grok (xAI)",
  "Other",
];
