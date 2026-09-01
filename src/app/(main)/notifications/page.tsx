"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CheckCheck,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationsSkeleton } from "@/components/ui/Skeletons";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  AppNotification,
} from "@/app/actions";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "NOTICES">("ALL");

  const loadNotifications = async () => {
    try {
      const res = await getUserNotifications();
      if (res) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const filteredList = notifications.filter((n) => {
    if (filter === "UNREAD") return !n.isRead;
    if (filter === "NOTICES") return n.type === "BILLING_ROLLOUT" || n.type === "DEMAND_NOTICE";
    return true;
  });

  return (
    <main className="relative flex-1 min-h-screen bg-surface-subtle text-on-surface flex flex-col p-4 sm:p-5 pb-24 max-w-md mx-auto w-full font-sans gap-4">
      {/* Sticky Top Section (Header + Tabs) */}
      <div className="sticky top-0 z-20 bg-surface-subtle/95 backdrop-blur-md -mx-4 px-4 sm:-mx-5 sm:px-5 pt-2 pb-0 space-y-4 shadow-sm border-b border-border-light/50">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl bg-surface border border-border-light shadow-sm flex items-center justify-center text-on-surface-muted hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-on-surface">Notifications</h1>
              <p className="text-xs text-on-surface-muted">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All notices caught up"}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-[#4B1426] hover:text-[#558467] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </header>

        {/* Filter Tabs - Clean Minimalistic Tabs (No Pills) */}
        <div className="flex items-center gap-6 border-b border-border-light px-1">
          {(
            [
              { key: "ALL" as const, label: `All (${notifications.length})` },
              { key: "UNREAD" as const, label: `Unread (${unreadCount})` },
              { key: "NOTICES" as const, label: "Statutory" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`relative py-2 text-xs font-medium transition-colors cursor-pointer ${
                filter === tab.key
                  ? "text-[#4B1426] font-semibold"
                  : "text-on-surface-muted hover:text-on-surface"
              }`}
            >
              <span>{tab.label}</span>
              {filter === tab.key && (
                <motion.div
                  layoutId="notifTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#4B1426] rounded-t-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <NotificationsSkeleton />
      ) : filteredList.length === 0 ? (
        <div className="p-8 text-center bg-surface shadow-sm rounded-2xl border border-border-light space-y-2 mt-4">
          <Bell className="w-8 h-8 text-[#DADCE0] mx-auto" />
          <h3 className="text-sm font-semibold text-on-surface">No notifications</h3>
          <p className="text-xs text-on-surface-muted">
            You have no notifications in this category.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                if (!item.isRead) handleMarkAsRead(item.id);
                if (item.type === "BILLING_ROLLOUT" || item.type === "DEMAND_NOTICE") {
                  router.push("/properties");
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                item.isRead
                  ? "bg-surface border-border-light hover:border-border-light"
                  : "bg-surface border-[#4B1426]/30 shadow-md ring-1 ring-[#4B1426]/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === "BILLING_ROLLOUT"
                        ? "bg-[#4B1426]/10 text-[#4B1426]"
                        : item.type === "PAYMENT_CONFIRMATION"
                        ? "bg-[#137333]/10 text-[#137333]"
                        : "bg-[#717171]/10 text-on-surface-muted"
                    }`}
                  >
                    {item.type === "BILLING_ROLLOUT" ? (
                      <FileText className="w-4 h-4" />
                    ) : item.type === "PAYMENT_CONFIRMATION" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-on-surface leading-snug">
                        {item.title}
                      </h3>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#C5221F] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-on-surface-muted mt-1 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-on-surface-muted shrink-0 whitespace-nowrap">
                  {item.timeAgo}
                </span>
              </div>

              <div className="pt-2 border-t border-[#F1F3F4] flex items-center justify-between text-[11px] text-on-surface-muted">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span>{item.createdAt}</span>
                </div>
                <span className="text-[#4B1426] font-medium flex items-center gap-0.5 hover:underline">
                  <span>View Details</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </main>
  );
}
