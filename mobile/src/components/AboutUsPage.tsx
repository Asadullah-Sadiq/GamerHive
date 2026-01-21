// AboutUsPage.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MaterialCommunityIcons,
  Feather,
  FontAwesome5,
  Ionicons,
  Entypo,
} from '@expo/vector-icons';
import api from '../utils/api';

const { width } = Dimensions.get('window');

const AboutUsPage: React.FC = () => {
  const [stats, setStats] = useState([
    { label: 'Active Gamers', value: '0', icon: <Feather name="users" size={20} />, color: '#60A5FA' },
    { label: 'Tournaments Hosted', value: '0', icon: <MaterialCommunityIcons name="trophy" size={20} />, color: '#FBBF24' },
    { label: 'Games Available', value: '0', icon: <FontAwesome5 name="gamepad" size={20} />, color: '#34D399' },
    { label: 'Communities', value: '0', icon: <Entypo name="globe" size={20} />, color: '#A78BFA' },
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/all');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        const formatNumber = (num: number) => {
          if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K+`;
          }
          return num.toString();
        };

        setStats([
          { label: 'Active Gamers', value: formatNumber(data.activeGamers || 0), icon: <Feather name="users" size={20} />, color: '#60A5FA' },
          { label: 'Tournaments Hosted', value: formatNumber(data.totalTournamentsCreated || 0), icon: <MaterialCommunityIcons name="trophy" size={20} />, color: '#FBBF24' },
          { label: 'Games Available', value: formatNumber(data.gamesAvailable || 0), icon: <FontAwesome5 name="gamepad" size={20} />, color: '#34D399' },
          { label: 'Communities', value: formatNumber(data.communities || 0), icon: <Entypo name="globe" size={20} />, color: '#A78BFA' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const features = [
    {
      icon: <MaterialCommunityIcons name="trophy-award" size={20} />,
      title: 'Epic Tournaments',
      description: 'Compete in professionally organized tournaments with amazing prizes and recognition.',
      bgColor: 'rgba(250,204,21,0.12)',
    },
    {
      icon: <Feather name="users" size={20} />,
      title: 'Global Community',
      description: 'Connect with gamers worldwide, form teams, and build lasting friendships.',
      bgColor: 'rgba(96,165,250,0.12)',
    },
    {
      icon: <FontAwesome5 name="gamepad" size={20} />,
      title: 'Game Library',
      description: 'Access thousands of games through our innovative borrowing system.',
      bgColor: 'rgba(52,211,153,0.12)',
    },
    {
      icon: <Entypo name="star" size={20} />,
      title: 'Skill Development',
      description: 'Learn from pros, get mentorship, and level up your gaming skills.',
      bgColor: 'rgba(167,139,250,0.12)',
    },
    {
      icon: <Ionicons name="shield-checkmark" size={20} />,
      title: 'Safe Environment',
      description: 'Enjoy a secure, moderated platform with anti-cheat and fair play policies.',
      bgColor: 'rgba(248,113,113,0.12)',
    },
    {
      icon: <Ionicons name="flash" size={20} />,
      title: 'Real-time Features',
      description: 'Experience lightning-fast matchmaking, live streaming, and instant notifications.',
      bgColor: 'rgba(94,234,212,0.12)',
    },
  ];

  const values = [
    {
      icon: <Feather name="heart" size={22} />,
      title: 'Community First',
      description: 'We believe in putting our gaming community at the center of everything we do.',
    },
    {
      icon: <Ionicons name="shield-checkmark-outline" size={22} />,
      title: 'Fair Play',
      description: 'Promoting honest competition and maintaining integrity in all gaming activities.',
    },
    {
      icon: <Entypo name="star" size={22} />,
      title: 'Excellence',
      description: 'Striving for the highest quality in our platform, features, and user experience.',
    },
    {
      icon: <Entypo name="globe" size={22} />,
      title: 'Inclusivity',
      description: 'Creating a welcoming space for gamers of all backgrounds, skills, and interests.',
    },
  ];


    function goToPage(arg0: string): void {
        throw new Error('Function not implemented.');
    }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Hero */}
      <LinearGradient
        colors={['#0f172a', '#3b0764aa', '#0f172a']}
        style={styles.hero}
        start={[0, 0]}
        end={[1, 0]}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>About GamerHive</Text>
          <Text style={styles.subtitle}>
            We're building the ultimate gaming community platform where players connect, compete, and grow together.
            Our mission is to create a space where every gamer can find their tribe and reach their full potential.
          </Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((s, i) => (
              <View key={i} style={styles.statBox}>
                {/* <View style={[styles.statIconWrap, { borderColor: 'rgba(255,255,255,0.04)' }]}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(255,255,255,0.03)' }]}> */}
                    {s.icon}
                  {/* </View> */}
                {/* </View> */}
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* Mission & Vision */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#7C3AED' }]}>
                <Feather name="target" size={18} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Our Mission</Text>
            </View>
            <Text style={styles.cardText}>
              To create the world's most inclusive and innovative gaming community platform, where players of all skill levels
              can connect, compete, learn, and grow together in a safe and supportive environment.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#06B6D4' }]}>
                <Entypo name="star" size={18} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Our Vision</Text>
            </View>
            <Text style={styles.cardText}>
              To be the go-to destination for gamers worldwide, fostering a global community that celebrates diversity,
              promotes fair play, and empowers every player to achieve their gaming dreams.
            </Text>
          </View>
        </View>
      </View>

      {/* Features */}
<View style={[styles.section, { paddingBottom: 0 }]}>
  <Text style={styles.sectionTitle}>What Makes Us Special</Text>

  {/* ✅ 2-per-row feature grid */}
  <View style={styles.featuresGrid}>
    {features.map((f, i) => (
      <View key={i} style={styles.featureCard}>
        <View style={[styles.featureIcon, { backgroundColor: f.bgColor }]}>
          {f.icon}
        </View>
        <Text style={styles.featureTitle}>{f.title}</Text>
        <Text style={styles.featureDesc}>{f.description}</Text>
      </View>
    ))}
  </View>
</View>


      {/* Values */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Core Values</Text>
        <View style={styles.valuesGrid}>
          {values.map((v, i) => (
            <View key={i} style={styles.valueBox}>
              <View style={styles.valueIconWrap}>{v.icon}</View>
              <Text style={styles.valueTitle}>{v.title}</Text>
              <Text style={styles.valueDesc}>{v.description}</Text>
            </View>
          ))}
        </View>
      </View>

      

      {/* Technology */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Built with Modern Technology</Text>
        <View style={styles.techCard}>
          <View style={styles.techCol}>
            <View style={styles.techIcon}>
              <Feather name="code" size={20} color="#60A5FA" />
            </View>
            <Text style={styles.techTitle}>Frontend</Text>
            <Text style={styles.techDesc}>React, TypeScript, Tailwind CSS</Text>
          </View>

          <View style={styles.techCol}>
            <View style={[styles.techIcon, { backgroundColor: 'rgba(16,185,129,0.08)' }]}>
              <Ionicons name="flash" size={20} color="#10B981" />
            </View>
            <Text style={styles.techTitle}>Backend</Text>
            <Text style={styles.techDesc}>Node.js, WebSocket, Real-time APIs</Text>
          </View>

          <View style={styles.techCol}>
            <View style={[styles.techIcon, { backgroundColor: 'rgba(124,58,237,0.08)' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.techTitle}>Security</Text>
            <Text style={styles.techDesc}>End-to-end encryption, Anti-cheat systems</Text>
          </View>
        </View>
      </View>

     

    </ScrollView>
  );
};

export default AboutUsPage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  contentContainer: { paddingBottom: 40 },
  hero: { paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: 'rgba(124,58,237,0.08)' },
  inner: { width: '90%', alignSelf: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { color: 'rgba(196,181,253,0.85)', fontSize: 16, textAlign: 'center', maxWidth: 800, marginBottom: 16 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',width:"100%",marginTop:10 },
  statBox: { width: width / 2 - 30, backgroundColor: 'rgba(15,23,42,0.5)', padding: 14, borderRadius: 12, marginBottom:12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(148,163,184,0.06)' },
  statIconWrap: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statIcon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 6 },
  statLabel: { color: 'rgba(196,181,253,0.7)', fontSize: 12, marginTop: 4 },

  section: { paddingHorizontal: 18, paddingVertical: 22 },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  card: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.06)', margin: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconCircle: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 10, fontWeight: '600', color: '#fff' },
  cardText: { color: 'rgba(196,181,253,0.85)', marginTop: 6, fontSize: 14 },

  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 14 },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop:10 },
  featureCard: { width: '48%', backgroundColor: 'rgba(15,23,42,0.5)', padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.06)' },
  featureIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featureTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  featureDesc: { color: 'rgba(196,181,253,0.7)', fontSize: 13 },

  valuesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  valueBox: { width: '48%', alignItems: 'center', marginBottom:14,backgroundColor:'rgba(15,23,42,0.5)',borderRadius:14,padding:12,borderWidth:1,borderColor:'rgba(148,163,184,0.06)' },
  valueIconWrap: { width: 64, height: 64, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C3AED'}, // visual only; gradient not applied here
  valueTitle: { color: '#fff', fontWeight: '700', marginTop: 8 },
  valueDesc: { color: 'rgba(196,181,253,0.7)', textAlign: 'center', marginTop: 6, fontSize: 13 },

  techCard: { backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 14, padding: 12, flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  techCol: { width: width / 3 - 20, alignItems: 'center' },
  techIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99,102,241,0.08)', marginBottom: 8 },
  techTitle: { color: '#fff', fontWeight: '700' },
  techDesc: { color: 'rgba(196,181,253,0.7)', fontSize: 12, textAlign: 'center' },

});
