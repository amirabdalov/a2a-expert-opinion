import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getFileDownloadUrl, downloadFile } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useSSE } from "@/hooks/use-sse";
import { InfoTooltip } from "@/components/info-tooltip";
import { NotificationBell } from "@/components/notification-bell";
import { OnboardingTour, EXPERT_TOUR_STEPS } from "@/components/onboarding-tour";
import { FloatingHelp } from "@/components/floating-help";
import {
  LayoutDashboard, Inbox, PlayCircle, History, DollarSign, UserCircle, LogOut,
  Clock, CheckCircle, Star, Award, Send, MessageSquare, Coins, TrendingUp,
  Search, Wrench, Paperclip, FileText, ArrowLeft, AlertCircle, User, Wallet,
  Lightbulb, Home, Printer, Download, Receipt, Share2, Camera,
  Bold, Italic, List as ListIcon, ListOrdered, Heading,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Request as ExpertRequest, Expert, ExpertReview, Message, CreditTransaction } from "@shared/schema";

// 2nd-Priority Fix 3: Format date to US Central time (h:mm AM/PM)
function formatCentralTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return "—"; }
}

type ExpertView = "overview" | "queue" | "active" | "completed" | "earnings" | "profile" | "review-detail";

// ─── Mobile Bottom Tab Bar ───
function MobileBottomTabs({ view, setView, onLogout }: { view: ExpertView; setView: (v: ExpertView) => void; onLogout: () => void }) {
  const tabs = [
    { id: "overview" as const, icon: Home, label: "Home" },
    { id: "queue" as const, icon: Inbox, label: "Queue" },
    { id: "active" as const, icon: PlayCircle, label: "Active" },
    { id: "profile" as const, icon: UserCircle, label: "Profile" },
  ];
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50 px-2 pb-[env(safe-area-inset-bottom)]" data-testid="mobile-bottom-tabs">
      <div className="flex justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex flex-col items-center py-2 px-3 text-[10px] transition-colors ${
              view === tab.id ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid={`mobile-tab-${tab.id}`}
          >
            <tab.icon className="h-5 w-5 mb-0.5" />
            {tab.label}
          </button>
        ))}
        <button
          onClick={onLogout}
          className="flex flex-col items-center py-2 px-3 text-[10px] text-red-500 transition-colors"
          data-testid="mobile-tab-logout"
        >
          <LogOut className="h-5 w-5 mb-0.5" />
          Logout
        </button>
      </div>
    </div>
  );
}

function serviceTypeBadge(t: string) {
  switch (t) {
    case "rate": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "review": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "custom": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default: return "bg-gray-100 text-gray-800";
  }
}

function statusColor(s: string) {
  switch (s) {
    case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "completed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    default: return "bg-gray-100 text-gray-800";
  }
}

// G2-3: Compute expert payout from request, preferring stored value over computed
const EXPERT_TAKE_RATES: Record<string, number> = { standard: 0.50, pro: 0.30, guru: 0.15 };
function getExpertPayout(request: any): string {
  if ((request as any).expertPayout != null) return Number((request as any).expertPayout).toFixed(2);
  const tr = EXPERT_TAKE_RATES[(request.tier || "standard").toLowerCase()] ?? 0.50;
  return (request.creditsCost * (1 - tr)).toFixed(2);
}

function ExpertSidebar({ view, setView, onLogout }: { view: ExpertView; setView: (v: ExpertView) => void; onLogout: () => void }) {
  const items = [
    { id: "overview" as const, icon: LayoutDashboard, label: "Overview" },
    { id: "queue" as const, icon: Inbox, label: "Available Queue" },
    { id: "active" as const, icon: PlayCircle, label: "My Active" },
    { id: "completed" as const, icon: History, label: "Completed" },
    { id: "earnings" as const, icon: DollarSign, label: "Earnings" },
    { id: "profile" as const, icon: UserCircle, label: "Profile" },
  ];
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src="/a2a-blue-logo.svg" alt="A2A" className="h-14 w-14 shrink-0 bg-white rounded-lg p-1" />
          <span className="font-semibold text-sm text-sidebar-foreground">Expert Portal</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton onClick={() => setView(item.id)} isActive={view === item.id} data-testid={`expert-nav-${item.id}`}>
                    <item.icon className="h-4 w-4" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onLogout} data-testid="expert-nav-logout">
                  <LogOut className="h-4 w-4" /><span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// ─── Expert Overview ───
function ExpertOverview({ expert, userId, setView }: { expert: Expert; userId: number; setView: (v: ExpertView) => void }) {
  const { data: creditData } = useQuery<{ credits: number; transactions: CreditTransaction[] }>({ queryKey: ["/api/credits", userId] });
  const { data: myReviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/expert", expert.id] });
  const { data: pendingReviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/pending"] });

  const active = myReviews?.filter((r) => r.status === "in_progress").length ?? 0;
  const completed = myReviews?.filter((r) => r.status === "completed").length ?? 0;
  const earnings = creditData?.transactions?.filter((t) => t.type === "earning").reduce((sum, t) => sum + t.amount, 0) ?? 0;

  return (
    <div className="p-6 space-y-6" data-testid="expert-view-overview">
      <h1 className="text-xl font-bold">Expert Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setView("earnings")} data-testid="card-stat-credits">
          <CardContent className="p-4"><div className="flex items-center gap-3"><Coins className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">${creditData?.credits ?? 0}</p><p className="text-xs text-muted-foreground">$ Credits Balance <InfoTooltip text="Your current available credits balance" /></p></div></div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setView("active")} data-testid="card-stat-active">
          <CardContent className="p-4"><div className="flex items-center gap-3"><PlayCircle className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{active}</p><p className="text-xs text-muted-foreground">Active Reviews</p></div></div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setView("queue")} data-testid="card-stat-queue">
          <CardContent className="p-4"><div className="flex items-center gap-3"><Inbox className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{pendingReviews?.length ?? 0}</p><p className="text-xs text-muted-foreground">Pending Queue <InfoTooltip text="Requests waiting for an expert to claim them" /></p></div></div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setView("profile")} data-testid="card-stat-rating">
          <CardContent className="p-4"><div className="flex items-center gap-3"><Star className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold">{(expert.rating / 10).toFixed(1)}</p><p className="text-xs text-muted-foreground">Avg Rating <InfoTooltip text="Your average score from client feedback. Higher ratings get more requests" /> ({expert.totalReviews} reviews)</p></div></div></CardContent>
        </Card>
      </div>

      <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setView("completed")} data-testid="card-stat-completed">
        <CardHeader className="pb-3"><CardTitle className="text-base">Completed: {completed}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <p className="text-sm text-muted-foreground">You've earned ${earnings} credits from {completed} completed reviews.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Estimated payout helper ───
function getEstimatedPayout(serviceType: string, tier: string): { min: number; max: number; time: string } {
  const payouts: Record<string, Record<string, { min: number; max: number; time: string }>> = {
    rate: { standard: { min: 2, max: 10, time: "5-15 min" }, pro: { min: 15, max: 50, time: "15-30 min" }, guru: { min: 100, max: 300, time: "30-90 min" } },
    review: { standard: { min: 10, max: 50, time: "15-30 min" }, pro: { min: 50, max: 200, time: "30-60 min" }, guru: { min: 300, max: 1000, time: "1-3 hours" } },
    custom: { standard: { min: 5, max: 25, time: "10-20 min" }, pro: { min: 25, max: 100, time: "20-45 min" }, guru: { min: 150, max: 500, time: "45-120 min" } },
  };
  const servicePayouts = payouts[serviceType] || payouts.custom;
  return servicePayouts[tier] || servicePayouts.standard || { min: 5, max: 25, time: "10-30 min" };
}

// ─── Available Queue ───
function AvailableQueue({ expertId, setView, setSelectedReview }: { expertId: number; setView: (v: ExpertView) => void; setSelectedReview: (id: number) => void }) {
  const { data: pendingReviews, isLoading } = useQuery<ExpertReview[]>({
    queryKey: ["/api/reviews/pending", `?expertId=${expertId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reviews/pending?expertId=${expertId}`);
      return res.json();
    },
  });
  const { toast } = useToast();
  const [skippedRequests, setSkippedRequests] = useState<number[]>([]);

  const claimMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const res = await apiRequest("POST", `/api/reviews/${reviewId}/claim`, { expertId });
      return res.json();
    },
    onSuccess: async (data) => {
      // G2-2: Pre-populate review into cache so ReviewDetail can render immediately
      queryClient.setQueryData<ExpertReview[]>(["/api/reviews/expert", expertId], (old) => {
        if (!old) return [data];
        const exists = old.some((r) => r.id === data.id);
        return exists ? old.map((r) => r.id === data.id ? data : r) : [...old, data];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/request", data.requestId] });
      toast({ title: "Review claimed!" });
      // G2-2: Navigate immediately — data is already in cache
      setSelectedReview(data.id);
      setView("review-detail");
      // Refetch in background to sync with server
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/expert", expertId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSkip = (requestId: number) => {
    setSkippedRequests((prev) => [...prev, requestId]);
    toast({ title: "Request hidden", description: "You won't see it again this session." });
  };

  // Filter out skipped reviews
  const filteredReviews = pendingReviews?.filter((r) => !skippedRequests.includes(r.requestId));

  return (
    <div className="p-4 md:p-6" data-testid="expert-view-queue">
      <h1 className="text-lg md:text-xl font-bold mb-4 md:mb-6">Available Reviews</h1>
      {isLoading ? <ExpertQueueSkeleton /> : (
        <div className="space-y-3 md:space-y-4">
          {(!filteredReviews || filteredReviews.length === 0) ? (
            <Card><CardContent className="p-8 text-center">
              <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-medium">No matching requests right now</p>
              <p className="text-xs text-muted-foreground mt-1">No requests in your categories right now. Check back soon!</p>
            </CardContent></Card>
          ) : (
            <PendingReviewCards reviews={filteredReviews} onClaim={(id) => claimMutation.mutate(id)} isPending={claimMutation.isPending} onSkip={handleSkip} />
          )}
        </div>
      )}
    </div>
  );
}

function PendingReviewCards({ reviews, onClaim, isPending, onSkip }: { reviews: ExpertReview[]; onClaim: (id: number) => void; isPending: boolean; onSkip?: (requestId: number) => void }) {
  const grouped = reviews.reduce<Record<number, ExpertReview[]>>((acc, rev) => {
    if (!acc[rev.requestId]) acc[rev.requestId] = [];
    acc[rev.requestId].push(rev);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grouped).map(([reqIdStr, revs]) => (
        <PendingRequestGroup key={reqIdStr} requestId={parseInt(reqIdStr)} reviews={revs} onClaim={onClaim} isPending={isPending} onSkip={onSkip} />
      ))}
    </>
  );
}

