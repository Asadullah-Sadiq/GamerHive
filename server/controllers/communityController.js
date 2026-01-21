const Community = require('../models/Community');
const User = require('../models/User');
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
        const fileName = `community-image-${uniqueSuffix}.${ext}`;
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
      
      // If file exists locally, return the URL
      if (fs.existsSync(filePath)) {
        // Always use localhost for image URLs
        const port = process.env.PORT || 3000;
        return `http://localhost:${port}/uploads/${fileName}`;
      } else {
        // File doesn't exist, but URL points to uploads - might be from different server
        // We'll try to download it if it's a full URL, otherwise throw error
        console.log('File in uploads folder does not exist locally:', filePath);
        // Continue to download logic below if it's a full URL
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
        const fileName = `community-image-${uniqueSuffix}.${ext}`;
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
    const currentHost = req.get('host');
    const currentProtocol = req.protocol;
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
          console.log('Image URL points to server uploads, normalizing to localhost:', localhostUrl);
          return localhostUrl;
        }
      }
    }

    // Validate URL format before attempting download
    let isValidUrl = false;
    let urlObj = null;
    try {
      urlObj = new URL(imageUrl);
      isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
      // Not a valid URL, might be a relative path or local path
      isValidUrl = false;
    }

    // If not a valid HTTP/HTTPS URL, check if it's a local file path
    if (!isValidUrl) {
      // Check if it's a relative path that might exist locally
      if (imageUrl.startsWith('/') || !imageUrl.includes('://')) {
        // If it starts with /uploads/, it's a relative path to our uploads folder
        if (imageUrl.startsWith('/uploads/')) {
          const fileName = imageUrl.replace('/uploads/', '').split('?')[0];
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          
          if (fs.existsSync(filePath)) {
            // File exists, always return localhost URL format
            const port = process.env.PORT || 3000;
            return `http://localhost:${port}${imageUrl}`;
          } else {
            throw new Error(`Image file not found: ${imageUrl}`);
          }
        }
        
        // Try to treat it as a local file path
        const possiblePath = imageUrl.startsWith('/') 
          ? imageUrl 
          : path.join(__dirname, '..', imageUrl);
        
        if (fs.existsSync(possiblePath)) {
          // Read the local file
          const fileBuffer = fs.readFileSync(possiblePath);
          const ext = path.extname(possiblePath).replace('.', '') || 'jpg';
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const fileName = `community-image-${uniqueSuffix}.${ext}`;
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          
          // Ensure uploads directory exists
          const uploadsDir = path.join(__dirname, '..', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          // Write the file
          fs.writeFileSync(filePath, fileBuffer);
          
          return `${currentProtocol}://${currentHost}/uploads/${fileName}`;
        } else {
          throw new Error(`Invalid URL or file path: ${imageUrl}. The path does not exist.`);
        }
      } else {
        throw new Error(`Invalid URL format: ${imageUrl}. Must be a valid HTTP/HTTPS URL, file:// URI, data URI, or local file path.`);
      }
    }

    // Download image from URL
    console.log('Downloading image from URL:', imageUrl);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      timeout: 30000, // 30 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Only accept 2xx status codes
      }
    });

    // Get file extension from URL or content-type
    let ext = 'jpg';
    const contentType = response.headers['content-type'];
    if (contentType && contentType.startsWith('image/')) {
      ext = contentType.split('/')[1].split(';')[0];
      if (ext === 'jpeg') ext = 'jpg';
    } else {
      // Try to get extension from URL
      const urlMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
      if (urlMatch) {
        ext = urlMatch[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
      }
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `community-image-${uniqueSuffix}.${ext}`;
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
        const protocol = req.protocol;
        const host = req.get('host');
        resolve(`${protocol}://${host}/uploads/${fileName}`);
      });
      writer.on('error', (err) => {
        // Clean up partial file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error downloading/saving image:', error);
    console.error('Image URL that failed:', imageUrl);
    
    // Provide more specific error messages
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot reach the image URL: ${error.message}`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Request timed out while downloading image: ${error.message}`);
    } else if (error.response && error.response.status) {
      throw new Error(`HTTP ${error.response.status}: Failed to download image from URL`);
    } else if (error.message.includes('Invalid URL')) {
      throw new Error(`Invalid URL format: ${imageUrl}`);
    } else {
      throw new Error(`Failed to download and save image: ${error.message}`);
    }
  }
};

