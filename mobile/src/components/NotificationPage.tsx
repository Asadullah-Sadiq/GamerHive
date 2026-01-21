import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../utils/api";
import { playNotificationSound } from "../utils/sound";
import {
  Feather,
  MaterialCommunityIcons,
  Ionicons,
  FontAwesome5,
  AntDesign,
} from "@expo/vector-icons";

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
  | "feedback_reply"
  | "post_like"
  | "post_comment"
  | "community_message"
  | "direct_message"
  | "game_added"
  | "admin_community"
  | "admin_tournament"
  | "admin_game";

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
  // instead of passing icon components directly we will resolve them by type or explicit key
  iconKey?: string;
  color?: string;
  payload?: any; // Additional notification data
  sender?: {
    id: string;
    username: string;
    name: string;
    picture?: string;
  };
}

const { width, height } = Dimensions.get("window");
const isSmallScreen = width < 375;
const isMediumScreen = width >= 375 && width < 768;
const isLargeScreen = width >= 768;

const initialNotifications: Notification[] = [
 
];

// Icon resolver: map keys to expo vector icons (choose whichever icon set suits)
const IconResolver = ({
  name,
  size = 20,
}: {
  name?: string;
  size?: number;
}) => {
  switch (name) {
    case "trophy":
      return <FontAwesome5 name="trophy" size={size} />;
    // case "user-plus":
    //   return <AntDesign name="adduser" size={size} />;
    case "crown":
      return <FontAwesome5 name="crown" size={size} />;
    case "users":
      return <FontAwesome5 name="users" size={size} />;
    case "message-square":
      return <Feather name="message-square" size={size} />;
    case "gamepad":
      return <FontAwesome5 name="gamepad" size={size} />;
    case "settings":
      return <Feather name="settings" size={size} />;
    case "target":
      return <Feather name="target" size={size} />;
    case "bell":
      return <Feather name="bell" size={size} />;
    case "user-plus":
      return <Feather name="user-plus" size={size} />;
    case "check-circle":
      return <Feather name="check-circle" size={size} />;
    case "clock":
      return <Feather name="clock" size={size} />;
    case "check":
      return <Feather name="check" size={size} />;
    case "trash":
      return <Feather name="trash-2" size={size} />;
    case "mail":
      return <Feather name="mail" size={size} />;
    default:
      return <Feather name="bell" size={size} />;
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
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>(
    []
  );
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
      await api.put('/notification/read', { notificationId: id });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    // Update local state immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    // Update on server
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        await api.put('/notification/read-all', { userId: user.id });
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
      await api.delete('/notification', { data: { notificationId: id } });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const deleteSelected = () => {
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
      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      const response = await api.get(`/notification?userId=${user.id}&all=true`);

      if (response.data.success) {
        // Play sound for unread notifications
        const unreadNotifications = response.data.data.notifications.filter((n: any) => !n.isRead);
        if (unreadNotifications.length > 0) {
          await playNotificationSound();
        }

        const apiNotifications = response.data.data.notifications.map((notif: any) => {
          // Map notification type to icon and color
          const getIconKey = (type: string) => {
            if (type.includes('friend_request')) return 'user-plus';
            if (type.includes('friend_request_accepted')) return 'check-circle';
            if (type.includes('tournament') || type.includes('admin_tournament')) return 'trophy';
            if (type.includes('community') || type.includes('community_message')) return 'users';
            if (type.includes('achievement')) return 'crown';
            if (type.includes('message') || type.includes('direct_message')) return 'message-square';
            if (type.includes('game') || type.includes('game_added') || type.includes('admin_game')) return 'gamepad';
            if (type.includes('feedback_reply')) return 'mail';
            if (type.includes('post_like') || type.includes('post_comment')) return 'bell';
            return 'bell';
          };

          const getColor = (type: string) => {
            if (type.includes('friend_request')) return '#60A5FA';
            if (type.includes('friend_request_accepted')) return '#34D399';
            if (type.includes('tournament') || type.includes('admin_tournament')) return '#FBBF24';
            if (type.includes('community') || type.includes('community_message') || type.includes('admin_community')) return '#34D399';
            if (type.includes('achievement')) return '#C084FC';
            if (type.includes('message') || type.includes('direct_message')) return '#06B6D4';
            if (type.includes('game') || type.includes('game_added') || type.includes('admin_game')) return '#FB923C';
            if (type.includes('feedback_reply')) return '#7C3AED';
            if (type.includes('post_like') || type.includes('post_comment')) return '#8B5CF6';
            return '#6366F1';
          };

          return {
            id: notif.id || notif._id,
            type: notif.type as NotificationType,
            title: notif.title || 'Notification',
            message: notif.message || '',
            timestamp: notif.createdAt || notif.timestamp || new Date().toISOString(),
            isRead: notif.isRead || false,
            priority: (notif.priority || 'medium') as Priority,
            avatar: notif.senderId?.picture || notif.sender?.picture || notif.relatedUserId?.picture || notif.avatar,
            iconKey: getIconKey(notif.type),
            color: getColor(notif.type),
            payload: notif.payload || {},
            sender: notif.senderId || notif.sender || notif.relatedUserId || null,
          };
        });
        
        // Merge with initial notifications for demo data (or replace entirely)
        setNotifications(apiNotifications.length > 0 ? apiNotifications : initialNotifications);
      }
    } catch (error) {
      // Silently handle network errors - server may be unavailable
      // Fallback to initial notifications on error
      setNotifications(initialNotifications);
    } finally {
      setLoading(false);
    }
  };

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>
        <Text style={styles.titleGradient}>Notifications</Text>
      </Text>
      <Text style={styles.subtitle}>
        Stay updated with the latest activities, tournaments, and community
        updates.
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name="bell" size={48} color="#A78BFA" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchTerm ? "Try adjusting your search terms." : "You're all caught up!"}
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: Notification }) => {
    const isSelected = selectedNotifications.includes(item.id);
    return (
      <Pressable
        style={[
          styles.notificationCard,
          item.isRead ? styles.cardRead : styles.cardUnread,
          isSelected ? styles.cardSelected : undefined,
        ]}
        android_ripple={{ color: "rgba(124, 58, 237, 0.1)" }}
      >
        <View style={styles.row}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              toggleSelection(item.id);
            }}
            style={[
              styles.checkbox,
              isSelected ? styles.checkboxSelected : styles.checkboxUnselected,
            ]}
          >
            {isSelected ? (
              <Feather name="check" size={14} color="#fff" />
            ) : null}
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: item.color ?? "#374151" }]}>
                <IconResolver name={item.iconKey} size={18} />
              </View>
            )}
          </View>

          <View style={styles.content}>
            <View style={styles.contentTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.titleText, item.isRead ? styles.textRead : styles.textUnread]}>
                  {item.title}
                </Text>
                <Text style={[styles.messageText, item.isRead ? styles.subRead : styles.subUnread]}>
                  {item.message}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={12} color={item.isRead ? "#9CA3AF" : "#A78BFA"} />
                    <Text style={[styles.metaText, { 
                      color: item.isRead ? "#9CA3AF" : "#A78BFA",
                      fontWeight: item.isRead ? "400" : "500"
                    }]}>
                      {formatTime(item.timestamp)}
                    </Text>
                  </View>

                  <View style={[styles.metaTypeBadge, { 
                    backgroundColor: item.isRead ? "rgba(156, 163, 175, 0.1)" : "rgba(167, 139, 250, 0.15)"
                  }]}>
                    <Text style={[styles.metaType, { 
                      color: item.isRead ? "#9CA3AF" : "#A78BFA",
                      fontWeight: item.isRead ? "400" : "600"
                    }]}>
                      {item.type.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                {!item.isRead && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      markAsRead(item.id);
                    }}
                    style={styles.iconBtn}
                    android_ripple={{ color: "#333" }}
                  >
                    <Feather name="check" size={18} color="#34D399" />
                  </Pressable>
                )}

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteNotification(item.id);
                  }}
                  style={styles.iconBtn}
                  android_ripple={{ color: "#333" }}
                >
                  <Feather name="trash-2" size={18} color="#F87171" />
                </Pressable>
              </View>
            </View>
          </View>

          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
      </Pressable>
    );
  };

  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header area */}
      {renderHeader()}

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <Feather name="search" size={18} color="#9F7AEA" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search notifications..."
            placeholderTextColor="#9F7AEA"
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          <Feather name="filter" size={18} color="#9F7AEA" />
          <View style={styles.pickerRow}>
            <TouchableOpacity
              onPress={() => setFilter("all")}
              style={[styles.filterBtn, filter === "all" && styles.filterBtnActive]}
            >
              <Text style={filter === "all" ? styles.filterActiveText : styles.filterText}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter("unread")}
              style={[styles.filterBtn, filter === "unread" && styles.filterBtnActive]}
            >
              <Text style={filter === "unread" ? styles.filterActiveText : styles.filterText}>
                Unread
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter("tournament")}
              style={[styles.filterBtn, filter === "tournament" && styles.filterBtnActive]}
            >
              <Text style={filter === "tournament" ? styles.filterActiveText : styles.filterText}>
                Tournaments
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter("community")}
              style={[styles.filterBtn, filter === "community" && styles.filterBtnActive]}
            >
              <Text style={filter === "community" ? styles.filterActiveText : styles.filterText}>
                Communities
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter("friend")}
              style={[styles.filterBtn, filter === "friend" && styles.filterBtnActive]}
            >
              <Text style={filter === "friend" ? styles.filterActiveText : styles.filterText}>
                Friends
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter("system")}
              style={[styles.filterBtn, filter === "system" && styles.filterBtnActive]}
            >
              <Text style={filter === "system" ? styles.filterActiveText : styles.filterText}>
                System
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            {selectedNotifications.length > 0 ? (
              <>
                <Text style={styles.selectedCount}>{selectedNotifications.length} selected</Text>
                <TouchableOpacity onPress={clearSelection} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={deleteSelected} style={[styles.smallBtn, styles.deleteBtn]}>
                  <Feather name="trash-2" size={14} color="#FCA5A5" />
                  <Text style={[styles.smallBtnText, { color: "#FCA5A5", marginLeft: 6 }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={selectAll} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Select All</Text>
              </TouchableOpacity>
            )}
          </View>

          <View>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
                <Feather name="check-circle" size={16} color="#86EFAC" />
                <Text style={styles.markAllText}>Mark All Read</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* List */}
      <View style={styles.listWrap}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : filteredNotifications.length === 0 ? (
          renderEmpty()
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={async () => {
                  setRefreshing(true);
                  await loadNotifications();
                  setRefreshing(false);
                }} 
                tintColor="#7c3aed" 
              />
            }
            refreshing={loading}
            onRefresh={loadNotifications}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default NotificationPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // slate-900 equivalent
  },
  header: {
    padding: isSmallScreen ? 14 : isMediumScreen ? 16 : 18,
    borderBottomWidth: 1,
    borderBottomColor: "#6D28D933", // subtle purple border
  },
  title: {
    fontSize: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    fontWeight: "800",
    marginBottom: 6,
    color: "#fff",
  },
  titleGradient: {
    // we can't do bg-clip-text easily — use one solid color for readability
    color: "#C084FC",
  },
  subtitle: {
    color: "#C4B5FD",
    marginBottom: 12,
    fontSize: isSmallScreen ? 13 : 14,
  },

  controls: {
    padding: isSmallScreen ? 10 : 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: isSmallScreen ? 13 : 14,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  pickerRow: {
    flexDirection: "row",
    marginLeft: isSmallScreen ? 6 : 10,
    flexWrap: "wrap",
    flex: 1,
  },
  filterBtn: {
    paddingHorizontal: isSmallScreen ? 8 : 10,
    paddingVertical: isSmallScreen ? 5 : 6,
    borderRadius: 8,
    marginRight: isSmallScreen ? 6 : 8,
    marginBottom: isSmallScreen ? 4 : 0,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterBtnActive: {
    backgroundColor: "rgba(99,102,241,0.12)",
    borderColor: "rgba(99,102,241,0.25)",
  },
  filterText: {
    color: "#C4B5FD",
    fontSize: isSmallScreen ? 11 : 12,
  },
  filterActiveText: {
    color: "#EDE9FE",
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: "700",
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    flex: 1,
  },
  selectedCount: {
    color: "#C4B5FD",
    marginRight: isSmallScreen ? 6 : 8,
    fontSize: isSmallScreen ? 11 : 12,
  },
  smallBtn: {
    paddingHorizontal: isSmallScreen ? 8 : 10,
    paddingVertical: isSmallScreen ? 5 : 6,
    borderRadius: 8,
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    marginRight: isSmallScreen ? 6 : 8,
    marginBottom: isSmallScreen ? 4 : 0,
  },
  smallBtnText: {
    color: "#C4B5FD",
    fontSize: isSmallScreen ? 11 : 12,
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: isSmallScreen ? 8 : 10,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 10,
    backgroundColor: "rgba(16,185,129,0.08)",
    marginTop: isSmallScreen ? 4 : 0,
  },
  markAllText: {
    color: "#86EFAC",
    marginLeft: isSmallScreen ? 6 : 8,
    fontWeight: "700",
    fontSize: isSmallScreen ? 11 : 12,
  },

  listWrap: {
    flex: 1,
    padding: isSmallScreen ? 10 : 12,
  },

  notificationCard: {
    padding: isSmallScreen ? 10 : 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  cardRead: {
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderColor: "rgba(148,163,184,0.08)",
  },
  cardUnread: {
    borderColor: "rgba(124,58,237,0.25)",
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "#7C3AED",
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  checkbox: {
    width: isSmallScreen ? 20 : 22,
    height: isSmallScreen ? 20 : 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: isSmallScreen ? 10 : 12,
    marginTop: 6,
  },
  checkboxSelected: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  checkboxUnselected: {
    borderColor: "#374151",
  },

  avatarWrap: {
    width: isSmallScreen ? 44 : 48,
    height: isSmallScreen ? 44 : 48,
    marginRight: isSmallScreen ? 10 : 12,
  },
  avatar: {
    width: isSmallScreen ? 44 : 48,
    height: isSmallScreen ? 44 : 48,
    borderRadius: isSmallScreen ? 22 : 24,
  },
  iconCircle: {
    width: isSmallScreen ? 44 : 48,
    height: isSmallScreen ? 44 : 48,
    borderRadius: isSmallScreen ? 22 : 24,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flex: 1,
    minWidth: 0,
  },
  contentTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  titleText: {
    fontWeight: "700",
    fontSize: isSmallScreen ? 14 : 15,
    marginBottom: 4,
  },
  messageText: {
    fontSize: isSmallScreen ? 12 : 13,
    marginBottom: 8,
  },
  textRead: {
    color: "#C4B5FD",
  },
  textUnread: {
    color: "#fff",
  },
  subRead: {
    color: "rgba(196,181,253,0.7)",
  },
  subUnread: {
    color: "rgba(196,181,253,0.85)",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  metaText: {
    color: "#C4B5FD",
    fontSize: isSmallScreen ? 10 : 11,
    marginLeft: 6,
    fontWeight: "500",
  },
  metaTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  metaType: {
    textTransform: "uppercase",
    color: "#C4B5FD",
    fontSize: isSmallScreen ? 9 : 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  actions: {
    marginLeft: isSmallScreen ? 8 : 12,
  },
  iconBtn: {
    padding: isSmallScreen ? 6 : 8,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.5)",
  },

  unreadDot: {
    width: 8,
    height: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    marginLeft: 10,
    marginTop: 6,
  },

  empty: {
    alignItems: "center",
    marginTop: 56,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#C4B5FD",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },

});
