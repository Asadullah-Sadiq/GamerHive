import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Gamepad2, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  HardDrive, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Download,
  Monitor,
  Smartphone,
  Gamepad as GamepadIcon,
  Upload,
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';

interface Game {
  id: string;
  title: string;
  genre: string;
  platform: string[];
  fileSize: string;
  version: string;
  addedDate: string;
  description: string;
  image: string;
  status: 'available' | 'borrowed' | 'maintenance';
  totalCopies: number;
  availableCopies: number;
  borrowedCount: number;
}

const GameBorrowingPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [viewingGame, setViewingGame] = useState<Game | null>(null);
  const [gameImageFile, setGameImageFile] = useState<File | null>(null);
  const [gameImagePreview, setGameImagePreview] = useState<string | null>(null);
  const [uploadingGame, setUploadingGame] = useState(false);
  const [updatingGame, setUpdatingGame] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  const [newGame, setNewGame] = useState<Partial<Game>>({
    title: '',
    genre: '',
    platform: [],
    fileSize: '',
    version: '',
    description: '',
  });

  const genres = ['Battle Royale', 'FPS', 'Sports', 'Fighting', 'MOBA', 'Sandbox', 'RPG', 'Strategy'];
  const platforms = ['PC', 'PlayStation', 'Xbox'];
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  // Load user ID and games on mount
  useEffect(() => {
    const loadUserIdAndGames = async () => {
      try {
        const user = getStoredUser();
        if (user) {
          setUserId(user.id);
        }
        await loadAllGames();
      } catch (error) {
        console.error('Error loading user ID:', error);
      }
    };
    loadUserIdAndGames();
  }, []);

  // Load all games from database (visible to all users)
  const loadAllGames = async () => {
    try {
      const response = await apiRequest<{ games: any[] }>('/game/all');
      if (response.success && response.data) {
        const gamesList = response.data.games.map((game: any) => ({
          id: game._id || game.id,
          title: game.title,
          genre: game.genre,
          platform: game.platform || [],
          fileSize: game.fileSize,
          version: game.version || '1.0.0',
          addedDate: game.addedDate || new Date().toISOString().split('T')[0],
          description: game.description || '',
          image: game.image,
          status: game.status || 'available',
          totalCopies: game.totalCopies || 1,
          availableCopies: game.availableCopies || 1,
          borrowedCount: game.borrowedCount || 0,
        }));
        setGames(gamesList);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch =
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.genre.toLowerCase().includes(searchTerm.toLowerCase());
    
      return matchesSearch;
  });
  }, [games, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-400 bg-green-400/20';
      case 'borrowed':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'maintenance':
        return 'text-red-400 bg-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return CheckCircle;
      case 'borrowed':
        return Clock;
      case 'maintenance':
        return AlertCircle;
      default:
        return XCircle;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'PC':
        return Monitor;
      case 'Mobile':
        return Smartphone;
      case 'PlayStation':
      case 'Xbox':
        return GamepadIcon;
      default:
        return Gamepad2;
    }
  };

  // Handle image picker
  const handlePickGameImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGameImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGameImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGameImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGameImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle add game
  const handleAddGame = async () => {
    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }

    if (!newGame.title || !newGame.genre || !newGame.platform || newGame.platform.length === 0 || !newGame.fileSize) {
      alert('Please fill required fields: Title, Genre, File Size, Platforms.');
      return;
    }

    if (!gameImageFile) {
      alert('Please upload a game image.');
      return;
    }

    try {
      setUploadingGame(true);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('image', gameImageFile);
      formData.append('title', newGame.title);
      formData.append('genre', newGame.genre);
      formData.append('platform', JSON.stringify(newGame.platform));
      formData.append('fileSize', newGame.fileSize);
      formData.append('version', newGame.version || '1.0.0');
      formData.append('description', newGame.description || '');
      formData.append('userId', userId);

      const response = await apiRequest<{ game: any }>('/game/add', {
        method: 'POST',
        body: formData,
      });

      if (response.success && response.data) {
        const gameData = response.data.game;
        const newGameItem: Game = {
          id: gameData._id || gameData.id,
          title: gameData.title,
          genre: gameData.genre,
          platform: gameData.platform,
          fileSize: gameData.fileSize,
          version: gameData.version || '1.0.0',
          addedDate: gameData.addedDate || new Date().toISOString().split('T')[0],
          description: gameData.description || '',
          image: gameData.image,
          status: gameData.status || 'available',
          totalCopies: gameData.totalCopies || 1,
          availableCopies: gameData.availableCopies || 1,
          borrowedCount: gameData.borrowedCount || 0,
        };

        setGames((prev) => [...prev, newGameItem]);
      setNewGame({
        title: '',
        genre: '',
        platform: [],
        fileSize: '',
        version: '',
        description: '',
        });
        setGameImageFile(null);
        setGameImagePreview(null);
      setIsAddingGame(false);
        alert('Game added successfully!');
      } else {
        alert((response as any).message || 'Failed to add game.');
      }
    } catch (error: any) {
      console.error('Add game error:', error);
      alert(error.message || 'Failed to add game. Please try again.');
    } finally {
      setUploadingGame(false);
    }
  };

  const handleEditGame = (game: Game) => {
    setEditingGame({ ...game });
    setGameImageFile(null);
    setGameImagePreview(null);
  };

  const handleSaveEdit = async () => {
    if (!editingGame) return;

    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }

    if (!editingGame.title || !editingGame.genre || !editingGame.platform || editingGame.platform.length === 0 || !editingGame.fileSize) {
      alert('Please fill required fields: Title, Genre, File Size, Platforms.');
      return;
    }

    try {
      setUpdatingGame(true);

      const updateData: any = {
        title: editingGame.title,
        genre: editingGame.genre,
        platform: JSON.stringify(editingGame.platform),
        fileSize: editingGame.fileSize,
        version: editingGame.version || '1.0.0',
        description: editingGame.description || '',
        status: editingGame.status || 'available',
        totalCopies: editingGame.totalCopies || 1,
        availableCopies: editingGame.availableCopies || editingGame.totalCopies || 1,
        userId: userId,
      };

      // If new image is selected, add it to FormData
      let formData;
      if (gameImageFile) {
        formData = new FormData();
        formData.append('image', gameImageFile);
        formData.append('title', updateData.title);
        formData.append('genre', updateData.genre);
        formData.append('platform', updateData.platform);
        formData.append('fileSize', updateData.fileSize);
        formData.append('version', updateData.version);
        formData.append('description', updateData.description);
        formData.append('status', updateData.status);
        formData.append('totalCopies', String(updateData.totalCopies));
        formData.append('availableCopies', String(updateData.availableCopies));
        formData.append('userId', updateData.userId);
      }

      const response = gameImageFile
        ? await apiRequest<{ game: any }>(`/game/${editingGame.id}`, {
            method: 'PUT',
            body: formData,
          })
        : await apiRequest<{ game: any }>(`/game/${editingGame.id}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
            headers: {
              'Content-Type': 'application/json',
            },
          });

      if (response.success && response.data) {
        const updatedGameData = response.data.game;
        const updatedGame: Game = {
          id: updatedGameData._id || updatedGameData.id || editingGame.id,
          title: updatedGameData.title,
          genre: updatedGameData.genre,
          platform: updatedGameData.platform,
          fileSize: updatedGameData.fileSize,
          version: updatedGameData.version || '1.0.0',
          addedDate: updatedGameData.addedDate || editingGame.addedDate,
          description: updatedGameData.description || '',
          image: updatedGameData.image || editingGame.image,
          status: updatedGameData.status || 'available',
          totalCopies: updatedGameData.totalCopies || 1,
          availableCopies: updatedGameData.availableCopies || 1,
          borrowedCount: updatedGameData.borrowedCount || editingGame.borrowedCount || 0,
        };

        setGames((prev) => prev.map((g) => (g.id === editingGame.id ? updatedGame : g)));
        setEditingGame(null);
        setGameImageFile(null);
        setGameImagePreview(null);
        alert('Game updated successfully!');
      } else {
        alert((response as any).message || 'Failed to update game.');
      }
    } catch (error: any) {
      console.error('Update game error:', error);
      alert(error.message || 'Failed to update game. Please try again.');
    } finally {
      setUpdatingGame(false);
    }
  };

  const handleBorrowGame = (game: Game) => {
    if (game.status !== 'available') {
      alert('This game is not available for borrowing.');
      return;
    }

    if (game.availableCopies <= 0) {
      alert('No copies available for borrowing.');
      return;
    }

    if (window.confirm(`Do you want to borrow "${game.title}"?`)) {
      // TODO: Implement borrow functionality with backend
      alert(`You have borrowed "${game.title}"!`);
      // Update game availability
      setGames((prev) =>
        prev.map((g) =>
          g.id === game.id
            ? {
                ...g,
                availableCopies: g.availableCopies - 1,
                borrowedCount: g.borrowedCount + 1,
                status: g.availableCopies - 1 === 0 ? 'borrowed' : g.status,
              }
            : g
        )
      );
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this game?')) {
      try {
        const response = await apiRequest(`/game/${gameId}`, {
          method: 'DELETE',
          body: JSON.stringify({ userId }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.success) {
          setGames((prev) => prev.filter((g) => g.id !== gameId));
          alert('Game deleted successfully!');
        } else {
          alert((response as any).message || 'Failed to delete game.');
        }
      } catch (error: any) {
        console.error('Delete game error:', error);
        alert(error.message || 'Failed to delete game. Please try again.');
      }
    }
  };

  // Render game card
  const renderGameCard = (item: Game) => {
    const StatusIcon = getStatusIcon(item.status);
          return (
            <div
        key={item.id}
        className="group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105 overflow-hidden cursor-pointer"
        onClick={() => setViewingGame(item)}
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src={getImageUrl(item.image) || item.image}
            alt={item.title}
            className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                
          {/* Top Badges */}
          <div className="absolute top-4 right-4 flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold">
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
                  <StatusIcon className="w-3 h-3" />
              <span className="uppercase">{item.status}</span>
                </div>
                </div>

          {/* Platform Icons */}
                <div className="absolute bottom-4 left-4 flex space-x-1">
            {item.platform.slice(0, 2).map((p, idx) => {
              const PlatformIcon = getPlatformIcon(p);
                    return (
                <div key={idx} className="p-1 bg-black/30 backdrop-blur-sm rounded">
                        <PlatformIcon className="w-3 h-3 text-white" />
                      </div>
                    );
                  })}
            {item.platform.length > 2 && (
              <div className="p-1 bg-black/30 backdrop-blur-sm rounded">
                <span className="text-white text-xs font-semibold">+{item.platform.length - 2}</span>
              </div>
            )}
                </div>
              </div>

        <div className="p-4">
          {/* Title & Genre */}
          <div className="mb-2">
            <h3 className="text-white font-bold text-sm mb-1 line-clamp-1">{item.title}</h3>
            <p className="text-purple-400 text-xs font-medium">{item.genre}</p>
                </div>

          {/* Quick Info */}
          <div className="flex items-center space-x-2 mb-2 py-1.5 px-2 bg-slate-800/50 rounded-lg">
            <HardDrive className="w-3 h-3 text-purple-400" />
            <span className="text-gray-300 text-xs">{item.fileSize}</span>
            <div className="w-px h-3 bg-gray-600"></div>
            <span className="text-gray-300 text-xs">{item.version}</span>
                  </div>

          {/* Availability */}
          <div className="mb-2">
            <div className="flex items-center space-x-1 px-2 py-1 bg-green-500/15 rounded-md border border-green-500/30 self-start">
              <CheckCircle className="w-2.5 h-2.5 text-green-400" />
              <span className="text-green-400 text-xs font-semibold">
                {item.availableCopies}/{item.totalCopies} Available
              </span>
                  </div>
                </div>

          {/* Borrow Button */}
                  <button
            onClick={(e) => {
              e.stopPropagation();
              handleBorrowGame(item);
            }}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors mb-2"
          >
            <Download className="w-4 h-4 text-white" />
            <span className="text-white font-semibold text-sm">Borrow</span>
                  </button>

          {/* Actions */}
          <div className="flex items-center space-x-1.5 pt-2 border-t border-slate-700">
                  <button
              onClick={(e) => {
                e.stopPropagation();
                setViewingGame(item);
              }}
              className="flex-1 flex items-center justify-center space-x-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-semibold text-xs">View</span>
                  </button>

                  <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditGame(item);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteGame(item.id);
              }}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
            </div>
      </div>
    </div>
  );
  };


  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-center">
          <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Game Borrowing
              </span>
            </h1>
          </div>

      {/* Content */}
      <div className="px-6 py-6">
        <>
            {/* Header Section with Stats */}
            <div className="flex justify-center items-center mb-4 py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center space-x-6">
                <div className="text-center flex-1">
                  <div className="text-white text-xl font-bold mb-1">{games.length}</div>
                  <div className="text-purple-400 text-xs uppercase tracking-wide">Total Games</div>
                </div>
                <div className="w-px h-8 bg-slate-600"></div>
                <div className="text-center flex-1">
                  <div className="text-white text-xl font-bold mb-1">
                    {games.filter((g) => g.status === 'available').length}
          </div>
                  <div className="text-purple-400 text-xs uppercase tracking-wide">Available</div>
                </div>
                <div className="w-px h-8 bg-slate-600"></div>
                <div className="text-center flex-1">
                  <div className="text-white text-xl font-bold mb-1">
                    {games.filter((g) => g.status === 'borrowed').length}
                  </div>
                  <div className="text-purple-400 text-xs uppercase tracking-wide">Borrowed</div>
                </div>
        </div>
      </div>

            {/* Add Game Button Row */}
            <div className="mb-4">
                <button
                onClick={() => setIsAddingGame(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Game</span>
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative flex items-center bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50">
                <Search className="w-4 h-4 text-purple-400 absolute left-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search games, genres..."
                  className="w-full pl-10 pr-4 bg-transparent text-white placeholder-purple-300/50 focus:outline-none"
                />
        </div>
      </div>

            {/* Games Grid */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white text-xl font-bold">Game Library</h2>
                <span className="text-purple-400 text-sm">
                  {filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'} found
                </span>
        </div>
              {filteredGames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Gamepad2 className="w-16 h-16 text-slate-600 mb-4" />
                  <div className="text-white text-lg font-semibold mb-2">No games found</div>
                  <div className="text-purple-400 text-sm">Try adjusting your search or filters</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredGames.map((item) => renderGameCard(item))}
                </div>
              )}
            </div>
        </>
      </div>

      {/* Add Game Modal */}
      {isAddingGame && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-purple-500/30 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Add New Game</h3>
              <button
                onClick={() => {
                  setIsAddingGame(false);
                  setGameImageFile(null);
                  setGameImagePreview(null);
                  setNewGame({
                    title: '',
                    genre: '',
                    platform: [],
                    fileSize: '',
                    version: '',
                    description: '',
                  });
                }}
                className="p-2 bg-slate-800/50 hover:bg-slate-800/70 rounded-lg text-purple-300 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">Game Title *</label>
                  <input
                    type="text"
                    value={newGame.title || ''}
                  onChange={(e) => setNewGame((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                    placeholder="Enter game title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">Genre *</label>
                  <select
                    value={newGame.genre || ''}
                  onChange={(e) => setNewGame((prev) => ({ ...prev, genre: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                  >
                    <option value="">Select genre</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">File Size *</label>
                  <input
                    type="text"
                    value={newGame.fileSize || ''}
                  onChange={(e) => setNewGame((prev) => ({ ...prev, fileSize: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                    placeholder="e.g., 2.5 GB"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">Version</label>
                  <input
                    type="text"
                    value={newGame.version || ''}
                  onChange={(e) => setNewGame((prev) => ({ ...prev, version: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                    placeholder="e.g., 1.0.0"
                  />
                </div>

                <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Game Image *</label>
                  <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handlePickGameImage}
                  className="w-full mt-2"
                >
                  {gameImagePreview ? (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-700">
                      <img src={gameImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameImageFile(null);
                          setGameImagePreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </button>
                </div>
                  ) : (
                    <div className="w-full h-48 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center space-y-2">
                      <Upload className="w-6 h-6 text-purple-400" />
                      <span className="text-purple-400 text-sm font-medium">Tap to upload image</span>
                </div>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Platforms *</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => {
                    const selected = (newGame.platform || []).includes(p);
                    return (
                    <button
                        key={p}
                      type="button"
                      onClick={() => {
                          const current = newGame.platform || [];
                          const updated = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
                          setNewGame((prev) => ({ ...prev, platform: updated }));
                        }}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          selected
                          ? 'bg-purple-600/30 border-purple-500/50 text-white'
                          : 'bg-slate-800/50 border-slate-600/50 text-purple-300 hover:border-purple-500/30'
                      }`}
                    >
                        {p}
                    </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Description</label>
                <textarea
                  value={newGame.description || ''}
                  onChange={(e) => setNewGame((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none resize-none"
                  placeholder="Enter game description"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => {
                    setIsAddingGame(false);
                    setGameImageFile(null);
                    setGameImagePreview(null);
                    setNewGame({
                      title: '',
                      genre: '',
                      platform: [],
                      fileSize: '',
                      version: '',
                      description: '',
                    });
                  }}
                  className="px-6 py-2 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-600/50 rounded-lg text-purple-300 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGame}
                  disabled={uploadingGame}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all"
                >
                  {uploadingGame ? 'Adding...' : 'Add Game'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-purple-500/30 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Edit Game</h3>
              <button
                onClick={() => {
                  setEditingGame(null);
                  setGameImageFile(null);
                  setGameImagePreview(null);
                }}
                className="p-2 bg-slate-800/50 hover:bg-slate-800/70 rounded-lg text-purple-300 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">Game Title</label>
                  <input
                    type="text"
                    value={editingGame.title}
                  onChange={(e) => setEditingGame({ ...editingGame, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                  />
                </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Genre</label>
                <select
                  value={editingGame.genre}
                  onChange={(e) => setEditingGame({ ...editingGame, genre: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                >
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">File Size</label>
                  <input
                    type="text"
                    value={editingGame.fileSize}
                  onChange={(e) => setEditingGame({ ...editingGame, fileSize: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">Version</label>
                  <input
                    type="text"
                    value={editingGame.version}
                  onChange={(e) => setEditingGame({ ...editingGame, version: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                  />
                </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => {
                    const selected = editingGame.platform.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const current = editingGame.platform;
                          const updated = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
                          setEditingGame({ ...editingGame, platform: updated });
                        }}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          selected
                            ? 'bg-purple-600/30 border-purple-500/50 text-white'
                            : 'bg-slate-800/50 border-slate-600/50 text-purple-300 hover:border-purple-500/30'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Game Image (optional - leave empty to keep current)</label>
                <input
                  ref={editImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => editImageInputRef.current?.click()}
                  className="w-full mt-2"
                >
                  {gameImagePreview ? (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-700">
                      <img src={gameImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameImageFile(null);
                          setGameImagePreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center space-y-2">
                      <img
                        src={getImageUrl(editingGame.image) || editingGame.image}
                        alt={editingGame.title}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">Click to change image</span>
                      </div>
                    </div>
                  )}
                </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-300 mb-2">Total Copies</label>
                  <input
                    type="number"
                    min="1"
                    value={editingGame.totalCopies}
                  onChange={(e) => setEditingGame({ ...editingGame, totalCopies: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                  />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Status</label>
                <select
                  value={editingGame.status}
                  onChange={(e) =>
                    setEditingGame({ ...editingGame, status: e.target.value as 'available' | 'borrowed' | 'maintenance' })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="available">Available</option>
                  <option value="borrowed">Borrowed</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-300 mb-2">Description</label>
                <textarea
                  value={editingGame.description}
                  onChange={(e) => setEditingGame({ ...editingGame, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => {
                    setEditingGame(null);
                    setGameImageFile(null);
                    setGameImagePreview(null);
                  }}
                  className="px-6 py-2 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-600/50 rounded-lg text-purple-300 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updatingGame}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all"
                >
                  {updatingGame ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Game Modal */}
      {viewingGame && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-purple-500/30 p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">{viewingGame.title}</h3>
              <button
                onClick={() => setViewingGame(null)}
                className="p-2 bg-slate-800/50 hover:bg-slate-800/70 rounded-lg text-purple-300 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
                <img
                src={getImageUrl(viewingGame.image) || viewingGame.image}
                  alt={viewingGame.title}
                className="w-full h-48 object-cover rounded-xl mb-4"
                />
                
                  <div>
                <h4 className="text-lg font-semibold text-white mb-3">Availability</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-purple-300">Total Copies:</span>
                        <span className="text-white">{viewingGame.totalCopies}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-300">Available:</span>
                        <span className="text-green-400">{viewingGame.availableCopies}</span>
                  </div>
                </div>
              </div>

                <div>
                <h4 className="text-lg font-semibold text-white mb-3">Description</h4>
                  <p className="text-purple-200/80 text-sm leading-relaxed">{viewingGame.description}</p>
                </div>

                <div>
                <h4 className="text-lg font-semibold text-white mb-3">Technical Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-300">File Size:</span>
                      <span className="text-white">{viewingGame.fileSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-300">Version:</span>
                      <span className="text-white">{viewingGame.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-300">Genre:</span>
                      <span className="text-white">{viewingGame.genre}</span>
                    </div>
                  </div>
                </div>

                <div>
                <h4 className="text-lg font-semibold text-white mb-3">Supported Platforms</h4>
                  <div className="flex flex-wrap gap-2">
                  {viewingGame.platform.map((p, idx) => {
                    const PlatformIcon = getPlatformIcon(p);
                      return (
                      <div key={idx} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
                          <PlatformIcon className="w-4 h-4 text-purple-400" />
                        <span className="text-white text-sm">{p}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                    </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default GameBorrowingPage;
