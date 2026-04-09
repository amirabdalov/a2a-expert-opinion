import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="page-not-found">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-lg font-medium mb-2">Page not found</p>
        <p className="text-sm text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
        <Link href="/">
          <Button variant="outline" data-testid="button-go-home">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
