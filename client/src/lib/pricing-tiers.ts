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

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "standard",
    label: "Standard",
    minRate: 0.01,
    maxRate: 1.00,
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
    clientMinRate: 0.015,
    clientMaxRate: 1.50,
  },
  {
    id: "pro",
    label: "Pro",
    minRate: 1.00,
    maxRate: 10.00,
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
    clientMinRate: 1.30,
    clientMaxRate: 13.00,
  },
  {
    id: "guru",
    label: "Guru",
    minRate: 10.00,
    maxRate: 30.00,
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
    clientMinRate: 11.50,
    clientMaxRate: 34.50,
  },
];

export function getTierFromRate(rate: number): PricingTier {
  for (let i = PRICING_TIERS.length - 1; i >= 0; i--) {
    if (rate >= PRICING_TIERS[i].minRate) return PRICING_TIERS[i];
  }
  return PRICING_TIERS[0];
}

export function getSliderValueFromRate(rate: number): number {
  // Map rate to 0-100 slider (logarithmic scale)
  const logMin = Math.log(0.01);
  const logMax = Math.log(30);
  const logVal = Math.log(Math.max(0.01, Math.min(30, rate)));
  return Math.round(((logVal - logMin) / (logMax - logMin)) * 100);
}

export function getRateFromSliderValue(val: number): number {
  const logMin = Math.log(0.01);
  const logMax = Math.log(30);
  const logVal = logMin + (val / 100) * (logMax - logMin);
  const rate = Math.exp(logVal);
  // Round to 2 decimal places
  return Math.round(rate * 100) / 100;
}

export function getAISuggestedClientPrice(serviceType: string): number {
  switch (serviceType) {
    case "rate": return 0.50;
    case "review": return 2.00;
    case "custom": return 5.00;
    default: return 0.50;
  }
}

export function getAISuggestedExpertRate(yearsExperience: number): number {
  if (yearsExperience <= 5) return 0.50;
  if (yearsExperience <= 10) return 2.00;
  if (yearsExperience <= 18) return 6.00;
  return 15.00;
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
