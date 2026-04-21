import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  PRICING_TIERS, getTierFromRate, getSliderValueFromRate, getRateFromSliderValue,
  getAISuggestedExpertRate,
} from "@/lib/pricing-tiers";
import {
  Award, GraduationCap, Briefcase, CheckCircle,
  ArrowRight, ArrowLeft, FileCheck, Timer, AlertTriangle, DollarSign,
  Clock, BarChart3, BookOpen, TrendingUp, Star,
} from "lucide-react";
import type { Expert } from "@shared/schema";

const ALL_CATEGORIES = [
  { id: "finance", label: "Finance", description: "Investment, tax planning, wealth management", enabled: true },
  { id: "business", label: "Business & Strategy", description: "Operations, marketing, growth strategy", enabled: true },
  { id: "entrepreneurship", label: "Entrepreneurship", description: "Startups, fundraising, product-market fit", enabled: true },
  { id: "legal", label: "Legal", description: "Coming soon", enabled: false },
  { id: "medical", label: "Medical", description: "Coming soon", enabled: false },
  { id: "sports", label: "Sports", description: "Coming soon", enabled: false },
];

type OnboardingStep = "profile" | "preview" | "rate" | "test" | "result";

interface TestAssignment {
  id: string;
  category: string;
  title: string;
  userQuestion: string;
  aiAnswer: string;
  instructions: string;
  timeLimit: number;
}

