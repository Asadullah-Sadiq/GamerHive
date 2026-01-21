require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('./connection');
const cors = require('cors');
const { initializeSocketHandlers } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Socket.io configuration with CORS
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173'], // Allow all origins in development (configure for production)
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
  allowEIO3: true, // Allow Engine.IO v3 clients
  allowUpgrades: true, // Allow transport upgrades
  perMessageDeflate: false, // Disable compression for better compatibility
});

// Initialize socket handlers
initializeSocketHandlers(io);

// Make io accessible to routes if needed
app.set('io', io);

// Export io for use in controllers
module.exports.io = io;

// Middleware - CORS Configuration
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory with CORS headers
const path = require('path');

// Middleware to add CORS headers to static files
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for static files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  // Set proper cache headers
  maxAge: '1d',
  // Ensure proper MIME types
  setHeaders: (res, filePath) => {
    // Set CORS headers explicitly for each file
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Determine MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  },
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
// app.get('/', (req, res) => {
  
//   res.send('Auth callback received');
// });
// Routes
const authRoutes = require('./routes/authRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');
const communityRoutes = require('./routes/communityRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const postRoutes = require('./routes/postRoutes');
const gameRoutes = require('./routes/gameRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const directMessageRoutes = require('./routes/directMessageRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/auth', authRoutes);
// Auth0 callback route (mounted at /auth/callback, not /api/auth/callback)
app.use('/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/post', postRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/direct', directMessageRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    ip: req.ip,
    host: req.get('host'),
    protocol: req.protocol,
  });
});

// Test static file serving
app.get('/api/test-uploads', (req, res) => {
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, 'uploads');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.status(404).json({
        success: false,
        message: 'Uploads directory does not exist',
      });
    }
    
    const files = fs.readdirSync(uploadsDir);
    const protocol = req.protocol;
    const host = req.get('host');
    
    const fileUrls = files.map(file => ({
      filename: file,
      url: `${protocol}://${host}/uploads/${file}`,
      localhostUrl: `http://localhost:${req.socket.localPort}/uploads/${file}`,
    }));
    
    res.json({
      success: true,
      message: 'Uploads directory accessible',
      uploadsDir: uploadsDir,
      filesCount: files.length,
      files: fileUrls.slice(0, 10), // Show first 10 files
      baseUrl: `${protocol}://${host}`,
      localhostUrl: `http://localhost:${req.socket.localPort}`,
      note: 'Use the baseUrl to construct file URLs. Both localhost and network IP should work.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reading uploads directory',
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle multer errors (file upload errors)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
      code: err.code,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Server
const PORT = process.env.PORT || 3000;

// Listen on all network interfaces (0.0.0.0) to allow connections from mobile devices
// Use 'server' instead of 'app' to support Socket.io
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔌 Socket.io enabled for real-time communication`);
  console.log(`📱 Access from mobile: http://YOUR_IP:${PORT}/api`);
  console.log(`💻 Local access: http://localhost:${PORT}/api`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };

