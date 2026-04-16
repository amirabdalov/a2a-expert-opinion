import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2 } from "lucide-react";

// In-memory admin state
let currentAdmin: { id: number; email: string; name: string; token?: string } | null = null;
const adminListeners: Array<() => void> = [];

export function setAdmin(admin: typeof currentAdmin) {
  currentAdmin = admin;
  if (admin?.token) {
    sessionStorage.setItem("adminToken", admin.token);
  }
  adminListeners.forEach(fn => fn());
}

export function getAdmin() {
  return currentAdmin;
}

export function getAdminToken(): string | null {
  return currentAdmin?.token || sessionStorage.getItem("adminToken") || null;
}

export function clearAdmin() {
  currentAdmin = null;
  sessionStorage.removeItem("adminToken");
  adminListeners.forEach(fn => fn());
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/login", { email, password });
      const admin = await res.json();
      setAdmin(admin);
      setLocation("/admin");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4" data-testid="admin-login-page">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 bg-teal-500/10 rounded-xl flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-teal-400" />
          </div>
          <CardTitle className="text-xl text-zinc-100">A2A Admin Portal</CardTitle>
          <p className="text-sm text-zinc-500 mt-1">Sign in to manage the platform</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-zinc-300">Email</Label>
              <Input
                id="admin-email"
                data-testid="input-admin-email"
                type="email"
                placeholder="admin@a2a.global"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-zinc-300">Password</Label>
              <Input
                id="admin-password"
                data-testid="input-admin-password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <Button
              type="submit"
              data-testid="button-admin-login"
              className="w-full bg-teal-600 hover:bg-teal-500 text-white"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
          {/* Admin credentials hint removed (Fix 9) */}
        </CardContent>
      </Card>
    </div>
  );
}
