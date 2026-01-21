import React, { useMemo, useState, useEffect } from "react";
import {
  Bell,
  Search,
  Filter,
  Check,
  Trash2,
  Clock,
  CheckCircle,
  Trophy,
  Crown,
  Users,
  MessageSquare,
  Gamepad2,
  Settings,
  Target,
  UserPlus,
  Mail,
  Loader2,
} from "lucide-react";
import { apiRequest, getStoredUser, getImageUrl } from "../utils/api";

type NotificationType =
  | "tournament"
  | "community"
  | "friend"
  | "friend_request"
  | "friend_request_accepted"
  | "system"
  | "achievement"
  | "message"
  | "game"
  | "feedback_reply";

type Priority = "low" | "medium" | "high";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO
  isRead: boolean;
  priority: Priority;
  actionUrl?: string;
  avatar?: string;
  iconKey?: string;
  color?: string;
}

// Icon resolver: map keys to lucide-react icons
const IconResolver: React.FC<{ name?: string; size?: number; className?: string }> = ({
  name,
  size = 20,
  className = "",
}) => {
  const iconProps = { size, className };
  switch (name) {
    case "trophy":
      return <Trophy {...iconProps} />;
    case "crown":
      return <Crown {...iconProps} />;
    case "users":
      return <Users {...iconProps} />;
    case "message-square":
      return <MessageSquare {...iconProps} />;
    case "gamepad":
      return <Gamepad2 {...iconProps} />;
    case "settings":
      return <Settings {...iconProps} />;
    case "target":
      return <Target {...iconProps} />;
    case "bell":
      return <Bell {...iconProps} />;
    case "user-plus":
      return <UserPlus {...iconProps} />;
    case "check-circle":
      return <CheckCircle {...iconProps} />;
    case "clock":
      return <Clock {...iconProps} />;
    case "check":
      return <Check {...iconProps} />;
    case "trash":
      return <Trash2 {...iconProps} />;
    case "mail":
      return <Mail {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<
    "all" | "unread" | "tournament" | "community" | "friend" | "system" | "feedback_reply"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !notification.isRead) ||
        notification.type === filter;
      const matchesSearch =
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [notifications, filter, searchTerm]);

  const markAsRead = async (id: string) => {
    // Update local state immediately
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification
      )
    );

    // Update on server
    try {
      await apiRequest("/notification/read", {
        method: "PUT",
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    // Update local state immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    // Update on server
    try {
      const user = getStoredUser();
      if (user) {
        await apiRequest("/notification/read-all", {
          method: "PUT",
          body: JSON.stringify({ userId: user.id }),
        });
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    // Update local state immediately
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setSelectedNotifications((prev) => prev.filter((pid) => pid !== id));

    // Delete on server
    try {
      await apiRequest("/notification", {
        method: "DELETE",
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const deleteSelected = async () => {
    // Delete all selected notifications from server
    try {
      for (const id of selectedNotifications) {
        await apiRequest("/notification", {
          method: "DELETE",
          body: JSON.stringify({ notificationId: id }),
        });
      }
    } catch (error) {
      console.error("Error deleting selected notifications:", error);
    }

    // Update local state
    setNotifications((prev) =>
      prev.filter((n) => !selectedNotifications.includes(n.id))
    );
    setSelectedNotifications([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allIds = filteredNotifications.map((n) => n.id);
    setSelectedNotifications(allIds);
  };

  const clearSelection = () => setSelectedNotifications([]);

  // Load notifications from API
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const user = getStoredUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const response = await apiRequest<{ notifications: any[] }>(
        `/notification?userId=${user.id}&all=true`
      );

      if (response.success && response.data) {
        const apiNotifications = response.data.notifications.map((notif: any) => ({
          id: notif._id || notif.id,
          type: notif.type as NotificationType,
          title: notif.title,
          message: notif.message,
          timestamp: notif.createdAt || notif.timestamp,
          isRead: notif.isRead,
          priority: (notif.priority || "medium") as Priority,
          avatar: notif.relatedUserId?.picture || notif.avatar,
          iconKey:
            notif.type === "friend_request"
              ? "user-plus"
              : notif.type === "friend_request_accepted"
              ? "check-circle"
              : notif.type === "tournament"
              ? "trophy"
              : notif.type === "community"
              ? "users"
              : notif.type === "achievement"
              ? "crown"
              : notif.type === "message"
              ? "message-square"
              : notif.type === "game"
              ? "gamepad"
              : notif.type === "feedback_reply"
              ? "mail"
              : "bell",
          color:
            notif.type === "friend_request"
              ? "#60A5FA"
              : notif.type === "friend_request_accepted"
              ? "#34D399"
              : notif.type === "tournament"
              ? "#FBBF24"
              : notif.type === "community"
              ? "#34D399"
              : notif.type === "achievement"
              ? "#C084FC"
              : notif.type === "message"
              ? "#06B6D4"
              : notif.type === "game"
              ? "#FB923C"
              : notif.type === "feedback_reply"
              ? "#7C3AED"
              : "#6366F1",
        }));

        setNotifications(apiNotifications);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
      // Silently handle network errors - server may be unavailable
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
  };

  const renderEmpty = () => (
    <div className="flex flex-col items-center mt-14">
      <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
        <Bell className="w-12 h-12 text-purple-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No Notifications Found</h3>
      <p className="text-purple-300/70">
        {searchTerm ? "Try adjusting your search terms." : "You're all caught up!"}
      </p>
    </div>
  );

  const renderItem = (item: Notification) => {
    const isSelected = selectedNotifications.includes(item.id);
    return (
      <div
        className={`p-3 rounded-xl border transition-all ${
          item.isRead
            ? "bg-slate-800/30 border-slate-700/50"
            : "border-purple-500/30 bg-purple-500/10"
        } ${isSelected ? "ring-2 ring-purple-500" : ""}`}
      >
        <div className="flex items-start">
          <button
            onClick={() => toggleSelection(item.id)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 mt-1 transition-colors ${
              isSelected
                ? "bg-purple-600 border-purple-600"
                : "border-slate-600 hover:border-purple-500"
            }`}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </button>

          <div className="flex-shrink-0 mr-3">
            {item.avatar ? (
              <img
                src={getImageUrl(item.avatar) || item.avatar}
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const placeholder = target.nextElementSibling as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                item.avatar ? "hidden" : ""
              }`}
              style={{ backgroundColor: item.color ? `${item.color}20` : "rgba(55, 65, 81, 0.5)" }}
            >
              <IconResolver
                name={item.iconKey}
                size={18}
                className={item.color || "text-purple-400"}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4
                  className={`font-semibold mb-1 ${
                    item.isRead ? "text-purple-200" : "text-white"
                  }`}
                >
                  {item.title}
                </h4>
                <p
                  className={`text-sm mb-2 ${
                    item.isRead ? "text-purple-300/70" : "text-purple-200/80"
                  }`}
                >
                  {item.message}
                </p>

                <div className="flex items-center gap-3 text-xs text-purple-300/70">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(item.timestamp)}</span>
                  </div>
                  <span className="capitalize">{item.type.replace("_", " ")}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-3">
                {!item.isRead && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    className="p-2 bg-slate-700/50 hover:bg-slate-700/70 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4 text-green-400" />
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(item.id)}
                  className="p-2 bg-slate-700/50 hover:bg-red-600/20 rounded-lg transition-colors"
                  title="Delete notification"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          </div>

          {!item.isRead && (
            <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-2 ml-2"></div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-purple-500/20">
        <div className="mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Notifications
            </span>
          </h1>
          <p className="text-purple-200/80 text-sm md:text-base">
            Stay updated with the latest activities, tournaments, and community updates.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 md:p-6 border-b border-slate-700/50">
        <div className="mb-4">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-purple-400" />
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "all", label: "All" },
                  { key: "unread", label: "Unread" },
                  { key: "tournament", label: "Tournaments" },
                  { key: "community", label: "Communities" },
                  { key: "friend", label: "Friends" },
                  { key: "system", label: "System" },
                  { key: "feedback_reply", label: "Feedback" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as any)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all ${
                      filter === f.key
                        ? "bg-purple-600/30 border border-purple-500/50 text-white font-semibold"
                        : "bg-slate-800/30 border border-transparent text-purple-300 hover:border-purple-500/30"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {selectedNotifications.length > 0 ? (
                <>
                  <span className="text-purple-300 text-sm">
                    {selectedNotifications.length} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-slate-700/50 hover:bg-slate-700/70 rounded-lg text-purple-300 text-sm transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={deleteSelected}
                    className="flex items-center gap-1 px-3 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-300 text-sm transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={selectAll}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-700/70 rounded-lg text-purple-300 text-sm transition-colors"
                >
                  Select All
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-green-300 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark All Read</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 bg-slate-700/50 hover:bg-slate-700/70 rounded-lg text-purple-300 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <Loader2 className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => (
              <div key={item.id}>{renderItem(item)}</div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default NotificationPage;