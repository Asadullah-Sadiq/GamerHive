import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  Search, 
  MapPin, 
  Target,
  Swords,
  Timer,
  UserCheck,
  Gift,
  Play,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  Image as ImageIcon,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

interface Tournament {
  id: string;
  name: string;
  game: string;
  description: string;
  participants: {
    current: number;
    max: number;
  };
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  prizePool: number;
  prize?: string; // Original prize string from backend (e.g., "$50,000")
  entryFee: number;
  status: 'upcoming' | 'live' | 'registration' | 'completed';
  format: 'Single Elimination' | 'Double Elimination' | 'Round Robin' | 'Swiss';
  platform: string;
  region: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
  image: string;
  organizer: string;
  rules: string[];
  prizes: {
    position: string;
    amount: number;
    percentage: number;
  }[];
  icon: React.ComponentType<any>;
  color: string;
  link?: string;
}

const TournamentPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [tournamentImage, setTournamentImage] = useState<string | null>(null);
  const [tournamentImageFile, setTournamentImageFile] = useState<File | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    prize: '',
    entryFee: '',
    platform: 'Multi-Platform',
      format: 'Single Elimination',
    maxParticipants: '',
    registerLink: '',
    watchLiveLink: '',
    status: 'registration' as 'registration' | 'live',
  });

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Check if user is admin and get userId
  useEffect(() => {
    const checkAdmin = () => {
      try {
        const user = getStoredUser();
        if (user) {
          setUserId(user.id);
          if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            setIsAdmin(true);
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };
    
    checkAdmin();
  }, []);

  // Fetch tournaments from backend
  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<{ tournaments: any[] }>('/tournament');
      
      if (response.success && response.data) {
        // Transform backend data to match Tournament interface
        const transformedTournaments = response.data.tournaments.map((t: any) => ({
          id: t.id,
          name: t.name,
          game: 'Tournament',
          description: `${t.name} - Prize: ${t.prize}`,
          participants: { current: 0, max: t.maxParticipants || 1000 },
          startDate: t.startDate,
          endDate: t.endDate,
          registrationDeadline: t.startDate,
          prizePool: parseFloat(t.prize.replace(/[^0-9.]/g, '')) || 0,
          prize: t.prize, // Store original prize string from backend
          entryFee: t.entryFee || 0,
          status: t.status,
          format: t.format || 'Single Elimination',
          platform: t.platform || 'Multi-Platform',
      region: 'Global',
      difficulty: 'Intermediate',
          image: t.image,
          organizer: 'GamerHive',
          rules: [],
          prizes: [],
      icon: Target,
          color: 'from-purple-500 to-pink-600',
          link: t.link,
        }));
        setTournaments(transformedTournaments as Tournament[]);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tournaments on component mount
  useEffect(() => {
    fetchTournaments();
  }, []);

  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tournament.game.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTournamentImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTournamentImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle create tournament
  const handleCreateTournament = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.prize) {
      alert("Please fill all required fields (Name, Start Date, End Date, Prize).");
      return;
    }

    if (formData.status === 'registration' && !formData.registerLink) {
      alert("Please provide a registration link.");
      return;
    }

    if (formData.status === 'live' && !formData.watchLiveLink) {
      alert("Please provide a watch live link.");
      return;
    }

    if (!tournamentImageFile && !tournamentImage) {
      alert("Please select a tournament image.");
      return;
    }

    if (!userId) {
      alert("User ID not found. Please login again.");
      return;
    }

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      
      // Add image file
      if (tournamentImageFile) {
        formDataToSend.append('image', tournamentImageFile);
      } else if (tournamentImage && tournamentImage.startsWith('http')) {
        formDataToSend.append('image', tournamentImage);
      }

      // Combine date and time for start and end dates
      const startDateTime = formData.startTime 
        ? `${formData.startDate}T${formData.startTime}:00`
        : `${formData.startDate}T00:00:00`;
      
      const endDateTime = formData.endTime 
        ? `${formData.endDate}T${formData.endTime}:00`
        : `${formData.endDate}T23:59:59`;

      // Add all required fields
      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('startDate', startDateTime);
      formDataToSend.append('endDate', endDateTime);
      formDataToSend.append('prize', formData.prize);
      formDataToSend.append('entryFee', formData.entryFee || '0');
      formDataToSend.append('platform', formData.platform);
      formDataToSend.append('format', formData.format);
      formDataToSend.append('maxParticipants', formData.maxParticipants || '1000');
      formDataToSend.append('status', formData.status);
      
      if (formData.status === 'registration') {
        formDataToSend.append('registerLink', formData.registerLink);
      } else {
        formDataToSend.append('watchLiveLink', formData.watchLiveLink);
      }

      const response = await apiRequest('/tournament', {
        method: 'POST',
        body: formDataToSend,
      });

      if (response.success) {
        alert("Tournament created successfully!");
        
        // Reset form
        setFormData({
          name: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          prize: '',
          entryFee: '',
          platform: 'Multi-Platform',
          format: 'Single Elimination',
          maxParticipants: '',
          registerLink: '',
          watchLiveLink: '',
          status: 'registration',
        });
        setTournamentImage(null);
        setTournamentImageFile(null);
        setShowAddModal(false);
        
        // Refresh tournaments list
        await fetchTournaments();
      } else {
        alert(response.message || "Failed to create tournament.");
      }
    } catch (error: any) {
      console.error("Error creating tournament:", error);
      alert(error.message || "Failed to create tournament. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle edit tournament
  const handleEditTournament = (tournament: Tournament) => {
    setEditingTournamentId(tournament.id);
    
    // Parse dates to extract date and time
    const startDateObj = new Date(tournament.startDate);
    const endDateObj = new Date(tournament.endDate);
    
    const startDate = startDateObj.toISOString().split('T')[0];
    const startTime = startDateObj.toTimeString().split(' ')[0].slice(0, 5);
    const endDate = endDateObj.toISOString().split('T')[0];
    const endTime = endDateObj.toTimeString().split(' ')[0].slice(0, 5);
    
    // Set form data with tournament values
    setFormData({
      name: tournament.name,
      startDate: startDate,
      startTime: startTime,
      endDate: endDate,
      endTime: endTime,
      prize: tournament.prize || tournament.prizePool.toString(), // Use original prize string or fallback to prizePool
      entryFee: tournament.entryFee ? String(tournament.entryFee) : '',
      platform: tournament.platform || 'Multi-Platform',
      format: tournament.format || 'Single Elimination',
      maxParticipants: tournament.participants.max ? String(tournament.participants.max) : '',
      registerLink: tournament.status === 'registration' ? (tournament.link || '') : '',
      watchLiveLink: tournament.status === 'live' ? (tournament.link || '') : '',
      status: (tournament.status === 'registration' || tournament.status === 'live') 
        ? tournament.status as 'registration' | 'live'
        : 'registration', // Default to 'registration' for 'upcoming' or 'completed' statuses
    });
    
    setTournamentImage(tournament.image);
    setShowEditModal(true);
  };

  // Handle update tournament
  const handleUpdateTournament = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.prize) {
      alert("Please fill all required fields (Name, Start Date, End Date, Prize).");
      return;
    }

    if (formData.status === 'registration' && !formData.registerLink) {
      alert("Please provide a registration link.");
      return;
    }

    if (formData.status === 'live' && !formData.watchLiveLink) {
      alert("Please provide a watch live link.");
      return;
    }

    if (!tournamentImage && !tournamentImageFile) {
      alert("Please select a tournament image.");
      return;
    }

    if (!userId || !editingTournamentId) {
      alert("User ID or Tournament ID not found. Please try again.");
      return;
    }

    setIsUpdating(true);

    try {
      const formDataToSend = new FormData();
      
      // Add image - either as file or URL
      if (tournamentImageFile) {
        formDataToSend.append('image', tournamentImageFile);
      } else if (tournamentImage) {
        formDataToSend.append('image', tournamentImage);
      }

      // Combine date and time for start and end dates
      const startDateTime = formData.startTime 
        ? `${formData.startDate}T${formData.startTime}:00`
        : `${formData.startDate}T00:00:00`;
      
      const endDateTime = formData.endTime 
        ? `${formData.endDate}T${formData.endTime}:00`
        : `${formData.endDate}T23:59:59`;

      // Add all required fields
      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('startDate', startDateTime);
      formDataToSend.append('endDate', endDateTime);
      formDataToSend.append('prize', formData.prize);
      formDataToSend.append('entryFee', formData.entryFee || '0');
      formDataToSend.append('platform', formData.platform);
      formDataToSend.append('format', formData.format);
      formDataToSend.append('maxParticipants', formData.maxParticipants || '1000');
      formDataToSend.append('status', formData.status);
      
      if (formData.status === 'registration') {
        formDataToSend.append('registerLink', formData.registerLink);
      } else {
        formDataToSend.append('watchLiveLink', formData.watchLiveLink);
      }

      const response = await apiRequest(`/tournament/${editingTournamentId}`, {
        method: 'PUT',
        body: formDataToSend,
      });

      if (response.success) {
        alert("Tournament updated successfully!");
        
        // Reset form
        setFormData({
          name: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          prize: '',
          entryFee: '',
          platform: 'Multi-Platform',
          format: 'Single Elimination',
          maxParticipants: '',
          registerLink: '',
          watchLiveLink: '',
          status: 'registration',
        });
        setTournamentImage(null);
        setTournamentImageFile(null);
        setEditingTournamentId(null);
        setShowEditModal(false);
        
        // Refresh tournaments list
        await fetchTournaments();
      } else {
        alert(response.message || "Failed to update tournament.");
      }
    } catch (error: any) {
      console.error("Error updating tournament:", error);
      alert(error.message || "Failed to update tournament. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle tournament selection
  const toggleTournamentSelection = (tournamentId: string) => {
    setSelectedTournaments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
      } else {
        newSet.add(tournamentId);
      }
      return newSet;
    });
  };

  // Delete selected tournaments
  const handleDeleteSelected = async () => {
    if (selectedTournaments.size === 0) {
      alert("Please select tournaments to delete.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedTournaments.size} tournament${selectedTournaments.size > 1 ? 's' : ''}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const tournamentIds = Array.from(selectedTournaments);
      const response = await apiRequest('/tournament', {
        method: 'DELETE',
        body: JSON.stringify({
          userId,
          tournamentIds,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.success) {
        alert(response.message || "Tournaments deleted successfully!");
        setIsSelectionMode(false);
        setSelectedTournaments(new Set());
        await fetchTournaments();
      } else {
        alert(response.message || "Failed to delete tournaments.");
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(error.message || "Failed to delete tournaments. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration': return 'text-blue-400 bg-blue-400/20';
      case 'upcoming': return 'text-yellow-400 bg-yellow-400/20';
      case 'live': return 'text-green-400 bg-green-400/20';
      case 'completed': return 'text-gray-400 bg-gray-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'registration': return UserCheck;
      case 'upcoming': return Clock;
      case 'live': return Play;
      case 'completed': return CheckCircle;
      default: return AlertCircle;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-400 bg-green-400/20';
      case 'Intermediate': return 'text-yellow-400 bg-yellow-400/20';
      case 'Advanced': return 'text-orange-400 bg-orange-400/20';
      case 'Pro': return 'text-red-400 bg-red-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getParticipationPercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header Section */}
      <div className="relative px-6 py-12 bg-gradient-to-r from-slate-900 via-purple-900/50 to-slate-900 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Gaming Tournaments
              </span>
            </h1>
            <p className="text-xl text-purple-200/80 max-w-3xl mx-auto">
              Compete in epic tournaments, win amazing prizes, and prove your gaming skills against the best players worldwide.
            </p>
          </div>

          {/* Admin Buttons */}
          {isAdmin && (
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold transition-all duration-300"
              >
                <Plus className="w-5 h-5" />
                Add Tournament
              </button>
              <button
                onClick={() => {
                  if (isSelectionMode) {
                    handleDeleteSelected();
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
                disabled={isDeleting}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all duration-300 ${
                  isSelectionMode ? 'bg-red-600 hover:bg-red-500' : 'bg-red-600/80 hover:bg-red-500'
                } disabled:opacity-50`}
              >
                <Trash2 className="w-5 h-5" />
                {isSelectionMode ? 'Delete Selected' : 'Delete'}
              </button>
              {isSelectionMode && (
                <button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedTournaments(new Set());
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-500 rounded-xl text-white font-semibold transition-all duration-300"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Search */}
          <div className="flex justify-center mb-8">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input
                type="text"
                placeholder="Search tournaments or games..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
              />
            </div>
            </div>
        </div>
      </div>

      {/* Tournaments Grid */}
      <div className="px-6 py-12">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">Loading tournaments...</h3>
            </div>
          ) : filteredTournaments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-12 h-12 text-purple-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">No Tournaments Found</h3>
              <p className="text-purple-300/70">Try adjusting your search to find tournaments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredTournaments.map((tournament) => {
                const IconComponent = tournament.icon;
                const StatusIcon = getStatusIcon(tournament.status);
                const participationPercentage = getParticipationPercentage(tournament.participants.current, tournament.participants.max);
                const isSelected = selectedTournaments.has(tournament.id);
                
                return (
                  <div
                    key={tournament.id}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleTournamentSelection(tournament.id);
                      }
                    }}
                    className={`group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer ${
                      isSelectionMode 
                        ? isSelected 
                          ? 'border-purple-500 border-2' 
                          : 'border-slate-700/50 opacity-90'
                        : 'border-slate-700/50 hover:border-purple-500/50 hover:transform hover:scale-105'
                    }`}
                  >
                    {/* Selection Indicator */}
                    {isSelectionMode && (
                      <div className="absolute top-3 left-3 z-10 bg-black/80 rounded-full p-1">
                        {isSelected ? (
                          <CheckSquare className="w-6 h-6 text-purple-400" />
                        ) : (
                          <Square className="w-6 h-6 text-purple-300" />
                        )}
                      </div>
                    )}
                    
                    {/* Background Image */}
                    <div className="relative h-48 overflow-hidden rounded-t-2xl">
                      <img
                        src={getImageUrl(tournament.image) || tournament.image}
                        alt={tournament.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${tournament.color} opacity-60`}></div>
                      
                      {/* Status Badge */}
                      <div className={`absolute top-4 right-4 flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tournament.status)}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span className="capitalize">{tournament.status}</span>
                      </div>

                      {/* Difficulty Badge */}
                      <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(tournament.difficulty)}`}>
                        {tournament.difficulty}
                      </div>

                      {/* Game Icon */}
                      <div className="absolute bottom-4 left-4 p-2 bg-black/30 backdrop-blur-sm rounded-lg">
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>

                      {/* Prize Pool */}
                      <div className="absolute bottom-4 right-4 flex items-center space-x-1 px-3 py-1 bg-black/30 backdrop-blur-sm rounded-lg">
                        <DollarSign className="w-4 h-4 text-yellow-400" />
                        <span className="text-white font-semibold">{formatCurrency(tournament.prizePool)}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">
                          {tournament.name}
                        </h3>
                        <p className="text-purple-400 text-sm font-medium">{tournament.game}</p>
                      </div>

                      <p className="text-purple-200/70 text-sm mb-4 line-clamp-2">
                        {tournament.description}
                      </p>

                      {/* Tournament Details */}
                      <div className="space-y-3 mb-4">
                        {/* Participants */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            <span className="text-purple-300">Participants</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-semibold">
                              {tournament.participants.current.toLocaleString()}/{tournament.participants.max.toLocaleString()}
                            </span>
                            <div className="w-16 bg-slate-700 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full" 
                                style={{ width: `${participationPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Start Date */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-green-400" />
                            <span className="text-purple-300">Start Date</span>
                          </div>
                          <span className="text-green-400 font-semibold">{formatDate(tournament.startDate)}</span>
                        </div>

                        {/* End Date */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Timer className="w-4 h-4 text-red-400" />
                            <span className="text-purple-300">End Date</span>
                          </div>
                          <span className="text-red-400 font-semibold">{formatDate(tournament.endDate)}</span>
                        </div>

                        {/* Entry Fee */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Gift className="w-4 h-4 text-yellow-400" />
                            <span className="text-purple-300">Entry Fee</span>
                          </div>
                          <span className="text-yellow-400 font-semibold">{formatCurrency(tournament.entryFee)}</span>
                        </div>

                        {/* Platform & Region */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-blue-400" />
                            <span className="text-purple-300">Platform</span>
                          </div>
                          <span className="text-blue-400 font-semibold">{tournament.platform}</span>
                        </div>

                        {/* Format */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Swords className="w-4 h-4 text-cyan-400" />
                            <span className="text-purple-300">Format</span>
                          </div>
                          <span className="text-cyan-400 font-semibold">{tournament.format}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {!isSelectionMode && (
                      <div className="flex space-x-2">
                          {isAdmin ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTournament(tournament);
                              }}
                              className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                              Edit Tournament
                            </button>
                          ) : (
                            <>
                              {tournament.status === 'registration' && tournament.link && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(tournament.link, '_blank');
                                  }}
                                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
                                >
                            Register Now
                          </button>
                        )}
                              {tournament.status === 'live' && tournament.link && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(tournament.link, '_blank');
                                  }}
                                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/25 flex items-center justify-center space-x-2"
                                >
                            <Play className="w-4 h-4" />
                            <span>Watch Live</span>
                          </button>
                        )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Tournament Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Add Tournament</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white hover:text-purple-400 transition-colors"
              >
                <X className="w-6 h-6" />
                          </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tournament Image */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Tournament Picture *</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-purple-500/30 rounded-xl flex items-center justify-center hover:border-purple-500/50 transition-colors"
                >
                  {tournamentImage ? (
                    <img src={tournamentImage} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                      <p className="text-purple-300">Select Image</p>
                    </div>
                  )}
                          </button>
              </div>

              {/* Tournament Name */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Tournament Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Enter tournament name"
                />
              </div>

              {/* Start Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Prize & Entry Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Prize *</label>
                  <input
                    type="text"
                    value={formData.prize}
                    onChange={(e) => setFormData(prev => ({ ...prev, prize: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., $50,000"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Entry Fee</label>
                  <input
                    type="text"
                    value={formData.entryFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, entryFee: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., $25"
                  />
                </div>
              </div>

              {/* Platform & Format */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Platform</label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., Multi-Platform"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Format</label>
                  <input
                    type="text"
                    value={formData.format}
                    onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., Single Elimination"
                  />
                </div>
              </div>

              {/* Max Participants */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Max Participants</label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g., 1000"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Status *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, status: 'registration' }))}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      formData.status === 'registration'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    Registration
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, status: 'live' }))}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      formData.status === 'live'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-800 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>

              {/* Register/Watch Live Link */}
              {formData.status === 'registration' ? (
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Register Link *</label>
                  <input
                    type="url"
                    value={formData.registerLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, registerLink: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Watch Live Link *</label>
                  <input
                    type="url"
                    value={formData.watchLiveLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, watchLiveLink: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleCreateTournament}
                disabled={isCreating}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all"
              >
                {isCreating ? 'Creating...' : 'Create Tournament'}
                        </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tournament Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Edit Tournament</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTournamentId(null);
                }}
                className="text-white hover:text-purple-400 transition-colors"
              >
                <X className="w-6 h-6" />
                        </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tournament Image */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Tournament Picture *</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-purple-500/30 rounded-xl flex items-center justify-center hover:border-purple-500/50 transition-colors overflow-hidden"
                >
                  {tournamentImage ? (
                    <img src={getImageUrl(tournamentImage) || tournamentImage} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                      <p className="text-purple-300">Select Image</p>
                    </div>
                  )}
                        </button>
                      </div>

              {/* Tournament Name */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Tournament Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Enter tournament name"
                />
                    </div>

              {/* Start Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                  </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Prize & Entry Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Prize *</label>
                  <input
                    type="text"
                    value={formData.prize}
                    onChange={(e) => setFormData(prev => ({ ...prev, prize: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., $50,000"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Entry Fee</label>
                  <input
                    type="text"
                    value={formData.entryFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, entryFee: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., $25"
                  />
                </div>
              </div>

              {/* Platform & Format */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Platform</label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., Multi-Platform"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Format</label>
                  <input
                    type="text"
                    value={formData.format}
                    onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="e.g., Single Elimination"
                  />
                </div>
              </div>

              {/* Max Participants */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Max Participants</label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                  placeholder="e.g., 1000"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">Status *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, status: 'registration' }))}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      formData.status === 'registration'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    Registration
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, status: 'live' }))}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      formData.status === 'live'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-800 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>

              {/* Register/Watch Live Link */}
              {formData.status === 'registration' ? (
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Register Link *</label>
                  <input
                    type="url"
                    value={formData.registerLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, registerLink: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">Watch Live Link *</label>
                  <input
                    type="url"
                    value={formData.watchLiveLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, watchLiveLink: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-800 border border-purple-500/30 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                    placeholder="https://..."
                  />
            </div>
          )}

              {/* Update Button */}
              <button
                onClick={handleUpdateTournament}
                disabled={isUpdating}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all"
              >
                {isUpdating ? 'Updating...' : 'Update Tournament'}
              </button>
        </div>
      </div>
        </div>
      )}
    </main>
  );
};

export default TournamentPage;