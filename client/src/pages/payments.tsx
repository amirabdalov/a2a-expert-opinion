import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowRight, Globe, ExternalLink } from "lucide-react";
import logoSrc from "@assets/a2a-blue-logo.svg";

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-payments">
      {/* Nav */}
      <nav className="border-b bg-background px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoSrc} alt="A2A Global" className="h-8" />
              <span className="font-display font-bold text-base">Expert Opinion</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3">A2A Global Payments</h1>
          <p className="text-muted-foreground mb-8">
            Cross-border payment infrastructure for global freelancers
          </p>
          <div className="bg-gradient-to-b from-[#DAE3FF] to-white dark:from-primary/10 dark:to-card border border-[#E5E7EB] rounded-xl p-8 mb-6">
            <Globe className="h-10 w-10 text-primary mx-auto mb-4 opacity-60" />
            <p className="text-sm text-muted-foreground mb-4">
              A2A Global provides seamless cross-border payment solutions, enabling freelancers and experts worldwide to receive payments quickly and securely.
            </p>
            <a href="https://a2a.global" target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white hover:opacity-90" data-testid="button-visit-a2a">
                Visit a2a.global for payment services
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
