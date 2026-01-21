import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Calendar,
  Activity,
  Search,
  Trophy,
  Target,
  Zap,
  Plus,
  X,
  Camera,
  Image as ImageIcon,
  Save,
  Trash2,
  CheckSquare,
  Square,
  Edit,
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';

// Community type matching mobile version
export interface Community {
  id: string;
  name: string;
  game: string;
  description: string;
  members: number;
  activeMembers: number;
  createdDate: string;
  category: string;
  categories?: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
  image: string | null;
  color: string;
  icon: React.ComponentType<any>;
  isMember?: boolean;
}

interface CommunitiesPageProps {
  onSelectCommunity: (community: Community) => void;
  selectedCommunityId?: string;
}

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

const CommunitiesPage: React.FC<CommunitiesPageProps> = ({ onSelectCommunity, selectedCommunityId }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommunities, setSelectedCommunities] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [joiningCommunityId, setJoiningCommunityId] = useState<string | null>(null);
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    game: "",
    description: "",
    categories: [] as string[],
    image: "",
    imageFile: null as File | null,
    color: "#7c3aed",
    icon: "Target",
  });

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Icon options mapping
  const iconOptions = [
    { name: "Target", component: Target },
    { name: "Trophy", component: Trophy },
    { name: "Zap", component: Zap },
    { name: "Users", component: Users },
  ];

  // Check if user is admin and get userId
  useEffect(() => {
    const checkAdmin = async () => {
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

  const fetchCommunities = async (targetUserId?: string | null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const finalUserId = targetUserId ?? userId;
      if (finalUserId) {
        params.append('userId', finalUserId);
      }
      
      const queryString = params.toString();
      const url = `/community${queryString ? `?${queryString}` : ''}`;
      const response = await apiRequest<{ communities: any[] }>(url);
      
      if (response.success && response.data) {
        // Map backend data to frontend Community type
        const mappedCommunities = response.data.communities.map((comm: any) => {
          // Map icon string to component
          let IconComponent = Target;
          switch (comm.icon) {
            case 'Trophy':
              IconComponent = Trophy;
              break;
            case 'Zap':
              IconComponent = Zap;
              break;
            case 'Users':
              IconComponent = Users;
              break;
            default:
              IconComponent = Target;
          }

          return {
            id: comm.id,
            name: comm.name,
            game: comm.game,
            description: comm.description,
            categories: comm.categories || [comm.category || 'Other'],
            category: comm.category || comm.categories?.[0] || 'Other',
            members: comm.members || 0,
            activeMembers: comm.activeMembers || 0,
            createdDate: comm.createdDate || new Date().toISOString(),
            image: comm.image || null, // Keep the image URL from database
            color: comm.color || '#7c3aed',
            icon: IconComponent,
            level: 'Pro' as const,
            isMember: comm.isMember || false,
          };
        });
        
        console.log('Fetched communities:', mappedCommunities.length);
        setCommunities(mappedCommunities);
      }
    } catch (error) {
      console.error("Error fetching communities:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch communities from backend
  useEffect(() => {
    if (userId !== null) {
      fetchCommunities(userId);
    }
  }, [userId]);

  // Scroll to selected community when selectedCommunityId is provided
  useEffect(() => {
    if (selectedCommunityId && communities.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const element = document.getElementById(`community-${selectedCommunityId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          element.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2');
          }, 2000);
        }
      }, 100);
    }
  }, [selectedCommunityId, communities]);

  const categories = [
    "All",
    "Battle Royale",
    "FPS",
    "Sports",
    "Fighting",
    "MOBA",
    "Sandbox",
  ];

  const filteredCommunities = communities.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.game.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || 
      c.category === selectedCategory ||
      (c.categories && Array.isArray(c.categories) && c.categories.includes(selectedCategory));
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatNumber = (num: number) =>
    num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          image: reader.result as string,
          imageFile: file,
        }));
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Handle create community
  const handleCreateCommunity = async () => {
    if (!formData.name || !formData.game || !formData.description || !formData.image || formData.categories.length === 0) {
      alert("Please fill all required fields and select at least one category.");
      return;
    }

    if (!userId) {
      alert("User ID not found. Please login again.");
      return;
    }

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      
      // Add image file if available
      if (formData.imageFile) {
        formDataToSend.append('image', formData.imageFile);
      } else if (formData.image && formData.image.startsWith('http')) {
        // If it's a URL, send it directly
        formDataToSend.append('image', formData.image);
      }

      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('game', formData.game);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('categories', JSON.stringify(formData.categories));
      formDataToSend.append('color', formData.color);
      formDataToSend.append('icon', formData.icon);

      const response = await apiRequest<{ community: any }>('/community', {
        method: 'POST',
        body: formDataToSend,
      });

      if (response.success) {
        alert("Community created successfully!");
        setShowAddModal(false);
        // Reset form
        setFormData({
          name: "",
          game: "",
          description: "",
          categories: [],
          image: "",
          imageFile: null,
          color: "#7c3aed",
          icon: "Target",
        });
        // Refresh communities list
        fetchCommunities();
      } else {
        alert(response.message || "Failed to create community.");
      }
    } catch (error: any) {
      console.error("Create community error:", error);
      alert(error.message || "Failed to create community. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddCommunity = () => {
    setEditingCommunityId(null);
    setFormData({
      name: "",
      game: "",
      description: "",
      categories: [],
      image: "",
      imageFile: null,
      color: "#7c3aed",
      icon: "Target",
    });
    setShowAddModal(true);
  };

  const handleEditCommunity = (community: Community) => {
    // Map icon component back to string
    let iconString = "Target";
    if (community.icon === Trophy) iconString = "Trophy";
    else if (community.icon === Zap) iconString = "Zap";
    else if (community.icon === Users) iconString = "Users";
    
    setEditingCommunityId(community.id);
    setFormData({
      name: community.name,
      game: community.game,
      description: community.description,
      categories: community.categories || [community.category || 'Other'],
      image: community.image || "",
      imageFile: null,
      color: community.color || "#7c3aed",
      icon: iconString,
    });
    setShowAddModal(true);
  };

  // Handle update community
  const handleUpdateCommunity = async () => {
    if (!formData.name || !formData.game || !formData.description || !formData.image || formData.categories.length === 0) {
      alert("Please fill all required fields and select at least one category.");
      return;
    }

    if (!userId || !editingCommunityId) {
      alert("User ID or Community ID not found. Please try again.");
      return;
    }

    setIsUpdating(true);

    try {
      const formDataToSend = new FormData();
      
      // Always send image - either as file or URL
      if (formData.imageFile) {
        formDataToSend.append('image', formData.imageFile);
      } else if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('game', formData.game);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('categories', JSON.stringify(formData.categories));
      formDataToSend.append('color', formData.color);
      formDataToSend.append('icon', formData.icon);

      const response = await apiRequest<{ community: any }>(`/community/${editingCommunityId}`, {
        method: 'PUT',
        body: formDataToSend,
      });

      if (response.success && response.data) {
        const updatedCommunity = response.data.community;
        
        // Update the community in the local state immediately
        setCommunities(prevCommunities => {
          const updated = prevCommunities.map(comm => {
            if (comm.id === editingCommunityId) {
              // Map icon string to component
              let IconComponent = Target;
              switch (updatedCommunity.icon) {
                case 'Trophy':
                  IconComponent = Trophy;
                  break;
                case 'Zap':
                  IconComponent = Zap;
                  break;
                case 'Users':
                  IconComponent = Users;
                  break;
                default:
                  IconComponent = Target;
              }

              return {
                ...comm,
                name: updatedCommunity.name,
                game: updatedCommunity.game,
                description: updatedCommunity.description,
                categories: updatedCommunity.categories || [updatedCommunity.category || 'Other'],
                category: updatedCommunity.category || updatedCommunity.categories?.[0] || 'Other',
                image: updatedCommunity.image,
                color: updatedCommunity.color,
                icon: IconComponent,
                members: updatedCommunity.members,
                activeMembers: updatedCommunity.activeMembers,
              };
            }
            return comm;
          });
          return updated;
        });
        
        alert("Community updated successfully!");
        setShowAddModal(false);
        setEditingCommunityId(null);
        // Reset form
        setFormData({
          name: "",
          game: "",
          description: "",
          categories: [],
          image: "",
          imageFile: null,
          color: "#7c3aed",
          icon: "Target",
        });
        // Refresh communities list to ensure everything is in sync
        fetchCommunities();
      } else {
        alert(response.message || "Failed to update community.");
      }
    } catch (error: any) {
      console.error("Update community error:", error);
      alert(error.message || "Failed to update community. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleJoinCommunity = (community: Community) => {
    if (isAdmin) {
      return; // Admins cannot join communities
    }

    if (!userId) {
      alert('Please login to join communities.');
      return;
    }

    if (window.confirm(`Do you want to join "${community.name}" community?`)) {
      joinCommunity(community);
    }
  };

  const joinCommunity = async (community: Community) => {
    if (!userId) return;
    setJoiningCommunityId(community.id);
    try {
      const response = await apiRequest<{ message?: string }>('/community/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          communityId: community.id,
        }),
      });

      if (response.success) {
        alert(response.message || 'Community joined successfully!');
        setCommunities(prev =>
          prev.map(c =>
            c.id === community.id ? { ...c, isMember: true, members: (c.members || 0) + 1 } : c,
          ),
        );
      } else {
        alert(response.message || 'Failed to join community.');
      }
    } catch (error: any) {
      console.error('Join community error:', error);
      alert(error.message || 'Failed to join community. Please try again.');
    } finally {
      setJoiningCommunityId(null);
    }
  };

  // Toggle community selection
  const toggleCommunitySelection = (communityId: string) => {
    setSelectedCommunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(communityId)) {
        newSet.delete(communityId);
      } else {
        newSet.add(communityId);
      }
      return newSet;
    });
  };

  // Delete selected communities
  const handleDeleteSelected = async () => {
    if (selectedCommunities.size === 0) {
      alert("Please select communities to delete.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedCommunities.size} communit${selectedCommunities.size > 1 ? 'ies' : 'y'}?`)) {
      setIsDeleting(true);
      try {
        const communityIds = Array.from(selectedCommunities);
        const response = await apiRequest<{ message?: string }>('/community', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            communityIds,
          }),
        });

        if (response.success) {
          alert(response.message || "Communities deleted successfully!");
          setIsSelectionMode(false);
          setSelectedCommunities(new Set());
          fetchCommunities();
        } else {
          alert(response.message || "Failed to delete communities.");
        }
      } catch (error: any) {
        console.error("Delete error:", error);
        alert(error.message || "Failed to delete communities. Please try again.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-purple-400 text-lg">Loading communities...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="p-4">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold text-purple-400 mb-3">🎮 Gaming Communities</h1>
          {!isAdmin && (
            <p className="text-purple-200 text-sm opacity-80">
              Join thousands of gamers in specialized communities. Find your tribe,
              compete, and level up together.
            </p>
          )}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <button
                className="flex items-center gap-2 bg-purple-600 px-5 py-3 rounded-xl text-white font-semibold hover:bg-purple-700 transition-colors"
                onClick={handleAddCommunity}
              >
                <Plus className="w-4 h-4" />
                Add Community
              </button>
              {communities.length > 0 && !isSelectionMode && (
                <button
                  className="flex items-center gap-2 bg-purple-600 px-5 py-3 rounded-xl text-white font-semibold hover:bg-purple-700 transition-colors"
                  onClick={() => {
                    setIsSelectionMode(true);
                    setSelectedCommunities(new Set());
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Communities
                </button>
              )}
              {isSelectionMode && selectedCommunities.size > 0 && (
                <button
                  className="flex items-center gap-2 bg-red-600 px-5 py-3 rounded-xl text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedCommunities.size})
                    </>
                  )}
                </button>
              )}
              {isSelectionMode && (
                <button
                  className="flex items-center gap-2 bg-gray-600 px-5 py-3 rounded-xl text-white font-semibold hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedCommunities(new Set());
                  }}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {isSelectionMode && (
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
            <p className="text-purple-200 text-sm font-semibold text-center mb-2">
              Select communities to delete ({selectedCommunities.size} selected)
            </p>
            <div className="flex gap-3 justify-center">
              <button
                className="bg-purple-600/30 px-4 py-2 rounded-lg text-purple-200 text-xs font-semibold hover:bg-purple-600/50 transition-colors"
                onClick={() => {
                  const allIds = new Set(filteredCommunities.map(c => c.id));
                  setSelectedCommunities(allIds);
                }}
              >
                Select All
              </button>
              <button
                className="bg-purple-600/30 px-4 py-2 rounded-lg text-purple-200 text-xs font-semibold hover:bg-purple-600/50 transition-colors"
                onClick={() => setSelectedCommunities(new Set())}
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

          {/* Search and Filters */}
        <div className="mb-4">
          <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-xl mb-3">
            <Search className="w-5 h-5 text-purple-400" />
              <input
                type="text"
                placeholder="Search communities or games..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isSelectionMode}
              />
            </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Communities Grid */}
      <div className="px-4 pb-8">
          {filteredCommunities.length === 0 ? (
            <div className="text-center py-16">
            <Users className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200 text-lg">No communities found</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCommunities.map((item) => {
              const IconComponent = item.icon;
              const isSelected = selectedCommunities.has(item.id);
                return (
                  <div
                  id={`community-${item.id}`}
                  key={item.id}
                  className={`bg-slate-800 rounded-2xl overflow-hidden transition-all ${
                    isSelected ? 'ring-2 ring-purple-500' : ''
                  }`}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleCommunitySelection(item.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (isAdmin && !isSelectionMode) {
                      e.preventDefault();
                      setIsSelectionMode(true);
                      toggleCommunitySelection(item.id);
                    }
                  }}
                >
                  {isSelectionMode && (
                    <div className="absolute top-2 left-2 z-10 bg-black/60 rounded-lg p-1">
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-purple-500" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  )}
                  <div className="w-full h-48 bg-slate-700 overflow-hidden rounded-t-2xl">
                    {item.image ? (
                      <img
                        src={getImageUrl(item.image) || item.image}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onLoad={() => {
                          if (import.meta.env.DEV) {
                            console.log(`[CommunitiesPage] Image loaded: ${item.name}`, {
                              original: item.image,
                              processed: getImageUrl(item.image) || item.image
                            });
                          }
                        }}
                        onError={(e) => {
                          console.error(`[CommunitiesPage] Image failed to load: ${item.name}`, {
                            original: item.image,
                            processed: getImageUrl(item.image) || item.image,
                            error: e
                          });
                          // Show placeholder on error
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                          if (placeholder) {
                            placeholder.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full bg-slate-700 flex items-center justify-center image-placeholder ${item.image ? 'hidden' : ''}`}>
                      <ImageIcon className="w-10 h-10 text-purple-400" />
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <IconComponent className="w-4 h-4 text-white" />
                      <h3 className="text-white font-bold text-base">{item.name}</h3>
                    </div>
                    <p className="text-purple-400 text-xs mb-1">{item.game}</p>
                    <p className="text-gray-300 text-xs mb-3 line-clamp-2">{item.description}</p>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-gray-400">{formatNumber(item.members)} Members</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Activity className="w-4 h-4 text-green-400" />
                        <span className="text-gray-400">{formatNumber(item.activeMembers)} Active</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-400">{formatDate(item.createdDate)}</span>
                      </div>
                    </div>

                    {/* Edit button for admins */}
                    {isAdmin && !isSelectionMode && (
                      <button
                        className="flex items-center justify-center gap-2 bg-blue-600 rounded-lg py-2 w-full mb-2 hover:bg-blue-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCommunity(item);
                        }}
                      >
                        <Edit className="w-4 h-4 text-white" />
                        <span className="text-white font-semibold text-sm">Edit</span>
                      </button>
                    )}

                    {/* Join/Enter button - hidden for admins */}
                    {!isAdmin && (
                      <button
                        className={`rounded-lg py-2 w-full font-semibold text-sm transition-colors ${
                          item.isMember
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        } ${
                          (joiningCommunityId === item.id || isSelectionMode) ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelectionMode) {
                            toggleCommunitySelection(item.id);
                            return;
                          }
                          if (item.isMember) {
                            onSelectCommunity(item);
                          } else {
                            handleJoinCommunity(item);
                          }
                        }}
                        disabled={isSelectionMode || joiningCommunityId === item.id}
                      >
                        {joiningCommunityId === item.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                          item.isMember ? 'Enter Community' : 'Join Community'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
                      </div>

      {/* Add/Edit Community Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => {
            setShowAddModal(false);
            setEditingCommunityId(null);
            setFormData({
              name: "",
              game: "",
              description: "",
              categories: [],
              image: "",
              imageFile: null,
              color: "#7c3aed",
              icon: "Target",
            });
          }}
        >
          <div
            className="bg-slate-800 rounded-t-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-white font-bold text-xl">
                {editingCommunityId ? 'Edit Community' : 'Create Community'}
              </h2>
              <button
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCommunityId(null);
                  setFormData({
                    name: "",
                    game: "",
                    description: "",
                    categories: [],
                    image: "",
                    imageFile: null,
                    color: "#7c3aed",
                    icon: "Target",
                  });
                }}
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
                        </div>

            <div className="overflow-y-auto flex-1 p-5">
              {/* Image Upload */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Community Image *</label>
                {formData.image ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      className="absolute bottom-3 right-3 bg-black/70 px-4 py-2 rounded-lg text-white text-xs font-semibold hover:bg-black/90 transition-colors"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div
                    className="bg-slate-700/60 border-2 border-dashed border-purple-500/30 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-colors"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Camera className="w-6 h-6 text-purple-400 mb-2" />
                    <span className="text-purple-400 text-sm font-semibold">Select Image</span>
                          </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                        </div>

              {/* Name */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Community Name *</label>
                <input
                  type="text"
                  placeholder="e.g., PUBG Warriors"
                  className="w-full bg-slate-700/60 rounded-xl p-3 text-white placeholder-gray-400 border border-slate-600 focus:border-purple-500 focus:outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
                          </div>

              {/* Game */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Game Name *</label>
                <input
                  type="text"
                  placeholder="e.g., PUBG Mobile"
                  className="w-full bg-slate-700/60 rounded-xl p-3 text-white placeholder-gray-400 border border-slate-600 focus:border-purple-500 focus:outline-none"
                  value={formData.game}
                  onChange={(e) => setFormData(prev => ({ ...prev, game: e.target.value }))}
                />
                        </div>

              {/* Description */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Description *</label>
                <textarea
                  placeholder="Describe your community..."
                  className="w-full bg-slate-700/60 rounded-xl p-3 text-white placeholder-gray-400 border border-slate-600 focus:border-purple-500 focus:outline-none min-h-[100px] resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
                      </div>

              {/* Categories - Multiple Selection */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Categories * (Select multiple)</label>
                <div className="flex flex-wrap gap-2">
                  {categories.filter(c => c !== "All").map((cat) => {
                    const isSelected = formData.categories.includes(cat);
                    return (
                      <button 
                        key={cat}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700/60 text-gray-400 hover:bg-slate-700 border border-slate-600'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setFormData(prev => ({
                              ...prev,
                              categories: prev.categories.filter(c => c !== cat)
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              categories: [...prev.categories, cat]
                            }));
                          }
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {formData.categories.length === 0 && (
                  <p className="text-red-400 text-xs mt-2">Please select at least one category</p>
                )}
                    </div>

              {/* Icon */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Icon</label>
                <div className="flex gap-3">
                  {iconOptions.map((icon) => {
                    const IconComponent = icon.component;
                    return (
                      <button
                        key={icon.name}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-colors ${
                          formData.icon === icon.name
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-slate-600 bg-slate-700/60'
                        }`}
                        onClick={() => setFormData(prev => ({ ...prev, icon: icon.name }))}
                      >
                        <IconComponent
                          className={`w-6 h-6 ${
                            formData.icon === icon.name ? 'text-purple-400' : 'text-gray-400'
                          }`}
                        />
                      </button>
                );
              })}
            </div>
              </div>

              {/* Color */}
              <div className="mb-5">
                <label className="block text-white font-semibold text-sm mb-2">Color</label>
                <div className="flex gap-3">
                  {["#7c3aed", "#ff4d4d", "#8b5cf6", "#22c55e", "#3b82f6", "#f59e0b"].map((color) => (
                    <button
                      key={color}
                      className={`w-10 h-10 rounded-full border-3 transition-transform ${
                        formData.color === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>

              {/* Create/Update Button */}
              <button
                className={`flex items-center justify-center gap-2 bg-purple-600 rounded-xl py-3 w-full font-semibold text-white hover:bg-purple-700 transition-colors ${
                  (isCreating || isUpdating) ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                onClick={editingCommunityId ? handleUpdateCommunity : handleCreateCommunity}
                disabled={isCreating || isUpdating}
              >
                {(isCreating || isUpdating) ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {editingCommunityId ? 'Update Community' : 'Create Community'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
};

export default CommunitiesPage;
