import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Users, 
  BarChart3, 
  ArrowUpRight,
  Calendar,
  UserPlus,
  Gamepad2,
  Trophy,
  Mail
} from "lucide-react";
import { apiRequest } from "../utils/api";

const MAX_BAR_HEIGHT = 220;

interface MonthlyData {
  currentMonth: string;
  currentMonthSignups: number;
  labels: string[];
  values: number[];
  totalUsers: number;
  growthPercentage: number;
}

interface MonthlyGameData {
  currentMonth: string;
  currentMonthGames: number;
  labels: string[];
  values: number[];
  totalGames: number;
}

interface MonthlyTournamentData {
  currentMonth: string;
  currentMonthTournaments: number;
  labels: string[];
  values: number[];
  totalTournaments: number;
}

interface AdminDashboardProps {
  goToPage?: (page: string, params?: any) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ goToPage }) => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [monthlyGameData, setMonthlyGameData] = useState<MonthlyGameData | null>(null);
  const [monthlyTournamentData, setMonthlyTournamentData] = useState<MonthlyTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    fetchMonthlySignups();
    fetchMonthlyGames();
    fetchMonthlyTournaments();
  }, []);

  const fetchMonthlySignups = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<MonthlyData>('/stats/monthly-signups');
      if (response.success && response.data) {
        setMonthlyData(response.data);
      }
    } catch (error) {
      console.error('Error fetching monthly signups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyGames = async () => {
    try {
      setLoadingGames(true);
      const response = await apiRequest<MonthlyGameData>('/stats/monthly-games');
      if (response.success && response.data) {
        setMonthlyGameData(response.data);
      }
    } catch (error) {
      console.error('Error fetching monthly games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  const fetchMonthlyTournaments = async () => {
    try {
      setLoadingTournaments(true);
      const response = await apiRequest<MonthlyTournamentData>('/stats/monthly-tournaments');
      if (response.success && response.data) {
        setMonthlyTournamentData(response.data);
      }
    } catch (error) {
      console.error('Error fetching monthly tournaments:', error);
    } finally {
      setLoadingTournaments(false);
    }
  };

  const getGrowthPercentage = () => {
    // Use growth percentage from backend if available
    if (monthlyData && monthlyData.growthPercentage !== undefined) {
      return monthlyData.growthPercentage;
    }
    // Fallback to local calculation if backend doesn't provide it
    if (!monthlyData || monthlyData.values.length < 2) return 0;
    const recent = monthlyData.values[monthlyData.values.length - 1];
    const previous = monthlyData.values[monthlyData.values.length - 2];
    if (previous === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - previous) / previous) * 100);
  };

  const renderCurrentMonthChart = () => {
    if (!monthlyData) {
      return (
        <div className="h-[360px] flex flex-col items-center justify-center py-10">
          <BarChart3 size={48} color="#64748b" />
          <p className="text-slate-400 text-base font-semibold mt-4">No signup data available</p>
          <p className="text-slate-500 text-sm mt-2">User signups will appear here</p>
        </div>
      );
    }

    const currentMonthCount = monthlyData.currentMonthSignups || 0;
    const maxValue = Math.max(...monthlyData.values, currentMonthCount, 1);
    const barHeight = (currentMonthCount / maxValue) * MAX_BAR_HEIGHT;

    // Get last 5 months for comparison (excluding current month)
    const comparisonData = monthlyData.values.slice(0, -1);
    const comparisonLabels = monthlyData.labels.slice(0, -1);
    const comparisonMax = Math.max(...comparisonData, 1);
    const comparisonBarHeight = 100; // Fixed height for comparison bars

    return (
      <div className="py-2">
        {/* Current Month Display */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Calendar size={20} color="#a78bfa" />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-medium mb-0.5">Current Month</p>
              <p className="text-white text-lg font-bold tracking-tight">{monthlyData.currentMonth}</p>
            </div>
          </div>
          
          <div className="bg-slate-900/60 rounded-2xl p-5 border border-purple-500/20">
            <div className="flex items-end gap-4">
              {/* Value Display */}
              <div className="bg-purple-500/15 px-4 py-4 rounded-xl border border-purple-500/30 min-w-[100px] text-center">
                <p className="text-purple-400 text-3xl font-extrabold tracking-tight mb-1">{currentMonthCount}</p>
                <p className="text-slate-400 text-xs font-medium text-center">Users Registered</p>
              </div>

              {/* Main Bar */}
              <div className="flex-1 h-[220px] relative flex items-end">
                <div
                  className="w-full rounded-xl min-h-[20px] relative overflow-hidden"
                  style={{
                    height: `${Math.max(barHeight, 20)}px`,
                    background: 'linear-gradient(to top, #8b5cf6, #a78bfa, #c4b5fd, #ddd6fe)',
                    boxShadow: '0 6px 12px rgba(124, 58, 237, 0.5)',
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), rgba(255,255,255,0), transparent)',
                    }}
                  />
                </div>
                
                {/* Grid lines */}
                <div className="absolute inset-0">
                  {[4, 3, 2, 1, 0].map((line) => (
                    <div
                      key={line}
                      className="absolute left-0 right-0 h-px bg-slate-700/10"
                      style={{ bottom: `${(line * MAX_BAR_HEIGHT / 4)}px` }}
                    />
                  ))}
                </div>
              </div>

              {/* Y-axis */}
              <div className="w-[35px] flex flex-col justify-between items-end pr-2 h-[220px]">
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((val, idx) => (
                  <span key={idx} className="text-slate-500 text-xs font-semibold tabular-nums">
                    {val}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Section - Last 5 Months */}
        <div className="mt-2">
          <p className="text-slate-400 text-sm font-semibold mb-4 uppercase tracking-wide">Previous Months Comparison</p>
          <div className="flex justify-between gap-2">
            {comparisonData.map((value, index) => {
              const barHeight = (value / comparisonMax) * comparisonBarHeight;
              const monthName = comparisonLabels[index]?.substring(0, 3) || '';
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center mb-2 min-h-[120px] justify-end">
                    {value > 0 && (
                      <>
                        <span className="text-white text-[10px] font-bold mb-1 bg-slate-900/90 px-1 py-0.5 rounded">
                          {value}
                        </span>
                        <div
                          className="w-full rounded-md min-h-[4px]"
                          style={{
                            height: `${Math.max(barHeight, 4)}px`,
                            background: 'linear-gradient(to top, #6366f1, #7c3aed)',
                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
                          }}
                        />
                      </>
                    )}
                    {value === 0 && (
                      <div className="w-full h-[4px] rounded-md bg-slate-700/5 border border-dashed border-slate-700/10" />
                    )}
                  </div>
                  <span className="text-slate-500 text-[10px] font-semibold text-center w-full">
                    {monthName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentMonthGamesChart = () => {
    if (!monthlyGameData) {
      return (
        <div className="h-[360px] flex flex-col items-center justify-center py-10">
          <Gamepad2 size={48} color="#64748b" />
          <p className="text-slate-400 text-base font-semibold mt-4">No game data available</p>
          <p className="text-slate-500 text-sm mt-2">Games added will appear here</p>
        </div>
      );
    }

    const currentMonthCount = monthlyGameData.currentMonthGames || 0;
    const maxValue = Math.max(...monthlyGameData.values, currentMonthCount, 1);
    const barHeight = (currentMonthCount / maxValue) * MAX_BAR_HEIGHT;

    // Get last 5 months for comparison (excluding current month)
    const comparisonData = monthlyGameData.values.slice(0, -1);
    const comparisonLabels = monthlyGameData.labels.slice(0, -1);
    const comparisonMax = Math.max(...comparisonData, 1);
    const comparisonBarHeight = 100; // Fixed height for comparison bars

    return (
      <div className="py-2">
        {/* Current Month Display */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Calendar size={20} color="#10b981" />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-medium mb-0.5">Current Month</p>
              <p className="text-white text-lg font-bold tracking-tight">{monthlyGameData.currentMonth}</p>
            </div>
          </div>
          
          <div className="bg-slate-900/60 rounded-2xl p-5 border border-emerald-500/20">
            <div className="flex items-end gap-4">
              {/* Value Display */}
              <div className="bg-emerald-500/15 px-4 py-4 rounded-xl border border-emerald-500/30 min-w-[100px] text-center">
                <p className="text-emerald-500 text-3xl font-extrabold tracking-tight mb-1">{currentMonthCount}</p>
                <p className="text-slate-400 text-xs font-medium text-center">Games Added</p>
              </div>

              {/* Main Bar */}
              <div className="flex-1 h-[220px] relative flex items-end">
                <div
                  className="w-full rounded-xl min-h-[20px] relative overflow-hidden"
                  style={{
                    height: `${Math.max(barHeight, 20)}px`,
                    background: 'linear-gradient(to top, #10b981, #34d399, #6ee7b7, #a7f3d0)',
                    boxShadow: '0 6px 12px rgba(16, 185, 129, 0.5)',
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), rgba(255,255,255,0), transparent)',
                    }}
                  />
                </div>
                
                {/* Grid lines */}
                <div className="absolute inset-0">
                  {[4, 3, 2, 1, 0].map((line) => (
                    <div
                      key={line}
                      className="absolute left-0 right-0 h-px bg-slate-700/10"
                      style={{ bottom: `${(line * MAX_BAR_HEIGHT / 4)}px` }}
                    />
                  ))}
                </div>
              </div>

              {/* Y-axis */}
              <div className="w-[35px] flex flex-col justify-between items-end pr-2 h-[220px]">
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((val, idx) => (
                  <span key={idx} className="text-slate-500 text-xs font-semibold tabular-nums">
                    {val}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Section - Last 5 Months */}
        <div className="mt-2">
          <p className="text-slate-400 text-sm font-semibold mb-4 uppercase tracking-wide">Previous Months Comparison</p>
          <div className="flex justify-between gap-2">
            {comparisonData.map((value, index) => {
              const barHeight = (value / comparisonMax) * comparisonBarHeight;
              const monthName = comparisonLabels[index]?.substring(0, 3) || '';
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center mb-2 min-h-[120px] justify-end">
                    {value > 0 && (
                      <>
                        <span className="text-white text-[10px] font-bold mb-1 bg-slate-900/90 px-1 py-0.5 rounded">
                          {value}
                        </span>
                        <div
                          className="w-full rounded-md min-h-[4px]"
                          style={{
                            height: `${Math.max(barHeight, 4)}px`,
                            background: 'linear-gradient(to top, #059669, #10b981)',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                          }}
                        />
                      </>
                    )}
                    {value === 0 && (
                      <div className="w-full h-[4px] rounded-md bg-slate-700/5 border border-dashed border-slate-700/10" />
                    )}
                  </div>
                  <span className="text-slate-500 text-[10px] font-semibold text-center w-full">
                    {monthName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentMonthTournamentsChart = () => {
    if (!monthlyTournamentData) {
      return (
        <div className="h-[360px] flex flex-col items-center justify-center py-10">
          <Trophy size={48} color="#64748b" />
          <p className="text-slate-400 text-base font-semibold mt-4">No tournament data available</p>
          <p className="text-slate-500 text-sm mt-2">Tournaments added will appear here</p>
        </div>
      );
    }

    const currentMonthCount = monthlyTournamentData.currentMonthTournaments || 0;
    const maxValue = Math.max(...monthlyTournamentData.values, currentMonthCount, 1);
    const barHeight = (currentMonthCount / maxValue) * MAX_BAR_HEIGHT;

    // Get last 5 months for comparison (excluding current month)
    const comparisonData = monthlyTournamentData.values.slice(0, -1);
    const comparisonLabels = monthlyTournamentData.labels.slice(0, -1);
    const comparisonMax = Math.max(...comparisonData, 1);
    const comparisonBarHeight = 100; // Fixed height for comparison bars

    return (
      <div className="py-2">
        {/* Current Month Display */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Calendar size={20} color="#f59e0b" />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-medium mb-0.5">Current Month</p>
              <p className="text-white text-lg font-bold tracking-tight">{monthlyTournamentData.currentMonth}</p>
            </div>
          </div>
          
          <div className="bg-slate-900/60 rounded-2xl p-5 border border-amber-500/20">
            <div className="flex items-end gap-4">
              {/* Value Display */}
              <div className="bg-amber-500/15 px-4 py-4 rounded-xl border border-amber-500/30 min-w-[100px] text-center">
                <p className="text-amber-500 text-3xl font-extrabold tracking-tight mb-1">{currentMonthCount}</p>
                <p className="text-slate-400 text-xs font-medium text-center">Tournaments Added</p>
              </div>

              {/* Main Bar */}
              <div className="flex-1 h-[220px] relative flex items-end">
                <div
                  className="w-full rounded-xl min-h-[20px] relative overflow-hidden"
                  style={{
                    height: `${Math.max(barHeight, 20)}px`,
                    background: 'linear-gradient(to top, #f59e0b, #fbbf24, #fcd34d, #fde68a)',
                    boxShadow: '0 6px 12px rgba(245, 158, 11, 0.5)',
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), rgba(255,255,255,0), transparent)',
                    }}
                  />
                </div>
                
                {/* Grid lines */}
                <div className="absolute inset-0">
                  {[4, 3, 2, 1, 0].map((line) => (
                    <div
                      key={line}
                      className="absolute left-0 right-0 h-px bg-slate-700/10"
                      style={{ bottom: `${(line * MAX_BAR_HEIGHT / 4)}px` }}
                    />
                  ))}
                </div>
              </div>

              {/* Y-axis */}
              <div className="w-[35px] flex flex-col justify-between items-end pr-2 h-[220px]">
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((val, idx) => (
                  <span key={idx} className="text-slate-500 text-xs font-semibold tabular-nums">
                    {val}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Section - Last 5 Months */}
        <div className="mt-2">
          <p className="text-slate-400 text-sm font-semibold mb-4 uppercase tracking-wide">Previous Months Comparison</p>
          <div className="flex justify-between gap-2">
            {comparisonData.map((value, index) => {
              const barHeight = (value / comparisonMax) * comparisonBarHeight;
              const monthName = comparisonLabels[index]?.substring(0, 3) || '';
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center mb-2 min-h-[120px] justify-end">
                    {value > 0 && (
                      <>
                        <span className="text-white text-[10px] font-bold mb-1 bg-slate-900/90 px-1 py-0.5 rounded">
                          {value}
                        </span>
                        <div
                          className="w-full rounded-md min-h-[4px]"
                          style={{
                            height: `${Math.max(barHeight, 4)}px`,
                            background: 'linear-gradient(to top, #d97706, #f59e0b)',
                            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
                          }}
                        />
                      </>
                    )}
                    {value === 0 && (
                      <div className="w-full h-[4px] rounded-md bg-slate-700/5 border border-dashed border-slate-700/10" />
                    )}
                  </div>
                  <span className="text-slate-500 text-[10px] font-semibold text-center w-full">
                    {monthName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const growthPercentage = getGrowthPercentage();

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-y-auto">
      {/* Hero Header */}
      <div
        className="h-[280px] bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-800 relative"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1080')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(30, 27, 75, 0.9), rgba(49, 46, 129, 0.9), rgba(30, 41, 59, 0.9))',
          }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
          <div className="w-18 h-18 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-5 border border-purple-500/20">
            <BarChart3 size={32} color="#a78bfa" />
          </div>
          <h1 className="text-3xl font-extrabold text-white text-center mb-2 tracking-tight">Admin Dashboard</h1>
          <p className="text-purple-300 text-base text-center opacity-90">
            Analytics & Insights Overview
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex justify-between gap-3">
          <div className="flex-1 bg-gradient-to-br from-purple-500/15 to-purple-500/5 p-5 rounded-2xl border border-slate-700/10 flex flex-col items-center min-h-[140px] justify-center">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
              <Users size={24} color="#a78bfa" />
            </div>
            <p className="text-2xl font-bold text-white mb-1 tracking-tight">
              {monthlyData ? monthlyData.totalUsers.toLocaleString() : '0'}
            </p>
            <p className="text-slate-400 text-xs font-medium text-center">Total Users</p>
          </div>

          <div className="flex-1 bg-gradient-to-br from-purple-600/15 to-purple-600/5 p-5 rounded-2xl border border-slate-700/10 flex flex-col items-center min-h-[140px] justify-center">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-3">
              <UserPlus size={24} color="#a78bfa" />
            </div>
            <p className="text-2xl font-bold text-white mb-1 tracking-tight">
              {monthlyData ? monthlyData.currentMonthSignups : 0}
            </p>
            <p className="text-slate-400 text-xs font-medium text-center">
              {monthlyData ? monthlyData.currentMonth.split(' ')[0] : 'This Month'}
            </p>
          </div>

          <div className={`flex-1 bg-gradient-to-br p-5 rounded-2xl border border-slate-700/10 flex flex-col items-center min-h-[140px] justify-center ${
            growthPercentage >= 0 
              ? 'from-emerald-500/15 to-emerald-500/5' 
              : 'from-red-500/15 to-red-500/5'
          }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
              growthPercentage >= 0 
                ? 'bg-emerald-500/20' 
                : 'bg-red-500/20'
            }`}>
              <TrendingUp 
                size={24} 
                color={growthPercentage >= 0 ? '#4ade80' : '#f87171'} 
              />
            </div>
            <p 
              className={`text-2xl font-bold mb-1 tracking-tight ${
                growthPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {growthPercentage > 0 ? '+' : ''}{growthPercentage}%
            </p>
            <p className="text-slate-400 text-xs font-medium text-center">Growth Rate</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {goToPage && (
        <div className="px-5 pt-6 pb-2">
          <button
            onClick={() => goToPage('feedback')}
            className="w-full rounded-2xl overflow-hidden bg-gradient-to-r from-purple-500/20 to-purple-500/10 border border-purple-500/20 p-4 flex items-center gap-3 mb-3 hover:from-purple-500/30 hover:to-purple-500/20 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Mail size={24} color="#a78bfa" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-base font-bold text-white mb-1">User Feedback</p>
              <p className="text-slate-400 text-sm">View and manage user feedback</p>
            </div>
            <ArrowUpRight size={20} color="#a78bfa" />
          </button>
        </div>
      )}

      {/* Chart Section - User Signups */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <TrendingUp size={20} color="#7c3aed" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-0.5 tracking-tight">Monthly User Signups</h2>
              <p className="text-slate-400 text-sm font-medium">
                Last 12 months analytics
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-600/15 flex items-center justify-center">
            <Calendar size={14} color="#a78bfa" />
          </div>
        </div>

        {loading ? (
          <div className="h-[360px] flex flex-col items-center justify-center bg-slate-800 rounded-2xl border border-slate-700/10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="text-slate-400 mt-4 text-sm font-medium">Loading analytics...</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/10 shadow-lg">
            {renderCurrentMonthChart()}
          </div>
        )}
      </div>

      {/* Games Chart Section */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Gamepad2 size={20} color="#10b981" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-0.5 tracking-tight">Monthly Game Additions</h2>
              <p className="text-slate-400 text-sm font-medium">
                Games added to borrow section
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Calendar size={14} color="#10b981" />
          </div>
        </div>

        {loadingGames ? (
          <div className="h-[360px] flex flex-col items-center justify-center bg-slate-800 rounded-2xl border border-slate-700/10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <p className="text-slate-400 mt-4 text-sm font-medium">Loading analytics...</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/10 shadow-lg">
            {renderCurrentMonthGamesChart()}
          </div>
        )}
      </div>

      {/* Tournaments Chart Section */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Trophy size={20} color="#f59e0b" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-0.5 tracking-tight">Monthly Tournament Additions</h2>
              <p className="text-slate-400 text-sm font-medium">
                Tournaments added to tournament page
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Calendar size={14} color="#f59e0b" />
          </div>
        </div>

        {loadingTournaments ? (
          <div className="h-[360px] flex flex-col items-center justify-center bg-slate-800 rounded-2xl border border-slate-700/10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            <p className="text-slate-400 mt-4 text-sm font-medium">Loading analytics...</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/10 shadow-lg">
            {renderCurrentMonthTournamentsChart()}
          </div>
        )}
      </div>

      {/* Bottom Spacing */}
      <div className="h-10" />
    </div>
  );
};

export default AdminDashboard;

