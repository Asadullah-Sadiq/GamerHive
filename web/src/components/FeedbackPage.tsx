import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Mail,
  User,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Circle,
  Reply,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';

interface Feedback {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'resolved';
  reply?: {
    message: string;
    repliedBy?: {
      id: string;
      username: string;
      email: string;
      picture?: string;
    } | null;
    repliedAt: string;
  } | null;
  userId?: {
    id: string;
    username: string;
    email: string;
    picture?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackPageProps {
  onBack?: () => void;
}

const FeedbackPage: React.FC<FeedbackPageProps> = ({ onBack }) => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    read: 0,
    replied: 0,
    resolved: 0,
  });

  useEffect(() => {
    fetchFeedback();
    fetchStats();
    loadAdminId();
  }, [selectedStatus]);

  const loadAdminId = () => {
    try {
      const user = getStoredUser();
      if (user) {
        setCurrentAdminId(user.id);
      }
    } catch (error) {
      console.error('Error loading admin ID:', error);
    }
  };

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, limit: 100 };
      if (selectedStatus) {
        params.status = selectedStatus;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await apiRequest<{ feedback: Feedback[] }>(`/feedback?${queryString}`);
      if (response.success && response.data) {
        setFeedback(response.data.feedback);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      window.alert('Error\nFailed to load feedback');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiRequest<{
        total: number;
        new: number;
        read: number;
        replied: number;
        resolved: number;
      }>('/feedback/stats');
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching feedback stats:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedback();
    fetchStats();
  };

  const handleStatusChange = async (feedbackId: string, newStatus: 'new' | 'read' | 'replied' | 'resolved') => {
    try {
      // If changing to "replied", show reply input
      if (newStatus === 'replied' && !selectedFeedback?.reply) {
        setShowReplyInput(true);
        return;
      }

      const response = await apiRequest<{ feedback: Feedback }>(`/feedback/${feedbackId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.success && response.data) {
        const updatedFeedback = response.data.feedback;
        setFeedback((prev) =>
          prev.map((f) => (f.id === feedbackId ? updatedFeedback : f))
        );
        fetchStats();
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback(updatedFeedback);
        }
        window.alert('Success\nStatus updated successfully');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      window.alert(`Error\n${error.message || 'Failed to update status'}`);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedFeedback || !currentAdminId) {
      window.alert('Error\nPlease enter a reply message');
      return;
    }

    setSendingReply(true);
    try {
      const response = await apiRequest<{ feedback: Feedback }>(`/feedback/${selectedFeedback.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          replyMessage: replyMessage.trim(),
          adminId: currentAdminId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.success && response.data) {
        const updatedFeedback = response.data.feedback;
        setFeedback((prev) =>
          prev.map((f) => (f.id === selectedFeedback.id ? updatedFeedback : f))
        );
        setSelectedFeedback(updatedFeedback);
        setReplyMessage('');
        setShowReplyInput(false);
        fetchStats();
        window.alert('Success\nReply sent successfully');
      }
    } catch (error: any) {
      console.error('Error sending reply:', error);
      window.alert(`Error\n${error.message || 'Failed to send reply'}`);
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = async (feedbackId: string) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      const response = await apiRequest(`/feedback/${feedbackId}`, {
        method: 'DELETE',
      });
      if (response.success) {
        setFeedback((prev) => prev.filter((f) => f.id !== feedbackId));
        fetchStats();
        if (selectedFeedback?.id === feedbackId) {
          setShowDetailModal(false);
          setSelectedFeedback(null);
        }
        window.alert('Success\nFeedback deleted successfully');
      }
    } catch (error: any) {
      console.error('Error deleting feedback:', error);
      window.alert(`Error\n${error.message || 'Failed to delete feedback'}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return '#3B82F6';
      case 'read':
        return '#8B5CF6';
      case 'replied':
        return '#10B981';
      case 'resolved':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Circle size={12} color="#3B82F6" fill="#3B82F6" />;
      case 'read':
        return <CheckCircle2 size={12} color="#8B5CF6" />;
      case 'replied':
        return <Reply size={12} color="#10B981" />;
      case 'resolved':
        return <CheckCircle2 size={12} color="#6B7280" />;
      default:
        return <Circle size={12} color="#6B7280" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFeedbackClick = async (item: Feedback) => {
    // Mark as read if it's new
    if (item.status === 'new') {
      try {
        const response = await apiRequest<{ feedback: Feedback }>(`/feedback/${item.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'read' }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.success && response.data) {
          // Update local state
          setFeedback((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: 'read' } : f))
          );
          // Update stats
          fetchStats();
          // Update selected feedback with new status
          setSelectedFeedback({ ...item, status: 'read' });
        }
      } catch (error: any) {
        console.error('Error marking feedback as read:', error);
        // Still open the modal even if status update fails
        setSelectedFeedback(item);
      }
    } else {
      setSelectedFeedback(item);
    }
    setShowDetailModal(true);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        {onBack && (
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft size={24} color="#fff" />
          </button>
        )}
        <h1 className="text-xl font-bold text-white">User Feedback</h1>
        <div className="w-10" />
      </div>

      {/* Stats Cards */}
      <div className="overflow-x-auto bg-slate-800 border-b border-slate-700">
        <div className="flex px-4 py-3 gap-3 min-w-max">
          <button
            onClick={() => setSelectedStatus(null)}
            className={`flex flex-col items-center bg-slate-900 rounded-xl p-4 min-w-[80px] border ${
              selectedStatus === null ? 'border-purple-600 bg-purple-900/20' : 'border-slate-700'
            } transition-colors`}
          >
            <span className="text-2xl font-bold text-white mb-1">{stats.total}</span>
            <span className="text-xs text-slate-400 uppercase">Total</span>
          </button>
          <button
            onClick={() => setSelectedStatus('new')}
            className={`flex flex-col items-center bg-slate-900 rounded-xl p-4 min-w-[80px] border relative ${
              selectedStatus === 'new' ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700'
            } transition-colors`}
          >
            <div className="relative w-full flex flex-col items-center">
              <span className="text-2xl font-bold mb-1" style={{ color: '#3B82F6' }}>
                {stats.new}
              </span>
              {stats.new > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center border-2 border-slate-900">
                  <span className="text-xs font-bold text-white">{stats.new}</span>
                </div>
              )}
            </div>
            <span className="text-xs text-slate-400 uppercase">New (Unread)</span>
          </button>
          <button
            onClick={() => setSelectedStatus('read')}
            className={`flex flex-col items-center bg-slate-900 rounded-xl p-4 min-w-[80px] border ${
              selectedStatus === 'read' ? 'border-purple-500 bg-purple-900/20' : 'border-slate-700'
            } transition-colors`}
          >
            <span className="text-2xl font-bold mb-1" style={{ color: '#8B5CF6' }}>
              {stats.read}
            </span>
            <span className="text-xs text-slate-400 uppercase">Read</span>
          </button>
          <button
            onClick={() => setSelectedStatus('replied')}
            className={`flex flex-col items-center bg-slate-900 rounded-xl p-4 min-w-[80px] border ${
              selectedStatus === 'replied' ? 'border-green-500 bg-green-900/20' : 'border-slate-700'
            } transition-colors`}
          >
            <span className="text-2xl font-bold mb-1" style={{ color: '#10B981' }}>
              {stats.replied}
            </span>
            <span className="text-xs text-slate-400 uppercase">Replied</span>
          </button>
          <button
            onClick={() => setSelectedStatus('resolved')}
            className={`flex flex-col items-center bg-slate-900 rounded-xl p-4 min-w-[80px] border ${
              selectedStatus === 'resolved' ? 'border-gray-500 bg-gray-900/20' : 'border-slate-700'
            } transition-colors`}
          >
            <span className="text-2xl font-bold mb-1" style={{ color: '#6B7280' }}>
              {stats.resolved}
            </span>
            <span className="text-xs text-slate-400 uppercase">Resolved</span>
          </button>
        </div>
      </div>

      {/* Feedback List */}
      {loading && !refreshing ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : feedback.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-8">
          <Mail size={48} color="#64748b" />
          <p className="text-lg font-semibold text-white mt-4">
            No feedback found
          </p>
          <p className="text-sm text-slate-400 mt-2 text-center">
            {selectedStatus ? `No ${selectedStatus} feedback` : 'No feedback submitted yet'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            {feedback.map((item) => (
              <button
                key={item.id}
                onClick={() => handleFeedbackClick(item)}
                className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-purple-500/50 transition-colors text-left relative"
              >
                {/* Unread indicator */}
                {item.status === 'new' && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-800"></div>
                  </div>
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center flex-1">
                    {/* User Profile Picture or Status Indicator */}
                    {item.userId?.picture ? (
                      <div className="w-10 h-10 rounded-full mr-3 overflow-hidden border-2 border-purple-600">
                        <img
                          src={getImageUrl(item.userId.picture) || ''}
                          alt={item.userId.username}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full mr-3 flex items-center justify-center"
                        style={{ backgroundColor: getStatusColor(item.status) }}
                      >
                        {getStatusIcon(item.status)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-base font-semibold text-white">
                        {item.userId?.username || item.name}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {item.userId?.email || item.email}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                </div>
                <p className="text-sm font-semibold text-purple-400 mb-2">{item.subject}</p>
                <p className="text-sm text-slate-300 line-clamp-2">{item.message}</p>
                {item.userId && (
                  <div className="flex items-center mt-2 pt-2 border-t border-slate-700">
                    <User size={12} color="#a78bfa" />
                    <span className="text-xs text-purple-400 ml-1.5">
                      Registered User: {item.userId.username}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      {!loading && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowDetailModal(false);
              setShowReplyInput(false);
              setReplyMessage('');
            }}
          ></div>
          <div
            className="relative bg-slate-800 w-full sm:w-[600px] max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Feedback Details</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setShowReplyInput(false);
                  setReplyMessage('');
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={24} color="#fff" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* User Profile Section */}
              <div>
                {selectedFeedback.userId?.picture ? (
                  <div className="flex items-center p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <img
                      src={getImageUrl(selectedFeedback.userId.picture) || ''}
                      alt={selectedFeedback.userId.username}
                      className="w-[60px] h-[60px] rounded-full border-2 border-purple-600"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="ml-4 flex-1">
                      <p className="text-lg font-bold text-white mb-1">
                        {selectedFeedback.userId.username}
                      </p>
                      <p className="text-sm text-slate-400">{selectedFeedback.userId.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start">
                    <User size={18} color="#a78bfa" className="mt-1" />
                    <div className="ml-3 flex-1">
                      <p className="text-xs text-slate-400 uppercase mb-1">Name</p>
                      <p className="text-base text-white font-medium">{selectedFeedback.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {!selectedFeedback.userId && (
                <div className="flex items-start">
                  <Mail size={18} color="#a78bfa" className="mt-1" />
                  <div className="ml-3 flex-1">
                    <p className="text-xs text-slate-400 uppercase mb-1">Email</p>
                    <p className="text-base text-white font-medium">{selectedFeedback.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start">
                <MessageSquare size={18} color="#a78bfa" className="mt-1" />
                <div className="ml-3 flex-1">
                  <p className="text-xs text-slate-400 uppercase mb-1">Subject</p>
                  <p className="text-base text-white font-medium">{selectedFeedback.subject}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase mb-2">Message</p>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedFeedback.message}</p>
              </div>

              <div className="flex items-start">
                <Calendar size={18} color="#a78bfa" className="mt-1" />
                <div className="ml-3 flex-1">
                  <p className="text-xs text-slate-400 uppercase mb-1">Submitted</p>
                  <p className="text-base text-white font-medium">
                    {formatDate(selectedFeedback.createdAt)}
                  </p>
                </div>
              </div>

              {/* Reply Section */}
              {selectedFeedback.reply ? (
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-2">Admin Reply</p>
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                    <p className="text-sm text-slate-300 leading-relaxed mb-2">
                      {selectedFeedback.reply.message}
                    </p>
                    <p className="text-xs text-slate-500 italic">
                      Replied on {formatDate(selectedFeedback.reply.repliedAt)}
                    </p>
                  </div>
                </div>
              ) : showReplyInput ? (
                <div>
                  <p className="text-xs text-slate-400 uppercase mb-2">Reply to User</p>
                  <textarea
                    className="w-full bg-slate-900 rounded-xl p-4 border border-slate-700 text-white text-sm min-h-[100px] resize-none focus:outline-none focus:border-purple-500"
                    placeholder="Type your reply message..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                  />
                  <div className="flex justify-end gap-3 mt-3">
                    <button
                      onClick={() => {
                        setShowReplyInput(false);
                        setReplyMessage('');
                      }}
                      className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 font-semibold hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || sendingReply}
                      className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingReply ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        'Send Reply'
                      )}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Status Buttons */}
              <div>
                <p className="text-xs text-slate-400 uppercase mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {(['new', 'read', 'replied', 'resolved'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(selectedFeedback.id, status)}
                      className={`px-4 py-2 rounded-lg border ${
                        selectedFeedback.status === status
                          ? 'bg-purple-900/30'
                          : 'bg-slate-900 border-slate-700'
                      }`}
                      style={{
                        borderColor:
                          selectedFeedback.status === status
                            ? getStatusColor(status)
                            : '#334155',
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{
                          color:
                            selectedFeedback.status === status
                              ? getStatusColor(status)
                              : '#94A3B8',
                        }}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(selectedFeedback.id)}
                className="flex items-center justify-center w-full bg-slate-900 py-3 rounded-lg border border-red-500 hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={18} color="#EF4444" />
                <span className="text-base text-red-500 font-semibold ml-2">Delete Feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;

