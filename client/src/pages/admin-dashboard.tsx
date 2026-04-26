import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FloatingHelp } from "@/components/floating-help";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, safeArray, getFileDownloadUrl, downloadFile } from "@/lib/queryClient";
import { formatCentralTime } from "@/lib/utils";
import { getAdmin, setAdmin, clearAdmin } from "./admin-login";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Users, GraduationCap, FileText, CreditCard,
  ArrowDownUp, Settings, Bell, LogOut, Search, Plus, Ban,
  CheckCircle2, XCircle, ChevronRight, TrendingUp, DollarSign,
  UserCheck, ClipboardList, PieChart, Activity, RefreshCw, Clock, Timer, BarChart3, Gauge,
  Command, ShieldCheck, MessageSquare, AlertCircle, Download, Paperclip,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
  PieChart as RechartsPieChart, Pie, Cell,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

type AdminPage = "dashboard" | "users" | "experts" | "requests" | "transactions" | "withdrawals" | "notifications" | "settings" | "intelligence" | "acquisition" | "review_queue" | "feedback";

const NAV_ITEMS: Array<{ id: AdminPage; label: string; icon: any; badgeKey?: string }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "review_queue", label: "Review Queue", icon: ShieldCheck, badgeKey: "pending_reviews" },
  { id: "users", label: "Users", icon: Users },
  { id: "experts", label: "Experts", icon: GraduationCap },
  { id: "requests", label: "Requests", icon: FileText },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowDownUp },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "intelligence", label: "RL Core & BI", icon: Activity },
  { id: "acquisition", label: "Acquisition", icon: BarChart3 },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
];

// Fix 12: Build chart data from real API data
function buildChartDataFromReal(
  requests: any[] | undefined,
  transactions: any[] | undefined
): Array<{ date: string; requests: number; revenue: number; payouts: number }> {
  const last30Days: Array<{ date: string; label: string }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isoDate = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    last30Days.push({ date: isoDate, label });
  }

  const safeReqs = safeArray(requests);
  const safeTxns = safeArray(transactions);

  return last30Days.map(({ date, label }) => {
    const reqs = safeReqs.filter((r: any) => {
      const created = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : null;
      return created === date;
    }).length;
    const rev = safeTxns.filter((t: any) => {
      const created = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : null;
      return created === date && t.amount > 0;
    }).reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const pay = safeTxns.filter((t: any) => {
      const created = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : null;
      return created === date && t.amount < 0;
    }).reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
    return { date: label, requests: reqs, revenue: rev, payouts: pay };
  });
}

// ─── Cmd+K Command Palette Actions (change #14) ───
const CMD_K_ACTIONS: Array<{ label: string; action: AdminPage | "credits"; icon: any }> = [
  { label: "Add credits to user", action: "credits", icon: Plus },
  { label: "Approve withdrawal", action: "withdrawals", icon: ArrowDownUp },
  { label: "Reassign request", action: "requests", icon: FileText },
  { label: "View user profile", action: "users", icon: Users },
  { label: "View expert profile", action: "experts", icon: GraduationCap },
  { label: "Check transactions", action: "transactions", icon: CreditCard },
  { label: "Platform settings", action: "settings", icon: Settings },
];

