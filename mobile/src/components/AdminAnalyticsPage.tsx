import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import {
  ArrowLeft,
  ChartBar,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  FileText,
  Reply,
} from 'lucide-react-native';

interface AdminAnalyticsPageProps {
  onBack: () => void;
}

export default function AdminAnalyticsPage({ onBack }: AdminAnalyticsPageProps) {
  const [loading, setLoading] = useState(true);
  const [moderationData, setModerationData] = useState<any>(null);

  const totals = useMemo(() => moderationData?.totals || null, [moderationData]);
  const stats = useMemo(() => moderationData?.stats || null, [moderationData]);
  const percentages = useMemo(() => moderationData?.percentages || null, [moderationData]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      const userId = user?.id || user?._id;
      if (!userId) {
        Alert.alert('Error', 'User not found. Please login again.');
        return;
      }

      const moderationRes = await api.get(`/admin/analytics/moderation?userId=${userId}`);

      if (moderationRes.data?.success) setModerationData(moderationRes.data.data);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <ChartBar size={22} color="#a78bfa" />
          <Text style={styles.headerTitle}>Admin Analytics</Text>
        </View>
      </View>


      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 14 }}>
            {!stats || !totals || !percentages ? (
              <Text style={styles.muted}>No moderation analytics yet.</Text>
            ) : (
              <>
                <View style={styles.cardGrid}>
                  <View style={[styles.card, styles.cardNeutral]}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardLabel}>Total Moderated</Text>
                      <Shield size={18} color="#a78bfa" />
                    </View>
                    <Text style={styles.cardValue}>{String(totals.total || 0)}</Text>
                    <Text style={styles.cardHint}>All content types</Text>
                  </View>

                  <View style={[styles.card, styles.cardGreen]}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.cardLabel, { color: '#34d399' }]}>Safe</Text>
                      <CheckCircle2 size={18} color="#10b981" />
                    </View>
                    <Text style={[styles.cardValue, { color: '#34d399' }]}>{String(stats.SAFE.total || 0)}</Text>
                    <Text style={[styles.cardHint, { color: 'rgba(52,211,153,0.7)' }]}>
                      {percentages.safe}% of total
                    </Text>
                  </View>

                  <View style={[styles.card, styles.cardYellow]}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.cardLabel, { color: '#fbbf24' }]}>Mild</Text>
                      <AlertTriangle size={18} color="#f59e0b" />
                    </View>
                    <Text style={[styles.cardValue, { color: '#fbbf24' }]}>{String(stats.MILD_INSULT.total || 0)}</Text>
                    <Text style={[styles.cardHint, { color: 'rgba(251,191,36,0.7)' }]}>
                      {percentages.mildInsult}% of total
                    </Text>
                  </View>

                  <View style={[styles.card, styles.cardRed]}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.cardLabel, { color: '#fb7185' }]}>Harmful</Text>
                      <XCircle size={18} color="#ef4444" />
                    </View>
                    <Text style={[styles.cardValue, { color: '#fb7185' }]}>{String(stats.HARMFUL.total || 0)}</Text>
                    <Text style={[styles.cardHint, { color: 'rgba(251,113,133,0.7)' }]}>
                      {percentages.harmful}% of total
                    </Text>
                  </View>
                </View>

                <View style={[styles.panel]}>
                  <Text style={styles.panelTitle}>Content Breakdown</Text>
                  <BreakdownRow icon={<MessageSquare size={18} color="#a78bfa" />} label="Messages" safe={stats.SAFE.messages} mild={stats.MILD_INSULT.messages} harmful={stats.HARMFUL.messages} />
                  <BreakdownRow icon={<FileText size={18} color="#a78bfa" />} label="Posts" safe={stats.SAFE.posts} mild={stats.MILD_INSULT.posts} harmful={stats.HARMFUL.posts} />
                  <BreakdownRow icon={<MessageSquare size={18} color="#a78bfa" />} label="Comments" safe={stats.SAFE.comments} mild={stats.MILD_INSULT.comments} harmful={stats.HARMFUL.comments} />
                  <BreakdownRow icon={<Reply size={18} color="#a78bfa" />} label="Replies" safe={stats.SAFE.replies} mild={stats.MILD_INSULT.replies} harmful={stats.HARMFUL.replies} />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function BreakdownRow(props: { icon: React.ReactNode; label: string; safe: number; mild: number; harmful: number }) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLeft}>
        {props.icon}
        <Text style={styles.breakdownLabel}>{props.label}</Text>
      </View>
      <View style={styles.breakdownRight}>
        <Text style={[styles.breakdownNum, { color: '#34d399' }]}>{String(props.safe || 0)}</Text>
        <Text style={[styles.breakdownNum, { color: '#fbbf24' }]}>{String(props.mild || 0)}</Text>
        <Text style={[styles.breakdownNum, { color: '#fb7185' }]}>{String(props.harmful || 0)}</Text>
      </View>
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  tabBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: '#7c3aed' },
  tabBtnInactive: { backgroundColor: 'rgba(15,23,42,0.65)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(148,163,184,0.15)' },
  tabText: { fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  tabTextInactive: { color: '#cbd5e1' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 30 },
  muted: { color: '#94a3b8', textAlign: 'center', marginTop: 20 },

  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  cardValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cardHint: { color: '#94a3b8', fontSize: 11, marginTop: 4 },

  cardNeutral: { backgroundColor: 'rgba(30,41,59,0.45)', borderColor: 'rgba(148,163,184,0.15)' },
  cardGreen: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' },
  cardYellow: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' },
  cardRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' },

  panel: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(30,41,59,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.15)',
    gap: 10,
  },
  panelTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },

  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { color: '#e2e8f0', fontWeight: '700' },
  breakdownRight: { flexDirection: 'row', gap: 16 },
  breakdownNum: { fontWeight: '800' },
});