function PendingRequestGroup({ requestId, reviews, onClaim, isPending, onSkip }: { requestId: number; reviews: ExpertReview[]; onClaim: (id: number) => void; isPending: boolean; onSkip?: (requestId: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: request } = useQuery<ExpertRequest>({ queryKey: ["/api/requests", requestId] });
  const { data: allReviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/request", requestId] });
  const { data: requestFiles } = useQuery({ queryKey: ["/api/files", requestId], queryFn: () => apiRequest("GET", `/api/files/${requestId}`).then(r => r.json()).catch(() => []), enabled: expanded });

  if (!request) return null;

  const completedCount = allReviews?.filter((r) => r.status === "completed").length ?? 0;
  const totalCount = allReviews?.length ?? 0;
  const claimableReview = reviews[0];
  const payout = getEstimatedPayout(request.serviceType, request.tier || "standard");

  const expertPayoutAmount = getExpertPayout(request);

  return (
    <Card data-testid={`queue-request-${requestId}`} className="hover:shadow-md transition">
      <CardContent className="p-4">
        {/* Clickable header — preview the request */}
        <div className="cursor-pointer" onClick={() => setExpanded(!expanded)} data-testid={`preview-toggle-${requestId}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-semibold">{request.title}</h3>
                <Badge className={`text-[10px] ${serviceTypeBadge(request.serviceType)}`}>{request.serviceType}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{request.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{expanded ? "▲ Less" : "▼ Preview"}</span>
              </div>
              <p className={`text-sm text-muted-foreground mb-2 ${expanded ? "" : "line-clamp-2"}`}>{request.description}</p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <span className="text-green-600 font-semibold text-sm">${expertPayoutAmount}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /><span title="US Central time zone">{formatCentralTime(request.createdAt)}</span></span>
            <span className="flex items-center gap-1" data-testid={`time-${requestId}`}><Clock className="h-3 w-3" />{payout.time}</span>
            {request.serviceType === "rate" && (
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{completedCount}/{totalCount} responded</span>
            )}
          </div>
        </div>

        {/* Expanded preview — full request details before claiming */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Full Description</p>
              <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </div>
            {request.aiResponse && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">AI-Generated Draft</p>
                <div className="text-sm bg-blue-50 rounded p-3 whitespace-pre-wrap">{request.aiResponse}</div>
              </div>
            )}
            {request.instructions && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Client Instructions</p>
                <p className="text-sm">{request.instructions}</p>
              </div>
            )}
            {requestFiles && requestFiles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Attachments ({requestFiles.length})</p>
                <div className="space-y-1">
                  {requestFiles.map((f: any) => (
                    <button key={f.id} onClick={() => downloadFile(`/api/files/${requestId}/${encodeURIComponent(f.filename)}`, f.filename)} className="flex items-center gap-1 text-primary hover:underline text-sm cursor-pointer bg-transparent border-0 p-0 text-left">
                      📎 {f.filename} ({(f.size / 1024).toFixed(1)} KB)
                      {f.uploader_role === 'expert' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 border border-teal-200">Expert</span>}
                      {f.uploader_role === 'client' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">Client</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs">
              <span><strong>Tier:</strong> {request.tier}</span>
              <span><strong>Category:</strong> {request.category}</span>
              <span className="text-green-600 font-semibold">Your payout: ${expertPayoutAmount}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-50">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onClaim(claimableReview.id); }} disabled={isPending} data-testid={`button-claim-review-${claimableReview.id}`}>
            Claim
          </Button>
            {onSkip && (
              <button
                onClick={() => onSkip(requestId)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`button-skip-${requestId}`}
              >
                Not interested
              </button>
            )}
          </div>
      </CardContent>
    </Card>
  );
}

// ─── My Active ───
function MyActive({ expertId, setView, setSelectedReview }: { expertId: number; setView: (v: ExpertView) => void; setSelectedReview: (id: number) => void }) {
  const { data: allReviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/expert", expertId] });
  const active = allReviews?.filter((r) => r.status === "in_progress") ?? [];

  return (
    <div className="p-6" data-testid="expert-view-active">
      <h1 className="text-xl font-bold mb-6">My Active Reviews</h1>
      {active.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><p className="text-sm text-muted-foreground">No active reviews. Check the queue for new ones.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {active.map((rev) => (
            <ActiveReviewCard key={rev.id} review={rev} onClick={() => { setSelectedReview(rev.id); setView("review-detail"); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveReviewCard({ review, onClick }: { review: ExpertReview; onClick: () => void }) {
  const { data: request } = useQuery<ExpertRequest>({ queryKey: ["/api/requests", review.requestId] });
  if (!request) return null;

  return (
    <Card className="cursor-pointer hover:shadow-md transition" onClick={onClick} data-testid={`active-review-${review.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold">{request.title}</h3>
              <Badge className={`text-[10px] ${serviceTypeBadge(request.serviceType)}`}>{request.serviceType}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{request.category} · {request.tier} · ${getExpertPayout(request)} payout</p>
          </div>
          <Badge className="bg-blue-100 text-blue-800 text-xs">In Progress</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Rich Text Toolbar (change #8) ───
function MarkdownToolbar({ textareaRef, value, onChange }: { textareaRef: React.RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void }) {
  function insertMarkdown(prefix: string, suffix: string = '') {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);
    const newText = before + prefix + (selected || 'text') + suffix + after;
    onChange(newText);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = start + prefix.length + (selected.length || 4);
    }, 10);
  }

  return (
    <div className="flex items-center gap-1 p-1.5 border border-b-0 rounded-t-lg bg-muted/30" data-testid="markdown-toolbar">
      <button type="button" onClick={() => insertMarkdown('**', '**')} className="p-1.5 rounded hover:bg-muted transition" title="Bold" data-testid="toolbar-bold"><Bold className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => insertMarkdown('*', '*')} className="p-1.5 rounded hover:bg-muted transition" title="Italic" data-testid="toolbar-italic"><Italic className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => insertMarkdown('## ')} className="p-1.5 rounded hover:bg-muted transition" title="Heading" data-testid="toolbar-heading"><Heading className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" onClick={() => insertMarkdown('- ')} className="p-1.5 rounded hover:bg-muted transition" title="Bullet list" data-testid="toolbar-bullet"><ListIcon className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => insertMarkdown('1. ')} className="p-1.5 rounded hover:bg-muted transition" title="Numbered list" data-testid="toolbar-numbered"><ListOrdered className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ─── Expert Response Templates (change #9) ───
const EXPERT_RESPONSE_TEMPLATES = [
  { label: 'Sense Check Template', content: 'Rating: /10\n\nWhat\'s correct:\n- \n\nWhat\'s incorrect:\n- \n\nRecommendation:\n' },
  { label: 'Detailed Review Template', content: '## Summary\n\n## What\'s Correct\n- \n\n## What\'s Wrong\n- \n\n## Missing Context\n- \n\n## Recommendations\n- \n\n## What Was at Stake\n' },
  { label: 'Custom Task Template', content: '## Executive Summary\n\n## Analysis\n\n## Key Findings\n\n## Recommendations\n\n## Next Steps\n' },
];

function ExpertTemplateDropdown({ onSelect, hasContent }: { onSelect: (content: string) => void; hasContent: boolean }) {
  const { toast } = useToast();
  const [confirmTemplate, setConfirmTemplate] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-expert-templates">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Templates
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {EXPERT_RESPONSE_TEMPLATES.map((tpl) => (
            <DropdownMenuItem
              key={tpl.label}
              onClick={() => {
                if (hasContent) {
                  setConfirmTemplate(tpl.content);
                } else {
                  onSelect(tpl.content);
                }
              }}
              data-testid={`expert-template-${tpl.label.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {tpl.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmTemplate !== null} onOpenChange={() => setConfirmTemplate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Replace content?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will replace your current text with the template.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTemplate(null)}>Cancel</Button>
            <Button onClick={() => { if (confirmTemplate) onSelect(confirmTemplate); setConfirmTemplate(null); }}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Skeleton loaders for expert (change #7/#12)
function ExpertQueueSkeleton() {
  return (
    <div className="p-6 space-y-4" data-testid="skeleton-queue">
      <div className="h-6 w-40 bg-muted animate-pulse rounded" />
      {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
    </div>
  );
}

function ExpertEarningsSkeleton() {
  return (
    <div className="p-6 space-y-6" data-testid="skeleton-earnings">
      <div className="h-6 w-32 bg-muted animate-pulse rounded" />
      <div className="grid sm:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
      </div>
      <div className="h-48 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

// ─── Review Detail (Expert — type-specific) ───
function ReviewDetail({ reviewId, expertId, setView }: { reviewId: number; expertId: number; setView: (v: ExpertView) => void }) {
  const { data: myReviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/expert", expertId] });
  const currentReview = myReviews?.find((r) => r.id === reviewId);

  const { data: request } = useQuery<ExpertRequest>({
    queryKey: ["/api/requests", currentReview?.requestId],
    enabled: !!currentReview?.requestId,
  });

  // FIX-5: Fetch full chat/message history and timeline for this request
  const { data: chatMessages, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["/api/messages", currentReview?.requestId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/messages/${currentReview!.requestId}`);
      return res.json();
    },
    enabled: !!currentReview?.requestId,
  });

  const { data: timelineEvents, refetch: refetchTimeline } = useQuery<any[]>({
    queryKey: ["/api/requests", currentReview?.requestId, "timeline"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/requests/${currentReview!.requestId}/timeline`);
      return res.json();
    },
    enabled: !!currentReview?.requestId,
  });

  const followUpMessages = timelineEvents?.filter((e) => e.type === "message") ?? [];

  // Follow-up reply state
  const [replyText, setReplyText] = useState("");
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [correctPoints, setCorrectPoints] = useState("");
  const [incorrectPoints, setIncorrectPoints] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [deliverable, setDeliverable] = useState("");

  // Refs for markdown toolbar
  const ratingCommentRef = useRef<HTMLTextAreaElement>(null);
  const correctPointsRef = useRef<HTMLTextAreaElement>(null);
  const incorrectPointsRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLTextAreaElement>(null);
  const deliverableRef = useRef<HTMLTextAreaElement>(null);

  // Current active field for templates
  const [activeField, setActiveField] = useState<string>("deliverable");
  const handleTemplateSelect = (content: string) => {
    if (activeField === "correctPoints") setCorrectPoints(content);
    else if (activeField === "incorrectPoints") setIncorrectPoints(content);
    else if (activeField === "suggestions") setSuggestions(content);
    else if (activeField === "deliverable") setDeliverable(content);
    else if (activeField === "ratingComment") setRatingComment(content);
  };
  const getActiveContent = () => {
    if (activeField === "correctPoints") return correctPoints;
    if (activeField === "incorrectPoints") return incorrectPoints;
    if (activeField === "suggestions") return suggestions;
    if (activeField === "deliverable") return deliverable;
    if (activeField === "ratingComment") return ratingComment;
    return "";
  };

  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {};
      if (request?.serviceType === "rate") {
        body.rating = ratingValue;
        body.ratingComment = ratingComment || null;
        body.deliverable = ratingComment || null;
      } else if (request?.serviceType === "review") {
        body.correctPoints = correctPoints || null;
        body.incorrectPoints = incorrectPoints || null;
        body.suggestions = suggestions || null;
        body.deliverable = [correctPoints, incorrectPoints, suggestions].filter(Boolean).join("\n\n") || null;
      } else if (request?.serviceType === "custom") {
        body.deliverable = deliverable || null;
      } else {
        body.deliverable = deliverable || null;
      }

      // FIX-1: Try POST /api/expert-reviews/{reviewId}/respond first, fall back to PATCH
      try {
        const respondRes = await apiRequest("POST", `/api/expert-reviews/${reviewId}/respond`, { deliverable: body.deliverable });
        if (respondRes.ok) return respondRes.json();
      } catch {
        // fallback to PATCH
      }
      const res = await apiRequest("PATCH", `/api/reviews/${reviewId}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Response submitted!", description: "Your response is now under A2A verification before delivery to the client." });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/expert", expertId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/request", currentReview?.requestId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/pending"] });
      if (currentReview?.requestId) {
        queryClient.invalidateQueries({ queryKey: ["/api/requests", currentReview.requestId] });
      }
      setView("completed");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Follow-up reply mutation
  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentReview?.requestId) throw new Error("No request ID");
      const res = await apiRequest("POST", `/api/requests/${currentReview.requestId}/message`, {
        role: "expert",
        actorId: undefined,
        actorName: "Expert",
        message: content,
      });
      if (!res.ok) throw new Error("Failed to send reply");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reply sent!", description: "Your message has been delivered to the client." });
      setReplyText("");
      refetchTimeline();
      refetchMessages();
    },
    onError: (err: Error) => {
      toast({ title: "Error sending reply", description: err.message, variant: "destructive" });
    },
  });

  if (!currentReview || !request) return <div className="p-6"><p className="text-sm text-muted-foreground">Loading...</p></div>;

  const parsedAttachments: Array<{ name: string; content: string }> = (() => {
    try { return JSON.parse(request.attachments || "[]"); } catch { return []; }
  })();

  // FIX-6: Fetch DB-stored files for this request
  const { data: requestFiles } = useQuery<Array<{ id: number; filename: string; size: number }>>(
    {
      queryKey: ['/api/files', currentReview.requestId],
      queryFn: () => apiRequest('GET', `/api/files/${currentReview.requestId}`).then(r => r.json()),
      enabled: !!currentReview.requestId,
    }
  );

  const isCompleted = currentReview.status === "completed";

  return (
    <div className="p-4 md:p-6 max-w-3xl md:mx-0" data-testid="expert-view-review-detail">
      <div className="flex items-center gap-2 md:gap-3 mb-1">
        <Button variant="ghost" size="sm" onClick={() => setView("active")} data-testid="button-back-to-active">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg md:text-xl font-bold truncate">{request.title}</h1>
        <Badge className={`text-xs shrink-0 ${serviceTypeBadge(request.serviceType)}`}>{request.serviceType}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4 ml-9 md:ml-10">{request.category} · {request.tier} tier · ${getExpertPayout(request)} payout</p>

      {request.aiResponse && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{request.serviceType === "custom" ? "Task Description" : "AI Response to Evaluate"}</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded text-xs">{request.aiResponse}</p></CardContent>
        </Card>
      )}

      {request.description && request.description !== request.aiResponse && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Client's Question</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{request.description}</p></CardContent>
        </Card>
      )}

      {/* Attachments — Build 44 Fix 2 (OB 2026-04-21): de-duplicate JSON + DB-stored files.
          DB-stored files carry uploader_role and are source-of-truth; JSON entries only shown
          when they have no DB counterpart (legacy). Same logic as client-dashboard. */}
      {(() => {
        const dbFilenames = new Set((requestFiles || []).map((f: any) => (f.filename || '').toLowerCase()));
        const jsonOnly = parsedAttachments.filter((a: any) => !dbFilenames.has((a.name || '').toLowerCase()));
        const totalCount = (requestFiles?.length || 0) + jsonOnly.length;
        if (totalCount === 0 && isCompleted) return null;
        return (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachments{totalCount > 0 ? ` (${totalCount})` : ''}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* DB-stored file attachments — has uploader metadata (client vs expert) */}
              {requestFiles?.map((f: any) => (
                <button
                  key={`db-${f.id}`}
                  onClick={() => downloadFile(`/api/files/${currentReview.requestId}/${encodeURIComponent(f.filename)}`, f.filename)}
                  className="flex items-center gap-2 text-primary hover:underline text-sm cursor-pointer bg-transparent border-0 p-0 text-left"
                >
                  <Paperclip className="h-4 w-4 shrink-0" />
                  {f.filename} ({(f.size / 1024).toFixed(1)} KB)
                  {f.uploader_role === 'expert' ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 border border-teal-200">Expert</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">Client</span>
                  )}
                </button>
              ))}
              {/* Legacy JSON-only attachments (no DB row) — assumed Client-uploaded */}
              {jsonOnly.map((a: any, i: number) => (
                <button
                  key={`parsed-${i}`}
                  onClick={() => downloadFile(`/api/files/${currentReview?.requestId}/${encodeURIComponent(a.name)}`, a.name)}
                  className="flex items-center gap-2 text-primary hover:underline text-sm cursor-pointer bg-transparent border-0 p-0 text-left"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {a.name}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">Client</span>
                </button>
              ))}
              {/* G2-4: Expert file upload */}
              {!isCompleted && (
                <div className="pt-2 border-t mt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Camera className="h-4 w-4" />
                    <span>Upload attachment</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !currentReview?.requestId) return;
                        const form = new FormData();
                        form.append("file", file);
                        try {
                          // Build 39 Fix 4: Include auth headers on file upload
                          const { getToken } = await import("@/lib/auth");
                          const hdrs: Record<string, string> = {};
                          const tk = getToken();
                          if (tk) hdrs["Authorization"] = `Bearer ${tk}`;
                          const res = await fetch(`/api/requests/${currentReview.requestId}/upload`, { method: "POST", body: form, headers: hdrs });
                          if (!res.ok) throw new Error("Upload failed");
                          toast({ title: "File uploaded" });
                          queryClient.invalidateQueries({ queryKey: ["/api/files", currentReview.requestId] });
                        } catch (err: any) {
                          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        );
      })()}

      {request.instructions && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700 dark:text-amber-400">Client Instructions</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{request.instructions}</p></CardContent>
        </Card>
      )}

      {/* Type-specific input / completed display */}
      {!isCompleted && request.serviceType === "rate" && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Your Rating</CardTitle>
              <ExpertTemplateDropdown onSelect={handleTemplateSelect} hasContent={!!getActiveContent()} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Score: {ratingValue}/10</Label>
                <span className="text-2xl font-bold text-amber-600">{ratingValue}</span>
              </div>
              <Slider value={[ratingValue]} onValueChange={([v]) => setRatingValue(v)} min={1} max={10} step={1} className="mb-4" data-testid="slider-rating" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 — Poor</span><span>5 — Average</span><span>10 — Excellent</span>
              </div>
            </div>
            <div>
              <Label className="text-sm">Comment (optional)</Label>
              <MarkdownToolbar textareaRef={ratingCommentRef} value={ratingComment} onChange={setRatingComment} />
              <Textarea ref={ratingCommentRef} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} onFocus={() => setActiveField("ratingComment")} placeholder="Brief explanation for your rating..." rows={3} className="rounded-t-none" data-testid="input-rating-comment" />
            </div>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="mt-4" data-testid="button-submit-review">
              <Send className="mr-2 h-4 w-4" /> {submitMutation.isPending ? "Submitting..." : "Submit Rating"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isCompleted && request.serviceType === "review" && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4 text-blue-500" /> Your Review</CardTitle>
              <ExpertTemplateDropdown onSelect={handleTemplateSelect} hasContent={!!getActiveContent()} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm flex items-center gap-2 mb-1"><CheckCircle className="h-3 w-3 text-green-600" /> What's Correct</Label>
              <MarkdownToolbar textareaRef={correctPointsRef} value={correctPoints} onChange={setCorrectPoints} />
              <Textarea ref={correctPointsRef} value={correctPoints} onChange={(e) => setCorrectPoints(e.target.value)} onFocus={() => setActiveField("correctPoints")} placeholder="List what the AI got right..." rows={4} className="border-green-200 focus:ring-green-500 rounded-t-none" data-testid="input-correct-points" />
            </div>
            <div>
              <Label className="text-sm flex items-center gap-2 mb-1"><AlertCircle className="h-3 w-3 text-red-600" /> What's Wrong</Label>
              <MarkdownToolbar textareaRef={incorrectPointsRef} value={incorrectPoints} onChange={setIncorrectPoints} />
              <Textarea ref={incorrectPointsRef} value={incorrectPoints} onChange={(e) => setIncorrectPoints(e.target.value)} onFocus={() => setActiveField("incorrectPoints")} placeholder="List what the AI got wrong..." rows={4} className="border-red-200 focus:ring-red-500 rounded-t-none" data-testid="input-incorrect-points" />
            </div>
            <div>
              <Label className="text-sm flex items-center gap-2 mb-1"><MessageSquare className="h-3 w-3 text-blue-600" /> Suggestions</Label>
              <MarkdownToolbar textareaRef={suggestionsRef} value={suggestions} onChange={setSuggestions} />
              <Textarea ref={suggestionsRef} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} onFocus={() => setActiveField("suggestions")} placeholder="Your recommendations and improvements..." rows={4} className="border-blue-200 focus:ring-blue-500 rounded-t-none" data-testid="input-suggestions" />
            </div>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || (!correctPoints && !incorrectPoints && !suggestions)} data-testid="button-submit-review">
              <Send className="mr-2 h-4 w-4" /> {submitMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isCompleted && request.serviceType === "custom" && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4 text-purple-500" /> Your Deliverable</CardTitle>
              <ExpertTemplateDropdown onSelect={(content) => setDeliverable(content)} hasContent={!!deliverable} />
            </div>
          </CardHeader>
          <CardContent>
            <MarkdownToolbar textareaRef={deliverableRef} value={deliverable} onChange={setDeliverable} />
            <Textarea ref={deliverableRef} value={deliverable} onChange={(e) => setDeliverable(e.target.value)} onFocus={() => setActiveField("deliverable")} placeholder="Write your complete deliverable here..." rows={12} className="mb-4 font-mono text-xs rounded-t-none" data-testid="input-deliverable" />
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !deliverable.trim()} data-testid="button-submit-review">
              <Send className="mr-2 h-4 w-4" /> {submitMutation.isPending ? "Submitting..." : "Submit Deliverable"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fix 3: Fallback response form for any unrecognized service type */}
      {!isCompleted && request.serviceType !== "rate" && request.serviceType !== "review" && request.serviceType !== "custom" && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4 text-blue-500" /> Your Response</CardTitle>
              <ExpertTemplateDropdown onSelect={(content) => setDeliverable(content)} hasContent={!!deliverable} />
            </div>
          </CardHeader>
          <CardContent>
            <MarkdownToolbar textareaRef={deliverableRef} value={deliverable} onChange={setDeliverable} />
            <Textarea ref={deliverableRef} value={deliverable} onChange={(e) => setDeliverable(e.target.value)} onFocus={() => setActiveField("deliverable")} placeholder="Write your response here..." rows={10} className="mb-4 rounded-t-none" data-testid="input-deliverable" />
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !deliverable.trim()} data-testid="button-submit-review">
              <Send className="mr-2 h-4 w-4" /> {submitMutation.isPending ? "Submitting..." : "Submit Response"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isCompleted && request.serviceType === "rate" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm font-semibold text-green-800 dark:text-green-400">Your Rating: {currentReview.rating}/10</p>
            </div>
            {currentReview.ratingComment && <p className="text-sm">{currentReview.ratingComment}</p>}
          </CardContent>
        </Card>
      )}

      {isCompleted && request.serviceType === "review" && (
        <div className="space-y-3">
          {currentReview.correctPoints && (
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> What's Correct</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{currentReview.correctPoints}</p></CardContent>
            </Card>
          )}
          {currentReview.incorrectPoints && (
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> What's Wrong</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{currentReview.incorrectPoints}</p></CardContent>
            </Card>
          )}
          {currentReview.suggestions && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Suggestions</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{currentReview.suggestions}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      {isCompleted && request.serviceType === "custom" && (
        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-700 dark:text-purple-400 flex items-center gap-2"><Wrench className="h-4 w-4" /> Your Deliverable</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{currentReview.deliverable}</p></CardContent>
        </Card>
      )}

      {/* FIX: Show deliverable for any completed service type not covered above */}
      {isCompleted && request.serviceType !== "rate" && request.serviceType !== "review" && request.serviceType !== "custom" && currentReview.deliverable && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Your Response</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{currentReview.deliverable}</p></CardContent>
        </Card>
      )}

      {/* OB-3: Verification status + pending credits banner */}
      {isCompleted && request.status === "under_review" && (
        <Card className="mt-4 border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Under A2A Global Verification</p>
              <p className="text-xs text-muted-foreground">${getExpertPayout(request)} pending (under client's review)</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isCompleted && (request.status === "awaiting_followup" || request.status === "completed") && (
        <Card className={`mt-4 ${request.clientRating != null ? "border-green-300 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/30" : "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {request.clientRating != null ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-400">Verified & Approved</p>
                  <p className="text-xs text-green-600">${getExpertPayout(request)} earned</p>
                </div>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Awaiting Client's Review</p>
                  <p className="text-xs text-amber-600">${getExpertPayout(request)} pending (under client's review)</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* FIX-2: Client review/feedback display */}
      {request.clientRating && (
        <Card className="mt-4 border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-semibold">Client Review: {request.clientRating}/5</p>
            </div>
            {request.clientRatingComment && (
              <p className="text-sm text-muted-foreground italic">"{request.clientRatingComment}"</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* FIX-5: Full conversation/chat history for this request + Follow-up reply form */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            {followUpMessages.length > 0 || (chatMessages && chatMessages.length > 0) ? "Conversation Thread" : "Follow-up Messages"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Chat messages */}
          {((chatMessages && chatMessages.length > 0) || followUpMessages.length > 0) ? (
            <div className="space-y-3 mb-5">
              {/* AI chat messages */}
              {chatMessages?.map((msg: Message) => (
                <div key={`chat-${msg.id}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-xs ${
                    msg.role === "user"
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                      : "bg-muted text-foreground"
                  }`}>
                    <p className="font-semibold mb-1 opacity-70">{msg.role === "user" ? "Client" : "AI"}</p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {/* Follow-up messages from timeline */}
              {followUpMessages.map((evt: any) => {
                const isExpert = evt.actorName && typeof evt.actorName === "string" && evt.actorName.toLowerCase().includes("expert");
                return (
                  <div key={`evt-${evt.id}`} className={`flex ${isExpert ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 text-xs ${
                      isExpert
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                        : "bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30"
                    }`}>
                      <p className={`font-semibold mb-1 ${
                        isExpert ? "opacity-70" : "text-amber-700 dark:text-amber-400"
                      }`}>{evt.actorName || "Client"}</p>
                      <p className="whitespace-pre-wrap text-foreground">{evt.message}</p>
                      {evt.createdAt && (
                        <p className="text-[10px] text-muted-foreground mt-1"><span title="US Central time zone">{formatCentralTime(evt.createdAt)}</span></p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-4">No follow-up messages yet. If the client asks a follow-up question, it will appear here.</p>
          )}

          {/* Follow-up Reply Form */}
          <div className="border-t pt-4" data-testid="expert-followup-reply-form">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Reply to Client Follow-ups
            </p>
            <Textarea
              ref={replyTextareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply to the client here..."
              rows={4}
              className="mb-3 resize-none"
              data-testid="expert-reply-textarea"
            />
            <Button
              onClick={() => {
                if (replyText.trim()) replyMutation.mutate(replyText.trim());
              }}
              disabled={replyMutation.isPending || !replyText.trim()}
              className="w-full sm:w-auto"
              data-testid="expert-reply-send-button"
            >
              <Send className="mr-2 h-4 w-4" />
              {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Completed History ───
function CompletedHistory({ expertId, setView, setSelectedReview }: { expertId: number; setView: (v: ExpertView) => void; setSelectedReview: (id: number) => void }) {
  const { data: allReviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/expert", expertId] });
  const completed = [...(allReviews?.filter((r) => r.status === "completed") ?? [])].sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  return (
    <div className="p-6" data-testid="expert-view-completed">
      <h1 className="text-xl font-bold mb-6">Completed History</h1>
      {completed.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><p className="text-sm text-muted-foreground">No completed reviews yet</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {completed.map((rev) => (
            <CompletedReviewCard key={rev.id} review={rev} onClick={() => { setSelectedReview(rev.id); setView("review-detail"); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompletedReviewCard({ review, onClick }: { review: ExpertReview; onClick: () => void }) {
  const { data: request } = useQuery<ExpertRequest>({ queryKey: ["/api/requests", review.requestId] });
  if (!request) return null;

  // Determine verification status and credits display
  const isUnderReview = request.status === "under_review";
  const isApproved = request.status === "awaiting_followup" || request.status === "completed";
  const isRejected = request.status === "in_progress" && review.status === "completed";

  return (
    <Card className="cursor-pointer hover:shadow-md transition" onClick={onClick} data-testid={`completed-review-${review.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold">{request.title}</h3>
              <Badge className={`text-[10px] ${serviceTypeBadge(request.serviceType)}`}>{request.serviceType}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{request.category} · Submitted <span title="US Central time zone">{formatCentralTime(review.completedAt)}</span></p>
          </div>
          <div className="text-right space-y-1">
            {request.serviceType === "rate" && review.rating && (
              <span className="text-lg font-bold text-amber-600">{review.rating}/10</span>
            )}
            {isUnderReview && (
              <>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Under A2A Global Verification</Badge>
                <p className="text-[10px] text-muted-foreground">${getExpertPayout(request)} payout pending after verification</p>
              </>
            )}
            {isApproved && request.clientRating != null && (
              <>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">Approved</Badge>
                <p className="text-[10px] text-green-600 font-medium">${getExpertPayout(request)} earned</p>
              </>
            )}
            {isApproved && request.clientRating == null && (
              <>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Approved</Badge>
                <p className="text-[10px] text-amber-600 font-medium">${getExpertPayout(request)} pending (under client's review)</p>
              </>
            )}
            {!isUnderReview && !isApproved && (
              <Badge className="bg-green-100 text-green-800 text-xs">Completed</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Normalize any legacy/seed tier value → Standard / Pro / Guru ───
function normalizeTier(raw: string | null | undefined): string {
  if (!raw) return "Standard";
  const t = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (t === "guru" || t === "ultimate") return "Guru";
  if (t === "pro" || t === "advanced" || t === "specialist") return "Pro";
  return "Standard";
}

// ─── Invoice types ───
interface InvoiceLineItem {
  reviewId: number;
  requestId: number;
  title: string;
  serviceType: string;
  category: string;
  creditsCost: number;
  completedAt: string;
  amountCents: number;
}

interface InvoiceData {
  invoice: { invoiceNumber: string; createdAt: string };
  expert: { id: number; name: string; email: string; category: string; tier: string };
  lineItems: InvoiceLineItem[];
  totalAmountCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  netPayoutCents: number;
}

// ─── Invoice Rendered Component ───
function InvoiceDocument({ data, userId }: { data: InvoiceData; userId: number }) {
  return (
    <div id="invoice-print-area" className="bg-white text-slate-900 p-8 max-w-[700px] mx-auto text-sm" data-testid="invoice-document">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; font-size: 11px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 border-b pb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Expert Payout Statement</h1>
          <p className="text-xs text-slate-500">Generated by A2A Expert Opinion Platform</p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-[#0F3DD1] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">A2A</span>
            </div>
            <span className="font-bold text-sm text-slate-800">A2A Global Inc.</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Merchant / Remitter</p>
        </div>
      </div>

      {/* Statement info + Expert details (two columns) */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Statement Information</h3>
          <table className="text-xs w-full">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500 w-40">Statement Number</td>
                <td className="py-1.5 font-mono font-semibold">{data.invoice.invoiceNumber}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">Statement Date</td>
                <td className="py-1.5">{new Date(data.invoice.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">Expert ID</td>
                <td className="py-1.5 font-mono">EX-{String(data.expert.id).padStart(6, "0")}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">A2A Account Number</td>
                <td className="py-1.5 font-mono">ACC-{String(userId).padStart(6, "0")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Expert Details</h3>
          <table className="text-xs w-full">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500 w-24">Name</td>
                <td className="py-1.5 font-semibold">{data.expert.name}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">Email</td>
                <td className="py-1.5">{data.expert.email}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">Category</td>
                <td className="py-1.5 capitalize">{data.expert.category}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">Tier</td>
                <td className="py-1.5 font-semibold">{normalizeTier(data.expert.tier)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Services Rendered</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200">
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Description</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Date Completed</th>
              <th className="text-right py-2 px-3 font-semibold text-slate-600">Credits</th>
              <th className="text-right py-2 px-3 font-semibold text-slate-600">Amount USD</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-2 px-3">{item.title} — {item.serviceType} review</td>
                <td className="py-2 px-3 text-slate-500"><span title="US Central time zone">{formatCentralTime(item.completedAt)}</span></td>
                <td className="py-2 px-3 text-right">{item.creditsCost}</td>
                <td className="py-2 px-3 text-right font-mono">${(item.amountCents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t-2 border-slate-300 pt-3 mb-8">
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-1.5 text-xs">
              <span className="text-slate-500">Subtotal (Expert Net)</span>
              <span className="font-mono">${(data.totalAmountCents / 100).toFixed(2)}</span>
            </div>
            {/* FIX-2: Only show platform fee row if it's non-zero */}
            {data.platformFeeRate > 0 && (
              <div className="flex justify-between py-1.5 text-xs">
                <span className="text-slate-500">Platform Fee ({data.platformFeeRate}%)</span>
                <span className="font-mono text-red-600">-${(data.platformFeeCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-sm font-bold border-t border-slate-200 mt-1">
              <span>Net Payout</span>
              <span className="text-green-700 font-mono">${(data.netPayoutCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-4 text-[10px] text-slate-400 text-center space-y-1">
        <p>© 2026 A2A Global Inc. All rights reserved. https://a2a.global/</p>
        <p>File number 10050200, Newark, Delaware, United States.</p>
        <p>For any questions, please contact billing@a2a.global</p>
      </div>
    </div>
  );
}

// ─── Withdrawal History ───
function WithdrawalHistory({ expertId }: { expertId?: number }) {
  const { data: invoices } = useQuery<any[]>({
    queryKey: ["/api/experts", expertId, "invoices"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/experts/${expertId}/invoices`);
      return res.json();
    },
    enabled: !!expertId,
  });

  if (!invoices || invoices.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-4">Withdrawal History</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium text-xs">Date</th>
              <th className="text-left p-3 font-medium text-xs">Invoice #</th>
              <th className="text-right p-3 font-medium text-xs">Gross</th>
              <th className="text-right p-3 font-medium text-xs">Net Payout</th>
              <th className="text-right p-3 font-medium text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3 text-xs text-muted-foreground"><span title="US Central time zone">{formatCentralTime(inv.createdAt)}</span></td>
                <td className="p-3 text-sm font-mono">{inv.invoiceNumber}</td>
                <td className="p-3 text-right text-sm">${(inv.totalAmount / 100).toFixed(2)}</td>
                <td className="p-3 text-right text-sm font-medium text-green-600">${(inv.netPayout / 100).toFixed(2)}</td>
                <td className="p-3 text-right">
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"} className={`text-[10px] ${inv.status === "paid" ? "bg-green-100 text-green-700" : ""}`}>
                    {inv.status === "pending" ? "Pending" : inv.status === "paid" ? "Paid" : inv.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Earnings (with Withdrawal + Invoice Dialog) ───
function Earnings({ userId }: { userId: number }) {
  const { data } = useQuery<{ credits: number; transactions: CreditTransaction[] }>({ queryKey: ["/api/credits", userId] });
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [showBankDetailsDialog, setShowBankDetailsDialog] = useState(false);
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankSwiftCode, setBankSwiftCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  // BUG-3: Expanded verification fields
  const [govIdType, setGovIdType] = useState("");
  const [govIdNumber, setGovIdNumber] = useState("");
  const [fullLegalName, setFullLegalName] = useState("");
  const [verCountry, setVerCountry] = useState("");
  const [fullAddress, setFullAddress] = useState(""); // legacy
  const [apartmentStreet, setApartmentStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [iban, setIban] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportUploading, setPassportUploading] = useState(false);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get expert for invoice data
  const { data: expert } = useQuery<Expert>({
    queryKey: ["/api/experts/user", userId],
    enabled: !!userId,
  });

  // OB-J: Fetch bank/verification details
  const { data: verification, refetch: refetchVerification } = useQuery<any>({
    queryKey: ["/api/experts", expert?.id, "verification"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/experts/${expert!.id}/verification`);
      return res.json();
    },
    enabled: !!expert?.id,
  });

  // OB-J: Fetch withdrawal requests
  const { data: withdrawalRequests, refetch: refetchWithdrawals } = useQuery<any[]>({
    queryKey: ["/api/experts", expert?.id, "withdrawal-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/experts/${expert!.id}/withdrawal-requests`);
      return res.json();
    },
    enabled: !!expert?.id,
  });

  const hasBankDetails = !!verification?.accountNumber;

  // OB-J: Upload passport
  async function handlePassportUpload(file: File) {
    if (!expert) return;
    setPassportUploading(true);
    try {
      const formData = new FormData();
      formData.append("passport", file);
      // Build 39 Fix 4: Include auth headers on passport upload
      const { getToken: getAuthToken } = await import("@/lib/auth");
      const authHeaders: Record<string, string> = {};
      const authTk = getAuthToken();
      if (authTk) authHeaders["Authorization"] = `Bearer ${authTk}`;
      const res = await fetch(`/api/experts/${expert.id}/upload-passport`, {
        method: "POST",
        body: formData,
        headers: authHeaders,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      toast({ title: "Passport uploaded", description: "Your ID document has been uploaded successfully." });
      return result.fileUrl;
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setPassportUploading(false);
    }
  }

  // OB-J: Save bank details
  const saveBankDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!expert) throw new Error("Expert not found");
      let passportFileUrl = verification?.passportFileUrl || "";
      if (passportFile) {
        const uploaded = await handlePassportUpload(passportFile);
        if (uploaded) passportFileUrl = uploaded;
      }
      const res = await apiRequest("POST", `/api/experts/${expert.id}/verification`, {
        passportFileUrl,
        governmentIdType: govIdType,
        governmentIdNumber: govIdNumber,
        fullLegalName,
        country: verCountry,
        fullAddress,
        apartmentStreet,
        city,
        stateProvince,
        postalCode,
        accountNumber: bankAccountNumber,
        swiftCode: bankSwiftCode,
        bankName,
        bankAddress,
        accountHolderName,
        bankCountry,
        iban,
        routingNumber,
        sortCode,
        ifscCode,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchVerification();
      setShowBankDetailsDialog(false);
      toast({ title: "Details saved", description: "Your bank details have been submitted for verification." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // OB-J: Create withdrawal request
  const createWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!expert) throw new Error("Expert not found");
      const res = await apiRequest("POST", `/api/experts/${expert.id}/withdrawal-request`, {
        amount: withdrawAmount,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      refetchWithdrawals();
      queryClient.invalidateQueries({ queryKey: ["/api/credits", userId] });
      setShowWithdrawDialog(false);
      toast({ title: "Withdrawal requested", description: `Invoice ${result.invoiceNumber} created. You will be notified when payout is initiated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const earningsTxs = data?.transactions?.filter((t) => t.type === "earning") ?? [];
  const earningsFromReviews = earningsTxs.reduce((sum, t) => sum + t.amount, 0);
  // Fix 6: Include $5 welcome bonus in Total Earned
  const WELCOME_BONUS = 5;
  const totalEarned = earningsFromReviews + WELCOME_BONUS;
  const balance = data?.credits ?? 0;

  const generateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!expert) throw new Error("Expert not found");
      const res = await apiRequest("POST", `/api/experts/${expert.id}/generate-invoice`);
      return res.json();
    },
    onSuccess: (result: InvoiceData) => {
      setInvoiceData(result);
      setShowWithdrawDialog(false);
      setShowInvoiceDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/credits", userId] });
      toast({ title: "Invoice generated", description: `Statement ${result.invoice.invoiceNumber} created.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  async function handleDownloadPDF() {
    if (!invoiceData) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const d = invoiceData;
    const margin = 20;
    let y = 20;

    // Header
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

    // Statement Info
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("STATEMENT INFORMATION", margin, y);
    doc.text("EXPERT DETAILS", 110, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const infoRows = [
      ["Statement Number", d.invoice.invoiceNumber],
      ["Statement Date", new Date(d.invoice.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
      ["Expert ID", `EX-${String(d.expert.id).padStart(6, "0")}`],
      ["Account Number", `ACC-${String(userId).padStart(6, "0")}`],
    ];
    const expertRows = [
      ["Name", d.expert.name],
      ["Email", d.expert.email],
      ["Category", d.expert.category],
      ["Tier", normalizeTier(d.expert.tier)],
    ];
    doc.setFontSize(8);
    infoRows.forEach(([label, val], i) => {
      doc.setTextColor(130, 130, 130);
      doc.text(label, margin, y + i * 5);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.text(val, margin + 38, y + i * 5);
      doc.setFont("helvetica", "normal");
    });
    expertRows.forEach(([label, val], i) => {
      doc.setTextColor(130, 130, 130);
      doc.text(label, 110, y + i * 5);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.text(val, 135, y + i * 5);
      doc.setFont("helvetica", "normal");
    });
    y += 28;

    // Line Items table
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
    d.lineItems.forEach((item: any) => {
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

    // Totals — FIX-2: Only show platform fee when non-zero
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Subtotal (Expert Net)", 145, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`$${(d.totalAmountCents / 100).toFixed(2)}`, 188, y, { align: "right" });
    y += 5;
    if (d.platformFeeRate > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 60, 60);
      doc.text(`Platform Fee (${d.platformFeeRate}%)`, 145, y, { align: "right" });
      doc.text(`-$${(d.platformFeeCents / 100).toFixed(2)}`, 188, y, { align: "right" });
      y += 6;
    }
    doc.setFillColor(240, 249, 240);
    doc.rect(120, y - 4, 70, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 120, 20);
    doc.text("Net Payout", 145, y + 1, { align: "right" });
    doc.text(`$${(d.netPayoutCents / 100).toFixed(2)}`, 188, y + 1, { align: "right" });
    y += 12;

    // Payment method
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Payment Method: Bank Transfer via Mercury", margin, y);
    doc.text("Status: Pending Approval", margin, y + 4);
    y += 12;

    // Footer
    doc.line(margin, y, 190, y);
    y += 4;
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text("\u00a9 2026 A2A Global Inc. All rights reserved. https://a2a.global/", margin, y);
    doc.text("File number 10050200, Newark, Delaware, United States.", margin, y + 3);
    doc.text("For any questions, please contact billing@a2a.global", margin, y + 6);

    doc.save(`${d.invoice.invoiceNumber}.pdf`);
  }

  // Mercury payout after invoice
  const processPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceData || !expert) throw new Error("No invoice data");
      const res = await apiRequest("POST", `/api/wallet/withdraw`, {
        userId,
        expertId: expert.id,
        amountCents: invoiceData.netPayoutCents,
        invoiceId: invoiceData.invoice.invoiceNumber,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits", userId] });
      toast({ title: "Payout requested", description: "Your withdrawal has been submitted. Funds will be sent via Mercury within 2-3 business days." });
      setShowInvoiceDialog(false);
      setInvoiceData(null);
    },
    onError: (err: Error) => {
      toast({ title: "Payout error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6" data-testid="expert-view-earnings">
      <h1 className="text-xl font-bold mb-6">Earnings</h1>

      {/* Fix 6: $ signs, welcome bonus included in Total Earned */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">${totalEarned}</p><p className="text-xs text-muted-foreground">Total Earned</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${balance}</p><p className="text-xs text-muted-foreground">Balance</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{earningsTxs.length}</p><p className="text-xs text-muted-foreground">Completed Reviews</p></CardContent></Card>
      </div>

      {/* OB-J: Bank details + Withdraw Funds */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Withdraw Funds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Current balance: <span className="font-bold">${balance}</span></p>
                <p className="text-xs text-muted-foreground">Withdrawals are available for a minimum of $200.</p>
              </div>
              {/* G2-5: Block withdrawal for unverified experts */}
              {expert && expert.verified !== 1 ? (
                <Button variant="outline" disabled data-testid="button-withdraw-unverified">
                  <AlertCircle className="mr-2 h-4 w-4" /> Complete verification to withdraw
                </Button>
              ) : !hasBankDetails ? (
                <Button
                  onClick={() => setShowBankDetailsDialog(true)}
                  variant="outline"
                  data-testid="button-finalise-details"
                >
                  <FileText className="mr-2 h-4 w-4" /> Finalise your details before initiating a withdrawal
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (balance < 200) {
                      toast({
                        title: "Minimum not reached",
                        description: "Withdrawals are available for a minimum of $200.",
                      });
                      return;
                    }
                    setWithdrawAmount(balance);
                    setShowWithdrawDialog(true);
                  }}
                  data-testid="button-withdraw"
                >
                  <Wallet className="mr-2 h-4 w-4" /> Withdraw Funds
                </Button>
              )}
            </div>
            {hasBankDetails && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Bank details submitted
                {verification?.verifiedByAdmin ? " — Verified by admin" : " — Pending admin verification"}
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => {
                  setBankAccountNumber(verification?.accountNumber || "");
                  setBankSwiftCode(verification?.swiftCode || "");
                  setBankName(verification?.bankName || "");
                  setBankAddress(verification?.bankAddress || "");
                  setGovIdType(verification?.governmentIdType || "");
                  setGovIdNumber(verification?.governmentIdNumber || "");
                  setFullLegalName(verification?.fullLegalName || "");
                  setApartmentStreet(verification?.apartmentStreet || "");
                  setCity(verification?.city || "");
                  setStateProvince(verification?.stateProvince || "");
                  setPostalCode(verification?.postalCode || "");
                  setSortCode(verification?.sortCode || "");
                  setIfscCode(verification?.ifscCode || "");
                  setVerCountry(verification?.country || "");
                  setFullAddress(verification?.fullAddress || "");
                  setAccountHolderName(verification?.accountHolderName || "");
                  setBankCountry(verification?.bankCountry || "");
                  setIban(verification?.iban || "");
                  setRoutingNumber(verification?.routingNumber || "");
                  setShowBankDetailsDialog(true);
                }}>Edit</Button>
              </div>
            )}
            {balance < 200 && balance > 0 && (
              <p className="text-xs text-amber-600" data-testid="text-withdrawal-threshold">
                Withdrawals are available for a minimum of $200.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OB-J: Bank Details Dialog */}
      <Dialog open={showBankDetailsDialog} onOpenChange={setShowBankDetailsDialog}>
        <DialogContent data-testid="dialog-bank-details">
          <DialogHeader>
            <DialogTitle>Verification & Bank Details</DialogTitle>
            <DialogDescription>Upload your ID and enter bank details to enable withdrawals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Identity Section */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identity Verification</p>
            <div>
              <Label className="text-sm">Copy of Government-issued ID (Passport, Driving License, Social Insurance, Aadhar etc)</Label>
              <input
                ref={passportInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPassportFile(file);
                }}
              />
              <div className="mt-1 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => passportInputRef.current?.click()} disabled={passportUploading}>
                  <Paperclip className="mr-2 h-3.5 w-3.5" /> {passportFile ? passportFile.name : (verification?.passportFileUrl ? "Replace document" : "Upload document")}
                </Button>
                {(passportFile || verification?.passportFileUrl) && (
                  <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {passportFile ? "Ready to upload" : "Document on file"}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">ID Type</Label>
                <select
                  value={govIdType}
                  onChange={(e) => setGovIdType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-gov-id-type"
                >
                  <option value="">Select...</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="drivers_license">Driver's License</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">ID Number</Label>
                <Input
                  value={govIdNumber}
                  onChange={(e) => setGovIdNumber(e.target.value)}
                  placeholder="ID document number"
                  className="mt-1"
                  data-testid="input-gov-id-number"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Full Legal Name (as on ID)</Label>
              <Input
                value={fullLegalName}
                onChange={(e) => setFullLegalName(e.target.value)}
                placeholder="e.g., John Michael Smith"
                className="mt-1"
                data-testid="input-full-legal-name"
              />
            </div>
            <div>
              <Label className="text-sm">Country</Label>
              <Input
                value={verCountry}
                onChange={(e) => setVerCountry(e.target.value)}
                placeholder="e.g., United Kingdom"
                className="mt-1"
                data-testid="input-country"
              />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Full Recipient Address</p>
            <div>
              <Label className="text-sm">Apartment and Street</Label>
              <Input
                value={apartmentStreet}
                onChange={(e) => setApartmentStreet(e.target.value)}
                placeholder="e.g., 45B Baker Street, Apt 3"
                className="mt-1"
                data-testid="input-apartment-street"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., London"
                  className="mt-1"
                  data-testid="input-city"
                />
              </div>
              <div>
                <Label className="text-sm">State</Label>
                <Input
                  value={stateProvince}
                  onChange={(e) => setStateProvince(e.target.value)}
                  placeholder="e.g., England"
                  className="mt-1"
                  data-testid="input-state"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Postal / Zip Code</Label>
              <Input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g., NW1 6XE"
                className="mt-1"
                data-testid="input-postal-code"
              />
            </div>

            {/* Bank Details Section */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Bank Details</p>
            <div>
              <Label className="text-sm">Account Holder Name</Label>
              <Input
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Name as it appears on the bank account"
                className="mt-1"
                data-testid="input-account-holder-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Account Number *</Label>
                <Input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="e.g., 12345678"
                  className="mt-1"
                  data-testid="input-account-number"
                />
              </div>
              <div>
                <Label className="text-sm">IBAN (if applicable) <span className="text-muted-foreground">— Optional</span></Label>
                <Input
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="e.g., GB29NWBK60161331926819"
                  className="mt-1"
                  data-testid="input-iban"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">SWIFT / BIC Code *</Label>
                <Input
                  value={bankSwiftCode}
                  onChange={(e) => setBankSwiftCode(e.target.value)}
                  placeholder="e.g., ABCDEF12"
                  className="mt-1"
                  data-testid="input-swift-code"
                />
              </div>
              <div>
                <Label className="text-sm">Routing Number (US only) <span className="text-muted-foreground">— Optional</span></Label>
                <Input
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  placeholder="e.g., 021000021"
                  className="mt-1"
                  data-testid="input-routing-number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Sort Code (if applicable) <span className="text-muted-foreground">— Optional</span></Label>
                <Input
                  value={sortCode}
                  onChange={(e) => setSortCode(e.target.value)}
                  placeholder="e.g., 60-16-13"
                  className="mt-1"
                  data-testid="input-sort-code"
                />
              </div>
              <div>
                <Label className="text-sm">IFSC Code (for India only) <span className="text-muted-foreground">— Optional</span></Label>
                <Input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="e.g., SBIN0001234"
                  className="mt-1"
                  data-testid="input-ifsc-code"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Bank Name *</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., HSBC"
                  className="mt-1"
                  data-testid="input-bank-name"
                />
              </div>
              <div>
                <Label className="text-sm">Bank Country</Label>
                <Input
                  value={bankCountry}
                  onChange={(e) => setBankCountry(e.target.value)}
                  placeholder="e.g., United Kingdom"
                  className="mt-1"
                  data-testid="input-bank-country"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Bank Address</Label>
              <Input
                value={bankAddress}
                onChange={(e) => setBankAddress(e.target.value)}
                placeholder="Full bank branch address"
                className="mt-1"
                data-testid="input-bank-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankDetailsDialog(false)}>Cancel</Button>
            <Button
              onClick={() => saveBankDetailsMutation.mutate()}
              disabled={!bankAccountNumber || !bankSwiftCode || !bankName || saveBankDetailsMutation.isPending}
              data-testid="button-save-bank-details"
            >
              {saveBankDetailsMutation.isPending ? "Saving..." : "Save Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OB-J: Withdrawal Request Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent data-testid="dialog-withdrawal">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>Submit a withdrawal request. An invoice will be generated automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm">Amount ($)</Label>
              <Input
                type="number"
                min={50}
                max={balance}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Math.min(balance, Math.max(0, parseInt(e.target.value) || 0)))}
                className="mt-1"
                data-testid="input-withdraw-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">Available: ${balance}</p>
            </div>
            {verification && (
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                <p className="font-medium">Bank details on file:</p>
                <p>Account: {verification.accountNumber}</p>
                <p>SWIFT: {verification.swiftCode}</p>
                <p>Bank: {verification.bankName}</p>
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
              <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                An invoice will be generated and sent to admin for processing. Please allow up to 3 business days for payout.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createWithdrawalMutation.mutate()}
              disabled={withdrawAmount < 200 || createWithdrawalMutation.isPending}
              data-testid="button-confirm-withdraw"
            >
              <Receipt className="mr-2 h-4 w-4" />
              {createWithdrawalMutation.isPending ? "Submitting..." : "Submit Withdrawal Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto" data-testid="dialog-invoice">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Expert Payout Statement
            </DialogTitle>
            <DialogDescription>
              {invoiceData?.invoice.invoiceNumber} — Generated {invoiceData ? new Date(invoiceData.invoice.createdAt).toLocaleDateString() : ""}
            </DialogDescription>
          </DialogHeader>
          {invoiceData && <InvoiceDocument data={invoiceData} userId={userId} />}
          <DialogFooter className="no-print gap-2">
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Close</Button>
            <Button variant="outline" onClick={handleDownloadPDF} data-testid="button-download-pdf">
              <Printer className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={() => processPayoutMutation.mutate()} disabled={processPayoutMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-process-payout">
              <DollarSign className="mr-2 h-4 w-4" />
              {processPayoutMutation.isPending ? "Processing..." : "Send to Mercury"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal History */}
      <WithdrawalHistory expertId={expert?.id} />

      {/* OB-J: Withdrawal Requests */}
      {withdrawalRequests && withdrawalRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold mb-4">Withdrawal Requests</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-xs">Date</th>
                  <th className="text-left p-3 font-medium text-xs">Invoice #</th>
                  <th className="text-right p-3 font-medium text-xs">Amount</th>
                  <th className="text-right p-3 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalRequests.map((wr: any) => (
                  <tr key={wr.id} className="border-t">
                    <td className="p-3 text-xs text-muted-foreground"><span title="US Central time zone">{formatCentralTime(wr.createdAt)}</span></td>
                    <td className="p-3 text-sm font-mono">{wr.invoiceNumber}</td>
                    <td className="p-3 text-right text-sm font-medium">${wr.amount}</td>
                    <td className="p-3 text-right">
                      <Badge variant="secondary" className={`text-[10px] ${
                        wr.status === "payout_initiated" ? "bg-blue-100 text-blue-700" :
                        wr.status === "completed" ? "bg-green-100 text-green-700" : ""
                      }`}>
                        {wr.status === "pending" ? "Pending" : wr.status === "payout_initiated" ? "Payout Initiated" : wr.status === "completed" ? "Completed" : wr.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="text-base font-semibold mb-4">Earning History</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium text-xs">Date</th>
              <th className="text-left p-3 font-medium text-xs">Description</th>
              <th className="text-right p-3 font-medium text-xs">Amount</th>
            </tr>
          </thead>
          <tbody>
            {earningsTxs.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">No earnings yet</td></tr>
            ) : earningsTxs.map((tx) => (
              <tr key={tx.id} className="border-t">
                <td className="p-3 text-xs text-muted-foreground"><span title="US Central time zone">{formatCentralTime(tx.createdAt)}</span></td>
                <td className="p-3 text-sm">{tx.description}</td>
                <td className="p-3 text-right text-sm font-medium text-green-600">+${tx.amount} credits</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Profile (with Rating Breakdown) ───
function ExpertProfile({ expert }: { expert: Expert }) {
  const { user } = useAuth();
  const [bio, setBio] = useState(expert.bio);
  const [expertise, setExpertise] = useState(expert.expertise);
  const [credentials, setCredentials] = useState(expert.credentials);
  const [availability, setAvailability] = useState(expert.availability === 1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fix 1: Rate-only editor — tier is auto-determined from rate
  const [editRate, setEditRate] = useState<string>(expert.ratePerMinute ? String(expert.ratePerMinute) : "");
  const [tierSaving, setTierSaving] = useState(false);

  // Auto-determine tier from rate per minute
  function getTierFromRateValue(rate: number): string {
    if (rate > 13.00) return "guru";
    if (rate > 1.50) return "pro";
    return "standard";
  }
  const editTier = getTierFromRateValue(parseFloat(editRate) || 0);

  // FIX-8: Fetch available requests by tier
  const { data: availableRequests } = useQuery<ExpertReview[]>({
    queryKey: ["/api/reviews/pending", `?expertId=${expert.id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reviews/pending?expertId=${expert.id}`);
      return res.json();
    },
  });

  async function handleSaveTierRate() {
    setTierSaving(true);
    try {
      await apiRequest("POST", "/api/experts/onboarding/rate", {
        expertId: expert.id,
        tier: editTier,
        ratePerMinute: parseFloat(editRate) || 0,
      });
      toast({ title: "Tier & rate updated!" });
    } catch {
      // fallback: try PATCH expert
      try {
        await apiRequest("PATCH", `/api/experts/${expert.id}`, {
          rateTier: editTier,
          ratePerMinute: editRate,
        });
        toast({ title: "Tier & rate updated!" });
      } catch (err: any) {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setTierSaving(false);
    }
  }

  // BUG-008: Load existing photo on mount
  useEffect(() => {
    if (user?.id) {
      setPhotoUrl(`/api/users/${user.id}/photo?t=${Date.now()}`);
    }
  }, [user?.id]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload a JPEG, PNG, or WebP image.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' });
      return;
    }
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const token = document.cookie.match(/(?:^|;\s*)a2a_token=([^;]*)/)?.[1];
      const res = await fetch(`/api/users/${user.id}/photo`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${decodeURIComponent(token)}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      setPhotoUrl(`/api/users/${user.id}/photo?t=${Date.now()}`);
      toast({ title: 'Photo updated!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/experts/${expert.id}`, {
        bio, expertise, credentials, availability: availability ? 1 : 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts/user", expert.userId] });
      toast({ title: "Profile updated!" });
    },
  });

  const ratingDisplay = (expert.rating / 10).toFixed(1);
  const totalReviews = expert.totalReviews;

  // Mock rating breakdown (since we don't store per-star data)
  const breakdown = [
    { stars: 5, count: Math.round(totalReviews * 0.55) },
    { stars: 4, count: Math.round(totalReviews * 0.25) },
    { stars: 3, count: Math.round(totalReviews * 0.12) },
    { stars: 2, count: Math.round(totalReviews * 0.05) },
    { stars: 1, count: Math.round(totalReviews * 0.03) },
  ];
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);

  const improvementTips = [
    "Respond within the expected timeframe for your tier",
    "Provide specific, actionable feedback with clear reasoning",
    "Include relevant data, benchmarks, or citations",
    "Structure your response with clear sections",
    "Address all parts of the client's question",
    "Proofread for accuracy and clarity",
  ];

  const tierName = normalizeTier(expert.rateTier);
  const tierStyles = {
    Guru: {
      banner: "bg-gradient-to-r from-amber-500 to-amber-400",
      badge: "bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700",
      label: "text-amber-700 dark:text-amber-300",
      icon: "text-amber-500",
      glow: "shadow-amber-200 dark:shadow-amber-900/40",
    },
    Pro: {
      banner: "bg-gradient-to-r from-indigo-600 to-indigo-500",
      badge: "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700",
      label: "text-indigo-700 dark:text-indigo-300",
      icon: "text-indigo-500",
      glow: "shadow-indigo-200 dark:shadow-indigo-900/40",
    },
    Standard: {
      banner: "bg-gradient-to-r from-blue-600 to-blue-500",
      badge: "bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700",
      label: "text-blue-700 dark:text-blue-300",
      icon: "text-blue-500",
      glow: "shadow-blue-200 dark:shadow-blue-900/40",
    },
  }[tierName] ?? {
    banner: "bg-gradient-to-r from-blue-600 to-blue-500",
    badge: "bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700",
    label: "text-blue-700 dark:text-blue-300",
    icon: "text-blue-500",
    glow: "shadow-blue-200 dark:shadow-blue-900/40",
  };

  return (
    <div className="p-6 max-w-2xl" data-testid="expert-view-profile">
      <h1 className="text-xl font-bold mb-4">Expert Profile</h1>

      {/* Fix 1: Rate-only editor — tier auto-determined */}
      <Card className="mb-6 border-primary/20" data-testid="card-tier-rate-editor">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Rate Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label className="text-sm mb-1 block">Set your rate per minute ($)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  placeholder="e.g. 5.00"
                  className="max-w-[160px]"
                  data-testid="input-expert-rate"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Your tier:</span>
                  <Badge
                    className={`text-xs capitalize ${
                      editTier === "guru"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : editTier === "pro"
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                    data-testid="badge-auto-tier"
                  >
                    {editTier}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                $0.01–$1.50/min = Standard &nbsp;·&nbsp; $1.51–$13.00/min = Pro &nbsp;·&nbsp; $13.01+/min = Guru
              </p>
            </div>
          </div>
          <Button onClick={handleSaveTierRate} disabled={tierSaving} size="sm" data-testid="button-save-tier-rate">
            {tierSaving ? "Saving..." : "Save Rate"}
          </Button>

        </CardContent>
      </Card>

      {/* Tier Banner */}
      <div className={`rounded-2xl ${tierStyles.badge} ${tierStyles.glow} shadow-lg mb-6 overflow-hidden`} data-testid="card-expert-tier">
        <div className={`${tierStyles.banner} px-5 py-3 flex items-center gap-3`}>
          <Award className="h-5 w-5 text-white" />
          <span className="text-white text-xs font-medium uppercase tracking-widest">Your Tier</span>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className={`text-3xl font-extrabold tracking-tight ${tierStyles.label}`} data-testid="text-expert-tier-name">{tierName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tierName === "Guru" && "Executive-grade requests · Earn up to $2,000 per review"}
              {tierName === "Pro" && "Professional-level requests · $360–$3,600 per 12 hours"}
              {tierName === "Standard" && "Entry-level requests · Quick reviews, earn $2–$180 per 12 hours"}
            </p>
          </div>
          {expert.ratePerMinute && (
            <div className="text-right">
              <p className={`text-xl font-bold ${tierStyles.label}`}>${expert.ratePerMinute}<span className="text-sm font-medium">/min</span></p>
              <p className="text-xs text-muted-foreground">Your rate</p>
            </div>
          )}
        </div>
      </div>

      {/* Rating Section */}
      <Card className="mb-6" data-testid="card-expert-rating">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Your Rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Big rating number */}
            <div className="text-center shrink-0">
              <p className="text-4xl font-bold text-amber-600" data-testid="text-expert-rating">{ratingDisplay}</p>
              <p className="text-xs text-muted-foreground">out of 5.0</p>
              <p className="text-xs text-muted-foreground mt-0.5">{totalReviews} reviews</p>
            </div>
            {/* Breakdown bars */}
            <div className="flex-1 space-y-1.5">
              {breakdown.map((b) => (
                <div key={b.stars} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-3 text-right">{b.stars}</span>
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all"
                      style={{ width: `${(b.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6 text-right">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How to improve tips */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800/30" data-testid="card-improvement-tips">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> How to improve your rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {improvementTips.map((tip, i) => (
              <li key={i} className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Profile Card */}
      <Card className="mb-6">
        <CardContent className="p-4 flex items-center gap-4">
          {/* BUG-008: Clickable photo avatar */}
          <div
            className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer group shrink-0"
            onClick={() => photoInputRef.current?.click()}
            title="Click to upload photo"
            data-testid="avatar-photo-upload"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
                onError={() => setPhotoUrl(null)}
              />
            ) : (
              <UserCircle className="h-8 w-8 text-primary" />
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {photoUploading ? (
                <span className="text-white text-[10px]">...</span>
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
              data-testid="input-photo-upload"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Expert ID: {expert.id}</p>
              {expert.verified === 1 && <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Rating: {ratingDisplay} · {totalReviews} reviews
              <InfoTooltip text="Your average score from client feedback. Higher ratings get more requests" />
            </p>
            {expert.ratePerMinute && (
              <p className="text-xs text-muted-foreground mt-0.5">Rate: ${expert.ratePerMinute}/min · {normalizeTier(expert.rateTier)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Click avatar to update photo</p>
          </div>
        </CardContent>
      </Card>

      {/* Public profile share */}
      <Card className="mb-6 border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/10" data-testid="card-share-profile">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Your Public Profile</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate" data-testid="text-public-profile-url">
              {window.location.origin + "/#/expert/profile/" + expert.id}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = window.location.origin + "/#/expert/profile/" + expert.id;
                try {
                  // Fallback for sandboxed iframes where navigator.clipboard is blocked
                  const textarea = document.createElement("textarea");
                  textarea.value = url;
                  textarea.style.position = "fixed";
                  textarea.style.left = "-9999px";
                  document.body.appendChild(textarea);
                  textarea.select();
                  document.execCommand("copy");
                  document.body.removeChild(textarea);
                  toast({ title: "URL copied!", description: "Share this link with clients." });
                } catch {
                  // If even execCommand fails, show the URL for manual copy
                  toast({ title: "Copy this URL", description: url });
                }
              }}
              data-testid="button-share-profile"
            >
              <Share2 className="h-3 w-3 mr-1" /> Share Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label className="text-sm">Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1" data-testid="input-expert-bio" />
        </div>
        <div>
          <Label className="text-sm">Expertise Areas</Label>
          <Input value={expertise} onChange={(e) => setExpertise(e.target.value)} className="mt-1" data-testid="input-expert-expertise" />
        </div>
        <div>
          <Label className="text-sm">Credentials</Label>
          <Input value={credentials} onChange={(e) => setCredentials(e.target.value)} className="mt-1" data-testid="input-expert-credentials" />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Availability</p>
            <p className="text-xs text-muted-foreground">Toggle to accept new requests</p>
          </div>
          <Switch checked={availability} onCheckedChange={setAvailability} data-testid="switch-availability" />
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-profile">
          {mutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      {/* FIX-2: Client Reviews section */}
      <ClientReviewsSection expertId={expert.id} />
    </div>
  );
}

function ClientReviewsSection({ expertId }: { expertId: number }) {
  const { data: reviews } = useQuery<ExpertReview[]>({ queryKey: ["/api/reviews/expert", expertId] });
  const completedReviews = (reviews || []).filter((r: any) => r.status === "completed");

  // Fetch requests for completed reviews to get clientRating
  const requestIds = completedReviews.map((r: any) => r.requestId).filter(Boolean);
  const requestQueries = requestIds.map((rid: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery<any>({ queryKey: ["/api/requests", rid], enabled: !!rid })
  );
  const requests = requestQueries.map((q: any) => q.data).filter(Boolean);
  const reviewedRequests = requests.filter((r: any) => r.clientRating != null);

  if (reviewedRequests.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          Client Reviews ({reviewedRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reviewedRequests.map((req: any) => (
          <div key={req.id} className="border-b border-muted last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium truncate">{req.title}</p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span className="text-sm font-bold">{req.clientRating}/5</span>
              </div>
            </div>
            {req.clientRatingComment && (
              <p className="text-xs text-muted-foreground italic">"{req.clientRatingComment}"</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── FIX-7: Expert notification bell wrapper with queue count ───
function ExpertNotificationBell({ userId, onNavigate, expertId }: { userId: number; onNavigate?: (link: string) => void; expertId: number }) {
  const { data: pendingData } = useQuery<ExpertReview[]>({
    queryKey: ["/api/reviews/pending", `?expertId=${expertId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reviews/pending?expertId=${expertId}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const queueCount = pendingData?.length ?? 0;

  // We render NotificationBell + a queue badge overlay by wrapping in relative div
  return (
    <div className="relative" data-testid="expert-notification-wrapper">
      <NotificationBell userId={userId} onNavigate={onNavigate} />
      {queueCount > 0 && (
        <button
          onClick={() => onNavigate?.('/expert?view=queue')}
          className="ml-1 hidden sm:inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-200 transition"
          data-testid="badge-queue-notification"
        >
          <Inbox className="h-3 w-3" />
          {queueCount} new in queue
        </button>
      )}
    </div>
  );
}

// ─── Expert Overview Skeleton (change #12) ───
function ExpertOverviewSkeleton() {
  return (
    <div className="p-6 space-y-6" data-testid="skeleton-overview">
      <div className="h-6 w-48 bg-muted animate-pulse rounded" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
      </div>
      <div className="h-24 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

// ─── Expert Header Avatar (Fix 4: photo in header) ───
function ExpertHeaderAvatar({ userId }: { userId: number }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(`/api/users/${userId}/photo?t=${Date.now()}`);
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="Profile"
          className="w-7 h-7 rounded-full object-cover"
          onError={() => setPhotoUrl(null)}
        />
      ) : (
        <UserCircle className="h-5 w-5 text-primary" />
      )}
    </div>
  );
}

// ─── Main Expert Dashboard ───
// ─── Expert Confetti (first-time registration celebration) ───
function ExpertConfetti() {
  return (
    <>
      <style>{`
        @keyframes expert-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-expert-confetti { animation: expert-confetti-fall var(--dur, 3s) ease-in var(--delay, 0s) forwards; }
      `}</style>
      <div className="fixed inset-0 z-50 pointer-events-none" style={{ overflow: 'visible' }}>
        {Array.from({length: 50}).map((_, i) => {
          const left = (Math.random() * 100).toFixed(1);
          const size = (6 + Math.random() * 8).toFixed(1);
          const delay = (Math.random() * 2).toFixed(2);
          const dur = (2 + Math.random() * 3).toFixed(2);
          const color = ['#0F3DD1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][Math.floor(Math.random() * 5)];
          const radius = Math.random() > 0.5 ? '50%' : '0';
          return (
            <div key={i} className="absolute animate-expert-confetti" style={{
              left: `${left}%`,
              top: '-10%',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              '--delay': `${delay}s`,
              '--dur': `${dur}s`,
              borderRadius: radius,
            } as React.CSSProperties} />
          );
        })}
      </div>
    </>
  );
}

export default function ExpertDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ExpertView>(() => {
    // Handle notification deep-link: ?view=queue
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        const v = params.get('view');
        if (v === 'queue') return 'queue';
        if (v === 'active') return 'active';
        if (v === 'earnings') return 'earnings';
      }
    } catch {}
    return "overview";
  });
  const [selectedReview, setSelectedReview] = useState<number>(0);
  // G1-1: Tour defaults to hidden; useEffect decides whether to show
  const [showTour, setShowTour] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [headerAvailability, setHeaderAvailability] = useState<boolean | null>(null);

  // BUG-009: Force light theme — remove dark class
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  // G1-1: Show confetti/tour only for genuine first-time logins (DB is source of truth)
  const expertTourInitialized = useRef(false);
  useEffect(() => {
    if (!user || expertTourInitialized.current) return;
    expertTourInitialized.current = true;
    const isFirstLogin = user.tourCompleted === 0 && ((user as any).loginCount ?? 0) <= 1;
    if (!isFirstLogin) {
      setShowTour(false);
      setShowConfetti(false);
    } else {
      setShowTour(true);
      setShowConfetti(true);
      apiRequest('PATCH', `/api/users/${user.id}`, { tourCompleted: 1 }).catch(() => {});
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [user]);

  // SSE real-time notifications
  useSSE(user?.id);

  const { data: expert, isLoading: expertLoading, error: expertError } = useQuery<Expert>({
    queryKey: ["/api/experts/user", user?.id],
    enabled: !!user,
    retry: 3,
    retryDelay: 500,
  });

  // Sync headerAvailability from fetched expert data
  useEffect(() => {
    if (expert && headerAvailability === null) {
      setHeaderAvailability(expert.availability === 1);
    }
  }, [expert]);

  const { toast } = useToast();

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (newVal: boolean) => {
      if (!expert) return;
      await apiRequest("PATCH", `/api/experts/${expert.id}`, { availability: newVal ? 1 : 0 });
    },
    onSuccess: (_, newVal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts/user", user?.id] });
      toast({
        title: newVal ? "You are now Online" : "You are now Offline",
        description: newVal ? "You will receive new requests." : "You won't receive new requests while offline.",
      });
    },
    onError: () => {
      // Revert on error
      setHeaderAvailability((prev) => !prev);
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  function handleToggleAvailability(val: boolean) {
    setHeaderAvailability(val);
    toggleAvailabilityMutation.mutate(val);
  }

  // FIX-4: Expert reviews for follow-up notification navigation
  const { data: allExpertReviews } = useQuery<ExpertReview[]>({
    queryKey: ["/api/reviews/expert", expert?.id],
    enabled: !!expert?.id,
  });

  // Helper: navigate to a specific request from a follow-up notification
  function navigateToRequest(requestId: number) {
    const rev = allExpertReviews?.find((r) => r.requestId === requestId);
    if (rev) {
      setSelectedReview(rev.id);
      setView("review-detail");
    } else {
      setView("active");
    }
  }

  // Search data for expert — search Available Queue
  const { data: pendingReviews } = useQuery<ExpertRequest[]>({
    queryKey: ["/api/requests"],
    enabled: !!expert && !!searchQuery,
  });

  const searchResults = searchQuery.trim().length > 1 && pendingReviews
    ? pendingReviews.filter(r => r.title?.toLowerCase().includes(searchQuery.toLowerCase()) || r.category?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5)
    : [];

  if (!user) {
    window.history.replaceState(null, '', '#/login');
    setLocation("/login");
    return null;
  }

  // Show loading while expert data is being fetched
  if (expertLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading expert dashboard...</p>
      </div>
    );
  }

  // Handle error loading expert profile
  if (expertError || !expert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load expert profile.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/experts/user", user?.id] })}>Try Again</Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); setLocation("/login"); }}>Back to Login</Button>
          </div>
        </div>
      </div>
    );
  }

  // Check onboarding status — redirect if not completed (now 3 steps)
  if (expert.onboardingComplete < 2) {
    setLocation("/expert/onboarding");
    return null;
  }

  function handleLogout() {
    logout();
    setLocation("/");
  }

  const sidebarStyle = { "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full" data-testid="page-expert-dashboard">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <ExpertSidebar view={view} setView={setView} onLogout={handleLogout} />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background gap-3">
            <div className="hidden md:block"><SidebarTrigger data-testid="button-expert-sidebar-toggle" /></div>
            <div className="md:hidden flex items-center gap-2">
              <img src="/a2a-blue-logo.svg" alt="A2A" className="h-14 w-14 shrink-0 bg-white rounded-lg p-1" />
              <span className="font-semibold text-sm">A2A</span>
            </div>
            {/* Global search bar (change #11) */}
            <div className="flex-1 max-w-md relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="pl-9 h-9"
                data-testid="expert-search-input"
              />
              {searchFocused && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-auto" data-testid="expert-search-results">
                  {searchResults.map(r => (
                    <button key={r.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2" onClick={() => { setSearchQuery(""); setView("queue"); }}>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{r.title}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">{r.category}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ExpertNotificationBell userId={user.id} expertId={expert.id} onNavigate={(link) => {
                // FIX-4: Parse link for in-page navigation, including follow-up request links
                if (!link) return;
                const qIdx = link.indexOf('?');
                const params = qIdx !== -1 ? new URLSearchParams(link.slice(qIdx + 1)) : new URLSearchParams();
                const v = params.get('view');
                const reqId = params.get('request');
                if (reqId) {
                  // Navigate to specific request via follow-up notification
                  const rid = parseInt(reqId);
                  if (!isNaN(rid)) navigateToRequest(rid);
                } else if (v === 'queue') setView('queue');
                else if (v === 'active') setView('active');
                else if (v === 'earnings') setView('earnings');
                else if (v === 'completed') setView('completed');
                else if (link.startsWith('/expert')) { /* already on expert */ }
                else setLocation(link);
              }} />
              {/* Uber-style Online/Offline toggle */}
              {expert && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors"
                  style={{ borderColor: headerAvailability ? '#22c55e' : '#d1d5db', background: headerAvailability ? '#f0fdf4' : '#f9fafb' }}
                  data-testid="header-availability-toggle"
                >
                  <Switch
                    checked={!!headerAvailability}
                    onCheckedChange={handleToggleAvailability}
                    disabled={toggleAvailabilityMutation.isPending}
                    data-testid="header-availability-switch"
                    className="h-4 w-7 scale-90"
                  />
                  <span className={`text-xs font-semibold hidden sm:block ${headerAvailability ? 'text-green-700' : 'text-gray-400'}`}>
                    {headerAvailability ? 'Online' : 'Offline'}
                  </span>
                </div>
              )}
              {expert?.verified === 1 && <Badge className="hidden sm:flex bg-green-100 text-green-800 text-xs"><Award className="h-3 w-3 mr-1" />Verified</Badge>}
              {/* Fix 7: Expert name clickable → profile; Fix 4: avatar in header */}
              <button
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                onClick={() => setView('profile')}
                title="Go to your profile"
                data-testid="header-expert-name"
              >
                <ExpertHeaderAvatar userId={user.id} />
                <span className="relative flex h-2 w-2 hidden sm:flex" title={headerAvailability ? 'Online' : 'Offline'}>
                  {headerAvailability && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${headerAvailability ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                </span>
                <span className="text-sm font-medium hidden sm:block">{user.name}</span>
              </button>
              {/* G3-3: Mobile logout button in top bar (matches client dashboard pattern) */}
              <button onClick={handleLogout} className="md:hidden text-red-500 p-1" title="Log out" data-testid="mobile-logout">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {expertLoading ? (
              <ExpertOverviewSkeleton />
            ) : !expert ? (
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Something went wrong loading your profile. Try refreshing.</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
              </div>
            ) : (
              <>
                {view === "overview" && <ExpertOverview expert={expert} userId={user.id} setView={setView} />}
                {view === "queue" && <AvailableQueue expertId={expert.id} setView={setView} setSelectedReview={setSelectedReview} />}
                {view === "active" && <MyActive expertId={expert.id} setView={setView} setSelectedReview={setSelectedReview} />}
                {view === "completed" && <CompletedHistory expertId={expert.id} setView={setView} setSelectedReview={setSelectedReview} />}
                {view === "earnings" && <Earnings userId={user.id} />}
                {view === "profile" && <ExpertProfile expert={expert} />}
                {view === "review-detail" && <ReviewDetail reviewId={selectedReview} expertId={expert.id} setView={setView} />}
              </>
            )}
            {/* FIX-2: Soft-launch banner */}
            <div className="w-full text-center py-3 text-red-500 text-xs font-medium border-t">
              That's a soft launch of our product. Sometimes you need to refresh the page to reflect all your changes
            </div>
          </main>
        </div>
        {/* Mobile bottom tab bar */}
        <MobileBottomTabs view={view} setView={setView} onLogout={handleLogout} />
        {showTour && <OnboardingTour steps={EXPERT_TOUR_STEPS} onComplete={() => setShowTour(false)} userId={user.id} />}
        {showConfetti && <ExpertConfetti />}
        <FloatingHelp />
      </div>
    </SidebarProvider>
  );
}
