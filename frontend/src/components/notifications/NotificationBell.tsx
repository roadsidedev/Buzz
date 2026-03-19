import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { walletAddress } = useAuthStore();
  const navigate = useNavigate();

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

  const fetchNotifications = async () => {
    if (!walletAddress) return;
    try {
      const res = await axios.get(`${apiUrl}/notifications?userId=${walletAddress}`);
      if (res.data.success) {
        const notifs = res.data.data;
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: any) => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [walletAddress]);

  const handleRead = async (id: string, link: string) => {
    try {
      await axios.post(`${apiUrl}/notifications/${id}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      if (link) {
        navigate(link);
      }
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  if (!walletAddress) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors outline-none">
          <Bell size={20} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] h-[18px] text-[10px] flex items-center justify-center bg-accent-crimson hover:bg-accent-crimson border-none shadow-none">
              {unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="p-3 border-b border-border bg-muted/30">
          <h3 className="font-bold text-sm uppercase tracking-wider">Notifications</h3>
        </div>
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No active notifications
          </div>
        ) : (
          notifications.map(n => (
            <DropdownMenuItem 
              key={n.id} 
              className={`p-3 border-b border-border cursor-pointer flex flex-col items-start gap-1 focus:bg-accent ${!n.isRead ? "bg-accent-purple/5 border-l-2 border-l-accent-purple" : ""}`}
              onClick={() => handleRead(n.id, n.link)}
            >
              <div className="flex justify-between w-full items-start gap-2">
                <span className="font-bold text-sm leading-tight text-foreground">{n.title}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.message}</p>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
