import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FloatingHelp } from "@/components/floating-help";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAdmin, setAdmin } from "./admin-login";
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
  Command,
} from "lucide-react";
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

type AdminPage = "dashboard" | "users" | "experts" | "requests" | "transactions" | "withdrawals" | "notifications" | "settings" | "intelligence" | "acquisition";

const NAV_ITEMS: Array<{ id: AdminPage; label: string; icon: any }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "experts", label: "Experts", icon: GraduationCap },
  { id: "requests", label: "Requests", icon: FileText },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowDownUp },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "intelligence", label: "RL Core & BI", icon: Activity },
  { id: "acquisition", label: "Acquisition", icon: BarChart3 },
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

  return last30Days.map(({ date, label }) => {
    const reqs = (requests || []).filter((r: any) => {
      const created = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : null;
      return created === date;
    }).length;
    const rev = (transactions || []).filter((t: any) => {
      const created = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : null;
      return created === date && t.amount > 0;
    }).reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const pay = (transactions || []).filter((t: any) => {
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

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const admin = getAdmin();
  const [page, setPage] = useState<AdminPage>("dashboard");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  useEffect(() => {
    if (!admin) setLocation("/admin/login");
  }, [admin]);

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
    <div className="flex h-screen bg-zinc-950 text-zinc-100" data-testid="admin-dashboard">
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
                {item.label}
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
            onClick={() => { setAdmin(null); setLocation("/admin/login"); }}
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
          {page === "users" && <UsersPage />}
          {page === "experts" && <ExpertsPage />}
          {page === "requests" && <RequestsPage />}
          {page === "transactions" && <TransactionsPage />}
          {page === "withdrawals" && <WithdrawalsPage />}
          {page === "notifications" && <NotificationsPage />}
          {page === "settings" && <SettingsPage />}
          {page === "intelligence" && <IntelligencePage />}
          {page === "acquisition" && <AcquisitionPanel />}
        </div>
      </main>
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
  const items = (notifications || []).slice(0, 10);
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

  const filtered = (users || []).filter((u: any) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

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
                  <td className="px-4 py-3 text-zinc-200 font-medium">{u.name}</td>
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

  const filtered = (experts || []).filter((e: any) => {
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

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Education</th>
                <th className="text-right px-4 py-3">Yrs Exp</th>
                <th className="text-left px-4 py-3">Categories</th>
                <th className="text-right px-4 py-3">Rate/min</th>
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

  const refundMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/requests/${id}/refund`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Refund processed" });
      setSelected(null);
    },
  });

  const filtered = (requests || []).filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.serviceType !== typeFilter) return false;
    if (catFilter !== "all" && r.category !== catFilter) return false;
    return true;
  });

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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Transactions Page ───

function TransactionsPage() {
  // Fix 10: Add isLoading and error handling to prevent blank page
  const { data: transactions, isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/admin/transactions"],
    retry: 2,
  });
  const [typeFilter, setTypeFilter] = useState("all");

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const filtered = safeTransactions.filter((t: any) =>
    typeFilter === "all" || t?.type === typeFilter
  );

  const totalIn = safeTransactions.filter((t: any) => (t?.amount ?? 0) > 0).reduce((sum: number, t: any) => sum + (t?.amount ?? 0), 0);
  const totalOut = safeTransactions.filter((t: any) => (t?.amount ?? 0) < 0).reduce((sum: number, t: any) => sum + Math.abs(t?.amount ?? 0), 0);

  return (
    <div data-testid="admin-transactions-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Transactions</h1>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-zinc-200 h-9 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="earning">Earning</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="bonus">Bonus</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
            <SelectItem value="admin_grant">Admin Grant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fix 10: Loading and error states */}
      {isLoading && (
        <div className="text-center py-8 text-zinc-500 text-sm">Loading transactions...</div>
      )}
      {error && (
        <div className="text-center py-8 text-red-400 text-sm">Failed to load transactions. Try refreshing.</div>
      )}

      {/* Fix 11: Remove 'cr', use $ */}
      <div className="grid grid-cols-3 gap-3 mb-4">
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
            <div className="text-lg font-bold text-teal-400">${(totalIn - totalOut).toFixed(2)}</div>
            <div className="text-xs text-zinc-500">Net Balance</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">
                  {isLoading ? "Loading..." : "No transactions found"}
                </td></tr>
              ) : filtered.map((t: any) => (
                <tr key={t?.id ?? Math.random()} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-tx-${t?.id}`}>
                  <td className="px-4 py-3 text-zinc-500">#{t?.id}</td>
                  <td className="px-4 py-3 text-zinc-200">{t?.userName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 capitalize">{t?.type ?? "—"}</Badge>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${(t?.amount ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t?.amount ?? 0) > 0 ? "+" : ""}{t?.amount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs max-w-[250px] truncate">{t?.description ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{t?.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
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

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div data-testid="admin-withdrawals-page">
      <h1 className="text-lg font-semibold mb-4">Withdrawals</h1>

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
              {(withdrawals || []).map((w: any) => (
                <tr key={w.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors" data-testid={`row-withdrawal-${w.id}`}>
                  <td className="px-4 py-3 text-zinc-500">#{w.id}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium">{w.userName}</td>
                  <td className="px-4 py-3 text-right text-zinc-200 font-medium">${(w.amountCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${statusColor[w.status] || ""}`}>{w.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{w.processedAt ? new Date(w.processedAt).toLocaleDateString() : "—"}</td>
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

  return (
    <div data-testid="admin-notifications-page">
      <h1 className="text-lg font-semibold mb-4">System Notifications</h1>

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
              {(notifications || []).map((n: any) => (
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
                  <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(n.createdAt).toLocaleDateString()}</td>
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
              {(settings?.admins || []).map((a: any) => (
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

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading RL Core metrics...</div>;
  if (!data) return <div className="p-6 text-destructive">Failed to load metrics</div>;

  const { rlCore, business, tiers, domains, funnel, abTests, legal } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">RL Core & Business Intelligence</h2>
        <p className="text-sm text-muted-foreground">A2A Global Reinforcement Learning Core metrics, CAC analysis, and A/B test results</p>
      </div>

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
