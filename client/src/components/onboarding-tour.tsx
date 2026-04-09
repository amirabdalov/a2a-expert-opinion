import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  userId?: number;
}

export function OnboardingTour({ steps, onComplete, userId }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    positionTooltip();
  }, [currentStep, visible]);

  function positionTooltip() {
    const step = steps[currentStep];
    if (!step) return;

    const target = document.querySelector(step.targetSelector);
    if (!target) {
      // Try to find by data-testid
      const alt = document.querySelector(`[data-testid="${step.targetSelector.replace('[data-testid="', '').replace('"]', '')}"]`);
      if (!alt) {
        // fallback: center of screen
        setTooltipStyle({
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
        });
        return;
      }
    }

    const rect = (target || document.querySelector(`[data-testid="${step.targetSelector}"]`))?.getBoundingClientRect();
    if (!rect) return;

    // Position tooltip to the right of target by default, or below if not enough space
    const tooltipWidth = 280;
    const tooltipHeight = 140;
    const margin = 12;

    let top = rect.top + rect.height / 2 - tooltipHeight / 2;
    let left = rect.right + margin;
    let arrowDir = "left";

    // If tooltip would go off right edge, put it below
    if (left + tooltipWidth > window.innerWidth - 20) {
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      top = rect.bottom + margin;
      arrowDir = "top";
    }

    // Ensure tooltip stays in viewport
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    setTooltipStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    });

    // Arrow pointing towards the target
    if (arrowDir === "left") {
      setArrowStyle({
        position: "absolute",
        left: "-6px",
        top: "50%",
        transform: "translateY(-50%)",
        width: 0,
        height: 0,
        borderTop: "6px solid transparent",
        borderBottom: "6px solid transparent",
        borderRight: "6px solid hsl(var(--primary))",
      });
    } else {
      setArrowStyle({
        position: "absolute",
        top: "-6px",
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderBottom: "6px solid hsl(var(--primary))",
      });
    }

    // Highlight the target element
    (target as HTMLElement)?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }

  if (!visible) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-[9998]"
        onClick={onComplete}
        data-testid="tour-overlay"
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="bg-primary text-primary-foreground rounded-lg shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
        data-testid={`tour-step-${currentStep}`}
      >
        <div style={arrowStyle} />

        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] font-medium opacity-80">
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={onComplete}
            className="text-primary-foreground/60 hover:text-primary-foreground -mt-1 -mr-1"
            data-testid="tour-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
        <p className="text-xs opacity-90 mb-3">{step.description}</p>

        {isLast && (
          <div className="flex items-center gap-2 mb-3" data-testid="tour-dont-show">
            <Checkbox
              id="tour-dont-show"
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(!!v)}
              className="border-primary-foreground/40 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
            />
            <label htmlFor="tour-dont-show" className="text-xs opacity-80 cursor-pointer">Don't show this again</label>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === currentStep ? "bg-primary-foreground" : "bg-primary-foreground/30"}`}
              />
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs px-3"
            onClick={() => {
              if (isLast) {
                if (dontShowAgain && userId) {
                  apiRequest('POST', `/api/users/${userId}/tour-complete`).catch(() => {});
                }
                onComplete();
              } else {
                setCurrentStep((s) => s + 1);
              }
            }}
            data-testid="tour-next"
          >
            {isLast ? "Got it!" : "Next"}
          </Button>
        </div>
      </div>
    </>
  );
}

// Pre-defined tours
export const CLIENT_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-testid="nav-new-request"]',
    title: "Create Your First Request",
    description: "Start here to submit your AI-generated content for expert review.",
  },
  {
    targetSelector: '[data-testid="nav-my-requests"]',
    title: "Track Your Submissions",
    description: "Track all your submissions and see expert responses here.",
  },
  {
    targetSelector: '[data-testid="nav-credits"]',
    title: "Manage Credits",
    description: "Manage your balance and top up credits when needed.",
  },
];

export const EXPERT_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-testid="expert-nav-queue"]',
    title: "Available Queue",
    description: "Find and claim requests that match your expertise.",
  },
  {
    targetSelector: '[data-testid="expert-nav-active"]',
    title: "My Active Reviews",
    description: "Work on claimed requests and submit your expert reviews.",
  },
  {
    targetSelector: '[data-testid="expert-nav-earnings"]',
    title: "Track Your Earnings",
    description: "Track your earnings and withdraw funds here.",
  },
];
