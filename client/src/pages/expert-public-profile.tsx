import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Award, Star, CheckCircle, GraduationCap, Briefcase, Clock,
  ArrowLeft, UserCircle, ExternalLink, Share2, MessageSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Expert, User } from "@shared/schema";
import logoSrc from "@assets/a2a-blue-logo.svg";

export default function ExpertPublicProfile() {
  const [match, params] = useRoute("/expert/profile/:expertId");
  const expertId = params?.expertId ? parseInt(params.expertId) : 0;

  const { data: expert, isLoading: expertLoading } = useQuery<Expert>({
    queryKey: ["/api/experts", expertId],
    enabled: !!expertId,
  });

  const { data: user, isLoading: userLoading } = useQuery<Omit<User, "password">>({
    queryKey: ["/api/auth/user", expert?.userId],
    enabled: !!expert?.userId,
  });

  if (expertLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Expert not found.</p>
          <Link href="/"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  const ratingDisplay = (expert.rating / 10).toFixed(1);
  const categories = (() => {
    try { return JSON.parse(expert.categories || "[]"); } catch { return []; }
  })();
  const tierLabel = expert.rateTier === "guru" ? "Guru" : expert.rateTier === "pro" ? "Pro" : "Standard";
  const tierColor = expert.rateTier === "guru" ? "bg-amber-500" : expert.rateTier === "pro" ? "bg-indigo-500" : "bg-blue-500";

  return (
    <div className="min-h-screen bg-background" data-testid="page-expert-public-profile">
      {/* Top nav */}
      <div className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoSrc} alt="A2A Global" className="h-6" />
              <span className="font-semibold text-sm">Expert Opinion</span>
            </div>
          </Link>
          <Link href="/register">
            <Button size="sm" data-testid="button-cta-get-opinion">Get Expert Opinion</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Profile header */}
        <div className="flex items-start gap-6 mb-8" data-testid="profile-header">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.photo ? (
              <img
                src={`/api/users/${user.id}/photo`}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <UserCircle className="h-10 w-10 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" data-testid="text-expert-name">{user?.name || (expert as any).userName || `Expert #${expert.id}`}</h1>
              {expert.verified === 1 && (
                <Badge className="bg-green-100 text-green-800 text-xs" data-testid="badge-verified">
                  <CheckCircle className="h-3 w-3 mr-1" />Verified
                </Badge>
              )}
              <Badge className={`${tierColor} text-white text-xs`} data-testid="badge-tier">{tierLabel}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1" data-testid="text-rating">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span className="font-medium text-foreground">{ratingDisplay}</span>/5.0
                <span className="text-xs">({expert.totalReviews} reviews)</span>
              </div>
              {expert.yearsExperience > 0 && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> {expert.yearsExperience} years experience
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary" data-testid="text-completed-count">{expert.totalReviews}</p>
              <p className="text-xs text-muted-foreground">Completed Reviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600" data-testid="text-rating-big">{ratingDisplay}</p>
              <p className="text-xs text-muted-foreground">Average Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600" data-testid="text-tier-big">{tierLabel}</p>
              <p className="text-xs text-muted-foreground">Expert Tier</p>
            </CardContent>
          </Card>
        </div>

        {/* Bio */}
        {expert.bio && (
          <Card className="mb-6" data-testid="card-bio">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{expert.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Education */}
        {expert.education && (
          <Card className="mb-6" data-testid="card-education">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{expert.education}</p>
            </CardContent>
          </Card>
        )}

        {/* Experience */}
        {expert.expertise && (
          <Card className="mb-6" data-testid="card-experience">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Professional Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{expert.expertise}</p>
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <Card className="mb-6" data-testid="card-categories">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Expertise Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: string) => (
                  <Badge key={cat} variant="secondary" className="capitalize">{cat}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FIX-2: Client Reviews */}
        <PublicClientReviews expertId={expertId} />

        {/* CTA */}
        <div className="text-center py-8 bg-primary/5 rounded-lg border border-primary/10" data-testid="section-cta">
          <Award className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">Get an Expert Opinion</h2>
          <p className="text-sm text-muted-foreground mb-4">Submit your AI-generated content for professional review</p>
          <Link href="/register">
            <Button size="lg" data-testid="button-get-expert-opinion">
              Get Expert Opinion <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function PublicClientReviews({ expertId }: { expertId: number }) {
  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/experts", expertId, "client-reviews"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/experts/${expertId}/client-reviews`);
      return res.json();
    },
    enabled: !!expertId,
  });

  if (!reviews || reviews.length === 0) return null;

  return (
    <Card className="mb-6" data-testid="card-client-reviews">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> Client Reviews ({reviews.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reviews.map((r: any) => (
          <div key={r.requestId} className="border-b last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                <span className="text-sm font-bold">{r.clientRating}/5</span>
              </div>
            </div>
            {r.clientRatingComment && (
              <p className="text-xs text-muted-foreground italic">"{r.clientRatingComment}"</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">{r.category}{r.clientName ? ` · ${r.clientName}` : ""}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

