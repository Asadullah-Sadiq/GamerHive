import React, { useEffect, useState } from 'react';
import { ArrowRight, Users, Trophy, Gamepad2, Star, RefreshCw } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface MainContentProps {
  onNavigate: (page: string) => void;
}

const MainContent: React.FC<MainContentProps> = ({ onNavigate }) => {
  const [activeGamersCount, setActiveGamersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [availableGamesCount, setAvailableGamesCount] = useState<number>(0);
  const [loadingGamesCount, setLoadingGamesCount] = useState<boolean>(true);
  const [tournamentsCount, setTournamentsCount] = useState<number>(0);
  const [loadingTournamentsCount, setLoadingTournamentsCount] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch active gamers count from API
  const fetchActiveGamersCount = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest<{ activeGamers: number }>('/stats/active-gamers');
      if (response.success && response.data) {
        setActiveGamersCount(response.data.activeGamers);
      }
    } catch (error) {
      console.error('Error fetching active gamers count:', error);
      // Keep default value of 0 on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available games count from API
  const fetchAvailableGamesCount = async () => {
    try {
      setLoadingGamesCount(true);
      const response = await apiRequest<{ games: any[] }>('/game/all');
      if (response.success && response.data) {
        // Filter only available games (status === 'available' and availableCopies > 0)
        const available = response.data.games.filter(
          (game: any) => game.status === 'available' && game.availableCopies > 0
        );
        setAvailableGamesCount(available.length);
      }
    } catch (error) {
      console.error('Error fetching available games count:', error);
    } finally {
      setLoadingGamesCount(false);
    }
  };

  // Fetch tournaments count from API
  const fetchTournamentsCount = async () => {
    try {
      setLoadingTournamentsCount(true);
      const response = await apiRequest<{ tournaments: any[] }>('/tournament');
      if (response.success && response.data) {
        const tournaments = response.data.tournaments || [];
        setTournamentsCount(tournaments.length);
      }
    } catch (error) {
      console.error('Error fetching tournaments count:', error);
      // Keep default value of 0 on error
    } finally {
      setLoadingTournamentsCount(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchActiveGamersCount();
    fetchAvailableGamesCount();
    fetchTournamentsCount();
  }, []);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchActiveGamersCount(),
      fetchAvailableGamesCount(),
      fetchTournamentsCount()
    ]);
    setRefreshing(false);
  };

  // Format count for display
  const formatCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K+`;
    }
    return count.toString();
  };
  return (
    <main className="flex-1 overflow-y-auto">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-12">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/30 to-blue-900/20">
          <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/50"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Join GamerHive
              </span>
              <br />
              <span className="text-white">Community</span>
            </h1>
            <p className="text-xl text-purple-200/80 max-w-2xl mx-auto leading-relaxed">
              Connect with gamers worldwide, participate in epic tournaments, and level up your gaming experience with our vibrant community.
            </p>
          </div>

          {/* CTA Button */}
          <button 
            onClick={() => onNavigate('communities')}
            className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transform hover:scale-105 transition-all duration-300"
          >
            <span className="flex items-center space-x-2">
              <span>Join Community</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300"></div>
          </button>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: Users, 
                label: 'Active Gamers', 
                value: isLoading ? '...' : formatCount(activeGamersCount) 
              },
              { 
                icon: Trophy, 
                label: 'Tournaments', 
                value: loadingTournamentsCount ? '...' : formatCount(tournamentsCount) 
              },
              { 
                icon: Gamepad2, 
                label: 'Games Available', 
                value: loadingGamesCount ? '...' : formatCount(availableGamesCount) 
              },
            ].map((stat) => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="p-6 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors"
                >
                  <IconComponent className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-purple-300/70 text-sm">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-8 flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-20 opacity-20">
          <Gamepad2 className="w-16 h-16 text-purple-400 animate-pulse" />
        </div>
        <div className="absolute bottom-20 right-20 opacity-20">
          <Trophy className="w-12 h-12 text-blue-400 animate-bounce" />
        </div>
      </section>

      {/* Additional Content Sections */}
      <section className="px-6 py-16 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Why Choose <span className="text-purple-400">GamerHive</span>?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'Global Community',
                description: 'Connect with gamers from around the world',
                color: 'from-purple-500 to-pink-500'
              },
              {
                title: 'Epic Tournaments',
                description: 'Compete in exciting gaming competitions',
                color: 'from-blue-500 to-cyan-500'
              },
              {
                title: 'Game Library',
                description: 'Access thousands of games to borrow',
                color: 'from-green-500 to-emerald-500'
              },
              {
                title: 'Skill Development',
                description: 'Level up your gaming skills with pros',
                color: 'from-orange-500 to-red-500'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} mb-4 flex items-center justify-center`}>
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-purple-200/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default MainContent;