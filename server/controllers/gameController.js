const Game = require('../models/Game');
const User = require('../models/User');
const GameBorrow = require('../models/GameBorrow');
const DirectMessage = require('../models/DirectMessage');
const fs = require('fs');
const path = require('path');

// Add Game
exports.addGame = async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!userId) {
      // If file was uploaded but no userId, delete the uploaded file and return error
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const { title, genre, platform, fileSize, version, description } = req.body;

    if (!title || !genre || !platform || !fileSize) {
      // Delete uploaded file if validation fails
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Title, Genre, Platform, and File Size are required',
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      // Delete uploaded file if user not found
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let imageUrl;

    // Check if file was uploaded
    if (req.file) {
      // Always use localhost for image URLs
      const port = process.env.PORT || 3000;
      imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    } else {
      // Delete uploaded file if no image provided
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Game image is required',
      });
    }

    // Parse platform array
    let platformArray = [];
    try {
      platformArray = typeof platform === 'string' ? JSON.parse(platform) : platform;
    } catch (e) {
      platformArray = Array.isArray(platform) ? platform : [platform];
    }

    // Create game
    const game = new Game({
      title: title.trim(),
      genre: genre.trim(),
      platform: platformArray,
      fileSize: fileSize.trim(),
      version: version || '1.0.0',
      description: description || '',
      image: imageUrl,
      status: 'available',
      totalCopies: 1,
      availableCopies: 1,
      borrowedCount: 0,
      addedBy: userId,
    });

    await game.save();

    // Add game to user's games list
    user.games.push(game._id);
    await user.save();

    // Check if creator is admin
    const creator = await User.findById(userId).select('isAdmin email');
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const isAdmin = creator?.isAdmin || (creator?.email && creator.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    
    if (isAdmin) {
      // Admin broadcast to all users
      const { notifyAdminBroadcast } = require('../utils/notificationService');
      notifyAdminBroadcast(
        userId,
        'admin_game',
        'New Game Added',
        `Admin added a new game: ${game.title}`,
        { gameId: game._id.toString(), gameTitle: game.title }
      ).catch((err) => {
        console.error('[GameController] Error notifying admin broadcast:', err);
      });
    } else {
      // Regular user - notify friends and other users
      const { notifyGameAdded } = require('../utils/notificationService');
      notifyGameAdded(userId, game._id.toString(), game.title).catch((err) => {
        console.error('[GameController] Error notifying game added:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'Game added successfully',
      data: {
        game: {
          _id: game._id,
          id: game._id,
          title: game.title,
          genre: game.genre,
          platform: game.platform,
          fileSize: game.fileSize,
          version: game.version,
          description: game.description,
          image: game.image,
          status: game.status,
          totalCopies: game.totalCopies,
          availableCopies: game.availableCopies,
          borrowedCount: game.borrowedCount,
          addedBy: game.addedBy,
          addedDate: game.addedDate,
        },
      },
    });
  } catch (error) {
    console.error('Add game error:', error);

    // Delete uploaded file on error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add game',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get User Games
exports.getUserGames = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId)
      .select('games')
      .populate('games');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        games: user.games || [],
        gamesCount: user.games ? user.games.length : 0,
      },
    });
  } catch (error) {
    console.error('Get user games error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get user games',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get All Games
exports.getAllGames = async (req, res) => {
  try {
    const games = await Game.find()
      .populate('addedBy', 'username name picture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        games: games,
        gamesCount: games.length,
      },
    });
  } catch (error) {
    console.error('Get all games error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get games',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update Game
exports.updateGame = async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.body.userId;

    if (!userId) {
      // If file was uploaded but no userId, delete the uploaded file and return error
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const { title, genre, platform, fileSize, version, description, status, totalCopies, availableCopies } = req.body;

    if (!title || !genre || !platform || !fileSize) {
      // Delete uploaded file if validation fails
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Title, Genre, Platform, and File Size are required',
      });
    }

    // Find the game
    const game = await Game.findById(gameId);

    if (!game) {
      // Delete uploaded file if game not found
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if user owns the game
    if (game.addedBy.toString() !== userId) {
      // Delete uploaded file if user doesn't own the game
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this game',
      });
    }

    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (game.image && game.image.includes('/uploads/')) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          
          if (game.image.includes('/uploads/')) {
            // Handle both full URLs (http://localhost:3000/uploads/file.jpg) and relative paths (/uploads/file.jpg)
            const urlParts = game.image.split('/uploads/');
            if (urlParts.length > 1) {
              // Get the filename, removing any query parameters
              oldFileName = urlParts[1].split('?')[0].split('#')[0];
            }
          }
          
          // If we found a filename, try to delete the old file
          if (oldFileName) {
            const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Deleted old game image: ${oldFileName}`);
            }
          }
        } catch (error) {
          // Log error but don't fail the update if old file deletion fails
          console.error('Error deleting old game image:', error);
        }
      }

      // Always use localhost for image URLs
      const port = process.env.PORT || 3000;
      game.image = `http://localhost:${port}/uploads/${req.file.filename}`;
      console.log(`Updated game image to: ${game.image}`);
    }

    // Parse platform array
    let platformArray = [];
    try {
      platformArray = typeof platform === 'string' ? JSON.parse(platform) : platform;
    } catch (e) {
      platformArray = Array.isArray(platform) ? platform : [platform];
    }

    // Update game fields
    game.title = title.trim();
    game.genre = genre.trim();
    game.platform = platformArray;
    game.fileSize = fileSize.trim();
    game.version = version || '1.0.0';
    game.description = description || '';
    game.status = status || 'available';
    game.totalCopies = parseInt(totalCopies) || 1;
    game.availableCopies = parseInt(availableCopies) || game.totalCopies;

    await game.save();

    res.status(200).json({
      success: true,
      message: 'Game updated successfully',
      data: {
        game: {
          _id: game._id,
          id: game._id,
          title: game.title,
          genre: game.genre,
          platform: game.platform,
          fileSize: game.fileSize,
          version: game.version,
          description: game.description,
          image: game.image,
          status: game.status,
          totalCopies: game.totalCopies,
          availableCopies: game.availableCopies,
          borrowedCount: game.borrowedCount,
          addedBy: game.addedBy,
          addedDate: game.addedDate,
        },
      },
    });
  } catch (error) {
    console.error('Update game error:', error);

    // Delete uploaded file on error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update game',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Game
exports.deleteGame = async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!gameId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID is required',
      });
    }

    // Find the game
    const game = await Game.findById(gameId);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if user owns the game
    if (game.addedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this game',
      });
    }

    // Delete game image file if exists
    if (game.image && game.image.includes('/uploads/')) {
      const imagePath = game.image;
      const fileName = imagePath.split('/').pop();
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove game from user's games array
    await User.findByIdAndUpdate(userId, {
      $pull: { games: gameId }
    });

    // Delete the game
    await Game.findByIdAndDelete(gameId);

    res.status(200).json({
      success: true,
      message: 'Game deleted successfully',
    });
  } catch (error) {
    console.error('Delete game error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete game',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Request to Borrow Game
exports.requestBorrowGame = async (req, res) => {
  try {
    const { gameId, borrowerId, message } = req.body;

    if (!gameId || !borrowerId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID and Borrower ID are required',
      });
    }

    // Find the game
    const game = await Game.findById(gameId).populate('addedBy', 'username name picture');
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if game is available
    if (game.status !== 'available' || game.availableCopies <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Game is not available for borrowing',
      });
    }

    // Check if borrower is trying to borrow their own game
    if (game.addedBy._id.toString() === borrowerId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot borrow your own game',
      });
    }

    // Check if there's already a pending or active borrow request
    const existingBorrow = await GameBorrow.findOne({
      gameId,
      borrowerId,
      status: { $in: ['pending', 'approved', 'active'] },
    });

    if (existingBorrow) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending or active borrow request for this game',
      });
    }

    // Create borrow request
    const borrowRequest = new GameBorrow({
      gameId,
      borrowerId,
      lenderId: game.addedBy._id,
      status: 'pending',
      message: message || '',
      borrowDuration: 14, // Default 14 days
    });

    await borrowRequest.save();

    // Populate borrower and lender info
    await borrowRequest.populate('borrowerId', 'username name picture');
    await borrowRequest.populate('lenderId', 'username name picture');
    await borrowRequest.populate('gameId', 'title image');

    // Create initial message in direct messages
    const borrower = await User.findById(borrowerId);
    const lender = await User.findById(game.addedBy._id);

    if (borrower && lender) {
      const borrowMessage = `Hi! I would like to borrow "${game.title}". ${message ? `\n\n${message}` : ''}`;
      
      const directMessage = new DirectMessage({
        senderId: borrowerId,
        receiverId: game.addedBy._id,
        content: borrowMessage,
        type: 'text',
      });

      await directMessage.save();
    }

    res.status(200).json({
      success: true,
      message: 'Borrow request created successfully',
      data: {
        borrowRequest: {
          id: borrowRequest._id,
          gameId: borrowRequest.gameId._id,
          gameTitle: borrowRequest.gameId.title,
          borrowerId: borrowRequest.borrowerId._id,
          borrowerName: borrowRequest.borrowerId.username || borrowRequest.borrowerId.name,
          borrowerAvatar: borrowRequest.borrowerId.picture,
          lenderId: borrowRequest.lenderId._id,
          lenderName: borrowRequest.lenderId.username || borrowRequest.lenderId.name,
          lenderAvatar: borrowRequest.lenderId.picture,
          status: borrowRequest.status,
          message: borrowRequest.message,
          createdAt: borrowRequest.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Request borrow game error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create borrow request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