function CommandPalette({ open, onClose, onAction }: { open: boolean; onClose: () => void; onAction: (action: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = CMD_K_ACTIONS.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" data-testid="command-palette">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-zinc-100 text-sm outline-none placeholder:text-zinc-500"
            data-testid="command-palette-input"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">No results found</p>
          ) : filtered.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                onClick={() => { onAction(action.action); onClose(); }}
                data-testid={`cmd-action-${action.label.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <Icon className="h-4 w-4 text-zinc-500" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Error Boundary ───
class AdminErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Admin Panel Error</h2>
          <p className="text-red-500 mb-4">{this.state.error}</p>
          <button
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const admin = getAdmin();
  const [page, setPage] = useState<AdminPage>("dashboard");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  useEffect(() => {
    if (!admin) setLocation("/admin/login");
  }, [admin]);

  // Fetch pending review count for badge
  const { data: pendingReviews } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-reviews"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pending-reviews");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const pendingReviewCount = safeArray(pendingReviews).length;

  // Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen(prev => !prev);
      }
      if (e.key === "Escape" && cmdkOpen) {
        setCmdkOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cmdkOpen]);

  const handleCmdAction = useCallback((action: string) => {
    if (action === "credits") {
      setPage("users");
    } else {
      setPage(action as AdminPage);
    }
  }, []);

  if (!admin) return null;

  return (
    <AdminErrorBoundary>
    {/* Build 45.6: scoped light theme override — remaps zinc dark palette to light */}
    <style>{`
      [data-admin-theme="light"] { background-color: #ffffff; color: #18181b; }
      [data-admin-theme="light"] .bg-zinc-950 { background-color: #ffffff !important; }
      [data-admin-theme="light"] .bg-zinc-900 { background-color: #ffffff !important; }
      [data-admin-theme="light"] .bg-zinc-800 { background-color: #f4f4f5 !important; }
      [data-admin-theme="light"] .bg-zinc-700 { background-color: #e4e4e7 !important; }
      [data-admin-theme="light"] .bg-zinc-600 { background-color: #d4d4d8 !important; }
      [data-admin-theme="light"] .hover\:bg-zinc-800:hover { background-color: #f4f4f5 !important; }
      [data-admin-theme="light"] .hover\:bg-zinc-700:hover { background-color: #e4e4e7 !important; }
      [data-admin-theme="light"] .bg-zinc-800\/50 { background-color: rgba(244,244,245,0.6) !important; }
      [data-admin-theme="light"] .bg-zinc-800\/60 { background-color: rgba(244,244,245,0.7) !important; }
      [data-admin-theme="light"] .text-zinc-100 { color: #18181b !important; }
      [data-admin-theme="light"] .text-zinc-200 { color: #27272a !important; }
      [data-admin-theme="light"] .text-zinc-300 { color: #3f3f46 !important; }
      [data-admin-theme="light"] .text-zinc-400 { color: #52525b !important; }
      [data-admin-theme="light"] .text-zinc-500 { color: #71717a !important; }
      [data-admin-theme="light"] .text-zinc-600 { color: #52525b !important; }
      [data-admin-theme="light"] .text-zinc-700 { color: #3f3f46 !important; }
      [data-admin-theme="light"] .hover\:text-zinc-100:hover { color: #18181b !important; }
      [data-admin-theme="light"] .hover\:text-zinc-300:hover { color: #3f3f46 !important; }
      [data-admin-theme="light"] .border-zinc-700 { border-color: #e4e4e7 !important; }
      [data-admin-theme="light"] .border-zinc-800 { border-color: #e4e4e7 !important; }
      [data-admin-theme="light"] .divide-zinc-800 > :not([hidden]) ~ :not([hidden]) { border-color: #e4e4e7 !important; }
      [data-admin-theme="light"] .placeholder\:text-zinc-500::placeholder { color: #a1a1aa !important; }
    `}</style>
    <div data-admin-theme="light" className="flex h-screen bg-white text-zinc-900" data-testid="admin-dashboard">
      {/* Command Palette */}
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} onAction={handleCmdAction} />

      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col" data-testid="admin-sidebar">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">A2A Admin</div>
              <div className="text-xs text-zinc-500">{admin.email}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            const badge = item.badgeKey === "pending_reviews" ? pendingReviewCount : 0;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-teal-500/10 text-teal-400 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        {/* Cmd+K hint */}
        <div className="px-3 py-2">
          <button
            onClick={() => setCmdkOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            data-testid="button-cmdk-hint"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Quick Actions</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">⌘K</kbd>
          </button>
        </div>
        <div className="p-2 border-t border-zinc-800">
          <button
            data-testid="button-admin-logout"
            onClick={() => { clearAdmin(); setLocation("/admin/login"); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {page === "dashboard" && <DashboardOverview />}
          {page === "review_queue" && <ReviewQueuePanel />}
          {page === "users" && <UsersPage />}
          {page === "experts" && <ExpertsPage />}
          {page === "requests" && <RequestsPage />}
          {page === "transactions" && <TransactionsPage />}
          {page === "withdrawals" && <WithdrawalsPage />}
          {page === "notifications" && <NotificationsPage />}
          {page === "settings" && <SettingsPage />}
          {page === "intelligence" && <IntelligencePage />}
          {page === "acquisition" && <AcquisitionPanel />}
          {page === "feedback" && <FeedbackPage />}
        </div>
      </main>
    </div>
    </AdminErrorBoundary>
  );
}

// Build 45.6.11 (OB 2026-04-26): Map serviceType code to the same label
// the client sees when submitting the request, so admin reviewers see the
// same wording as the client. Mirrors `serviceTypeLabel` in client-dashboard.tsx.
function adminServiceTypeLabel(t?: string): string {
  switch ((t || "").toLowerCase()) {
    case "sense_check": return "Sense Check";
    case "prompt_calibration": return "Prompt Calibration";
    case "full_review": return "Full Review";
    case "other": return "Other";
    case "rate": return "Rate";
    case "review": return "Review";
    default: return t ? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Not specified";
  }
}

// ─── Review Queue Panel ───
function ReviewQueuePanel() {
  const { toast } = useToast();
  const { data: pendingItems, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-reviews"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pending-reviews");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const [feedbackMap, setFeedbackMap] = useState<Record<number, string>>({});
  const [showFeedbackFor, setShowFeedbackFor] = useState<number | null>(null);

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/admin/reviews/${requestId}/approve`, {});
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Response sent to client." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-reviews"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, feedback }: { requestId: number; feedback: string }) => {
      const res = await apiRequest("POST", `/api/admin/reviews/${requestId}/reject`, { feedback });
      if (!res.ok) throw new Error("Failed to request revision");
      return res.json();
    },
    onSuccess: (_data, { requestId }) => {
      toast({ title: "Revision Requested", description: "Expert has been notified." });
      setShowFeedbackFor(null);
      setFeedbackMap(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-reviews"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div data-testid="review-queue-panel">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
          Review Queue
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Expert responses awaiting A2A quality verification before delivery to clients.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-40 bg-zinc-800 animate-pulse rounded-lg" />)}
        </div>
      ) : safeArray(pendingItems).length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-zinc-300 font-medium">All clear!</p>
          <p className="text-zinc-500 text-sm mt-1">No responses pending review right now.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {safeArray(pendingItems).map((item: any) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden" data-testid={`review-item-${item.id}`}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-zinc-500 capitalize">{item.category}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-zinc-400">Client: <span className="text-zinc-300">{item.clientName}</span></span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-zinc-400">Expert: <span className="text-zinc-300">{item.expertName}</span></span>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <ShieldCheck className="h-3 w-3" /> Under Review
                  </span>
                </div>
              </div>

              {/* Build 45.6.11 (OB 2026-04-26): Original client request fields,
                  shown to admin reviewers so they can verify the expert's response
                  against the question, AI output, and any expert instructions.
                  Each field renders only when populated to keep the card compact. */}
              {(item.serviceType || item.serviceCategory || (item.description && String(item.description).trim()) || (item.aiResponse && String(item.aiResponse).trim()) || item.llmProvider || item.llmModel || (item.instructions && String(item.instructions).trim())) && (
                <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-900/40">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Original Client Request
                  </p>
                  <div className="space-y-3">
                    {(item.serviceType || item.serviceCategory) && (
                      <div data-testid={`review-${item.id}-service-type`}>
                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Service type</p>
                        <p className="text-sm text-zinc-200">
                          {adminServiceTypeLabel(item.serviceType)}
                          {item.serviceCategory ? <span className="text-zinc-500"> &middot; <span className="capitalize">{item.serviceCategory}</span></span> : null}
                        </p>
                      </div>
                    )}
                    {item.description && String(item.description).trim() && (
                      <div data-testid={`review-${item.id}-description`}>
                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">My question</p>
                        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                          <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">{item.description}</pre>
                        </div>
                      </div>
                    )}
                    {item.aiResponse && String(item.aiResponse).trim() && (
                      <div data-testid={`review-${item.id}-ai-response`}>
                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">AI response submitted for verification</p>
                        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                          <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">{item.aiResponse}</pre>
                        </div>
                      </div>
                    )}
                    {(item.llmProvider || item.llmModel) && (
                      <div data-testid={`review-${item.id}-llm`}>
                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Which AI generated this</p>
                        <p className="text-sm text-zinc-200">
                          {[item.llmProvider, item.llmModel].filter(Boolean).join(" \u00B7 ") || <span className="text-zinc-500 italic">Not specified</span>}
                        </p>
                      </div>
                    )}
                    {item.instructions && String(item.instructions).trim() && (
                      <div data-testid={`review-${item.id}-instructions`}>
                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-1">Instructions for expert</p>
                        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                          <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">{item.instructions}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Expert Response */}
              <div className="px-5 py-4 border-t border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Expert Response
                </p>
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {item.expertResponse || <span className="text-zinc-500 italic">No response text found</span>}
                  </pre>
                </div>
              </div>

              {/* BUG-2 fix: Expert file attachments */}
              {safeArray(item.fileAttachments).length > 0 && (
                <div className="px-5 py-3 border-t border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Attachments ({item.fileAttachments.length})
                  </p>
                  <div className="space-y-1.5">
                    {safeArray(item.fileAttachments).map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => downloadFile(`/api/files/${item.id}/${encodeURIComponent(f.filename)}`, f.filename)}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline text-sm cursor-pointer bg-transparent border-0 p-0 text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        {f.filename} <span className="text-zinc-500">({(f.size / 1024).toFixed(1)} KB)</span>
                        {/* Build 44 Fix 4 (OB 2026-04-21): label both Client and Expert uploads (previously only Expert was tagged). */}
                        {f.uploader_role === 'expert' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/30">Expert</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">Client</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 py-4 border-t border-zinc-800 flex flex-col gap-3">
                {showFeedbackFor === item.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <p className="text-sm font-medium text-zinc-200">Feedback for expert (required):</p>
                    </div>
                    <Textarea
                      value={feedbackMap[item.id] || ""}
                      onChange={(e) => setFeedbackMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Explain what needs to be revised..."
                      rows={3}
                      className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 resize-none"
                      data-testid={`feedback-textarea-${item.id}`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => rejectMutation.mutate({ requestId: item.id, feedback: feedbackMap[item.id] || "" })}
                        disabled={rejectMutation.isPending || !(feedbackMap[item.id] || "").trim()}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                        data-testid={`button-reject-confirm-${item.id}`}
                      >
                        {rejectMutation.isPending ? "Sending..." : "Send Revision Request"}
                      </button>
                      <button
                        onClick={() => setShowFeedbackFor(null)}
                        className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => approveMutation.mutate(item.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                      data-testid={`button-approve-${item.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve &amp; Send to Client
                    </button>
                    <button
                      onClick={() => setShowFeedbackFor(item.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 text-red-400 text-sm font-medium transition-colors"
                      data-testid={`button-reject-${item.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                      Request Revision
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top-Up Requests (soft launch — bank transfer) */}
      <TopUpRequestsSection />

      {/* 2nd-Priority Fix 9: Action History/Journal */}
      <AdminActionJournal />
    </div>
  );
}

// ─── Acquisition Panel ───

const TRAFFIC_COLORS: Record<string, string> = {
  organic: "#22c55e",
  referral: "#3b82f6",
  paid: "#f97316",
  news: "#a855f7",
  direct: "#6b7280",
};

function AcquisitionPanel() {
  const [sortCol, setSortCol] = useState<"count" | "source" | "medium" | "campaign">("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/admin/acquisition"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/acquisition");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
        <span className="ml-2 text-zinc-400 text-sm">Loading acquisition data...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        <XCircle className="w-5 h-5 mr-2" />
        Failed to load acquisition data.
      </div>
    );
  }

  const { summary = {}, bySource = [], topPages = [], dailyRegs = [], newsViews = 0 } = data;

  // Build traffic sources pie data
  const trafficSources = [
    { name: "Organic", value: summary.fromOrganic ?? 0, color: TRAFFIC_COLORS.organic },
    { name: "Referral", value: summary.fromReferral ?? 0, color: TRAFFIC_COLORS.referral },
    { name: "Paid", value: summary.fromPaid ?? 0, color: TRAFFIC_COLORS.paid },
    { name: "News Section", value: summary.fromNews ?? 0, color: TRAFFIC_COLORS.news },
    { name: "Direct", value: summary.fromDirect ?? 0, color: TRAFFIC_COLORS.direct },
  ].filter(s => s.value > 0);

  const totalTraffic = trafficSources.reduce((s, x) => s + x.value, 0);

  const newsConversionRate =
    newsViews > 0 ? ((summary.fromNews ?? 0) / newsViews * 100).toFixed(2) : "0.00";

  // Sorted sources table
  const sortedBySource = [...(bySource || [])].sort((a: any, b: any) => {
    const valA = sortCol === "count" ? (a.count ?? 0) : (a[sortCol] ?? "").toString();
    const valB = sortCol === "count" ? (b.count ?? 0) : (b[sortCol] ?? "").toString();
    if (typeof valA === "number") {
      return sortDir === "desc" ? valB - valA : valA - valB;
    }
    return sortDir === "desc"
      ? valB.localeCompare(valA)
      : valA.localeCompare(valB);
  });

  const handleSort = (col: "count" | "source" | "medium" | "campaign") => {
    if (sortCol === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const kpis = [
    {
      label: "Total Experts",
      value: summary.totalExperts ?? 0,
      target: "Goal: 1,000/day",
      icon: GraduationCap,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
    {
      label: "Total Clients",
      value: summary.totalClients ?? 0,
      target: "Goal: 100/day",
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "30d Registrations",
      value: summary.totalRegs30d ?? 0,
      target: "",
      icon: TrendingUp,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Conversion Rate",
      value: summary.conversionRate ?? "0%",
      target: "Views → Registrations",
      icon: BarChart3,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6" data-testid="acquisition-panel">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">User Acquisition</h1>
        <p className="text-sm text-zinc-400 mt-1">Traffic sources, registration trends, and conversion analytics.</p>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-zinc-100">
                  {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">{kpi.label}</div>
                {kpi.target && (
                  <div className="text-xs text-zinc-600 mt-1">{kpi.target}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Row 2: Traffic Sources Pie Chart + Row 3: Daily Registrations Line Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Traffic Sources Donut */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Traffic Sources (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {trafficSources.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPieChart>
                  <Pie
                    data={trafficSources}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ name, value }) =>
                      totalTraffic > 0
                        ? `${name} ${((value / totalTraffic) * 100).toFixed(0)}%`
                        : name
                    }
                    labelLine={true}
                  >
                    {trafficSources.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} (${totalTraffic > 0 ? ((value / totalTraffic) * 100).toFixed(1) : 0}%)`,
                      name,
                    ]}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7" }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2">
              {trafficSources.map(s => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Registrations Line Chart */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Daily Registrations (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {(!dailyRegs || dailyRegs.length === 0) ? (
              <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyRegs} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#27272a" }}
                    interval={Math.max(0, Math.floor(dailyRegs.length / 7) - 1)}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#27272a" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7" }}
                    labelFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#14b8a6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: News Section Performance */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-violet-400" />
            News Section Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-zinc-100">{(newsViews || 0).toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-0.5">News Page Views (30d)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-violet-400">{(summary.fromNews ?? 0).toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-0.5">Registrations from News</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-400">{newsConversionRate}%</div>
              <div className="text-xs text-zinc-500 mt-0.5">News Conversion Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 5: Top Traffic Sources Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Top Traffic Sources</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(!sortedBySource || sortedBySource.length === 0) ? (
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">No source data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {(["source", "medium", "campaign", "count"] as const).map(col => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide cursor-pointer hover:text-zinc-300 select-none"
                        onClick={() => handleSort(col)}
                      >
                        {col === "count" ? "Registrations" : col.charAt(0).toUpperCase() + col.slice(1)}
                        {sortCol === col && (
                          <span className="ml-1">{sortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBySource.slice(0, 20).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-300 font-medium">{row.source || "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{row.medium || "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {row.campaign ? (
                          <span className={row.campaign?.toLowerCase().includes("news") ? "text-violet-400 font-medium" : ""}>
                            {row.campaign}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-teal-400 font-medium">{(row.count ?? 0).toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 6: Top Pages Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Top Pages (7d)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(!topPages || topPages.length === 0) ? (
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">No page data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Page</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Views (7d)</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.slice(0, 15).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-300 font-mono text-xs">{row.page || row.path || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-blue-400 font-medium">{(row.views ?? row.count ?? 0).toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 7: UTM Campaign Breakdown */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Registration Source Breakdown by UTM Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          {(!sortedBySource || sortedBySource.length === 0) ? (
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">No UTM data</div>
          ) : (
            <div className="space-y-2">
              {sortedBySource
                .filter((row: any) => row.campaign)
                .slice(0, 15)
                .map((row: any, i: number) => {
                  const isNews = (row.campaign ?? "").toLowerCase().includes("news") ||
                    (row.source ?? "").toLowerCase().includes("news") ||
                    (row.medium ?? "").toLowerCase().includes("news");
                  const maxCount = sortedBySource[0]?.count ?? 1;
                  const pct = Math.max(2, Math.round(((row.count ?? 0) / maxCount) * 100));
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isNews ? "text-violet-400" : "text-zinc-300"}`}>
                            {row.campaign}
                          </span>
                          {isNews && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-violet-500/20 text-violet-400 border-0">News</Badge>
                          )}
                          <span className="text-zinc-600">{row.source}{row.medium ? ` / ${row.medium}` : ""}</span>
                        </div>
                        <span className="font-mono text-zinc-300">{(row.count ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isNews ? "#a855f7" : "#14b8a6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Dashboard Overview ───

const PIE_COLORS = ["#14b8a6", "#a78bfa", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

interface AdminMetrics {
  avgTimeToClaim: number;
  avgTimeToComplete: number;
  expertUtilization: number;
  supplyDemandRatio: number | string;
  categoryStats: Array<{ category: string; pending: number; available: number; total: number }>;
}

function OperationalMetrics() {
  const { data: metrics } = useQuery<AdminMetrics>({
    queryKey: ["/api/admin/metrics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/metrics");
      return res.json();
    },
  });

  if (!metrics) return null;

  // Derive chart data from categoryStats
  const requestsByCategory = (metrics.categoryStats || []).map(c => ({ category: c.category, count: c.total }));
  const supplyDemandByCategory = (metrics.categoryStats || []).map(c => ({ category: c.category, pendingRequests: c.pending, activeExperts: c.available }));

  const opsKpis = [
    {
      label: "Avg Time to Claim",
      value: `${metrics.avgTimeToClaim.toFixed(0)} min`,
      icon: Timer,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Avg Time to Complete",
      value: `${metrics.avgTimeToComplete.toFixed(0)} min`,
      icon: Clock,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Expert Utilization",
      value: `${metrics.expertUtilization.toFixed(0)}%`,
      icon: Activity,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    {
      label: "Supply / Demand",
      value: Number(metrics.supplyDemandRatio).toFixed(2),
      icon: BarChart3,
      color: "text-pink-400",
      bg: "bg-pink-500/10",
    },
  ];

  return (
    <div className="mb-6" data-testid="admin-operational-metrics">
      <h2 className="text-sm font-semibold text-zinc-300 mb-3">Operational Metrics</h2>

      {/* Ops KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {opsKpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <div className="text-lg font-bold text-zinc-100" data-testid={`metric-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>{kpi.value}</div>
                <div className="text-xs text-zinc-500">{kpi.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row: Pie + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Requests by Category — Pie Chart */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Requests by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RechartsPieChart>
                <Pie
                  data={requestsByCategory}
                  dataKey="count"
                  nameKey="category"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  label={({ category, count }: any) => `${category} (${count})`}
                  labelLine={false}
                >
                  {requestsByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7" }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Supply/Demand by Category — Bar Chart */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Supply vs Demand by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={supplyDemandByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="category" tick={{ fill: "#71717a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7" }} />
                <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
                <Bar dataKey="pendingRequests" name="Pending Requests" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="activeExperts" name="Active Experts" fill="#14b8a6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/admin/stats"] });
  // Fix 12: Fetch real data for charts
  const { data: allRequests } = useQuery<any[]>({ queryKey: ["/api/admin/requests"] });
  const { data: allTransactions } = useQuery<any[]>({ queryKey: ["/api/admin/transactions"] });

  const chartData = buildChartDataFromReal(allRequests, allTransactions);
  const hasChartData = chartData.some(d => d.requests > 0 || d.revenue > 0);

  // Fix 11: Remove "cr" from Total Revenue — show as $X.XX
  const kpis = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Verified Experts", value: `${stats?.verifiedExperts ?? "—"} / ${stats?.totalExperts ?? "—"}`, icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Active Requests", value: stats?.activeRequests ?? "—", icon: ClipboardList, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Total Revenue", value: `$${(stats?.totalRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-teal-400", bg: "bg-teal-500/10" },
    { label: "Total Payouts", value: `$${((stats?.totalPayouts ?? 0) / 100).toFixed(2)}`, icon: ArrowDownUp, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Avg Take Rate", value: `${((stats?.avgTakeRate ?? 0) * 100).toFixed(0)}%`, icon: PieChart, color: "text-rose-400", bg: "bg-rose-500/10" },
  ];

  return (
    <div data-testid="admin-overview">
      <h1 className="text-lg font-semibold mb-4">Dashboard Overview</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <div className="text-lg font-bold text-zinc-100">{kpi.value}</div>
                <div className="text-xs text-zinc-500">{kpi.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Operational Metrics */}
      <OperationalMetrics />

      {/* Charts — Fix 12: Use real data, show empty state if none */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Requests / Day (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasChartData ? (
              <div className="h-[220px] flex items-center justify-center text-zinc-500 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7" }} />
                  <Area type="monotone" dataKey="requests" stroke="#14b8a6" fill="url(#reqGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Revenue vs Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasChartData ? (
              <div className="h-[220px] flex items-center justify-center text-zinc-500 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7" }} />
                  <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue ($)" fill="#14b8a6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="payouts" name="Payouts ($)" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivity />
        </CardContent>
      </Card>
    </div>
  );
}

function RecentActivity() {
  const { data: notifications } = useQuery<any[]>({ queryKey: ["/api/admin/notifications"] });
  const items = safeArray(notifications).slice(0, 10);
  if (items.length === 0) return <p className="text-sm text-zinc-500">No recent activity</p>;
  return (
    <div className="space-y-2">
      {items.map((n: any) => (
        <div key={n.id} className="flex items-start gap-3 py-2 border-b border-zinc-800 last:border-0">
          <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-200">{n.title}</div>
            <div className="text-xs text-zinc-500 truncate">{n.message}</div>
          </div>
          <div className="text-xs text-zinc-600 shrink-0">{n.userName}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Users Page ───

function UsersPage() {
  const { toast } = useToast();
  const { data: users } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("10");

  const addCreditsMut = useMutation({
    mutationFn: (data: { id: number; amount: number }) =>
      apiRequest("POST", `/api/admin/users/${data.id}/add-credits`, { amount: data.amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Credits added" });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deactivated" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/users/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User activated" });
    },
  });

  const filtered = safeArray(users).filter((u: any) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Build 45.6.7: Totals for Users table
  const totalUsers = filtered.length;
  const totalCredits = filtered.reduce((s: number, u: any) => s + (u.credits || 0), 0);
  const totalWalletCents = filtered.reduce((s: number, u: any) => s + (u.walletBalance || 0), 0);
  const activeUsers = filtered.filter((u: any) => u.active !== 0).length;

  return (
    <div data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Users</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            data-testid="input-user-search"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Build 45.6.7: Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="users-totals">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-teal-400" data-testid="total-users-count">{totalUsers}</div>
            <div className="text-xs text-zinc-500">Total Users</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">{activeUsers}</div>
            <div className="text-xs text-zinc-500">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{totalCredits.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Total Credits</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-blue-400">${(totalWalletCents / 100).toFixed(2)}</div>
            <div className="text-xs text-zinc-500">Total Wallet</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Username</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-right px-4 py-3">Credits</th>
                <th className="text-right px-4 py-3">Wallet</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-user-${u.id}`}>
                  <td className="px-4 py-3 text-zinc-500">#{u.id}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium"><span className="max-w-[200px] inline-block truncate align-bottom" title={u.name}>{u.name}</span></td>
                  <td className="px-4 py-3 text-zinc-400">{u.username}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === "expert" ? "default" : "secondary"} className="text-xs">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-200">{u.credits}</td>
                  <td className="px-4 py-3 text-right text-zinc-200">${((u.walletBalance || 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {u.active !== 0 ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Disabled</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-add-credits-${u.id}`}
                        className="h-7 text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                        onClick={() => setSelected(u)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Credits
                      </Button>
                      {u.active !== 0 ? (
                        <Button
                          size="sm" variant="ghost"
                          data-testid={`button-deactivate-${u.id}`}
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => deactivateMut.mutate(u.id)}
                        >
                          <Ban className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="ghost"
                          data-testid={`button-activate-${u.id}`}
                          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => activateMut.mutate(u.id)}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Credits Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Add Credits to {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-zinc-400">Credits to add</label>
              <Input
                type="number"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 mt-1"
                data-testid="input-credit-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)} className="text-zinc-400">Cancel</Button>
            <Button
              data-testid="button-confirm-add-credits"
              className="bg-teal-600 hover:bg-teal-500"
              onClick={() => {
                addCreditsMut.mutate({ id: selected!.id, amount: parseInt(creditAmount) || 0 });
                setSelected(null);
              }}
            >
              Add Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Experts Page ───

function ExpertsPage() {
  const { data: experts } = useQuery<any[]>({ queryKey: ["/api/admin/experts"] });
  const [catFilter, setCatFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");

  const filtered = safeArray(experts).filter((e: any) => {
    if (verifiedFilter === "verified" && !e.verified) return false;
    if (verifiedFilter === "unverified" && e.verified) return false;
    if (catFilter !== "all") {
      try {
        const cats = JSON.parse(e.categories || "[]");
        if (!cats.includes(catFilter)) return false;
      } catch { return false; }
    }
    return true;
  });

  // Build 45.6.7: Totals for Experts table
  const totalExperts = filtered.length;
  const verifiedCount = filtered.filter((e: any) => e.verified).length;
  const totalReviews = filtered.reduce((s: number, e: any) => s + (e.totalReviews || 0), 0);
  const ratingsWithReviews = filtered.filter((e: any) => (e.totalReviews || 0) > 0);
  const avgRating = ratingsWithReviews.length > 0
    ? (ratingsWithReviews.reduce((s: number, e: any) => s + ((e.rating || 0) / 10), 0) / ratingsWithReviews.length).toFixed(2)
    : "—";

  return (
    <div data-testid="admin-experts-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Experts</h1>
        <div className="flex items-center gap-2">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="entrepreneurship">Entrepreneurship</SelectItem>
            </SelectContent>
          </Select>
          <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Build 45.6.7: Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="experts-totals">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-teal-400" data-testid="total-experts-count">{totalExperts}</div>
            <div className="text-xs text-zinc-500">Total Experts</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">{verifiedCount}</div>
            <div className="text-xs text-zinc-500">Verified</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-blue-400">{totalReviews.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Total Reviews</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{avgRating}</div>
            <div className="text-xs text-zinc-500">Avg Rating</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Education</th>
                <th className="text-right px-4 py-3">Yrs Exp</th>
                <th className="text-left px-4 py-3">Categories</th>
                <th className="text-right px-4 py-3">Rate/hour</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-right px-4 py-3">Rating</th>
                <th className="text-left px-4 py-3">Verified</th>
                <th className="text-right px-4 py-3">Reviews</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => {
                let cats: string[] = [];
                try { cats = JSON.parse(e.categories || "[]"); } catch {}
                return (
                  <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-expert-${e.id}`}>
                    <td className="px-4 py-3 text-zinc-500">#{e.id}</td>
                    {/* Fix 13: Expert name clickable → public profile */}
                    <td className="px-4 py-3 text-zinc-200 font-medium">
                      <a
                        href={`/#/expert/profile/${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-teal-400 hover:underline transition-colors"
                        data-testid={`link-expert-profile-${e.id}`}
                      >
                        {e.userName}
                      </a>
                    </td>
                    {/* Build 45.6.6: Email column — mailto link + copy-on-click */}
                    <td className="px-4 py-3 text-zinc-300 text-xs">
                      {e.userEmail ? (
                        <a
                          href={`mailto:${e.userEmail}`}
                          className="hover:text-teal-400 hover:underline transition-colors break-all"
                          data-testid={`link-expert-email-${e.id}`}
                          title={e.userEmail}
                        >
                          {e.userEmail}
                        </a>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{e.education || "—"}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{e.yearsExperience}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {cats.map((c: string) => (
                          <Badge key={c} variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{c}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-200">${e.ratePerMinute || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300 capitalize">{e.rateTier || "—"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-200">{(e.rating / 10).toFixed(1)}</td>
                    <td className="px-4 py-3">
                      {e.verified ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Yes</Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">No</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{e.totalReviews}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Requests Page ───

function RequestsPage() {
  const { toast } = useToast();
  const { data: requests } = useQuery<any[]>({ queryKey: ["/api/admin/requests"] });
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  // Build 39 Fix: Fetch file attachments when a request is selected
  const { data: selectedFiles } = useQuery<Array<{ id: number; filename: string; content_type: string; size: number; created_at: string; uploader_id?: number | null; uploader_role?: string | null }>>({
    queryKey: ["/api/files", selected?.id],
    queryFn: () => apiRequest("GET", `/api/files/${selected.id}`).then(r => r.json()).catch(() => []),
    enabled: !!selected?.id,
  });

  const refundMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/requests/${id}/refund`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Refund processed" });
      setSelected(null);
    },
  });

  const filtered = safeArray(requests).filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.serviceType !== typeFilter) return false;
    if (catFilter !== "all" && r.category !== catFilter) return false;
    return true;
  });

  // Build 45.6.7: Totals for Requests table
  const totalRequests = filtered.length;
  const pendingCount = filtered.filter((r: any) => r.status === "pending").length;
  const completedCount = filtered.filter((r: any) => r.status === "completed").length;
  const totalCost = filtered.reduce((s: number, r: any) => s + (r.creditsCost || 0), 0);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <div data-testid="admin-requests-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Requests</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="rate">Rate</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="entrepreneurship">Entrepreneurship</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Build 45.6.7: Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="requests-totals">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-teal-400" data-testid="total-requests-count">{totalRequests}</div>
            <div className="text-xs text-zinc-500">Total Requests</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-amber-400">{pendingCount}</div>
            <div className="text-xs text-zinc-500">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">{completedCount}</div>
            <div className="text-xs text-zinc-500">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-blue-400">{totalCost.toLocaleString()} cr</div>
            <div className="text-xs text-zinc-500">Total Cost</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Cost</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer" data-testid={`row-request-${r.id}`} onClick={() => setSelected(r)}>
                  <td className="px-4 py-3 text-zinc-500">#{r.id}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium max-w-[200px] truncate">{r.title}</td>
                  <td className="px-4 py-3 text-zinc-400">{r.clientName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 capitalize">{r.category}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 capitalize">{r.serviceType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs capitalize">{r.priceTier || r.tier}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${statusColor[r.status] || ""}`}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300">{r.creditsCost} cr</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {!r.refunded ? (
                      <Button
                        size="sm" variant="ghost"
                        data-testid={`button-refund-${r.id}`}
                        className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        onClick={() => refundMut.mutate(r.id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Refund
                      </Button>
                    ) : (
                      <Badge className="bg-zinc-800 text-zinc-500 text-[10px]">Refunded</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Request Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Request #{selected?.id}: {selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-zinc-500">Client:</span> <span className="text-zinc-200">{selected.clientName}</span></div>
                <div><span className="text-zinc-500">Category:</span> <span className="text-zinc-200 capitalize">{selected.category}</span></div>
                <div><span className="text-zinc-500">Service Type:</span> <span className="text-zinc-200 capitalize">{selected.serviceType}</span></div>
                <div><span className="text-zinc-500">Status:</span> <Badge className={`text-xs ${statusColor[selected.status] || ""}`}>{selected.status}</Badge></div>
                <div><span className="text-zinc-500">Price Tier:</span> <span className="text-zinc-200 capitalize">{selected.priceTier || "—"}</span></div>
                <div><span className="text-zinc-500">Cost:</span> <span className="text-zinc-200">{selected.creditsCost} credits</span></div>
              </div>
              <Separator className="bg-zinc-800" />
              <div>
                <span className="text-zinc-500 text-xs">Description</span>
                <p className="text-zinc-300 mt-1">{selected.description}</p>
              </div>
              {selected.aiResponse && (
                <div>
                  <span className="text-zinc-500 text-xs">AI Response</span>
                  <p className="text-zinc-400 mt-1 whitespace-pre-wrap text-xs bg-zinc-800/50 p-3 rounded-lg">{selected.aiResponse}</p>
                </div>
              )}
              {selected.instructions && (
                <div>
                  <span className="text-zinc-500 text-xs">Instructions</span>
                  <p className="text-zinc-300 mt-1">{selected.instructions}</p>
                </div>
              )}
              {/* Build 39 Fix: Show file attachments in admin request detail */}
              {/* Build 44 Fix 4 (OB 2026-04-21): add Client/Expert uploader tag per attachment. */}
              {selectedFiles && selectedFiles.length > 0 && (
                <div>
                  <Separator className="bg-zinc-800" />
                  <span className="text-zinc-500 text-xs flex items-center gap-1 mt-2"><Paperclip className="h-3 w-3" /> Attachments ({selectedFiles.length})</span>
                  <div className="mt-2 space-y-1.5">
                    {selectedFiles.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => downloadFile(`/api/files/${selected.id}/${encodeURIComponent(f.filename)}`, f.filename)}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline text-sm cursor-pointer bg-transparent border-0 p-0 text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        {f.filename} <span className="text-zinc-500">({(f.size / 1024).toFixed(1)} KB)</span>
                        {f.uploader_role === 'expert' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/30">Expert</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">Client</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Top-Up Requests Section (soft launch — bank transfer) ───
function TopUpRequestsSection() {
  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/topup-requests"],
    refetchInterval: 30000,
  });
  const { toast } = useToast();
  const verifyMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/topup-requests/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topup-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      toast({ title: "Top-up verified", description: "Credits added and client notified via email." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
  const rejectMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/topup-requests/${id}/reject`, { reason: "Bank transfer not received" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topup-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/actions"] });
      toast({ title: "Top-up rejected", description: "Client has been notified." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const safeRequests = Array.isArray(requests) ? requests : [];
  const pending = safeRequests.filter((r: any) => r.status === "pending");

  if (isLoading) return null;
  if (safeRequests.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-green-400" />
        Top-Up Requests {pending.length > 0 && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">{pending.length} pending</Badge>}
      </h2>
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-3 py-3">Client</th>
                <th className="text-left px-3 py-3">Amount</th>
                <th className="text-left px-3 py-3">Current Balance</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Date</th>
                <th className="text-right px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {safeRequests.map((r: any) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-3 py-3">
                    <p className="text-zinc-200 text-xs font-medium">{r.userName || r.user_name}</p>
                    <p className="text-zinc-500 text-[10px]">{r.userEmail || r.user_email}</p>
                  </td>
                  <td className="px-3 py-3 text-green-400 font-semibold text-sm">${r.amount_dollars || r.amountDollars}</td>
                  <td className="px-3 py-3 text-zinc-400 text-xs">{r.userCredits ?? r.user_credits ?? "—"} credits</td>
                  <td className="px-3 py-3">
                    <Badge className={`text-[10px] ${r.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : r.status === "rejected" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-green-500/15 text-green-400 border-green-500/30"}`}>
                      {r.status === "pending" ? "Pending" : r.status === "rejected" ? "Rejected" : "Verified"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(r.created_at || r.createdAt)}</span></td>
                  <td className="px-3 py-3 text-right">
                    {r.status === "pending" && (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => verifyMut.mutate(r.id)} disabled={verifyMut.isPending || rejectMut.isPending}>
                          {verifyMut.isPending ? "..." : "Verify"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => rejectMut.mutate(r.id)} disabled={verifyMut.isPending || rejectMut.isPending}>
                          {rejectMut.isPending ? "..." : "Reject"}
                        </Button>
                      </div>
                    )}
                    {r.status === "verified" && (
                      <span className="text-[10px] text-zinc-500">By {r.verified_by || r.adminVerifiedBy}</span>
                    )}
                    {r.status === "rejected" && (
                      <span className="text-[10px] text-zinc-500">By {r.verified_by || r.adminVerifiedBy}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// 2nd-Priority Fix 9: Admin Action Journal
function AdminActionJournal() {
  const { data: actions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/actions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/actions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const safeActions = safeArray(actions);

  function downloadActionsExcel() {
    const headers = ["ID", "Admin", "Action", "Target Type", "Target ID", "Details", "Date"];
    const rows = safeActions.map((a: any) => [
      a.id ?? "",
      a.admin_email ?? a.adminEmail ?? "",
      a.action_type ?? a.actionType ?? "",
      a.target_type ?? a.targetType ?? "",
      a.target_id ?? a.targetId ?? "",
      (a.details ?? "").replace(/,/g, " "),
      a.created_at ?? a.createdAt ? new Date(a.created_at || a.createdAt).toLocaleString() : "",
    ]);
    const csvContent = [headers, ...rows].map(r => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `a2a-admin-actions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-8" data-testid="admin-action-journal">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-400" />
          Action History
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="bg-zinc-800 border-zinc-700 text-zinc-200 h-9 text-xs"
          onClick={downloadActionsExcel}
          disabled={safeActions.length === 0}
          data-testid="button-download-actions"
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Download Excel
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-zinc-500 text-sm">Loading actions...</div>
      ) : safeActions.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm">No actions recorded yet.</div>
      ) : (
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                  <th className="text-left px-3 py-3">Admin</th>
                  <th className="text-left px-3 py-3">Action</th>
                  <th className="text-left px-3 py-3">Target</th>
                  <th className="text-left px-3 py-3">Details</th>
                  <th className="text-left px-3 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {safeActions.slice(0, 50).map((a: any) => (
                  <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-3 py-3 text-zinc-300 text-xs">{a.admin_email || a.adminEmail}</td>
                    <td className="px-3 py-3">
                      {(() => {
                        const actionType = a.action_type || a.actionType;
                        const greenActions = ["approve", "verify_bank", "approve_withdrawal", "verify_topup"];
                        const blueActions = ["initiate_payout"];
                        const labelMap: Record<string, string> = {
                          approve: "Approve Review",
                          reject: "Reject Review",
                          verify_bank: "Verify Bank",
                          initiate_payout: "Initiate Payout",
                          approve_withdrawal: "Approve Withdrawal",
                          reject_withdrawal: "Reject Withdrawal",
                          verify_topup: "Verify Top-Up",
                          reject_topup: "Reject Top-Up",
                        };
                        const colorClass = greenActions.includes(actionType)
                          ? "bg-green-500/15 text-green-400 border border-green-500/30"
                          : blueActions.includes(actionType)
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            : "bg-red-500/15 text-red-400 border border-red-500/30";
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorClass}`}>
                            {labelMap[actionType] || actionType}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-zinc-400 text-xs">#{a.target_id || a.targetId}</td>
                    <td className="px-3 py-3 text-zinc-400 text-xs max-w-[300px] truncate">{a.details}</td>
                    <td className="px-3 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(a.created_at || a.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Transactions Page ───

function TransactionsPage() {
  // Fix 10: Add isLoading and error handling to prevent blank page
  const { data: txData, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/transactions"],
    retry: 2,
  });
  const [typeFilter, setTypeFilter] = useState("all");

  // API returns { transactions: [], totals: {} }
  const safeTransactions = safeArray(txData?.transactions ?? txData);
  const totals = txData?.totals || {};

  const filtered = safeTransactions.filter((t: any) =>
    typeFilter === "all" || t?.type === typeFilter
  );

  const totalIn = safeTransactions.filter((t: any) => (t?.amount ?? 0) > 0).reduce((sum: number, t: any) => sum + (t?.amount ?? 0), 0);
  const totalOut = safeTransactions.filter((t: any) => (t?.amount ?? 0) < 0).reduce((sum: number, t: any) => sum + Math.abs(t?.amount ?? 0), 0);

  // Compute take rate summary from enriched transactions
  const chargedTx = safeTransactions.filter((t: any) => t?.type === "charged" || t?.type === "earning");
  const totalPlatformRevenue = chargedTx.reduce((s: number, t: any) => s + (t?.platformFee || 0), 0);
  const totalExpertPayouts = chargedTx.reduce((s: number, t: any) => s + (t?.expertPayout || 0), 0);
  const totalClientPaid = chargedTx.reduce((s: number, t: any) => s + (t?.clientPaid || 0), 0);
  const blendedTakeRate = totalClientPaid > 0 ? Math.round((totalPlatformRevenue / totalClientPaid) * 100) : 0;

  return (
    <div data-testid="admin-transactions-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-zinc-800 border-zinc-700 text-zinc-200 h-9 text-xs"
            onClick={() => {
              const headers = ["ID","User","Type","Amount","Take Rate %","Platform Fee","Expert Payout","Client Paid","Description","Date"];
              const rows = filtered.map((t: any) => [
                t?.id ?? "",
                t?.userName ?? "",
                t?.type ?? "",
                t?.amount ?? 0,
                t?.takeRatePercent ?? "",
                t?.platformFee ?? "",
                t?.expertPayout ?? "",
                t?.clientPaid ?? "",
                (t?.description ?? "").replace(/,/g, " "),
                t?.createdAt ? new Date(t.createdAt).toLocaleString() : "",
              ]);
              const csvContent = [headers, ...rows].map(r => r.map((c: any) => `"${c}"`).join(",")).join("\n");
              const BOM = "\uFEFF";
              const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `a2a-transactions-${new Date().toISOString().split("T")[0]}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }}
            data-testid="button-download-transactions"
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Download Excel
          </Button>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="charged">Charged</SelectItem>
            <SelectItem value="earning">Earning</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="bonus">Bonus</SelectItem>
            <SelectItem value="hold">Hold</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
            <SelectItem value="admin_grant">Admin Grant</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Fix 10: Loading and error states */}
      {isLoading && (
        <div className="text-center py-8 text-zinc-500 text-sm">Loading transactions...</div>
      )}
      {error && (
        <div className="text-center py-8 text-red-400 text-sm">Failed to load transactions. Try refreshing.</div>
      )}

      {/* Summary cards with take rate data */}
      {/* Build 45.6.7: Total transaction count */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3" data-testid="transactions-totals">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-teal-400" data-testid="total-tx-count">{filtered.length}</div>
            <div className="text-xs text-zinc-500">Total Transactions</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-emerald-400">${totalIn.toFixed(2)}</div>
            <div className="text-xs text-zinc-500">Total In</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-red-400">${totalOut.toFixed(2)}</div>
            <div className="text-xs text-zinc-500">Total Out</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-cyan-400">${(totalIn - totalOut).toFixed(2)}</div>
            <div className="text-xs text-zinc-500">Net Balance</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-blue-400">${totalPlatformRevenue}</div>
            <div className="text-xs text-zinc-500">Platform Revenue</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-amber-400">${totalExpertPayouts}</div>
            <div className="text-xs text-zinc-500">Expert Payouts</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-purple-400">{blendedTakeRate}%</div>
            <div className="text-xs text-zinc-500">Blended Take Rate</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-3 py-3">ID</th>
                <th className="text-left px-3 py-3">User</th>
                <th className="text-left px-3 py-3">Type</th>
                <th className="text-right px-3 py-3">Amount</th>
                <th className="text-right px-3 py-3">Take Rate</th>
                <th className="text-right px-3 py-3">Platform Fee</th>
                <th className="text-right px-3 py-3">Expert Payout</th>
                <th className="text-right px-3 py-3">Client Paid</th>
                <th className="text-left px-3 py-3">Description</th>
                <th className="text-left px-3 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-500 text-sm">
                  {isLoading ? "Loading..." : "No transactions found"}
                </td></tr>
              ) : filtered.map((t: any) => (
                <tr key={t?.id ?? Math.random()} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-tx-${t?.id}`}>
                  <td className="px-3 py-3 text-zinc-500">#{t?.id}</td>
                  <td className="px-3 py-3 text-zinc-200">{t?.userName ?? "—"}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 capitalize">{t?.type ?? "—"}</Badge>
                  </td>
                  <td className={`px-3 py-3 text-right font-medium ${(t?.amount ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t?.amount ?? 0) > 0 ? "+" : ""}{t?.amount ?? 0}
                  </td>
                  <td className="px-3 py-3 text-right text-zinc-400 text-xs">{t?.takeRatePercent != null ? `${t.takeRatePercent}%` : "—"}</td>
                  <td className="px-3 py-3 text-right text-blue-400 text-xs">{t?.platformFee != null ? `$${t.platformFee}` : "—"}</td>
                  <td className="px-3 py-3 text-right text-amber-400 text-xs">{t?.expertPayout != null ? `$${t.expertPayout}` : "—"}</td>
                  <td className="px-3 py-3 text-right text-zinc-300 text-xs">{t?.clientPaid != null ? `$${t.clientPaid}` : "—"}</td>
                  <td className="px-3 py-3 text-zinc-400 text-xs max-w-[200px] truncate">{t?.description ?? "—"}</td>
                  <td className="px-3 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(t?.createdAt)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Withdrawals Page ───

function WithdrawalsPage() {
  const { toast } = useToast();
  const { data: withdrawals } = useQuery<any[]>({ queryKey: ["/api/admin/withdrawals"] });

  // G2-6: Download invoice PDF for a withdrawal request
  async function handleDownloadInvoicePDF(invoiceNumber: string) {
    try {
      const res = await apiRequest("GET", `/api/admin/invoices/${encodeURIComponent(invoiceNumber)}`);
      const d = await res.json();
      if (!d || !d.invoice) throw new Error("Invoice data not found");
      // BUG-5: Defensive defaults for missing fields
      d.expert = d.expert || { id: 0, name: "Unknown", email: "", category: "general", tier: "standard" };
      d.lineItems = d.lineItems || [];
      d.totalAmountCents = d.totalAmountCents || 0;
      d.netPayoutCents = d.netPayoutCents || 0;
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 20;
      let y = 20;

      doc.setFillColor(15, 61, 209);
      doc.rect(margin, y, 12, 12, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("A2A", margin + 6, y + 7.5, { align: "center" });
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(16);
      doc.text("Expert Payout Statement", margin + 16, y + 6);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Generated by A2A Expert Opinion Platform", margin + 16, y + 11);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("A2A Global Inc.", 190, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text("Merchant / Remitter", 190, y + 8, { align: "right" });

      y += 16;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, 190, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("STATEMENT INFORMATION", margin, y);
      doc.text("EXPERT DETAILS", 110, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const infoRows = [
        ["Statement Number", d.invoice.invoiceNumber || invoiceNumber],
        ["Statement Date", d.invoice.createdAt ? new Date(d.invoice.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"],
        ["Expert ID", `EX-${String(d.expert.id || 0).padStart(6, "0")}`],
      ];
      const expertRows = [
        ["Name", d.expert.name || "Unknown"],
        ["Email", d.expert.email || "N/A"],
        ["Category", d.expert.category || "general"],
        ["Tier", d.expert.tier || "standard"],
      ];
      doc.setFontSize(8);
      infoRows.forEach(([label, val]: string[], i: number) => {
        doc.setTextColor(130, 130, 130);
        doc.text(label, margin, y + i * 5);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text(val, margin + 38, y + i * 5);
        doc.setFont("helvetica", "normal");
      });
      expertRows.forEach(([label, val]: string[], i: number) => {
        doc.setTextColor(130, 130, 130);
        doc.text(label, 110, y + i * 5);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text(val, 135, y + i * 5);
        doc.setFont("helvetica", "normal");
      });
      y += 24;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text("SERVICES RENDERED", margin, y);
      y += 4;
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y, 170, 6, "F");
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(7);
      doc.text("Description", margin + 2, y + 4);
      doc.text("Date", 115, y + 4);
      doc.text("Credits", 145, y + 4, { align: "right" });
      doc.text("Amount USD", 188, y + 4, { align: "right" });
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      (d.lineItems || []).forEach((item: any) => {
        const desc = `${item.title} — ${item.serviceType} review`;
        const truncated = desc.length > 55 ? desc.slice(0, 55) + "..." : desc;
        doc.text(truncated, margin + 2, y);
        doc.text(item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "-", 115, y);
        doc.text(String(item.creditsCost), 145, y, { align: "right" });
        doc.text(`$${(item.amountCents / 100).toFixed(2)}`, 188, y, { align: "right" });
        y += 5;
      });

      y += 2;
      doc.line(margin, y, 190, y);
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text("Subtotal (Expert Net)", 145, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(`$${(d.totalAmountCents / 100).toFixed(2)}`, 188, y, { align: "right" });
      y += 6;
      doc.setFillColor(240, 249, 240);
      doc.rect(120, y - 4, 70, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 120, 20);
      doc.text("Net Payout", 145, y + 1, { align: "right" });
      doc.text(`$${(d.netPayoutCents / 100).toFixed(2)}`, 188, y + 1, { align: "right" });
      y += 12;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Payment Method: Bank Transfer via Mercury", margin, y);
      y += 12;
      doc.line(margin, y, 190, y);
      y += 4;
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text("\u00a9 2026 A2A Global Inc. All rights reserved. https://a2a.global/", margin, y);
      doc.text("File number 10050200, Newark, Delaware, United States.", margin, y + 3);

      doc.save(`${invoiceNumber}.pdf`);
      toast({ title: "Invoice downloaded" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  // OB-J: Expert verifications
  const { data: verifications } = useQuery<any[]>({ queryKey: ["/api/admin/expert-verifications"] });

  // OB-J: Withdrawal requests (new table)
  const { data: withdrawalRequests } = useQuery<any[]>({ queryKey: ["/api/admin/withdrawal-requests"] });

  const approveMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/withdrawals/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Withdrawal approved" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/withdrawals/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      toast({ title: "Withdrawal rejected" });
    },
  });

  // OB-J: Mark payout initiated
  const payoutMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/withdrawal-requests/${id}/payout`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawal-requests"] });
      toast({ title: "Payout initiated", description: "Expert has been notified via email." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // OB-J: Verify bank details
  const verifyBankMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/expert-verifications/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expert-verifications"] });
      toast({ title: "Bank details verified" });
    },
  });

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    payout_initiated: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  const [selectedVerification, setSelectedVerification] = useState<any>(null);

  // Build 45.6.7: Totals for Withdrawals page (3 tables)
  const verificationsArr = safeArray(verifications);
  const verificationsCount = verificationsArr.length;
  const verificationsVerified = verificationsArr.filter((v: any) => v.verifiedByAdmin).length;
  const withdrawalRequestsArr = safeArray(withdrawalRequests);
  const withdrawalRequestsCount = withdrawalRequestsArr.length;
  const withdrawalRequestsPending = withdrawalRequestsArr.filter((wr: any) => wr.status === "pending").length;
  // `wr.amount` is a dollar number on this endpoint
  const withdrawalRequestsTotal = withdrawalRequestsArr.reduce((s: number, wr: any) => s + (Number(wr.amount) || 0), 0);
  const legacyWithdrawalsArr = safeArray(withdrawals);
  const legacyWithdrawalsCount = legacyWithdrawalsArr.length;
  const legacyWithdrawalsPending = legacyWithdrawalsArr.filter((w: any) => w.status === "pending").length;
  // amountCents is cents
  const legacyWithdrawalsTotalCents = legacyWithdrawalsArr.reduce((s: number, w: any) => s + (w.amountCents || 0), 0);

  return (
    <div data-testid="admin-withdrawals-page">
      {/* OB-J: Expert ID / Bank Verification Section */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Expert ID / Bank Verification</h1>
        {/* Build 45.6.7: Totals */}
        <div className="flex items-center gap-2 text-xs" data-testid="verifications-totals">
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Total: <span className="font-semibold text-teal-400 ml-1">{verificationsCount}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Verified: <span className="font-semibold text-emerald-400 ml-1">{verificationsVerified}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Pending: <span className="font-semibold text-amber-400 ml-1">{verificationsCount - verificationsVerified}</span></Badge>
        </div>
      </div>
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">Expert</th>
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">ID Document</th>
                <th className="text-left px-4 py-3">Account #</th>
                <th className="text-left px-4 py-3">SWIFT</th>
                <th className="text-left px-4 py-3">Bank</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(verifications).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-zinc-500 text-xs">No expert verifications submitted yet.</td></tr>
              ) : safeArray(verifications).map((v: any) => (
                <tr key={v.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-zinc-200 font-medium">{v.fullLegalName || v.expertName || `Expert #${v.expertId}`}</div>
                    {v.fullLegalName && v.expertName && <div className="text-[10px] text-zinc-500">{v.expertName}</div>}
                    {v.city && <div className="text-[10px] text-zinc-500">{[v.city, v.stateProvince].filter(Boolean).join(", ")}</div>}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{v.country || "—"}</td>
                  <td className="px-4 py-3">
                    {/* BUG-3b: View + Download document */}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => setSelectedVerification(v)}>
                      <Paperclip className="w-3 h-3 mr-1" /> View / Download
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{v.accountNumber || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{v.swiftCode || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    {v.bankName || "—"}
                    {v.iban && <div className="text-[10px] text-zinc-500 font-mono">IBAN: {v.iban}</div>}
                    {v.sortCode && <div className="text-[10px] text-zinc-500 font-mono">Sort: {v.sortCode}</div>}
                    {v.ifscCode && <div className="text-[10px] text-zinc-500 font-mono">IFSC: {v.ifscCode}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${v.verifiedByAdmin ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {v.verifiedByAdmin ? "Verified" : "Pending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!v.verifiedByAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={() => verifyBankMut.mutate(v.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verify
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* OB-J: Passport/ID Viewer Dialog — BUG-3b: Show all fields, viewable + downloadable */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expert Verification Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Passport/ID Image */}
            {selectedVerification?.passportFileUrl ? (
              <div className="space-y-2">
                <img src={selectedVerification.passportFileUrl} alt="Government-issued ID" className="w-full rounded-lg border border-zinc-700" />
                <a
                  href={selectedVerification.passportFileUrl}
                  download={`expert-${selectedVerification.expertId}-id-document`}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1"
                >
                  <Download className="w-3 h-3" /> Download ID Document
                </a>
              </div>
            ) : selectedVerification ? (
              <div className="space-y-2">
                <img
                  id={`passport-img-${selectedVerification.expertId}`}
                  src={getFileDownloadUrl(`/api/experts/${selectedVerification.expertId}/passport-file`)}
                  alt="Government-issued ID"
                  className="w-full rounded-lg border border-zinc-700"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; document.getElementById(`passport-fallback-${selectedVerification.expertId}`)?.classList.remove('hidden'); }}
                />
                <button
                  onClick={() => downloadFile(`/api/experts/${selectedVerification.expertId}/passport-file`, `expert-${selectedVerification.expertId}-id-document`)}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1 bg-transparent border-0 p-0 cursor-pointer"
                >
                  <Download className="w-3 h-3" /> Download ID Document
                </button>
                <p id={`passport-fallback-${selectedVerification.expertId}`} className="text-zinc-500 text-xs hidden">No ID document uploaded yet.</p>
              </div>
            ) : null}

            {/* Personal Details */}
            <div className="border-t border-zinc-800 pt-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Personal Details</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p className="text-zinc-500">Full Legal Name</p>
                <p className="text-zinc-200">{selectedVerification?.fullLegalName || "—"}</p>
                <p className="text-zinc-500">ID Type</p>
                <p className="text-zinc-200">{selectedVerification?.governmentIdType || "—"}</p>
                <p className="text-zinc-500">Country</p>
                <p className="text-zinc-200">{selectedVerification?.country || "—"}</p>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="border-t border-zinc-800 pt-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Recipient Address</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p className="text-zinc-500">Apartment / Street</p>
                <p className="text-zinc-200">{selectedVerification?.apartmentStreet || "—"}</p>
                <p className="text-zinc-500">City</p>
                <p className="text-zinc-200">{selectedVerification?.city || "—"}</p>
                <p className="text-zinc-500">State / Province</p>
                <p className="text-zinc-200">{selectedVerification?.stateProvince || "—"}</p>
                <p className="text-zinc-500">Postal / Zip Code</p>
                <p className="text-zinc-200">{selectedVerification?.postalCode || "—"}</p>
              </div>
            </div>

            {/* Bank Details */}
            <div className="border-t border-zinc-800 pt-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Bank Details</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p className="text-zinc-500">Bank Name</p>
                <p className="text-zinc-200">{selectedVerification?.bankName || "—"}</p>
                <p className="text-zinc-500">Account Number</p>
                <p className="text-zinc-200 font-mono">{selectedVerification?.accountNumber || "—"}</p>
                <p className="text-zinc-500">SWIFT / BIC</p>
                <p className="text-zinc-200 font-mono">{selectedVerification?.swiftCode || "—"}</p>
                <p className="text-zinc-500">Account Holder</p>
                <p className="text-zinc-200">{selectedVerification?.accountHolderName || "—"}</p>
                {selectedVerification?.iban && <><p className="text-zinc-500">IBAN</p><p className="text-zinc-200 font-mono">{selectedVerification.iban}</p></>}
                {selectedVerification?.routingNumber && <><p className="text-zinc-500">Routing Number</p><p className="text-zinc-200 font-mono">{selectedVerification.routingNumber}</p></>}
                {selectedVerification?.sortCode && <><p className="text-zinc-500">Sort Code</p><p className="text-zinc-200 font-mono">{selectedVerification.sortCode}</p></>}
                {selectedVerification?.ifscCode && <><p className="text-zinc-500">IFSC Code</p><p className="text-zinc-200 font-mono">{selectedVerification.ifscCode}</p></>}
                <p className="text-zinc-500">Bank Country</p>
                <p className="text-zinc-200">{selectedVerification?.bankCountry || "—"}</p>
                <p className="text-zinc-500">Bank Address</p>
                <p className="text-zinc-200">{selectedVerification?.bankAddress || "—"}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVerification(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OB-J: Withdrawal Requests Section */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Withdrawal Requests</h1>
        {/* Build 45.6.7: Totals */}
        <div className="flex items-center gap-2 text-xs" data-testid="withdrawal-requests-totals">
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Total: <span className="font-semibold text-teal-400 ml-1">{withdrawalRequestsCount}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Pending: <span className="font-semibold text-amber-400 ml-1">{withdrawalRequestsPending}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Amount: <span className="font-semibold text-blue-400 ml-1">${withdrawalRequestsTotal.toFixed(2)}</span></Badge>
        </div>
      </div>
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">Invoice #</th>
                <th className="text-left px-4 py-3">Expert</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Bank Details</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Requested</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(withdrawalRequests).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500 text-xs">No withdrawal requests yet.</td></tr>
              ) : safeArray(withdrawalRequests).map((wr: any) => (
                <tr key={wr.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-withdrawal-req-${wr.id}`}>
                  <td className="px-4 py-3 text-zinc-300 font-mono text-xs">
                    <span className="flex items-center gap-1">
                      {wr.invoiceNumber}
                      <Button
                        variant="ghost" size="sm"
                        className="h-5 w-5 p-0 text-zinc-400 hover:text-zinc-200"
                        onClick={() => handleDownloadInvoicePDF(wr.invoiceNumber)}
                        title="Download Invoice PDF"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-200 font-medium">{wr.expertName || `Expert #${wr.expertId}`}</td>
                  <td className="px-4 py-3 text-right text-zinc-200 font-medium">${wr.amount}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {wr.verification ? (
                      <div>
                        <span>{wr.verification.bankName} — {wr.verification.accountNumber}</span>
                        {wr.verification.fullLegalName && <div className="text-[10px] text-zinc-500 mt-0.5">Name: {wr.verification.fullLegalName}</div>}
                        {wr.verification.iban && <div className="text-[10px] text-zinc-500">IBAN: {wr.verification.iban}</div>}
                        {wr.verification.swiftCode && <div className="text-[10px] text-zinc-500">SWIFT: {wr.verification.swiftCode}</div>}
                        {wr.verification.sortCode && <div className="text-[10px] text-zinc-500">Sort: {wr.verification.sortCode}</div>}
                        {wr.verification.ifscCode && <div className="text-[10px] text-zinc-500">IFSC: {wr.verification.ifscCode}</div>}
                        {wr.verification.bankCountry && <div className="text-[10px] text-zinc-500">Country: {wr.verification.bankCountry}</div>}
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] text-blue-400 hover:text-blue-300 p-0 mt-1" onClick={() => setSelectedVerification(wr.verification)}>
                          <Paperclip className="w-2.5 h-2.5 mr-0.5" /> View ID & Full Details
                        </Button>
                      </div>
                    ) : (
                      <span className="text-amber-400">No bank details</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${statusColor[wr.status] || ""}`}>
                      {wr.status === "pending" ? "Pending" : wr.status === "payout_initiated" ? "Payout Initiated" : wr.status === "completed" ? "Completed" : wr.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(wr.createdAt)}</span></td>
                  <td className="px-4 py-3 text-right">
                    {wr.status === "pending" && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-zinc-500 mb-1">Please make a payout to the expert from your bank account</p>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => payoutMut.mutate(wr.id)}
                          disabled={payoutMut.isPending}
                        >
                          <DollarSign className="w-3 h-3 mr-1" /> Payout Initiated
                        </Button>
                      </div>
                    )}
                    {wr.status !== "pending" && (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legacy Withdrawals (from old system) */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Legacy Withdrawals</h1>
        {/* Build 45.6.7: Totals */}
        <div className="flex items-center gap-2 text-xs" data-testid="legacy-withdrawals-totals">
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Total: <span className="font-semibold text-teal-400 ml-1">{legacyWithdrawalsCount}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Pending: <span className="font-semibold text-amber-400 ml-1">{legacyWithdrawalsPending}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Amount: <span className="font-semibold text-blue-400 ml-1">${(legacyWithdrawalsTotalCents / 100).toFixed(2)}</span></Badge>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Expert</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Requested</th>
                <th className="text-left px-4 py-3">Processed</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(withdrawals).map((w: any) => (
                <tr key={w.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-withdrawal-${w.id}`}>
                  <td className="px-4 py-3 text-zinc-500">#{w.id}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium">{w.userName}</td>
                  <td className="px-4 py-3 text-right text-zinc-200 font-medium">${(w.amountCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${statusColor[w.status] || ""}`}>{w.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(w.createdAt)}</span></td>
                  <td className="px-4 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(w.processedAt)}</span></td>
                  <td className="px-4 py-3 text-right">
                    {w.status === "pending" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="ghost"
                          data-testid={`button-approve-${w.id}`}
                          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => approveMut.mutate(w.id)}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          data-testid={`button-reject-${w.id}`}
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => rejectMut.mutate(w.id)}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Notifications Page ───

function NotificationsPage() {
  const { data: notifications } = useQuery<any[]>({ queryKey: ["/api/admin/notifications"] });

  // Build 45.6.7: Totals
  const notificationsArr = safeArray(notifications);
  const totalNotifications = notificationsArr.length;
  const unreadCount = notificationsArr.filter((n: any) => !n.read).length;

  return (
    <div data-testid="admin-notifications-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">System Notifications</h1>
        {/* Build 45.6.7: Totals */}
        <div className="flex items-center gap-2 text-xs" data-testid="notifications-totals">
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Total: <span className="font-semibold text-teal-400 ml-1">{totalNotifications}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Unread: <span className="font-semibold text-blue-400 ml-1">{unreadCount}</span></Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Read: <span className="font-semibold text-zinc-400 ml-1">{totalNotifications - unreadCount}</span></Badge>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Message</th>
                <th className="text-left px-4 py-3">Read</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(notifications).map((n: any) => (
                <tr key={n.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-500">#{n.id}</td>
                  <td className="px-4 py-3 text-zinc-200">{n.userName}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium">{n.title}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs max-w-[300px] truncate">{n.message}</td>
                  <td className="px-4 py-3">
                    {n.read ? (
                      <Badge className="bg-zinc-800 text-zinc-500 text-[10px]">Read</Badge>
                    ) : (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">Unread</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs"><span title="US Central time zone">{formatCentralTime(n.createdAt)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Settings Page ───

function SettingsPage() {
  const { data: settings } = useQuery<any>({ queryKey: ["/api/admin/settings"] });

  return (
    <div data-testid="admin-settings-page">
      <h1 className="text-lg font-semibold mb-4">Platform Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Take Rates by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {settings?.takeRates && Object.entries(settings.takeRates).map(([tier, rate]: [string, any]) => (
                <div key={tier} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-sm text-zinc-300 capitalize">{tier}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-teal-400">{(rate * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Credit Packs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {settings?.creditPacks && Object.entries(settings.creditPacks).map(([id, pack]: [string, any]) => (
                <div key={id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-sm text-zinc-300">{pack.name}</span>
                  <span className="text-sm text-zinc-400">${pack.dollars} → {pack.credits} credits</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Admin Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {safeArray(settings?.admins).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <div className="text-sm text-zinc-200">{a.name}</div>
                    <div className="text-xs text-zinc-500">{a.email}</div>
                  </div>
                  <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 text-xs">Admin</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <FloatingHelp />
    </div>
  );
}

// ===== RL CORE & BUSINESS INTELLIGENCE PAGE =====
function IntelligencePage() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/rl-metrics"] });
  // Build 45.6: LLM-generated operator recommendations
  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights, isFetching: insightsFetching } = useQuery<any>({
    queryKey: ["/api/admin/rl-insights"],
    staleTime: 10 * 60 * 1000,
  });
  const { toast } = useToast();
  const handleRefreshInsights = async () => {
    try {
      await apiRequest("POST", "/api/admin/rl-insights/refresh");
      await refetchInsights();
      toast({ title: "Insights refreshed" });
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e?.message || "Try again", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading RL Core metrics...</div>;
  if (!data) return <div className="p-6 text-destructive">Failed to load metrics</div>;

  const { rlCore, business, tiers, domains, funnel, abTests, legal } = data;
  const insights: any[] = insightsData?.insights || [];
  const insightsSource: string = insightsData?.source || "";
  const insightsGeneratedAt: string = insightsData?.generatedAt || "";

  const impactColor = (impact: string) =>
    impact === "high" ? "bg-rose-100 text-rose-700 border-rose-200" :
    impact === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-slate-100 text-slate-700 border-slate-200";
  const diffColor = (d: string) =>
    d === "easy" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    d === "hard" ? "bg-rose-100 text-rose-700 border-rose-200" :
    "bg-sky-100 text-sky-700 border-sky-200";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">RL Core & Business Intelligence</h2>
        <p className="text-sm text-muted-foreground">A2A Global Reinforcement Learning Core metrics, CAC analysis, and A/B test results</p>
      </div>

      {/* Build 45.6: AI Operator Recommendations (always 3–5) */}
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                AI Operator Recommendations
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Powered by our Reinforcement Learning Core. Data from users, experts, requests, revenue, and feedback signals.
                {insightsGeneratedAt && (
                  <> Last updated {new Date(insightsGeneratedAt).toLocaleString()}.</>
                )}
                {insightsSource && (
                  <> Source: <span className="font-mono">{insightsSource}</span>.</>
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleRefreshInsights} disabled={insightsFetching} data-testid="rl-insights-refresh">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${insightsFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {insightsLoading ? (
            <div className="text-sm text-muted-foreground">Generating insights…</div>
          ) : insights.length === 0 ? (
            <div className="text-sm text-muted-foreground">No insights yet. Click Refresh to generate.</div>
          ) : (
            <div className="space-y-2" data-testid="rl-insights-list">
              {insights.map((ins: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition">
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{ins.title}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${impactColor(ins.impact)}`}>{ins.impact} impact</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${diffColor(ins.difficulty)}`}>{ins.difficulty}</span>
                  </div>
                  {ins.rationale && <p className="text-xs text-muted-foreground ml-6 mb-1">{ins.rationale}</p>}
                  <p className="text-xs ml-6 text-slate-700"><span className="font-semibold">Do this:</span> {ins.suggestion}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RL Core Metrics */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Reinforcement Learning Core</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Training Signals", value: rlCore?.totalTrainingSignals || 0, color: "text-primary" },
            { label: "Avg Expert Rating", value: `${rlCore?.avgExpertRating || 0}/100`, color: "text-emerald-600" },
            { label: "Match Accuracy", value: `${rlCore?.matchAccuracy || 0}%`, color: "text-amber-600" },
            { label: "Error Taxonomy Size", value: rlCore?.errorTaxonomySize || 0, color: "text-violet-600" },
            { label: "Data Points", value: rlCore?.dataPointsCollected || 0, color: "text-rose-600" },
            { label: "Model Version", value: rlCore?.modelVersion || "v0.1", color: "text-gray-600" },
          ].map((m, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3">
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent></Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Business Metrics / CAC / LTV */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600" /> Unit Economics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "CAC", value: `$${business?.cac || 0}`, sub: "Customer Acquisition Cost" },
            { label: "LTV", value: `$${business?.ltv || 0}`, sub: "Lifetime Value (est.)" },
            { label: "LTV:CAC", value: business?.ltvCacRatio || "N/A", sub: "Target: >3.0" },
            { label: "ARPC", value: `$${business?.avgRevenuePerClient || 0}`, sub: "Avg Revenue per Client" },
            { label: "Total Revenue", value: `$${business?.totalRevenue || 0}`, sub: "All-time credits purchased" },
            { label: "Total Users", value: business?.totalUsers || 0, sub: `${business?.totalExperts || 0} experts, ${business?.totalClients || 0} clients` },
            { label: "Active Requests", value: business?.activeRequests || 0, sub: `${business?.completedRequests || 0} completed` },
            { label: "Total Requests", value: business?.totalRequests || 0, sub: "Expert opinion requests" },
          ].map((m, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3">
              <p className="text-lg font-bold">{m.value}</p>
              <p className="text-xs font-medium">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </CardContent></Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Expert Tier Distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expert Tier Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { tier: "Standard", count: tiers?.standard || 0, color: "bg-gray-400", desc: "Open access" },
                { tier: "Pro", count: tiers?.pro || 0, color: "bg-primary", desc: "Open access" },
                { tier: "Guru", count: tiers?.guru || 0, color: "bg-amber-500", desc: "Test required" },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${t.color}`} />
                  <span className="text-sm font-medium w-20">{t.tier}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${t.color} rounded-full`} style={{ width: `${Math.max(5, (t.count / Math.max(business?.totalExperts || 1, 1)) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-mono w-8 text-right">{t.count}</span>
                  <span className="text-xs text-muted-foreground">{t.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conversion Funnel</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(funnel || []).map((f: any, i: number) => {
                const maxCount = funnel?.[0]?.count || 1;
                const pct = Math.round((f.count / maxCount) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs w-28 text-muted-foreground">{f.stage}</span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary/80 rounded flex items-center px-2" style={{ width: `${Math.max(5, pct)}%` }}>
                        <span className="text-[10px] text-white font-medium">{f.count}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* A/B Tests */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-600" /> A/B Tests</h3>
        <div className="grid gap-3">
          {(abTests || []).map((test: any, i: number) => {
            const aRate = test.a_visitors > 0 ? ((test.a_conversions / test.a_visitors) * 100).toFixed(1) : "0";
            const bRate = test.b_visitors > 0 ? ((test.b_conversions / test.b_visitors) * 100).toFixed(1) : "0";
            const winner = parseFloat(bRate) > parseFloat(aRate) ? "B" : "A";
            return (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{test.name}</span>
                    <Badge variant={test.status === "running" ? "default" : "secondary"} className="text-xs">{test.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className={`p-2 rounded ${winner === "A" ? "bg-emerald-50 border border-emerald-200" : "bg-muted"}`}>
                      <p className="font-medium">A: {test.variant_a}</p>
                      <p className="text-muted-foreground">{test.a_conversions}/{test.a_visitors} = <span className="font-mono font-bold">{aRate}%</span></p>
                    </div>
                    <div className={`p-2 rounded ${winner === "B" ? "bg-emerald-50 border border-emerald-200" : "bg-muted"}`}>
                      <p className="font-medium">B: {test.variant_b}</p>
                      <p className="text-muted-foreground">{test.b_conversions}/{test.b_visitors} = <span className="font-mono font-bold">{bRate}%</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Legal Compliance */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Legal Compliance</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-lg font-bold">{legal?.termsAcceptances?.c || 0}</p>
            <p className="text-xs text-muted-foreground">Terms of Use acceptances</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-lg font-bold">{legal?.privacyAcceptances?.c || 0}</p>
            <p className="text-xs text-muted-foreground">Privacy Policy acceptances</p>
          </CardContent></Card>
        </div>
        {legal?.recentAcceptances?.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Recent Acceptances</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs">
                {legal.recentAcceptances.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>User #{a.user_id} — {a.document_type}</span>
                    <span>{a.ip_address} — {a.accepted_at?.slice(0, 19)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Domain Distribution */}
      {domains?.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3">Expert Domain Distribution</h3>
            <div className="flex flex-wrap gap-2">
              {domains.map((d: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">{d.name}: {d.count}</Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Feedback Page (Build 45 — Bug #3) ───
function FeedbackPage() {
  const { toast } = useToast();
  const { data: feedback, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/feedback"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feedback");
      return res.json();
    },
  });

  const rows = safeArray<any>(feedback);

  const handleExport = async () => {
    try {
      await downloadFile(
        "/api/admin/feedback/export",
        `a2a-feedback-${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast({ title: "Download started", description: "Excel export saved." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Try again.", variant: "destructive" });
    }
  };

  return (
    <div data-testid="admin-feedback-page">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Feedback</h1>
          <p className="text-sm text-zinc-500 mt-1">User feedback submissions — most recent first.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Build 45.6.7: Totals */}
          <div className="flex items-center gap-2 text-xs mr-2" data-testid="feedback-totals">
            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">Total: <span className="font-semibold text-teal-400 ml-1">{rows.length}</span></Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="feedback-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={handleExport} data-testid="feedback-export-xlsx">
            <Download className="h-4 w-4 mr-1" /> Download Excel
          </Button>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-zinc-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-zinc-400" data-testid="feedback-empty">No feedback submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="feedback-table">
                <thead className="bg-zinc-800 text-zinc-300">
                  <tr>
                    <th className="text-left p-3 font-medium">Reference</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Page</th>
                    <th className="text-left p-3 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-zinc-800/50" data-testid={`feedback-row-${r.id}`}>
                      <td className="p-3 font-mono text-blue-400">{r.reference_number || `FDB-${100000000 + r.id}`}</td>
                      <td className="p-3 text-zinc-300 whitespace-nowrap">{r.created_at ? formatCentralTime(r.created_at) : "—"}</td>
                      <td className="p-3 text-zinc-200">{r.user_name || "—"}</td>
                      <td className="p-3 text-zinc-400">{r.user_email || "—"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">{r.user_role || "unknown"}</Badge>
                      </td>
                      <td className="p-3 text-zinc-500 max-w-[200px] truncate" title={r.page_url || ""}>{r.page_url || "—"}</td>
                      <td className="p-3 text-zinc-200 max-w-[400px] whitespace-pre-wrap break-words">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
