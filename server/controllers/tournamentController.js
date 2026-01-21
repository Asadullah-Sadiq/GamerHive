const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Stats = require('../models/Stats');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Helper function to download and save image from URL to uploads folder
const downloadAndSaveImage = async (imageUrl, req) => {
  try {
    // Validate that imageUrl is a string
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Image URL must be a valid string');
    }

    // Trim whitespace
    imageUrl = imageUrl.trim();

    // Handle file:// URIs (local file paths from mobile)
    if (imageUrl.startsWith('file://')) {
      // Remove file:// prefix
      imageUrl = imageUrl.replace(/^file:\/\//, '');
      // If it's a local file path, we need to read it and save it
      if (fs.existsSync(imageUrl)) {
        // Read the file
        const fileBuffer = fs.readFileSync(imageUrl);
        const ext = path.extname(imageUrl).replace('.', '') || 'jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `tournament-image-${uniqueSuffix}.${ext}`;
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        
        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Write the file
        fs.writeFileSync(filePath, fileBuffer);
        
        // Always use localhost for image URLs
        const port = process.env.PORT || 3000;
        return `http://localhost:${port}/uploads/${fileName}`;
      } else {
        throw new Error('Local file path does not exist');
      }
    }

    // If image is already in uploads folder (local file), return as is
    if (imageUrl.includes('/uploads/')) {
      // Extract filename from URL (handle both full URLs and relative paths)
      const fileName = imageUrl.split('/uploads/').pop().split('?')[0]; // Remove query params
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      
      // If file exists locally, return the URL (always use localhost)
      if (fs.existsSync(filePath)) {
        const port = process.env.PORT || 3000;
        return `http://localhost:${port}/uploads/${fileName}`;
      }
    }

    // If it's a data URI (base64), save it directly
    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `tournament-image-${uniqueSuffix}.${ext}`;
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        
        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, buffer);
        
        // Always use localhost for image URLs
        const port = process.env.PORT || 3000;
        return `http://localhost:${port}/uploads/${fileName}`;
      }
    }

    // Check if it's already a URL pointing to this server's uploads folder
    // If so, normalize it to localhost format (extract filename and return localhost URL)
    const port = process.env.PORT || 3000;
    
    if (imageUrl.includes('/uploads/')) {
      // Extract filename from URL (handles both localhost and IP-based URLs)
      const fileNameMatch = imageUrl.match(/\/uploads\/([^?#]+)/);
      if (fileNameMatch) {
        const fileName = fileNameMatch[1];
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        
        // Check if file exists locally
        if (fs.existsSync(filePath)) {
          // Always return localhost URL format, regardless of how it was stored
          const localhostUrl = `http://localhost:${port}/uploads/${fileName}`;
          console.log('Tournament image URL points to server uploads, normalizing to localhost:', localhostUrl);
          return localhostUrl;
        }
      }
    }

    // Validate URL format before attempting download
    let isValidUrl = false;
    try {
      const urlObj = new URL(imageUrl);
      isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
      isValidUrl = false;
    }

    // If not a valid HTTP/HTTPS URL, throw error
    if (!isValidUrl) {
      throw new Error(`Invalid URL format: ${imageUrl}`);
    }

    // Download image from URL
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
    });

    // Get file extension from URL or content-type
    let ext = 'jpg';
    const contentType = response.headers['content-type'];
    if (contentType && contentType.startsWith('image/')) {
      ext = contentType.split('/')[1].split(';')[0];
      if (ext === 'jpeg') ext = 'jpg';
    } else {
      const urlMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
      if (urlMatch) {
        ext = urlMatch[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
      }
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `tournament-image-${uniqueSuffix}.${ext}`;
    const filePath = path.join(__dirname, '..', 'uploads', fileName);

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save file
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        // Always use localhost for image URLs
        const port = process.env.PORT || 3000;
        resolve(`http://localhost:${port}/uploads/${fileName}`);
      });
      writer.on('error', (err) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error downloading/saving image:', error);
    throw new Error(`Failed to download and save image: ${error.message}`);
  }
};