// Create Community
exports.createCommunity = async (req, res) => {
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

    const { name, game, description, categories, color, icon } = req.body;

    // Parse categories if it's a string (for backward compatibility)
    let categoriesArray = categories;
    if (typeof categories === 'string') {
      try {
        categoriesArray = JSON.parse(categories);
      } catch (e) {
        categoriesArray = [categories];
      }
    }

    // Validation
    if (!name || !game || !description || !categoriesArray || !Array.isArray(categoriesArray) || categoriesArray.length === 0) {
      // Delete uploaded file if validation fails
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Name, game, description, and at least one category are required',
      });
    }

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
          // If it's an object, try to extract the URL or convert to string
          if (typeof imageUrlString === 'object') {
            imageUrlString = imageUrlString.toString();
          } else {
            imageUrlString = String(imageUrlString);
          }
        }

        // Validate that we have a valid string
        if (!imageUrlString || imageUrlString.trim() === '') {
          throw new Error('Image URL is empty or invalid');
        }

        imageUrl = await downloadAndSaveImage(imageUrlString.trim(), req);
      } catch (error) {
        console.error('Error processing image URL:', error);
        return res.status(400).json({
          success: false,
          message: `Failed to save image: ${error.message}`,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Community image is required',
      });
    }

    // Create new community
    const community = new Community({
      name,
      game,
      description,
      categories: categoriesArray,
      image: imageUrl,
      color: color || '#7c3aed',
      icon: icon || 'Target',
      members: 0,
      activeMembers: 0,
      createdBy: userId,
    });

    await community.save();

    // Check if creator is admin and send broadcast
    const creator = await User.findById(userId).select('isAdmin email');
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const isAdmin = creator?.isAdmin || (creator?.email && creator.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    
    if (isAdmin) {
      const { notifyAdminBroadcast } = require('../utils/notificationService');
      notifyAdminBroadcast(
        userId,
        'admin_community',
        'New Community Created',
        `Admin created a new community: ${community.name}`,
        { communityId: community._id.toString(), communityName: community.name }
      ).catch((err) => {
        console.error('[CommunityController] Error notifying admin broadcast:', err);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      data: {
        community: {
          id: community._id,
          name: community.name,
          game: community.game,
          description: community.description,
          categories: community.categories || [],
          category: community.categories?.[0] || 'Other',
          image: community.image,
          color: community.color,
          icon: community.icon,
          members: community.members,
          activeMembers: community.activeMembers,
          createdDate: community.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Create community error:', error);

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
      message: 'Failed to create community',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get All Communities
exports.getAllCommunities = async (req, res) => {
  try {
    const userId = req.query.userId;
    let joinedCommunityIds = new Set();

    if (userId) {
      const user = await User.findById(userId).select('joinedCommunities');
      if (user?.joinedCommunities) {
        joinedCommunityIds = new Set(user.joinedCommunities.map(id => id.toString()));
      }
    }

    const communities = await Community.find()
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        communities: communities.map(community => ({
          id: community._id,
          name: community.name,
          game: community.game,
          description: community.description,
          categories: community.categories || [],
          category: community.categories?.[0] || 'Other', // For backward compatibility
          image: community.image,
          color: community.color,
          icon: community.icon,
          members: community.members,
          activeMembers: community.activeMembers,
          createdDate: community.createdAt,
          isMember: joinedCommunityIds.has(community._id.toString()),
        })),
      },
    });
  } catch (error) {
    console.error('Get communities error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get communities',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get Single Community
exports.getCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.query.userId;
    let isMember = false;

    if (userId) {
      const user = await User.findById(userId).select('joinedCommunities');
      if (user?.joinedCommunities) {
        isMember = user.joinedCommunities.some(id => id.toString() === communityId);
      }
    }

    const community = await Community.findById(communityId)
      .populate('createdBy', 'username email');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        community: {
          id: community._id,
          name: community.name,
          game: community.game,
          description: community.description,
          categories: community.categories || [],
          category: community.categories?.[0] || 'Other', // For backward compatibility
          image: community.image,
          color: community.color,
          icon: community.icon,
          members: community.members,
          activeMembers: community.activeMembers,
          createdDate: community.createdAt,
          isMember,
        },
      },
    });
  } catch (error) {
    console.error('Get community error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get community',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Join Community
exports.joinCommunity = async (req, res) => {
  try {
    const { userId, communityId } = req.body;

    if (!userId || !communityId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Community ID are required',
      });
    }

    const user = await User.findById(userId);
    const community = await Community.findById(communityId);

    if (!user || !community) {
      return res.status(404).json({
        success: false,
        message: 'User or Community not found',
      });
    }

    const alreadyJoined = user.joinedCommunities.some((id) => id.toString() === communityId);

    if (alreadyJoined) {
      return res.status(200).json({
        success: true,
        message: 'You have already joined this community',
      });
    }

    user.joinedCommunities.push(communityId);
    await user.save();

    community.members = (community.members || 0) + 1;
    await community.save();

    res.status(200).json({
      success: true,
      message: 'Community joined successfully',
      data: {
        community: {
          id: community._id,
          members: community.members,
        },
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          joinedCommunities: user.joinedCommunities,
        },
      },
    });
  } catch (error) {
    console.error('Join community error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to join community',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get Community Members
exports.getCommunityMembers = async (req, res) => {
  try {
    const communityId = req.params.id;

    // Find all users who have joined this community
    const users = await User.find({
      joinedCommunities: communityId,
    })
      .select('username email picture createdAt')
      .sort({ createdAt: 1 }); // Sort by join date (oldest first)

    // Get community to find owner/creator
    const community = await Community.findById(communityId).select('createdBy');

    const members = users.map((user) => {
      // Determine role: owner if createdBy, otherwise member
      // Note: Admin/moderator roles can be added later if needed
      let role = 'member';
      if (community && community.createdBy && community.createdBy.toString() === user._id.toString()) {
        role = 'owner';
      }

      return {
        id: user._id,
        userId: user._id,
        username: user.username || user.name || 'Unknown',
        avatar: user.picture || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
        role: role,
        status: 'offline', // TODO: Implement online status tracking
        joinDate: user.createdAt, // Using user creation date as join date approximation
        email: user.email,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        members,
        total: members.length,
      },
    });
  } catch (error) {
    console.error('Get community members error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get community members',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Community
exports.deleteCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Delete image file if exists
    if (community.image && community.image.includes('/uploads/')) {
      const imagePath = community.image;
      const fileName = imagePath.split('/').pop();
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Community.findByIdAndDelete(communityId);
    await User.updateMany(
      { joinedCommunities: communityId },
      { $pull: { joinedCommunities: communityId } }
    );

    res.status(200).json({
      success: true,
      message: 'Community deleted successfully',
    });
  } catch (error) {
    console.error('Delete community error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete community',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update Community
exports.updateCommunity = async (req, res) => {
  try {
    const communityId = req.params.id;
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

    const community = await Community.findById(communityId);

    if (!community) {
      // Delete uploaded file if community not found
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    const { name, game, description, categories, color, icon } = req.body;

    console.log('Update community request body:', req.body);
    console.log('Update community file:', req.file);

    // Parse categories if it's a string (for backward compatibility)
    let categoriesArray = categories;
    if (categories && typeof categories === 'string') {
      try {
        categoriesArray = JSON.parse(categories);
      } catch (e) {
        categoriesArray = [categories];
      }
    }

    // Update fields if provided (always update if field is in request body)
    if (name !== undefined && name !== null) {
      community.name = name;
    }
    if (game !== undefined && game !== null) {
      community.game = game;
    }
    if (description !== undefined && description !== null) {
      community.description = description;
    }
    if (categoriesArray && Array.isArray(categoriesArray) && categoriesArray.length > 0) {
      community.categories = categoriesArray;
    }
    if (color !== undefined && color !== null) {
      community.color = color;
    }
    if (icon !== undefined && icon !== null) {
      community.icon = icon;
    }

    // Handle image update
    let imageUrl = community.image; // Keep existing image by default

    // Check if file was uploaded (new image file)
    if (req.file) {
      // Delete old image file if it exists and is a local upload
      if (community.image) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          
          if (community.image.includes('/uploads/')) {
            // Handle both full URLs (http://localhost:3000/uploads/file.jpg) and relative paths (/uploads/file.jpg)
            const urlParts = community.image.split('/uploads/');
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
              console.log(`Deleted old community image: ${oldFileName}`);
            }
          }
        } catch (error) {
          // Log error but don't fail the update if old file deletion fails
          console.error('Error deleting old community image:', error);
        }
      }

      // Always use localhost for image URLs
      const port = process.env.PORT || 3000;
      imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
      community.image = imageUrl;
      console.log(`Updated community image to: ${imageUrl}`);
    } 
    // Check if image URL is provided directly - download and save to uploads folder
    else if (req.body.image !== undefined && req.body.image !== null) {
      try {
        // Convert image to string if it's not already
        let imageUrlString = req.body.image;
        console.log('Received image data type:', typeof imageUrlString);
        console.log('Received image data:', imageUrlString);
        
        if (typeof imageUrlString !== 'string') {
          // If it's an object, try to extract the URL or convert to string
          if (typeof imageUrlString === 'object') {
            // Try to get URI property if it's a file object
            if (imageUrlString.uri) {
              imageUrlString = imageUrlString.uri;
            } else if (imageUrlString.url) {
              imageUrlString = imageUrlString.url;
            } else {
              imageUrlString = imageUrlString.toString();
            }
          } else {
            imageUrlString = String(imageUrlString);
          }
        }

        // Validate that we have a valid string
        if (!imageUrlString || imageUrlString.trim() === '') {
          throw new Error('Image URL is empty or invalid');
        }

        imageUrlString = imageUrlString.trim();
        console.log('Processing image URL:', imageUrlString);

        // Check if the image URL is the same as the existing one
        if (community.image && community.image === imageUrlString) {
          console.log('Image URL unchanged, keeping existing image');
          imageUrl = community.image; // Keep existing image
        }
        // Check if it's already a valid server URL pointing to uploads
        else if (imageUrlString.includes('/uploads/')) {
          const port = process.env.PORT || 3000;
          
          // Extract filename and check if file exists (handles both localhost and IP-based URLs)
          const fileName = imageUrlString.split('/uploads/').pop().split('?')[0];
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          
          if (fs.existsSync(filePath)) {
            // File exists locally, always normalize to localhost URL format
            imageUrl = `http://localhost:${port}/uploads/${fileName}`;
            community.image = imageUrl;
            console.log('Using existing server image, normalized to localhost:', imageUrl);
          } else {
            // File doesn't exist, try to download it (might be from different server or external URL)
            imageUrl = await downloadAndSaveImage(imageUrlString, req);
            community.image = imageUrl;
          }
        }
        // If it's a file:// URI that doesn't exist on server, skip it if it's the same as existing
        else if (imageUrlString.startsWith('file://')) {
          // Check if we can access the file
          const filePath = imageUrlString.replace(/^file:\/\//, '');
          if (fs.existsSync(filePath)) {
            // File exists, process it
            imageUrl = await downloadAndSaveImage(imageUrlString, req);
            community.image = imageUrl;
          } else {
            // File doesn't exist on server (normal for mobile file:// URIs)
            // If community already has an image, keep it
            if (community.image) {
              console.log('File:// URI not accessible on server, keeping existing image');
              imageUrl = community.image;
            } else {
              throw new Error('Local file path does not exist and no existing image to keep');
            }
          }
        }
        // Otherwise, try to download and save it
        else {
          // Delete old image file if it exists and is a local upload
          if (community.image && typeof community.image === 'string' && community.image.includes('/uploads/')) {
            try {
              // Extract filename from various URL formats
              let oldFileName = null;
              const urlParts = community.image.split('/uploads/');
              if (urlParts.length > 1) {
                // Get the filename, removing any query parameters
                oldFileName = urlParts[1].split('?')[0].split('#')[0];
              }
              
              // If we found a filename, try to delete the old file
              if (oldFileName) {
                const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
                if (fs.existsSync(oldFilePath)) {
                  fs.unlinkSync(oldFilePath);
                  console.log(`Deleted old community image: ${oldFileName}`);
                }
              }
            } catch (error) {
              // Log error but don't fail the update if old file deletion fails
              console.error('Error deleting old community image:', error);
            }
          }

          imageUrl = await downloadAndSaveImage(imageUrlString, req);
          community.image = imageUrl;
          console.log(`Updated community image to: ${imageUrl}`);
        }
      } catch (error) {
        console.error('Error processing image URL:', error);
        console.error('Image data that failed:', req.body.image);
        return res.status(400).json({
          success: false,
          message: `Failed to save image: ${error.message}`,
        });
      }
    }
    // If no image provided, keep existing image (already set above)

    await community.save();

    res.status(200).json({
      success: true,
      message: 'Community updated successfully',
      data: {
        community: {
          id: community._id,
          name: community.name,
          game: community.game,
          description: community.description,
          categories: community.categories || [],
          category: community.categories?.[0] || 'Other',
          image: community.image,
          color: community.color,
          icon: community.icon,
          members: community.members,
          activeMembers: community.activeMembers,
          createdDate: community.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Update community error:', error);

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
      message: 'Failed to update community',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Multiple Communities
exports.deleteMultipleCommunities = async (req, res) => {
  try {
    const { communityIds } = req.body;
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!communityIds || !Array.isArray(communityIds) || communityIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Community IDs array is required',
      });
    }

    // Find all communities to delete
    const communities = await Community.find({ _id: { $in: communityIds } });

    // Delete image files
    for (const community of communities) {
      if (community.image && community.image.includes('/uploads/')) {
        const imagePath = community.image;
        const fileName = imagePath.split('/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Delete communities
    await Community.deleteMany({ _id: { $in: communityIds } });
    await User.updateMany(
      { joinedCommunities: { $in: communityIds } },
      { $pull: { joinedCommunities: { $in: communityIds } } }
    );

    res.status(200).json({
      success: true,
      message: `${communityIds.length} communit${communityIds.length > 1 ? 'ies' : 'y'} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete multiple communities error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete communities',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

