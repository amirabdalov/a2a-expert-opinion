import { useState } from "react";
import { MessageSquare, X, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Build 45 — Bug #3: Global "Feedback F" pill button.
 *
 * - Top-right header placement (callers position it).
 * - Click → popover with textarea, Send button, support contact footer.
 * - Submits to POST /api/feedback (userOrAdminAuth). Shows reference number toast on success.
 * - Also available to admins (userOrAdminAuth accepts admin tokens).
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    if (trimmed.length > 5000) {
      toast({ title: "Too long", description: "Please keep feedback under 5000 characters.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/feedback", {
        message: trimmed,
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
      });
      const data = await res.json();
      if (data?.error) {
        throw new Error(data.message || "Failed to send feedback");
      }
      toast({
        title: "Feedback received",
        description: `Reference: ${data.referenceNumber || "saved"}. Thank you — we will act on it.`,
      });
      setMessage("");
      setOpen(false);
    } catch (e: any) {
      toast({
        title: "Could not send feedback",
        description: e?.message || "Please try again or email support@a2a.global.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative" data-testid="feedback-button-root">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors"
        data-testid="button-feedback"
        aria-label="Send feedback"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Feedback
      </button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => !submitting && setOpen(false)}
            data-testid="feedback-overlay"
          />
          <div
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-background border rounded-lg shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            data-testid="feedback-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Send feedback</h3>
              <button
                onClick={() => !submitting && setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
                data-testid="feedback-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Have an idea how to improve this page? Tell us and we will act on it."
              className="w-full h-28 resize-none text-sm p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={5000}
              disabled={submitting}
              data-testid="feedback-textarea"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">{message.length}/5000</span>
              <button
                onClick={handleSend}
                disabled={submitting || !message.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                data-testid="feedback-send"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground leading-relaxed">
              Need help? Contact{" "}
              <a
                href="mailto:support@a2a.global"
                className="text-blue-600 hover:underline"
                data-testid="feedback-support-email"
              >
                support@a2a.global
              </a>{" "}
              or call{" "}
              <a
                href="tel:+13026210214"
                className="text-blue-600 hover:underline"
                data-testid="feedback-support-phone"
              >
                +1 (302) 621-0214
              </a>
              .
            </div>
          </div>
        </>
      )}
    </div>
  );
}
