import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import termsUrl from "@assets/terms-of-use.pdf";
import privacyUrl from "@assets/privacy-policy.pdf";

function PDFRedirectPage({ title, pdfPath, downloadName }: { title: string; pdfPath: string; downloadName: string }) {
  // Auto-open PDF in new tab on mount
  useEffect(() => {
    window.open(pdfPath, "_blank");
  }, [pdfPath]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-[#0F3DD1]/10 flex items-center justify-center mx-auto mb-6">
          <FileText className="h-8 w-8 text-[#0F3DD1]" />
        </div>
        <h1 className="text-xl font-bold text-[#111827] mb-2">{title}</h1>
        <p className="text-sm text-[#6B7280] mb-6">The document should have opened in a new tab. If it didn't, use the buttons below.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <a href={pdfPath} target="_blank" rel="noopener noreferrer">
            <Button className="gap-2 bg-gradient-to-br from-[#0F3DD1] to-[#171717] text-white w-full sm:w-auto" data-testid="button-open-pdf">
              <ExternalLink className="h-4 w-4" /> Open PDF
            </Button>
          </a>
          <a href={pdfPath} download={downloadName}>
            <Button variant="outline" className="gap-2 w-full sm:w-auto" data-testid="button-download-pdf">
              <Download className="h-4 w-4" /> Download
            </Button>
          </a>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-[#6B7280]" data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <PDFRedirectPage
      title="Terms of Use — A2A Global Inc."
      pdfPath={termsUrl}
      downloadName="TERMS-OF-USE-A2A-Global-Inc-Apr-2026.pdf"
    />
  );
}

export function PrivacyPage() {
  return (
    <PDFRedirectPage
      title="Privacy Policy — A2A Global Inc."
      pdfPath={privacyUrl}
      downloadName="PRIVACY-POLICY-A2A-Global-Inc-Apr-2026.pdf"
    />
  );
}

export function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-[#6B7280]" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
        <article style={{ fontFamily: "Inter, sans-serif" }}>
          <h1 className="text-2xl font-bold text-[#111827] mb-2">Cookie Policy</h1>
          <p className="text-sm text-[#6B7280] mb-8">A2A Global Inc. · Last updated: April 2026</p>
          <h2 className="text-lg font-semibold text-[#111827] mt-8 mb-3">1. What Are Cookies</h2>
          <p className="text-sm text-[#374151] leading-relaxed mb-3">Cookies are small text files placed on your device when you visit our platform. They help us provide you with a better experience by remembering your preferences and understanding how you use our service.</p>
          <h2 className="text-lg font-semibold text-[#111827] mt-8 mb-3">2. Essential Cookies</h2>
          <p className="text-sm text-[#374151] leading-relaxed mb-3">These cookies are strictly necessary for the platform to function. They enable core features such as user authentication, session management, and security.</p>
          <h2 className="text-lg font-semibold text-[#111827] mt-8 mb-3">3. Functional Cookies</h2>
          <p className="text-sm text-[#374151] leading-relaxed mb-3">Functional cookies remember your preferences and settings to enhance your experience.</p>
          <h2 className="text-lg font-semibold text-[#111827] mt-8 mb-3">4. Analytics Cookies</h2>
          <p className="text-sm text-[#374151] leading-relaxed mb-3">Analytics cookies help us understand how visitors interact with our platform. We will request your consent before setting analytics cookies.</p>
          <h2 className="text-lg font-semibold text-[#111827] mt-8 mb-3">5. Managing Cookies</h2>
          <p className="text-sm text-[#374151] leading-relaxed mb-3">You can control and manage cookies through your browser settings. Disabling essential cookies may affect platform functionality.</p>
          <h2 className="text-lg font-semibold text-[#111827] mt-8 mb-3">6. Contact</h2>
          <p className="text-sm text-[#374151] leading-relaxed mb-3">For questions about our cookie practices, contact us at privacy@a2a.global.</p>
        </article>
        <div className="mt-12 pt-6 border-t text-xs text-[#9CA3AF]">
          <p>© 2026 A2A Global Inc. — Delaware C-Corp (File No. 10050200)</p>
        </div>
      </div>
    </div>
  );
}
