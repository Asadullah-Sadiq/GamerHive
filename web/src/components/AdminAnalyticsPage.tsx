import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Reply,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../utils/api';

interface AdminAnalyticsPageProps {
  onBack: () => void;
}


const AdminAnalyticsPage: React.FC<AdminAnalyticsPageProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [moderationData, setModerationData] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const user = getStoredUser();
      if (!user?.id) {
        alert('User not found. Please login again.');
        return;
      }

      // Load moderation analytics
      const moderationResponse = await apiRequest(`/admin/analytics/moderation?userId=${user.id}`);
      if (moderationResponse.success) {
        setModerationData(moderationResponse.data);
      }
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      alert('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const renderModerationTab = () => {
    if (!moderationData) return null;

    const { stats, totals, percentages } = moderationData;

    return (
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total Moderated</span>
              <Shield size={20} color="#a78bfa" />
            </div>
            <div className="text-2xl font-bold text-white">{totals.total.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">All content types</div>
          </div>

          <div className="bg-green-500/10 rounded-xl p-5 border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm">Safe Content</span>
              <CheckCircle size={20} color="#10b981" />
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.SAFE.total.toLocaleString()}</div>
            <div className="text-xs text-green-400/70 mt-1">{percentages.safe}% of total</div>
          </div>

          <div className="bg-yellow-500/10 rounded-xl p-5 border border-yellow-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-400 text-sm">Mild Insults</span>
              <AlertTriangle size={20} color="#f59e0b" />
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.MILD_INSULT.total.toLocaleString()}</div>
            <div className="text-xs text-yellow-400/70 mt-1">{percentages.mildInsult}% of total</div>
          </div>

          <div className="bg-red-500/10 rounded-xl p-5 border border-red-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 text-sm">Harmful Content</span>
              <XCircle size={20} color="#ef4444" />
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.HARMFUL.total.toLocaleString()}</div>
            <div className="text-xs text-red-400/70 mt-1">{percentages.harmful}% of total</div>
          </div>
        </div>

        {/* Breakdown by Content Type */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Content Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} color="#a78bfa" />
                <span className="text-white font-medium">Messages</span>
              </div>
              <div className="flex gap-6">
                <span className="text-green-400">{stats.SAFE.messages}</span>
                <span className="text-yellow-400">{stats.MILD_INSULT.messages}</span>
                <span className="text-red-400">{stats.HARMFUL.messages}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText size={20} color="#a78bfa" />
                <span className="text-white font-medium">Posts</span>
              </div>
              <div className="flex gap-6">
                <span className="text-green-400">{stats.SAFE.posts}</span>
                <span className="text-yellow-400">{stats.MILD_INSULT.posts}</span>
                <span className="text-red-400">{stats.HARMFUL.posts}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} color="#a78bfa" />
                <span className="text-white font-medium">Comments</span>
              </div>
              <div className="flex gap-6">
                <span className="text-green-400">{stats.SAFE.comments}</span>
                <span className="text-yellow-400">{stats.MILD_INSULT.comments}</span>
                <span className="text-red-400">{stats.HARMFUL.comments}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Reply size={20} color="#a78bfa" />
                <span className="text-white font-medium">Replies</span>
              </div>
              <div className="flex gap-6">
                <span className="text-green-400">{stats.SAFE.replies}</span>
                <span className="text-yellow-400">{stats.MILD_INSULT.replies}</span>
                <span className="text-red-400">{stats.HARMFUL.replies}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Moderation Distribution</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-300">Safe</span>
                <span className="text-sm text-green-400 font-semibold">{percentages.safe}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${percentages.safe}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-300">Mild Insult</span>
                <span className="text-sm text-yellow-400 font-semibold">{percentages.mildInsult}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all"
                  style={{ width: `${percentages.mildInsult}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-300">Harmful</span>
                <span className="text-sm text-red-400 font-semibold">{percentages.harmful}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${percentages.harmful}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} color="#ffffff" />
          </button>
          <div className="flex items-center gap-3">
            <BarChart3 size={28} color="#a78bfa" />
            <h1 className="text-2xl font-bold text-white">Admin Analytics</h1>
          </div>
        </div>

      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          renderModerationTab()
        )}
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
