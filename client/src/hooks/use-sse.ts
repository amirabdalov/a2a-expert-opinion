import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface SSEEvent {
  type: string;
  title: string;
  message: string;
  requestId?: number;
  link?: string;
}

export function useSSE(userId: number | undefined) {
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;

    const url = `${API_BASE}/api/events/${userId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        // Build navigation link from event data
        const link = data.link ||
          (data.requestId ? `#/dashboard?request=${data.requestId}` : undefined);

        // Show toast notification — clickable if there's a link
        toast({
          title: data.title,
          description: data.message + (link ? " (click to view)" : ""),
          duration: 8000,
          ...(link ? {
            onClick: () => {
              window.location.hash = link.startsWith('#') ? link.slice(1) : link;
            },
            className: "cursor-pointer",
          } : {}),
        });
        // Auto-refresh relevant queries
        if (data.type === "new_request") {
          queryClient.invalidateQueries({ queryKey: ["/api/reviews/pending"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        } else if (data.type === "claimed" || data.type === "review_completed") {
          queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
          if (data.requestId) {
            queryClient.invalidateQueries({ queryKey: ["/api/requests", data.requestId] });
            queryClient.invalidateQueries({ queryKey: ["/api/reviews/request", data.requestId] });
            queryClient.invalidateQueries({ queryKey: ["/api/requests", data.requestId, "timeline"] });
          }
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        } else if (data.type === "message") {
          if (data.requestId) {
            queryClient.invalidateQueries({ queryKey: ["/api/requests", data.requestId, "timeline"] });
          }
        }
      } catch {}
    };

    es.onerror = () => {
      // Auto-reconnect is handled by EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [userId]);
}
