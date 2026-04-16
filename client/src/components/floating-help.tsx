import { useState } from "react";
import { HelpCircle, Mail, Phone, ExternalLink, X } from "lucide-react";

export function FloatingHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50" data-testid="floating-help">
      {/* Popover */}
      {open && (
        <div
          className="absolute bottom-14 right-0 w-64 bg-background border rounded-lg shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-150"
          data-testid="help-popover"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Need help?</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="help-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <a
              href="mailto:support@a2a.global"
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              data-testid="help-email"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">support@a2a.global</p>
              </div>
            </a>

            <a
              href="tel:+13026210214"
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              data-testid="help-phone"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium text-foreground">+1 (302) 621-0214</p>
              </div>
            </a>

            <a
              href="/#/section-faq"
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              data-testid="help-faq"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = "/#/";
                setTimeout(() => {
                  document.getElementById("section-faq")?.scrollIntoView({ behavior: "smooth" });
                }, 300);
                setOpen(false);
              }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Help Center</p>
                <p className="text-sm font-medium text-foreground">FAQ</p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        data-testid="button-help"
        aria-label="Help"
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