// Create Tournament
exports.createTournament = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;
    
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

    const { name, startDate, endDate, prize, entryFee, platform, format, maxParticipants, status, registerLink, watchLiveLink } = req.body;

    // Validation
    if (!name || !startDate || !endDate || !prize || !status) {
      // Delete uploaded file if validation fails
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Name, start date, end date, prize, and status are required',
      });
    }

    // Validate status
    if (!['registration', 'live'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "registration" or "live"',
      });
    }

    // Validate link based on status
    let link = '';
    if (status === 'registration' && !registerLink) {
      return res.status(400).json({
        success: false,
        message: 'Register link is required for registration status',
      });
    }
    if (status === 'live' && !watchLiveLink) {
      return res.status(400).json({
        success: false,
        message: 'Watch live link is required for live status',
      });
    }
    link = status === 'registration' ? registerLink : watchLiveLink;

    let imageUrl;

    // Check if file was uploaded
    if (req.file) {
      // Always use localhost for image URLs
      const port = process.env.PORT || 3000;
      imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    } 
    // Check if image URL is provided directly - download and save to uploads folder
    else if (req.body.image) {
      try {
        // Convert image to string if it's not already
        let imageUrlString = req.body.image;
        if (typeof imageUrlString !== 'string') {
          if (typeof imageUrlString === 'object' && imageUrlString.uri) {
            imageUrlString = imageUrlString.uri;
          } else {
            imageUrlString = String(imageUrlString);
          }
        }

        if (!imageUrlString || imageUrlString.trim() === '') {
          throw new Error('Image URL is empty or invalid');
        }

        imageUrl = await downloadAndSaveImage(imageUrlString.trim(), req);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Failed to save image: ${error.message}`,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Tournament image is required',
      });
    }

    // Parse dates (handle both date-only and datetime formats)
    let startDateObj = new Date(startDate);
    let endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD or ISO datetime format.',
      });
    }

    // Create new tournament
    const tournament = new Tournament({
      name,
      image: imageUrl,
      startDate: startDateObj,
      endDate: endDateObj,
      prize,
      entryFee: entryFee ? parseFloat(entryFee) : 0,
      platform: platform || 'Multi-Platform',
      format: format || 'Single Elimination',
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : 1000,
      status,
      link,
      createdBy: userId,
    });

    await tournament.save();

    // Check if creator is admin and send broadcast
    const User = require('../models/User');
    const creator = await User.findById(userId).select('isAdmin email');
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const isAdmin = creator?.isAdmin || (creator?.email && creator.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    
    if (isAdmin) {
      const { notifyAdminBroadcast } = require('../utils/notificationService');
      notifyAdminBroadcast(
        userId,
        'admin_tournament',
        'New Tournament Created',
        `Admin created a new tournament: ${tournament.name}`,
        { tournamentId: tournament._id.toString(), tournamentName: tournament.name }
      ).catch((err) => {
        console.error('[TournamentController] Error notifying admin broadcast:', err);
      });
    }

    // Increment total tournaments counter
    try {
      const stats = await Stats.getOrCreate();
      stats.totalTournamentsCreated += 1;
      await stats.save();
    } catch (error) {
      console.error('Error updating total tournaments count:', error);
      // Don't fail the request if stats update fails
    }

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      data: {
        tournament: {
          id: tournament._id,
          name: tournament.name,
          image: tournament.image,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          prize: tournament.prize,
          entryFee: tournament.entryFee,
          platform: tournament.platform,
          format: tournament.format,
          maxParticipants: tournament.maxParticipants,
          status: tournament.status,
          link: tournament.link,
          createdAt: tournament.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Create tournament error:', error);

    // Delete uploaded file on error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create tournament',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Helper function to delete expired tournaments
const deleteExpiredTournaments = async () => {
  try {
    const now = new Date();
    
    // Find all tournaments where endDate has passed
    const expiredTournaments = await Tournament.find({
      endDate: { $lt: now }
    });

    if (expiredTournaments.length > 0) {
      console.log(`Found ${expiredTournaments.length} expired tournament(s) to delete`);

      // Delete image files for expired tournaments
      for (const tournament of expiredTournaments) {
        if (tournament.image && tournament.image.includes('/uploads/')) {
          const imagePath = tournament.image;
          const fileName = imagePath.split('/uploads/').pop().split('?')[0]; // Remove query params
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`Deleted image file: ${fileName}`);
            } catch (err) {
              console.error(`Error deleting image file ${fileName}:`, err);
            }
          }
        }
      }

      // Delete expired tournaments from database
      const deleteResult = await Tournament.deleteMany({
        endDate: { $lt: now }
      });

      console.log(`Deleted ${deleteResult.deletedCount} expired tournament(s)`);
      return deleteResult.deletedCount;
    }

    return 0;
  } catch (error) {
    console.error('Error deleting expired tournaments:', error);
    return 0;
  }
};

// Get All Tournaments
exports.getAllTournaments = async (req, res) => {
  try {
    // First, delete expired tournaments automatically
    await deleteExpiredTournaments();

    // Then fetch remaining tournaments
    const tournaments = await Tournament.find()
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        tournaments: tournaments.map(tournament => ({
          id: tournament._id,
          name: tournament.name,
          image: tournament.image,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          prize: tournament.prize,
          entryFee: tournament.entryFee,
          platform: tournament.platform,
          format: tournament.format,
          maxParticipants: tournament.maxParticipants,
          status: tournament.status,
          link: tournament.link,
          createdAt: tournament.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get tournaments error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get tournaments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Tournament
exports.deleteTournament = async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Delete image file if exists
    if (tournament.image && tournament.image.includes('/uploads/')) {
      const imagePath = tournament.image;
      const fileName = imagePath.split('/uploads/').pop();
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Tournament.findByIdAndDelete(tournamentId);

    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully',
    });
  } catch (error) {
    console.error('Delete tournament error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete tournament',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update Tournament
exports.updateTournament = async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const userId = req.body.userId || req.query.userId;

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

    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      // Delete uploaded file if tournament not found
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    const { name, startDate, endDate, prize, entryFee, platform, format, maxParticipants, status, registerLink, watchLiveLink } = req.body;

    // Update fields if provided
    if (name !== undefined && name !== null) {
      tournament.name = name;
    }
    if (startDate !== undefined && startDate !== null) {
      const startDateObj = new Date(startDate);
      if (!isNaN(startDateObj.getTime())) {
        tournament.startDate = startDateObj;
      }
    }
    if (endDate !== undefined && endDate !== null) {
      const endDateObj = new Date(endDate);
      if (!isNaN(endDateObj.getTime())) {
        tournament.endDate = endDateObj;
      }
    }
    if (prize !== undefined && prize !== null) {
      tournament.prize = prize;
    }
    if (entryFee !== undefined && entryFee !== null) {
      tournament.entryFee = parseFloat(entryFee) || 0;
    }
    if (platform !== undefined && platform !== null) {
      tournament.platform = platform;
    }
    if (format !== undefined && format !== null) {
      tournament.format = format;
    }
    if (maxParticipants !== undefined && maxParticipants !== null) {
      tournament.maxParticipants = parseInt(maxParticipants) || 1000;
    }
    if (status !== undefined && status !== null) {
      if (['registration', 'live'].includes(status)) {
        tournament.status = status;
      }
    }

    // Handle link update based on status
    if (status !== undefined && status !== null) {
      if (status === 'registration' && registerLink) {
        tournament.link = registerLink;
      } else if (status === 'live' && watchLiveLink) {
        tournament.link = watchLiveLink;
      }
    } else {
      // If status not changed, update link if provided
      if (registerLink && tournament.status === 'registration') {
        tournament.link = registerLink;
      } else if (watchLiveLink && tournament.status === 'live') {
        tournament.link = watchLiveLink;
      }
    }

    // Handle image update
    if (req.file) {
      // Delete old image file if it exists and is a local upload
      if (tournament.image && tournament.image.includes('/uploads/')) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          
          if (tournament.image.includes('/uploads/')) {
            // Handle both full URLs (http://localhost:3000/uploads/file.jpg) and relative paths (/uploads/file.jpg)
            const urlParts = tournament.image.split('/uploads/');
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
              console.log(`Deleted old tournament image: ${oldFileName}`);
            }
          }
        } catch (error) {
          // Log error but don't fail the update if old file deletion fails
          console.error('Error deleting old tournament image:', error);
        }
      }

      // Always use localhost for image URLs
      const port = process.env.PORT || 3000;
      tournament.image = `http://localhost:${port}/uploads/${req.file.filename}`;
      console.log(`Updated tournament image to: ${tournament.image}`);
    } else if (req.body.image !== undefined && req.body.image !== null) {
      try {
        // Convert image to string if it's not already
        let imageUrlString = req.body.image;
        if (typeof imageUrlString !== 'string') {
          if (typeof imageUrlString === 'object' && imageUrlString.uri) {
            imageUrlString = imageUrlString.uri;
          } else {
            imageUrlString = String(imageUrlString);
          }
        }

        if (imageUrlString && imageUrlString.trim() !== '' && imageUrlString !== tournament.image) {
          // Delete old image if it's a local upload
          if (tournament.image && tournament.image.includes('/uploads/')) {
            try {
              // Extract filename from various URL formats
              let oldFileName = null;
              const urlParts = tournament.image.split('/uploads/');
              if (urlParts.length > 1) {
                oldFileName = urlParts[1].split('?')[0].split('#')[0];
              }
              
              if (oldFileName) {
                const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
                if (fs.existsSync(oldFilePath)) {
                  fs.unlinkSync(oldFilePath);
                  console.log(`Deleted old tournament image: ${oldFileName}`);
                }
              }
            } catch (error) {
              console.error('Error deleting old tournament image:', error);
            }
          }

          const newImageUrl = await downloadAndSaveImage(imageUrlString.trim(), req);
          tournament.image = newImageUrl;
          console.log(`Updated tournament image to: ${tournament.image}`);
        }
      } catch (error) {
        console.error('Error updating image:', error);
        // Don't fail the update if image update fails
      }
    }

    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      data: {
        tournament: {
          id: tournament._id,
          name: tournament.name,
          image: tournament.image,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          prize: tournament.prize,
          entryFee: tournament.entryFee,
          platform: tournament.platform,
          format: tournament.format,
          maxParticipants: tournament.maxParticipants,
          status: tournament.status,
          link: tournament.link,
          createdAt: tournament.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Update tournament error:', error);

    // Delete uploaded file on error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update tournament',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Multiple Tournaments
exports.deleteMultipleTournaments = async (req, res) => {
  try {
    const { tournamentIds } = req.body;
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!tournamentIds || !Array.isArray(tournamentIds) || tournamentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tournament IDs array is required',
      });
    }

    // Find all tournaments to delete
    const tournaments = await Tournament.find({ _id: { $in: tournamentIds } });

    // Delete image files
    for (const tournament of tournaments) {
      if (tournament.image && tournament.image.includes('/uploads/')) {
        const imagePath = tournament.image;
        const fileName = imagePath.split('/uploads/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Delete tournaments
    await Tournament.deleteMany({ _id: { $in: tournamentIds } });

    res.status(200).json({
      success: true,
      message: `${tournamentIds.length} tournament${tournamentIds.length > 1 ? 's' : ''} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete multiple tournaments error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete tournaments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

