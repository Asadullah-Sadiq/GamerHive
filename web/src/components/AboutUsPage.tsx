import React, { useState, useEffect } from 'react';
import {
  Users,
  Trophy,
  Gamepad2,
  Globe,
  Award,
  Star,
  Shield,
  Zap,
  Heart,
  Target,
  Code,
} from 'lucide-react';
import { apiRequest } from '../utils/api';

const AboutUsPage: React.FC = () => {
  const [stats, setStats] = useState([
    { label: 'Active Gamers', value: '0', icon: Users, color: '#60A5FA' },
    { label: 'Tournaments Hosted', value: '0', icon: Trophy, color: '#FBBF24' },
    { label: 'Games Available', value: '0', icon: Gamepad2, color: '#34D399' },
    { label: 'Communities', value: '0', icon: Globe, color: '#A78BFA' },
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiRequest<{
        activeGamers: number;
        tournaments: number;
        totalTournamentsCreated: number;
        gamesAvailable: number;
        communities: number;
      }>('/stats/all');
      
      if (response.success && response.data) {
        const data = response.data;
        const formatNumber = (num: number) => {
          if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K+`;
          }
          return num.toString();
        };

        setStats([
          { label: 'Active Gamers', value: formatNumber(data.activeGamers || 0), icon: Users, color: '#60A5FA' },
          { label: 'Tournaments Hosted', value: formatNumber(data.totalTournamentsCreated || 0), icon: Trophy, color: '#FBBF24' },
          { label: 'Games Available', value: formatNumber(data.gamesAvailable || 0), icon: Gamepad2, color: '#34D399' },
          { label: 'Communities', value: formatNumber(data.communities || 0), icon: Globe, color: '#A78BFA' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const features = [
    {
      icon: Award,
      title: 'Epic Tournaments',
      description: 'Compete in professionally organized tournaments with amazing prizes and recognition.',
      bgColor: 'rgba(250,204,21,0.12)',
      iconColor: '#FBBF24',
    },
    {
      icon: Users,
      title: 'Global Community',
      description: 'Connect with gamers worldwide, form teams, and build lasting friendships.',
      bgColor: 'rgba(96,165,250,0.12)',
      iconColor: '#60A5FA',
    },
    {
      icon: Gamepad2,
      title: 'Game Library',
      description: 'Access thousands of games through our innovative borrowing system.',
      bgColor: 'rgba(52,211,153,0.12)',
      iconColor: '#34D399',
    },
    {
      icon: Star,
      title: 'Skill Development',
      description: 'Learn from pros, get mentorship, and level up your gaming skills.',
      bgColor: 'rgba(167,139,250,0.12)',
      iconColor: '#A78BFA',
    },
    {
      icon: Shield,
      title: 'Safe Environment',
      description: 'Enjoy a secure, moderated platform with anti-cheat and fair play policies.',
      bgColor: 'rgba(248,113,113,0.12)',
      iconColor: '#F87171',
    },
    {
      icon: Zap,
      title: 'Real-time Features',
      description: 'Experience lightning-fast matchmaking, live streaming, and instant notifications.',
      bgColor: 'rgba(94,234,212,0.12)',
      iconColor: '#5EEAD4',
    },
  ];

  const values = [
    {
      icon: Heart,
      title: 'Community First',
      description: 'We believe in putting our gaming community at the center of everything we do.',
    },
    {
      icon: Shield,
      title: 'Fair Play',
      description: 'Promoting honest competition and maintaining integrity in all gaming activities.',
    },
    {
      icon: Star,
      title: 'Excellence',
      description: 'Striving for the highest quality in our platform, features, and user experience.',
    },
    {
      icon: Globe,
      title: 'Inclusivity',
      description: 'Creating a welcoming space for gamers of all backgrounds, skills, and interests.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-900/50 to-slate-900 border-b border-purple-500/20 py-7">
        <div className="w-[90%] max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">About GamerHive</h1>
          <p className="text-purple-200/85 text-base text-center max-w-4xl mx-auto mb-4">
            We're building the ultimate gaming community platform where players connect, compete, and grow together.
            Our mission is to create a space where every gamer can find their tribe and reach their full potential.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-between w-full mt-2.5">
            {stats.map((s, i) => {
              const IconComponent = s.icon;
              return (
                <div
                  key={i}
                  className="w-[calc(50%-15px)] bg-slate-900/50 p-3.5 rounded-xl mb-3 text-center border border-slate-700/6"
                >
                  <div className="flex justify-center mb-2">
                    <IconComponent size={20} color={s.color} />
                  </div>
                  <p className="text-white text-xl font-bold mt-1.5">{s.value}</p>
                  <p className="text-purple-200/70 text-xs mt-1">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mission & Vision */}
      <div className="px-4.5 py-5.5">
        <div className="flex flex-col md:flex-row gap-3 justify-between">
          <div className="flex-1 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/6 m-1.5">
            <div className="flex items-center mb-2">
              <div className="w-11 h-11 rounded-lg bg-purple-600 flex items-center justify-center mr-2.5">
                <Target size={18} color="#fff" />
              </div>
              <h2 className="text-lg font-semibold text-white">Our Mission</h2>
            </div>
            <p className="text-purple-200/85 mt-1.5 text-sm">
              To create the world's most inclusive and innovative gaming community platform, where players of all skill levels
              can connect, compete, learn, and grow together in a safe and supportive environment.
            </p>
          </div>

          <div className="flex-1 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/6 m-1.5">
            <div className="flex items-center mb-2">
              <div className="w-11 h-11 rounded-lg bg-cyan-500 flex items-center justify-center mr-2.5">
                <Star size={18} color="#fff" />
              </div>
              <h2 className="text-lg font-semibold text-white">Our Vision</h2>
            </div>
            <p className="text-purple-200/85 mt-1.5 text-sm">
              To be the go-to destination for gamers worldwide, fostering a global community that celebrates diversity,
              promotes fair play, and empowers every player to achieve their gaming dreams.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4.5 py-5.5 pb-0">
        <h2 className="text-2xl font-extrabold text-white text-center mb-3.5">What Makes Us Special</h2>

        {/* 2-per-row feature grid */}
        <div className="flex flex-wrap justify-between mt-2.5">
          {features.map((f, i) => {
            const IconComponent = f.icon;
            return (
              <div
                key={i}
                className="w-[48%] bg-slate-900/50 p-3.5 rounded-xl mb-3.5 border border-slate-700/6"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center mb-2"
                  style={{ backgroundColor: f.bgColor }}
                >
                  <IconComponent size={20} color={f.iconColor} />
                </div>
                <h3 className="text-white font-bold text-base mb-1">{f.title}</h3>
                <p className="text-purple-200/70 text-sm">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Values */}
      <div className="px-4.5 py-5.5">
        <h2 className="text-2xl font-extrabold text-white text-center mb-3.5">Our Core Values</h2>
        <div className="flex flex-wrap justify-between">
          {values.map((v, i) => {
            const IconComponent = v.icon;
            return (
              <div
                key={i}
                className="w-[48%] text-center mb-3.5 bg-slate-900/50 rounded-xl p-3 border border-slate-700/6"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-purple-600 mb-2">
                  <IconComponent size={22} color="#fff" />
                </div>
                <h3 className="text-white font-bold mt-2">{v.title}</h3>
                <p className="text-purple-200/70 text-center mt-1.5 text-sm">{v.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technology */}
      <div className="px-4.5 py-5.5">
        <h2 className="text-2xl font-extrabold text-white text-center mb-3.5">Built with Modern Technology</h2>
        <div className="bg-slate-900/50 rounded-xl p-3 flex flex-row justify-between mt-2">
          <div className="w-[calc(33.33%-13.33px)] text-center">
            <div className="w-15 h-15 rounded-full flex items-center justify-center mx-auto mb-2 bg-blue-500/8">
              <Code size={20} color="#60A5FA" />
            </div>
            <h3 className="text-white font-bold">Frontend</h3>
            <p className="text-purple-200/70 text-xs text-center">React, TypeScript, Tailwind CSS</p>
          </div>

          <div className="w-[calc(33.33%-13.33px)] text-center">
            <div className="w-15 h-15 rounded-full flex items-center justify-center mx-auto mb-2 bg-green-500/8">
              <Zap size={20} color="#10B981" />
            </div>
            <h3 className="text-white font-bold">Backend</h3>
            <p className="text-purple-200/70 text-xs text-center">Node.js, WebSocket, Real-time APIs</p>
          </div>

          <div className="w-[calc(33.33%-13.33px)] text-center">
            <div className="w-15 h-15 rounded-full flex items-center justify-center mx-auto mb-2 bg-purple-500/8">
              <Shield size={20} color="#7C3AED" />
            </div>
            <h3 className="text-white font-bold">Security</h3>
            <p className="text-purple-200/70 text-xs text-center">End-to-end encryption, Anti-cheat systems</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUsPage;