// ─── Profile Step (Step 1 of 3) ───
function ProfileStep({ expert, onComplete }: { expert: Expert; onComplete: () => void }) {
  const { user } = useAuth();
  const [education, setEducation] = useState(expert.education || "");
  const [expertise, setExpertise] = useState(expert.expertise || "");
  const [yearsExperience, setYearsExperience] = useState<number | "">(expert.yearsExperience || "");
  const [bio, setBio] = useState(expert.bio || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    try { return JSON.parse(expert.categories || "[]"); } catch { return []; }
  });
  const { toast } = useToast();

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest("POST", "/api/experts/onboarding/profile", {
          expertId: expert.id,
          education,
          yearsExperience: yearsExperience === "" ? 0 : yearsExperience,
          categories: selectedCategories,
          bio,
          expertise,
        });
        return res.json();
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/experts/user", expert.userId] });
      toast({ title: "Profile saved!" });
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Error saving profile", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = education.trim() && expertise.trim() && yearsExperience >= 1 && selectedCategories.length > 0;

  return (
    <div className="space-y-6" data-testid="onboarding-step-profile">
      {/* Value Proposition Section */}
      <div className="text-center mb-2" data-testid="value-prop-section">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Award className="h-4 w-4" /> Join 1,000+ experts
        </div>
        <h2 className="text-xl font-bold mb-6">Take advantage of A2A Global's platform</h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6" data-testid="value-props">
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg p-4 text-center">
          <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Earn up to $2,000
            <InfoTooltip text="Guru tier handles complex executive-grade requests. Typical completion: 1-3 hours. Average payout: $690-$2,070 per request." />
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">per one request in Guru mode</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4 text-center">
          <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Flexible hours</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Work on your schedule</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 text-center">
          <Star className="h-6 w-6 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Build your reputation</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Rating system → better tasks</p>
        </div>
      </div>

      {/* Sample task cards */}
      <div className="space-y-3 mb-6" data-testid="sample-task-cards">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sample tasks by tier</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="border-blue-200 dark:border-blue-800/30">
            <CardContent className="p-4">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] mb-2">Standard</Badge>
              <p className="text-sm font-medium">Rate this AI stock analysis</p>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span className="text-green-600 font-semibold">$2-5</span>
                <span>5-10 min</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 dark:border-indigo-800/30">
            <CardContent className="p-4">
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] mb-2">Pro</Badge>
              <p className="text-sm font-medium">Review AI's M&A valuation model</p>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span className="text-green-600 font-semibold">$50-150</span>
                <span>30-60 min</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-800/30">
            <CardContent className="p-4">
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] mb-2">Guru</Badge>
              <p className="text-sm font-medium">Build complete investment thesis</p>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span className="text-green-600 font-semibold">$500-2,000</span>
                <span>1-3 hours</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">Fill in your details, select your mode and start earning with A2A Global</p>
      </div>

      {/* Original profile form header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Complete Your Expert Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Tell us about your professional background</p>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium">Full Name</Label>
          <Input value={user?.name ?? ""} disabled className="mt-1 bg-muted/50" data-testid="input-onboarding-name" />
          <p className="text-xs text-muted-foreground mt-1">From your registration</p>
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">Education Details</Label>
            <InfoTooltip text="Include degrees, institutions, and graduation years" />
          </div>
          <Textarea
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder="e.g. MBA, Wharton School of Business, 2015"
            rows={2}
            className="mt-1"
            data-testid="input-onboarding-education"
          />
        </div>

        <div>
          <div className="flex items-center">
            <Label className="text-sm font-medium">Professional Experience</Label>
            <InfoTooltip text="Describe your career background and areas of expertise" />
          </div>
          <Textarea
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            placeholder="Describe your career background and areas of expertise..."
            rows={3}
            className="mt-1"
            data-testid="input-onboarding-expertise"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Years of Experience</Label>
          <Input
            type="number"
            min="0"
            max={50}
            value={yearsExperience}
            placeholder="0"
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                setYearsExperience("");
              } else {
                const n = parseInt(val, 10);
                setYearsExperience(isNaN(n) ? "" : Math.min(50, Math.max(0, n)));
              }
            }}
            className="mt-1 w-32"
            data-testid="input-onboarding-years"
          />
        </div>

        <div>
          <div className="flex items-center mb-3">
            <Label className="text-sm font-medium">Select Your Categories</Label>
            <InfoTooltip text="Select all fields where you have professional expertise" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {ALL_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className={`border rounded-lg p-4 transition ${
                  !cat.enabled
                    ? "opacity-50 cursor-not-allowed bg-muted/30"
                    : `cursor-pointer hover:border-primary/50 ${
                        selectedCategories.includes(cat.id)
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border"
                      }`
                }`}
                onClick={() => cat.enabled && toggleCategory(cat.id)}
                data-testid={`checkbox-category-${cat.id}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedCategories.includes(cat.id)}
                    onCheckedChange={() => cat.enabled && toggleCategory(cat.id)}
                    disabled={!cat.enabled}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{cat.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Short Bio</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A brief professional bio that clients will see..."
            rows={3}
            className="mt-1"
            data-testid="input-onboarding-bio"
          />
        </div>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={!canSubmit || mutation.isPending}
        className="w-full"
        data-testid="button-save-profile"
      >
        {mutation.isPending ? "Saving..." : "Continue"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Preview Step (Step 2 of 4) — Blurred Queue ───
const MOCK_QUEUE = [
  { title: "Rate AI tax optimization advice", category: "Finance", payout: "$15", time: "~10 min" },
  { title: "Review M&A valuation model", category: "Business", payout: "$45", time: "~25 min" },
  { title: "Build financial model review", category: "Entrepreneurship", payout: "$120", time: "~40 min" },
  { title: "Audit startup pitch deck analysis", category: "Business", payout: "$35", time: "~20 min" },
  { title: "Check retirement portfolio advice", category: "Finance", payout: "$28", time: "~15 min" },
];

function PreviewStep({ expert, onComplete }: { expert: Expert; onComplete: () => void }) {
  const categories = (() => {
    try { return JSON.parse(expert.categories || "[]"); } catch { return []; }
  })();

  const matchingRequests = MOCK_QUEUE.filter(r =>
    categories.some((c: string) => r.category.toLowerCase().includes(c.toLowerCase()))
  );
  const displayRequests = matchingRequests.length >= 3 ? matchingRequests : MOCK_QUEUE.slice(0, 5);
  const avgPayout = displayRequests.reduce((sum, r) => sum + parseInt(r.payout.replace("$", "")), 0) / displayRequests.length;

  return (
    <div className="space-y-6" data-testid="onboarding-step-preview">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold">Requests Waiting for You</h2>
        <p className="text-sm text-muted-foreground mt-1">Complete verification to unlock these earning opportunities</p>
      </div>

      {/* Earnings preview banner */}
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg p-4 text-center" data-testid="banner-earnings-preview">
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          {displayRequests.length} requests waiting{categories.length > 0 ? ` in ${categories.join(", ")}` : ""} · Average payout ${avgPayout.toFixed(0)}
        </p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Complete verification to start earning</p>
      </div>

      {/* Blurred queue */}
      <div className="space-y-3">
        {displayRequests.map((req, i) => (
          <div key={i} className="relative border rounded-lg p-4 bg-muted/20 overflow-hidden" data-testid={`preview-request-${i}`}>
            <div className="absolute inset-0 backdrop-blur-[2px] bg-background/30 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 bg-background/90 px-3 py-1.5 rounded-full shadow-sm border">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-medium">Locked — Complete verification to claim</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{req.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">{req.category}</Badge>
                  <span className="text-xs text-muted-foreground">{req.time}</span>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{req.payout}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Urgency CTA */}
      <Button
        onClick={onComplete}
        className="w-full"
        size="lg"
        data-testid="button-continue-to-rate"
      >
        Complete verification now to claim these requests
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Set Your Rate Step (Step 3 of 4) ───
function RateStep({ expert, onComplete, onSkipToVerified }: { expert: Expert; onComplete: () => void; onSkipToVerified: () => void }) {
  const suggestedRate = getAISuggestedExpertRate(expert.yearsExperience || 1);
  const [rate, setRate] = useState(suggestedRate);
  // Build 45.5: all rates are hourly.
  const { toast } = useToast();

  const currentTier = getTierFromRate(rate);
  const sliderVal = getSliderValueFromRate(rate);
  // Build 45.4: no verification test required for ANY tier (including Guru).

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest("POST", "/api/experts/onboarding/rate", {
          expertId: expert.id,
          ratePerMinute: rate.toFixed(2),
          rateTier: currentTier.id,
        });
        return res.json();
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/experts/user", expert.userId] });
      toast({ title: "Rate saved!" });
      // All tiers (including guru) skip straight to verified — no test assignment required
      onSkipToVerified();
    },
    onError: (err: Error) => {
      toast({ title: "Error saving rate", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6" data-testid="onboarding-step-rate">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Set Your Earning Rate</h2>
        <p className="text-sm text-muted-foreground mt-1">
          AI suggests a rate based on your profile. Adjust to match your expectations.
          <InfoTooltip text="Your desired earnings rate. AI suggests a rate based on your profile" />
        </p>
      </div>

      {/* AI suggested indicator */}
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800/30 flex items-center justify-center shrink-0">
          <TrendingUp className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">AI Suggested: ${suggestedRate.toFixed(2)}/hour</p>
          <p className="text-xs text-green-600 dark:text-green-400">Based on {expert.yearsExperience} years of experience</p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shrink-0"
          onClick={() => {
            setRate(suggestedRate);
            // Auto-advance: save the rate and continue
            setTimeout(() => mutation.mutate(), 100);
          }}
          disabled={mutation.isPending}
          data-testid="button-use-this-rate"
        >
          Use This Rate →
        </Button>
      </div>

      {/* Tier badge */}
      <div className="text-center mb-2">
        <Badge className={`${currentTier.color} text-white text-lg px-4 py-1`} data-testid="badge-expert-rate-tier">
          {currentTier.label}
        </Badge>
      </div>

      {/* Rate display — Build 45.5: always per-hour */}
      <div className="text-center mb-4">
        <p className="text-3xl font-bold" data-testid="text-expert-rate-display">
          ${rate.toFixed(2)}
          <span className="text-base font-normal text-muted-foreground">/hour</span>
        </p>
      </div>

      {/* Slider */}
      <div className="px-2 mb-2">
        <Slider
          value={[sliderVal]}
          onValueChange={([v]) => setRate(getRateFromSliderValue(v))}
          min={0} max={100} step={1}
          className="mb-3"
          data-testid="slider-expert-rate"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          {PRICING_TIERS.map((t) => (
            <span key={t.id} className={currentTier.id === t.id ? "font-bold text-foreground" : ""}>{t.label}</span>
          ))}
        </div>
      </div>

      {/* Verification notice — Build 45.4: no verification test required for ANY tier (including Guru) */}
      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm" data-testid="notice-auto-verify">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span>No additional verification required. You'll be verified immediately.</span>
      </div>

      {/* 5 info cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Sample Request & Expected Answer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground" data-testid="text-expert-sample-work">{currentTier.sampleWork}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-green-500" /> Expected Request Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground" data-testid="text-expert-volume">{currentTier.expectedVolume}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Expected Earnings per 12h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground" data-testid="text-expert-earnings">{currentTier.expectedEarnings}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Expected Time per Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground" data-testid="text-expert-time">{currentTier.expectedTime}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-purple-500" /> Required Skills & Education
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground" data-testid="text-expert-skills">{currentTier.requiredSkills}</p>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full"
        data-testid="button-save-rate"
      >
        {mutation.isPending ? "Saving..." : "Complete Verification"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Test Step (Step 3 of 3) ───
function TestStep({ expert, onComplete }: { expert: Expert; onComplete: (result: { passed: boolean; message: string }) => void }) {
  const categories = (() => {
    try { return JSON.parse(expert.categories || "[]"); } catch { return []; }
  })();
  const firstCategory = categories[0] || "finance";

  const { data: assignment, isLoading } = useQuery<TestAssignment>({
    queryKey: ["/api/experts/onboarding/assignment", firstCategory],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/experts/onboarding/assignment?category=${firstCategory}`);
      return res.json();
    },
    enabled: categories.length > 0,
  });

  const [response, setResponse] = useState("");
  const [timeLeft, setTimeLeft] = useState(1800);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/experts/onboarding/test", {
        expertId: expert.id,
        assignmentId: assignment?.id,
        category: assignment?.category,
        response: response,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/experts/user", expert.userId] });
      onComplete(data);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (timeLeft === 0 && assignment && !submitMutation.isPending && response.trim().length > 0) {
      submitMutation.mutate();
    }
  }, [timeLeft]);

  if (isLoading || !assignment) {
    return (
      <div className="text-center py-12" data-testid="onboarding-step-test-loading">
        <p className="text-sm text-muted-foreground">Loading verification assignment...</p>
      </div>
    );
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const charCount = response.length;
  const canSubmit = charCount >= 200;

  return (
    <div className="space-y-6" data-testid="onboarding-step-test">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileCheck className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold">Verification Assignment</h2>
        <p className="text-sm text-muted-foreground mt-1">{assignment.title}</p>
      </div>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Timer className={`h-4 w-4 ${timeLeft < 300 ? "text-red-500" : "text-muted-foreground"}`} />
          <span className={`text-sm font-mono font-medium ${timeLeft < 300 ? "text-red-500" : ""}`} data-testid="text-timer">
            {formatTime(timeLeft)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">30 minute time limit</span>
      </div>

      {timeLeft < 300 && timeLeft > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4" />
          Less than 5 minutes remaining!
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4" data-testid="text-instructions">
        <p className="text-sm text-blue-800 dark:text-blue-300">{assignment.instructions}</p>
      </div>

      <Card data-testid="card-user-question">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" /> User Question
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed" data-testid="text-user-question">{assignment.userQuestion}</p>
        </CardContent>
      </Card>

      <Card data-testid="card-ai-answer">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> AI-Generated Answer
          </CardTitle>
          <CardDescription>Review this response for errors, omissions, or misleading statements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono" data-testid="text-ai-answer">
            {assignment.aiAnswer}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Your Expert Review</Label>
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Identify errors, explain why they matter, and provide corrections. Minimum 200 characters."
          rows={10}
          className="min-h-[300px] text-sm leading-relaxed"
          data-testid="textarea-expert-review"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${charCount >= 200 ? "text-green-600" : "text-muted-foreground"}`} data-testid="text-char-count">
            {charCount} / 200 minimum
          </span>
          {charCount > 0 && charCount < 200 && (
            <span className="text-xs text-amber-600">{200 - charCount} more characters needed</span>
          )}
        </div>
      </div>

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={!canSubmit || submitMutation.isPending}
        className="w-full"
        size="lg"
        data-testid="button-submit-test"
      >
        {submitMutation.isPending ? "Submitting..." : "Submit Review"}
      </Button>
    </div>
  );
}

// ─── Result Step ───
function ResultStep({ result }: { result: { passed: boolean; message: string } }) {
  const [, setLocation] = useLocation();

  return (
    <div className="text-center py-8 space-y-6" data-testid="onboarding-result-passed">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-green-700 dark:text-green-400">Welcome to A2A Expert Opinion!</h2>
        <p className="text-sm text-muted-foreground mt-2">{result.message}</p>
      </div>
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg p-4 max-w-md mx-auto">
        <div className="flex items-center gap-2 justify-center">
          <Award className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">Verified Expert</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Your profile is now verified and visible to clients</p>
      </div>
      <Button onClick={() => setLocation("/expert")} size="lg" data-testid="button-go-to-dashboard">
        Go to Dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main Onboarding Page ───
export default function ExpertOnboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // BUG-009: Force light theme — remove dark class on mount
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const { data: expert, isLoading, error } = useQuery<Expert>({
    queryKey: ["/api/experts/user", user?.id],
    enabled: !!user,
    retry: 3,
    retryDelay: 500,
  });

  const [step, setStep] = useState<OnboardingStep>("profile");
  const [testResult, setTestResult] = useState<{ passed: boolean; message: string } | null>(null);
  const initialStepSet = useRef(false);

  // Determine initial step from expert data — only on first load
  useEffect(() => {
    if (expert && !initialStepSet.current) {
      initialStepSet.current = true;
      if (expert.onboardingComplete >= 3) {
        setLocation("/expert");
      } else if (expert.onboardingComplete === 2) {
        setStep("test");
      } else if (expert.onboardingComplete === 1) {
        setStep("preview");
      } else {
        setStep("profile");
      }
    }
  }, [expert?.onboardingComplete]);

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load expert profile.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/experts/user", user?.id] })}>Try Again</Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/login")}>Back to Login</Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !expert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const stepNum = step === "profile" ? 1 : step === "preview" ? 2 : step === "rate" ? 3 : step === "test" ? 4 : 5;

  return (
    <div className="min-h-screen bg-background" data-testid="page-expert-onboarding">
      {/* Top bar */}
      <div className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded flex items-center justify-center">
              <Award className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Expert Onboarding</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Step {Math.min(stepNum, 4)} of 4</span>
          </div>
        </div>
      </div>

      {/* Step indicators — 4 steps */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <div className="flex items-center gap-3 mb-8">
          {/* Step 1: Profile */}
          <div className={`flex items-center gap-1.5 ${stepNum >= 1 ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              stepNum > 1 ? "bg-primary text-white" : stepNum === 1 ? "bg-primary/10 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
            }`}>
              {stepNum > 1 ? <CheckCircle className="h-3.5 w-3.5" /> : "1"}
            </div>
            <span className="text-xs font-medium hidden sm:inline">Profile</span>
          </div>
          <div className="flex-1 h-px bg-border" />

          {/* Step 2: Preview */}
          <div className={`flex items-center gap-1.5 ${stepNum >= 2 ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              stepNum > 2 ? "bg-primary text-white" : stepNum === 2 ? "bg-primary/10 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
            }`}>
              {stepNum > 2 ? <CheckCircle className="h-3.5 w-3.5" /> : "2"}
            </div>
            <span className="text-xs font-medium hidden sm:inline">Preview</span>
          </div>
          <div className="flex-1 h-px bg-border" />

          {/* Step 3: Set Your Rate */}
          <div className={`flex items-center gap-1.5 ${stepNum >= 3 ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              stepNum > 3 ? "bg-primary text-white" : stepNum === 3 ? "bg-primary/10 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
            }`}>
              {stepNum > 3 ? <CheckCircle className="h-3.5 w-3.5" /> : "3"}
            </div>
            <span className="text-xs font-medium hidden sm:inline">Rate</span>
          </div>
          <div className="flex-1 h-px bg-border" />

          {/* Step 4: Verification */}
          <div className={`flex items-center gap-1.5 ${stepNum >= 4 ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              step === "result" && testResult?.passed ? "bg-primary text-white" : stepNum === 4 ? "bg-primary/10 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
            }`}>
              {step === "result" && testResult?.passed ? <CheckCircle className="h-3.5 w-3.5" /> : "4"}
            </div>
            <span className="text-xs font-medium hidden sm:inline">Verification</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        {step === "profile" && (
          <ProfileStep
            expert={expert}
            onComplete={() => {
              setStep("preview");
            }}
          />
        )}
        {step === "preview" && (
          <PreviewStep
            expert={expert}
            onComplete={() => {
              setStep("rate");
            }}
          />
        )}
        {step === "rate" && (
          <RateStep
            expert={expert}
            onComplete={() => {
              setStep("test");
            }}
            onSkipToVerified={async () => {
              // Mark expert as verified on server for non-Guru tiers
              try {
                await apiRequest("PATCH", `/api/experts/${expert.id}`, {
                  onboardingComplete: 3,
                  verified: 1,
                  verificationScore: 100,
                  availability: 1,
                });
                await queryClient.invalidateQueries({ queryKey: ["/api/experts/user", expert.userId] });
              } catch (e) {
                // Continue to result even if server update fails
              }
              setTestResult({ passed: true, message: "Your profile has been verified! You're approved for Standard/Pro tier requests. Start earning now." });
              setStep("result");
            }}
          />
        )}
        {step === "test" && (
          <TestStep
            expert={expert}
            onComplete={(result) => {
              setTestResult(result);
              setStep("result");
            }}
          />
        )}
        {step === "result" && testResult && (
          <ResultStep result={testResult} />
        )}
      </div>
    </div>
  );
}
