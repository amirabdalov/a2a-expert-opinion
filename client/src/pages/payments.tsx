import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, ArrowRight, Globe, Shield, Zap, Clock, DollarSign, Users, FileText, CheckCircle2, ChevronRight } from "lucide-react";
import logoSrc from "@assets/a2a-blue-logo.svg";

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="page-payments">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoSrc} alt="A2A Global" className="h-8" />
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/"><Button variant="ghost" size="sm">Expert Opinion</Button></Link>
            <Link href="/register"><Button size="sm" className="bg-[#0F3DD1]">Get Started</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#f0f4ff] to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#0F3DD1]/10 text-[#0F3DD1] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Globe className="w-4 h-4" /> Cross-Border Payments
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Receive USD Payments<br />Instantly in India
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            A2A Global enables freelancers and experts worldwide to generate payment links and receive cross-border payments from US clients via licensed payment partners.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-[#0F3DD1] to-[#171717] text-white px-8">
                Create Payment Link <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12 text-gray-900">Why A2A Global Payments</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: "10X Faster", desc: "Receive payments in hours, not weeks. Direct corridor from US to India." },
              { icon: DollarSign, title: "Zero Fees", desc: "No hidden charges. LIVE FX rate with zero markup on currency conversion." },
              { icon: Shield, title: "Licensed Partners", desc: "All payments processed through regulated, licensed payment service providers." },
              { icon: Clock, title: "Instant FIRA", desc: "Get your Foreign Inward Remittance Advice certificate automatically." },
              { icon: Users, title: "For Freelancers", desc: "Built for independent professionals working with US companies." },
              { icon: FileText, title: "Compliant", desc: "Fully compliant with RBI regulations and US payment laws." },
            ].map((f, i) => (
              <Card key={i} className="border-gray-200">
                <CardContent className="pt-6">
                  <f.icon className="w-8 h-8 text-[#0F3DD1] mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12 text-gray-900">How It Works</h2>
          <div className="space-y-6">
            {[
              { step: "1", title: "Register on A2A Global", desc: "Create your account with email verification. No paperwork needed to start." },
              { step: "2", title: "Generate a Payment Link", desc: "Create a secure payment link for your US client. Set the amount in USD." },
              { step: "3", title: "Client Pays in USD", desc: "Your client clicks the link and pays via card or bank transfer." },
              { step: "4", title: "Receive in INR", desc: "Funds arrive in your Indian bank account at the live FX rate. FIRA issued automatically." },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#0F3DD1] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to Get Paid?</h2>
          <p className="text-gray-600 mb-6">Join thousands of Indian freelancers receiving payments from US clients.</p>
          <Link href="/register">
            <Button size="lg" className="bg-gradient-to-r from-[#0F3DD1] to-[#171717] text-white px-8">
              Start Receiving Payments <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-8">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            Connecting businesses with AI experts worldwide. Secure cross-border payments included.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            © 2026 A2A Global Inc. All rights reserved. File number 10050200, Newark, Delaware, United States.
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <Link href="/terms" className="text-xs text-[#0F3DD1] hover:underline">Terms of Use</Link>
            <Link href="/privacy" className="text-xs text-[#0F3DD1] hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
