import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { ArrowLeft, Search, X, Users, Shield } from 'lucide-react-native';

import { PageType } from '../../types';

interface AdminUsersPageProps {
  onBack: () => void;
  goToPage?: (page: PageType, params?: any) => void;
}

type AdminUserRow = {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  picture?: string | null;
  isAdmin?: boolean;
  isActive?: boolean;
  createdAt?: string;
};

export default function AdminUsersPage({ onBack, goToPage }: AdminUsersPageProps) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem('user');
      const me = raw ? JSON.parse(raw) : null;
      const userId = me?.id || me?._id;
      if (!userId) {
        setUsers([]);
        return;
      }
      const res = await api.get(`/user/all?userId=${userId}`);
      if (res.data?.success && res.data?.data?.users) {
        setUsers(res.data.data.users);
      } else {
        setUsers([]);
      }
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || username.includes(term) || email.includes(term);
    });
  }, [users, searchTerm]);

  const openUser = (userId: string) => {
    goToPage?.('profile', { targetUserId: userId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>All Users</Text>
          <Text style={styles.subtitle}>Total: {users.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearBtn}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Users size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>{searchTerm ? 'No users found' : 'No users yet'}</Text>
              <Text style={styles.emptySub}>{searchTerm ? 'Try a different search term' : 'Users will appear here once they register'}</Text>
            </View>
          ) : (
            filtered.map((u) => {
              const displayName = u.name || u.username || 'Unknown User';
              return (
                <TouchableOpacity key={u.id} style={styles.row} onPress={() => openUser(u.id)}>
                  <View style={styles.avatarWrap}>
                    <Image source={getAvatarImageSource(u.picture || '')} style={styles.avatar} />
                    {u.isActive && <View style={styles.onlineDot} />}
                    {u.isAdmin && (
                      <View style={styles.adminBadge}>
                        <Shield size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                      {u.isAdmin && (
                        <View style={styles.tagAdmin}><Text style={styles.tagAdminText}>Admin</Text></View>
                      )}
                      {u.isActive === false && (
                        <View style={styles.tagInactive}><Text style={styles.tagInactiveText}>Inactive</Text></View>
                      )}
                    </View>
                    <Text style={styles.username} numberOfLines={1}>@{u.username || 'no-username'}</Text>
                  </View>
                  <Users size={18} color="#7C3AED" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  header: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  searchWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  searchInput: { flex: 1, color: '#fff', fontWeight: '600' },
  clearBtn: { padding: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, paddingBottom: 30, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(30,41,59,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  avatarWrap: { width: 50, height: 50, borderRadius: 25 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(148,163,184,0.2)' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34d399',
    borderWidth: 2,
    borderColor: '#0b1220',
  },
  adminBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 2,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontWeight: '800', maxWidth: 170 },
  username: { color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  tagAdmin: { backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagAdminText: { color: '#f59e0b', fontSize: 11, fontWeight: '800' },
  tagInactive: { backgroundColor: 'rgba(239,68,68,0.18)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagInactiveText: { color: '#ef4444', fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { color: '#cbd5e1', fontSize: 16, fontWeight: '800', marginTop: 14 },
  emptySub: { color: '#94a3b8', marginTop: 6, textAlign: 'center' },
});

