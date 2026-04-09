import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, ChevronRight } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";

interface NotificationBellProps {
  userId: number;
  onNavigate?: (link: string) => void;
}

export function NotificationBell({ userId, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["/api/notifications", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/notifications/${userId}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", userId] });
    },
  });

  const unreadCount = data?.unreadCount || 0;
  const notifications = (data?.notifications || []).slice(0, 15);

  function handleNotificationClick(n: any) {
    // Mark as read
    if (!n.read) {
      markReadMut.mutate(n.id);
    }
    // Navigate if link exists
    if (n.link) {
      setOpen(false);
      if (onNavigate) {
        onNavigate(n.link);
      } else {
        setLocation(n.link);
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-notification-bell"
          className="relative h-8 w-8 p-0"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              data-testid="badge-unread-count"
              className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-background border"
        align="end"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors ${
                  n.link ? "cursor-pointer hover:bg-muted/50" : ""
                } ${!n.read ? "bg-primary/5" : ""}`}
                onClick={() => n.link && handleNotificationClick(n)}
                data-testid={`notification-${n.id}`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-primary" : "bg-muted"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {n.link ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : !n.read ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      markReadMut.mutate(n.id);
                    }}
                    data-testid={`button-mark-read-${n.id}`}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
