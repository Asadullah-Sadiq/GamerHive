# GamerHive - Complete Project Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Features & Functionalities](#features--functionalities)
6. [Database Models](#database-models)
7. [API Endpoints](#api-endpoints)
8. [Authentication System](#authentication-system)
9. [Real-time Features](#real-time-features)
10. [Frontend Implementation](#frontend-implementation)
11. [Backend Implementation](#backend-implementation)
12. [Security Features](#security-features)
13. [Deployment & Configuration](#deployment--configuration)

---

## 🎮 Project Overview

**GamerHive** is a comprehensive gaming social platform that connects gamers worldwide. It provides features for community building, game borrowing, tournaments, messaging, and social interactions. The platform is built with a modern tech stack supporting both web and mobile applications.

### Key Highlights
- **Multi-platform**: Web (React) and Mobile (React Native/Expo)
- **Real-time Communication**: Socket.io for live messaging and notifications
- **Secure Authentication**: Email OTP-based authentication system
- **AI-Powered**: Google Gemini integration for content moderation
- **Social Features**: Friends, communities, messaging, and more
- **Game Management**: Borrow/lend games, tournaments, ratings

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Web Client    │         │  Mobile Client  │
│   (React/Vite)   │         │ (React Native)  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │      HTTP/REST API         │
         │      WebSocket (Socket.io) │
         │                           │
         └───────────┬───────────────┘
                     │
         ┌───────────▼───────────┐
         │   Express.js Server  │
         │   (Node.js Backend)   │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   MongoDB Database    │
         │   (Mongoose ODM)        │
         └───────────────────────┘
```

### Architecture Patterns
- **MVC Pattern**: Controllers, Models, Routes separation
- **RESTful API**: Standard HTTP methods for API endpoints
- **WebSocket**: Real-time bidirectional communication
- **JWT Authentication**: Token-based stateless authentication
- **Middleware Pattern**: Request processing pipeline

---

## 💻 Technology Stack

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io
- **Authentication**: JWT (JSON Web Tokens), bcrypt
- **Email**: Nodemailer
- **File Upload**: Multer
- **AI/ML**: Google Gemini API (for content moderation)
- **Validation**: Mongoose schema validation

### Frontend - Web
- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.2
- **Routing**: React Router DOM 7.12.0
- **Styling**: Tailwind CSS 3.4.1
- **Icons**: Lucide React
- **State Management**: React Hooks (useState, useEffect, useContext)
- **HTTP Client**: Fetch API (custom wrapper)

### Frontend - Mobile
- **Framework**: React Native 0.81.5
- **Platform**: Expo SDK 54
- **Navigation**: Custom navigation system with history tracking
- **Styling**: StyleSheet API, NativeWind (Tailwind for React Native)
- **Icons**: Lucide React Native, Expo Vector Icons
- **Storage**: AsyncStorage
- **Notifications**: Expo Notifications
- **Media**: Expo Image Picker, Expo Video, Expo Audio
- **HTTP Client**: Axios

### Development Tools
- **Language**: TypeScript (Frontend), JavaScript (Backend)
- **Package Manager**: npm
- **Version Control**: Git
- **Code Quality**: ESLint

---

## 📁 Project Structure

```
GamerHive/
├── server/                 # Backend Server
│   ├── controllers/        # Business logic controllers
│   ├── models/            # MongoDB schemas
│   ├── routes/            # API route definitions
│   ├── middleware/        # Express middleware
│   ├── socket/            # Socket.io handlers
│   ├── utils/             # Utility functions
│   ├── uploads/           # File uploads directory
│   ├── config/            # Configuration files
│   └── index.js           # Server entry point
│
├── web/                   # Web Frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # Utility functions
│   │   ├── hooks/         # Custom React hooks
│   │   └── App.tsx        # Main app component
│   └── package.json
│
├── mobile/                # Mobile Frontend
│   ├── src/
│   │   ├── components/    # React Native components
│   │   ├── utils/         # Utility functions
│   │   ├── hooks/         # Custom React hooks
│   │   └── App.tsx        # Main app component
│   └── package.json
│
└── PROJECT_DOCUMENTATION.md
```

---

## ✨ Features & Functionalities

### 1. Authentication & Authorization

#### Email OTP Authentication
- **Signup Flow**:
  1. User enters email, username, password
  2. System creates user with `isVerified: false`
  3. 6-digit OTP generated and hashed
  4. OTP sent via email (5-minute expiry)
  5. User verifies OTP to activate account

- **Login Flow**:
  1. User enters email and password
  2. Credentials validated
  3. OTP generated and sent
  4. User verifies OTP
  5. JWT token issued

- **Forgot Password Flow**:
  1. User requests password reset
  2. OTP sent to email
  3. User verifies OTP
  4. User sets new password

#### Security Features
- Password hashing with bcrypt (10 rounds)
- OTP hashing before storage
- JWT tokens with expiration
- Email verification required
- Rate limiting on OTP attempts (5 max attempts)
- Single-use OTPs (marked as used after verification)

### 2. User Management

#### Profile System
- **User Profile**:
  - Username, email, name, bio
  - Profile picture and cover photo
  - Date of birth, location
  - Favorite games and skill levels
  - Profile rank system (Bronze to Legend)

#### Profile Ranking System
- **Rank Calculation Formula**:
  ```
  Rank Score = (Followers × 10) + (Average Rating × 20) + (Content Quality Score / 100 × 200)
  ```

- **Rank Tiers**:
  - Bronze: 0-50 points
  - Silver: 51-100 points
  - Gold: 101-200 points
  - Platinum: 201-350 points
  - Diamond: 351-500 points
  - Master: 501-750 points
  - Grandmaster: 751-1000 points
  - Legend: 1000+ points

- **Content Quality Scoring**:
  - Analyzes posts, comments, messages
  - Uses Google Gemini API for moderation
  - Tracks average quality score per user
  - Default score: 50 (for new users)

### 3. Social Features

#### Friends System
- Send/accept/reject friend requests
- Friends list management
- Friend activity tracking
- Friend messaging

#### Communities
- Create and join gaming communities
- Community-based messaging (group chat)
- Community posts and media sharing
- Member management
- Community categories and tags

### 4. Messaging System

#### Point-to-Point (PTP) Messaging
- Direct one-on-one messaging
- Real-time message delivery
- Message types: text, image, video, audio, file
- Read receipts and delivery status
- Message reactions
- Media download and sharing
- Message search

#### Community Messaging
- Group chat within communities
- Real-time updates via Socket.io
- Message replies and threading
- Media sharing
- Message moderation (AI-powered)
- Read status tracking

#### Message Features
- **Real-time Delivery**: Socket.io for instant messaging
- **Media Support**: Images, videos, audio, files
- **Status Indicators**: Sending, sent, delivered, read
- **Message Actions**: Reply, react, delete, forward
- **Search**: Full-text search across conversations

### 5. Game Borrowing System

#### Game Management
- Add games to library
- Game details: title, genre, platform, file size, version
- Game images and descriptions
- Availability tracking (total copies, available copies)

#### Borrow Request Flow
1. User browses available games
2. Clicks "Borrow" on desired game
3. System validates:
   - Game is available
   - User is not the owner
   - No existing pending request
4. Borrow request created in database
5. Initial message sent to game owner via PTP messaging
6. User redirected to chat with game owner

#### Borrow Request States
- **Pending**: Request sent, awaiting approval
- **Approved**: Owner approved the request
- **Rejected**: Owner rejected the request
- **Active**: Game currently borrowed
- **Returned**: Game returned successfully
- **Cancelled**: Request cancelled by borrower

### 6. Tournament System

#### Tournament Features
- Create tournaments
- Tournament registration
- Tournament brackets and scheduling
- Prize management
- Tournament results and rankings
- Tournament categories and types

### 7. Content Management

#### Posts System
- Create posts with text, images, videos
- Like and comment on posts
- Post sharing
- Post moderation (AI-powered)
- Post analytics

#### Content Moderation
- **AI Integration**: Google Gemini API
- **Moderation Categories**:
  - SAFE: No issues detected
  - MILD_INSULT: Minor inappropriate content
  - HARMFUL: Severe inappropriate content
- **Automatic Flagging**: Real-time content analysis
- **Warning System**: Users receive warnings for flagged content

### 8. Notification System

#### Notification Types
- Friend requests
- Friend request accepted
- Tournament updates
- Community updates
- Message notifications
- Game borrowing updates
- System notifications
- Achievement notifications
- Feedback replies

#### Notification Features
- Real-time push notifications (mobile)
- In-app notification center
- Notification filtering and search
- Mark as read/unread
- Notification preferences
- Sound alerts

### 9. Admin Features

#### Admin Dashboard
- User management
- Content moderation
- Analytics and statistics
- System configuration
- User activity monitoring

#### Admin Analytics
- User statistics
- Content statistics
- Moderation statistics
- Ranking statistics
- Engagement metrics

### 10. Search & Discovery

#### Search Features
- User search
- Community search
- Game search
- Post search
- Global search across all content types

---

## 🗄️ Database Models

### User Model
```javascript
{
  username: String,
  email: String (unique, required),
  password: String (hashed),
  name: String,
  dateOfBirth: Date,
  picture: String (URL),
  coverPhoto: String (URL),
  bio: String (max 500 chars),
  favoriteGames: [String],
  skillLevels: Map<String, String>,
  friends: [ObjectId],
  sentFriendRequests: [ObjectId],
  receivedFriendRequests: [ObjectId],
  blockedUsers: [ObjectId],
  games: [ObjectId],
  joinedCommunities: [ObjectId],
  isAdmin: Boolean,
  isActive: Boolean,
  isVerified: Boolean,
  profileRank: {
    rank: String,
    rankScore: Number,
    rankColor: String,
    lastCalculated: Date
  },
  contentQuality: {
    averageQualityScore: Number,
    totalContent: Number,
    flaggedContent: Number
  },
  pushToken: String,
  pushTokenPlatform: String
}
```

### Game Model
```javascript
{
  title: String (required),
  genre: String (required),
  platform: [String] (required),
  fileSize: String (required),
  version: String,
  description: String,
  image: String (required),
  status: Enum ['available', 'borrowed', 'maintenance'],
  totalCopies: Number,
  availableCopies: Number,
  borrowedCount: Number,
  addedBy: ObjectId (ref: User),
  addedDate: Date
}
```

### GameBorrow Model
```javascript
{
  gameId: ObjectId (ref: Game),
  borrowerId: ObjectId (ref: User),
  lenderId: ObjectId (ref: User),
  status: Enum ['pending', 'approved', 'rejected', 'active', 'returned', 'cancelled'],
  borrowDate: Date,
  returnDate: Date,
  dueDate: Date,
  borrowDuration: Number (default: 14 days),
  message: String
}
```

### Community Model
```javascript
{
  name: String (required),
  game: String,
  description: String,
  image: String,
  color: String,
  icon: String,
  members: [ObjectId],
  activeMembers: Number,
  createdBy: ObjectId (ref: User),
  categories: [String]
}
```

### Message Model (Community)
```javascript
{
  communityId: ObjectId (ref: Community),
  userId: ObjectId (ref: User),
  content: String (required, max 5000),
  type: Enum ['text', 'image', 'video', 'audio', 'file'],
  fileUrl: String,
  fileName: String,
  fileSize: String,
  duration: String,
  replyTo: ObjectId (ref: Message),
  reactions: [{
    emoji: String,
    users: [ObjectId]
  }],
  readBy: [{
    userId: ObjectId,
    readAt: Date
  }],
  moderationCategory: Enum ['SAFE', 'MILD_INSULT', 'HARMFUL'],
  hasWarning: Boolean
}
```

### DirectMessage Model
```javascript
{
  senderId: ObjectId (ref: User),
  receiverId: ObjectId (ref: User),
  content: String (required, max 5000),
  type: Enum ['text', 'image', 'video', 'audio', 'file'],
  fileUrl: String,
  fileName: String,
  fileSize: String,
  duration: String,
  isRead: Boolean,
  readAt: Date,
  isDeleted: Boolean,
  deletedFor: [ObjectId]
}
```

### OTP Model
```javascript
{
  email: String (required, indexed),
  hashedOtp: String (required),
  purpose: Enum ['signup', 'login', 'forgot-password'] (indexed),
  expiresAt: Date (TTL index),
  isUsed: Boolean (indexed),
  attempts: Number,
  maxAttempts: Number (default: 5)
}
```

### Notification Model
```javascript
{
  userId: ObjectId (ref: User),
  type: String,
  title: String,
  message: String,
  priority: Enum ['low', 'medium', 'high'],
  isRead: Boolean,
  relatedUserId: ObjectId,
  actionUrl: String
}
```

### Post Model
```javascript
{
  userId: ObjectId (ref: User),
  description: String,
  media: [String],
  mediaType: Enum ['image', 'video'],
  likes: [{
    userId: ObjectId,
    username: String,
    name: String,
    picture: String
  }],
  comments: [{
    userId: ObjectId,
    content: String,
    replies: [ObjectId]
  }],
  moderationCategory: Enum ['SAFE', 'MILD_INSULT', 'HARMFUL'],
  hasWarning: Boolean
}
```

### Tournament Model
```javascript
{
  title: String,
  description: String,
  game: String,
  startDate: Date,
  endDate: Date,
  maxParticipants: Number,
  participants: [ObjectId],
  prize: String,
  status: Enum ['upcoming', 'ongoing', 'completed', 'cancelled']
}
```

### Rating Model
```javascript
{
  raterUserId: ObjectId (ref: User),
  ratedUserId: ObjectId (ref: User),
  rating: Number (1-5),
  comment: String
}
```

---

## 🔌 API Endpoints

### Authentication Routes (`/api/auth`)

#### POST `/auth/signup`
- **Description**: User registration with OTP
- **Body**: `{ email, username, password }`
- **Response**: `{ success, message }`
- **Flow**: Creates user, generates OTP, sends email

#### POST `/auth/login`
- **Description**: User login with OTP
- **Body**: `{ email, password }`
- **Response**: `{ success, message }`
- **Flow**: Validates credentials, generates OTP, sends email

#### POST `/auth/verify-otp`
- **Description**: Verify OTP and get JWT token
- **Body**: `{ email, otp, purpose }`
- **Response**: `{ success, token, user }`
- **Flow**: Verifies OTP, marks as used, issues JWT

#### POST `/auth/resend-otp`
- **Description**: Resend OTP
- **Body**: `{ email, purpose }`
- **Response**: `{ success, message }`

#### POST `/auth/forgot-password`
- **Description**: Request password reset OTP
- **Body**: `{ email }`
- **Response**: `{ success, message }`

#### POST `/auth/reset-password`
- **Description**: Reset password with OTP
- **Body**: `{ email, otp, newPassword, confirmPassword }`
- **Response**: `{ success, message, token }`

### User Routes (`/api/user`)

#### GET `/user/profile/:userId`
- **Description**: Get user profile with rank
- **Response**: `{ success, data: { user, profileRank } }`

#### GET `/user/profile/:userId/rank`
- **Description**: Get user profile rank
- **Response**: `{ success, data: { rank, rankScore, rankColor } }`

#### PUT `/user/profile/:userId`
- **Description**: Update user profile
- **Body**: Profile fields to update
- **Response**: `{ success, data: { user } }`

### Game Routes (`/api/game`)

#### POST `/game/add`
- **Description**: Add new game (with image upload)
- **Body**: FormData with game details and image
- **Response**: `{ success, data: { game } }`

#### GET `/game/all`
- **Description**: Get all games
- **Response**: `{ success, data: { games } }`
- **Populates**: `addedBy` (owner info)

#### POST `/game/borrow`
- **Description**: Request to borrow a game
- **Body**: `{ gameId, borrowerId, message }`
- **Response**: `{ success, data: { borrowRequest } }`
- **Side Effect**: Creates initial DirectMessage

#### PUT `/game/:id`
- **Description**: Update game
- **Body**: Game fields to update
- **Response**: `{ success, message }`

#### DELETE `/game/:id`
- **Description**: Delete game
- **Response**: `{ success, message }`

### Community Routes (`/api/community`)

#### POST `/community/create`
- **Description**: Create new community
- **Body**: Community details
- **Response**: `{ success, data: { community } }`

#### GET `/community/all`
- **Description**: Get all communities
- **Response**: `{ success, data: { communities } }`

#### POST `/community/:id/join`
- **Description**: Join a community
- **Body**: `{ userId }`
- **Response**: `{ success, message }`

### Message Routes (`/api/message`)

#### GET `/message/:id`
- **Description**: Get community messages
- **Query**: `page, limit, before`
- **Response**: `{ success, data: { messages, pagination } }`

#### POST `/message/send`
- **Description**: Send community message
- **Body**: `{ communityId, content, type, fileUrl }`
- **Response**: `{ success, data: { message } }`
- **Real-time**: Emits via Socket.io

### Direct Message Routes (`/api/direct`)

#### GET `/direct/messages/:userId/:targetUserId`
- **Description**: Get PTP messages
- **Response**: `{ success, data: { messages } }`

#### POST `/direct/send`
- **Description**: Send direct message
- **Body**: `{ senderId, receiverId, content, type }`
- **Response**: `{ success, data: { message } }`
- **Real-time**: Emits via Socket.io

### Notification Routes (`/api/notification`)

#### GET `/notification`
- **Description**: Get user notifications
- **Query**: `userId, all`
- **Response**: `{ success, data: { notifications } }`

#### PUT `/notification/read`
- **Description**: Mark notification as read
- **Body**: `{ notificationId }`
- **Response**: `{ success }`

#### POST `/notification/register-token`
- **Description**: Register push notification token
- **Body**: `{ userId, token, platform }`
- **Response**: `{ success }`

---

## 🔐 Authentication System

### OTP Generation & Verification

#### OTP Generation Process
```javascript
1. Generate 6-digit random number (100000-999999)
2. Hash OTP using bcrypt (10 rounds)
3. Store hashed OTP in database with:
   - Email
   - Purpose (signup/login/forgot-password)
   - Expiration (5 minutes from now)
   - Attempts counter (max 5)
   - isUsed flag (false)
4. Send plain OTP via email
```

#### OTP Verification Process
```javascript
1. Receive OTP from user
2. Find most recent unused OTP for email + purpose
3. Check if expired
4. Check if attempts exceeded
5. Compare provided OTP with hashed OTP (bcrypt.compare)
6. If valid:
   - For signup: Mark user as verified, mark OTP as used
   - For login: Issue JWT token, mark OTP as used
   - For forgot-password: Don't mark as used yet (used in reset step)
7. If invalid: Increment attempts counter
```

#### JWT Token Structure
```javascript
{
  userId: String,
  email: String,
  iat: Number (issued at),
  exp: Number (expiration - 7 days)
}
```

### Password Security
- **Hashing**: bcrypt with 10 salt rounds
- **Pre-save Hook**: Automatically hashes password before saving
- **Validation**: Minimum 6 characters
- **Reset Flow**: OTP verification required before reset

---

## 🔄 Real-time Features

### Socket.io Implementation

#### Connection Setup
```javascript
// Server-side
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket']
});
```

#### Socket Events

##### Client → Server
- `join_community`: Join community room
- `leave_community`: Leave community room
- `send_message`: Send community message
- `typing`: User typing indicator
- `stop_typing`: Stop typing indicator
- `mark_read`: Mark message as read

##### Server → Client
- `message_received`: New message broadcast
- `message_status`: Message status update
- `user_typing`: User typing notification
- `user_stopped_typing`: User stopped typing
- `error`: Error notification

#### Room Management
- Each community has a Socket.io room
- Users join room when entering community chat
- Messages broadcast to all room members
- Typing indicators scoped to room

### Real-time Message Flow

#### Community Message Flow
```
1. User sends message via Socket.io
2. Server validates and saves to database
3. Server populates user details
4. Server calculates read status
5. Server broadcasts to community room
6. All connected clients receive message
7. Clients update UI optimistically
```

#### Direct Message Flow
```
1. User sends message via API
2. Server saves to database
3. Server emits to specific receiver
4. Receiver's client receives message
5. If receiver offline, message stored for later
```

---

## 🎨 Frontend Implementation

### Web Application (React)

#### Routing Structure
```typescript
/ (Public)
  ├── /login (PublicRoute)
  ├── /signup (PublicRoute)
  └── /dashboard (ProtectedRoute)
      ├── /profile
      ├── /communities
      ├── /tournaments
      ├── /game-borrowing
      ├── /settings
      └── /notifications
```

#### State Management
- **Local State**: React useState hooks
- **Global State**: Context API (if needed)
- **Persistence**: localStorage for auth tokens
- **Navigation**: React Router with history

#### Component Architecture
```
App.tsx
├── AuthPage (Login/Signup)
├── ProtectedRoute
│   ├── Header
│   ├── Sidebar
│   └── MainContent
│       ├── UserProfilePage
│       ├── CommunitiesPage
│       ├── TournamentPage
│       ├── GameBorrowingPage
│       └── ...
└── PublicRoute
```

#### Styling Approach
- **Framework**: Tailwind CSS
- **Method**: Utility-first classes
- **Theme**: Dark mode with purple accent
- **Responsive**: Mobile-first design

### Mobile Application (React Native)

#### Navigation System
- **Custom Navigation**: State-based navigation
- **History Tracking**: useNavigationHistory hook
- **Page Types**: TypeScript enum for type safety
- **Params Passing**: Navigation params object

#### Navigation Flow
```typescript
goToPage(page: PageType, params?: any)
  ├── Add to navigation history
  ├── Set current page
  ├── Set navigation params
  └── Close sidebar
```

#### Component Structure
```
App.tsx
├── AuthPage
│   ├── Login Form
│   ├── Signup Form
│   ├── OTPVerification
│   ├── WelcomeSplash
│   └── ForgotPasswordPage
├── Header
├── Sidebar
└── MainContent
    ├── UserProfilePage
    ├── CommunitiesPage
    ├── JoinCommunityPage
    ├── TournamentPage
    ├── GameBorrowingPage
    ├── PTPMessagingPage
    ├── FriendMessagingPage
    └── ...
```

#### Storage
- **AsyncStorage**: User data, tokens, preferences
- **Keys**: 
  - `user`: User object
  - `token`: JWT token
  - `notificationsEnabled`: Boolean preference

#### Styling
- **StyleSheet API**: React Native StyleSheet
- **NativeWind**: Tailwind for React Native (optional)
- **Responsive**: Dimensions API for screen sizes
- **Theme**: Consistent with web (dark purple theme)

---

## ⚙️ Backend Implementation

### Server Structure

#### Entry Point (`server/index.js`)
```javascript
1. Load environment variables
2. Connect to MongoDB
3. Create Express app
4. Setup Socket.io
5. Configure middleware (CORS, JSON parsing)
6. Mount routes
7. Setup file serving
8. Start server
```

#### Middleware Stack
```javascript
1. CORS (Cross-Origin Resource Sharing)
2. JSON body parser
3. URL-encoded body parser
4. File upload (Multer)
5. Authentication (JWT verification)
6. Error handling
```

### Controller Pattern

#### Controller Structure
```javascript
exports.functionName = async (req, res) => {
  try {
    // 1. Validate input
    // 2. Query database
    // 3. Process data
    // 4. Return response
    res.status(200).json({
      success: true,
      data: { ... }
    });
  } catch (error) {
    // Error handling
    res.status(500).json({
      success: false,
      message: 'Error message'
    });
  }
};
```

### Database Operations

#### Mongoose Patterns
- **Schema Definition**: Models with validation
- **Pre-save Hooks**: Password hashing, timestamp updates
- **Indexes**: Performance optimization
- **Populate**: Reference population for related data
- **Aggregation**: Complex queries

#### Query Optimization
- **Indexes**: On frequently queried fields
- **Select**: Only fetch needed fields
- **Lean**: Return plain objects (faster)
- **Pagination**: Limit results for large datasets

---

## 🔒 Security Features

### Authentication Security
- **Password Hashing**: bcrypt (10 rounds)
- **OTP Security**: Hashed before storage
- **JWT Tokens**: Signed with secret, expiration
- **Email Verification**: Required for account activation
- **Rate Limiting**: OTP attempt limits

### Data Security
- **Input Validation**: Mongoose schema validation
- **SQL Injection Prevention**: Mongoose parameterized queries
- **XSS Prevention**: Input sanitization
- **CORS Configuration**: Restricted origins
- **File Upload Security**: Type and size validation

### Content Security
- **AI Moderation**: Google Gemini API
- **Content Filtering**: Bad word detection
- **Warning System**: User warnings for flagged content
- **Auto-moderation**: Real-time content analysis

---

## 🚀 Deployment & Configuration

### Environment Variables

#### Server (.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/gamerhive

# JWT
JWT_SECRET=your-secret-key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Server
PORT=3000
NODE_ENV=development

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key
```

#### Frontend Configuration
- **API Base URL**: Configured in `utils/api.ts`
- **Socket.io URL**: Configured in socket service
- **Environment**: Development/Production modes

### File Upload Configuration
- **Storage**: Local filesystem (`server/uploads/`)
- **Multer Config**: Image file types, size limits
- **File Serving**: Static file serving via Express

### Database Setup
1. Install MongoDB
2. Create database: `gamerhive`
3. Configure connection string
4. Indexes created automatically by Mongoose

### Running the Application

#### Server
```bash
cd server
npm install
npm start  # or npm run dev
```

#### Web
```bash
cd web
npm install
npm run dev
```

#### Mobile
```bash
cd mobile
npm install
npm start  # Expo dev server
```

---

## 📊 Key Algorithms & Logic

### Profile Ranking Algorithm
```javascript
function calculateRankScore(followersCount, averageRating, contentQualityScore) {
  const followersScore = followersCount * 10;
  const ratingScore = averageRating * 20;
  const qualityBonus = (contentQualityScore / 100) * 200;
  return Math.round(followersScore + ratingScore + qualityBonus);
}

function getRankTier(score) {
  if (score >= 1000) return 'Legend';
  if (score >= 751) return 'Grandmaster';
  if (score >= 501) return 'Master';
  if (score >= 351) return 'Diamond';
  if (score >= 201) return 'Platinum';
  if (score >= 101) return 'Gold';
  if (score >= 51) return 'Silver';
  return 'Bronze';
}
```

### Content Quality Scoring
- Analyzes user's posts, comments, messages
- Uses Google Gemini API for sentiment/content analysis
- Tracks average quality score
- Updates user's contentQuality field
- Affects profile ranking

### OTP Expiration & Cleanup
- **TTL Index**: MongoDB automatically deletes expired OTPs
- **Expiration Time**: 5 minutes from creation
- **Cleanup**: No manual cleanup needed (MongoDB handles)

### Message Status Calculation
```javascript
// For community messages
const totalRecipients = communityMembers.length - 1; // Exclude sender
const readCount = message.readBy.length;
let status = 'sent';
if (readCount >= totalRecipients && totalRecipients > 0) {
  status = 'read';
} else if (readCount > 0) {
  status = 'delivered';
}
```

---

## 🔄 Data Flow Examples

### User Signup Flow
```
1. User fills signup form
2. Frontend sends POST /auth/signup
3. Backend creates user (isVerified: false)
4. Backend generates OTP
5. Backend hashes OTP
6. Backend saves OTP to database
7. Backend sends email with OTP
8. User enters OTP
9. Frontend sends POST /auth/verify-otp
10. Backend verifies OTP
11. Backend marks user as verified
12. Backend issues JWT token
13. Frontend stores token and user data
14. User redirected to dashboard
```

### Game Borrowing Flow
```
1. User browses games
2. User clicks "Borrow" on game
3. Frontend validates (availability, ownership)
4. Frontend sends POST /game/borrow
5. Backend creates GameBorrow record (status: pending)
6. Backend creates DirectMessage to game owner
7. Backend returns borrow request data
8. Frontend navigates to PTP messaging
9. User can chat with game owner
10. Owner can approve/reject in chat
```

### Real-time Message Flow
```
1. User types message in community chat
2. Frontend emits 'send_message' via Socket.io
3. Server receives event
4. Server validates and saves to database
5. Server populates user details
6. Server calculates read status
7. Server emits 'message_received' to community room
8. All connected clients receive message
9. Clients update UI
10. Clients mark as read if user is viewing
```

---

## 🎯 Best Practices Implemented

### Code Organization
- **Separation of Concerns**: Controllers, Models, Routes
- **DRY Principle**: Reusable utility functions
- **Type Safety**: TypeScript in frontend
- **Error Handling**: Try-catch blocks, error responses

### Performance
- **Database Indexing**: On frequently queried fields
- **Pagination**: For large datasets
- **Lazy Loading**: Components loaded on demand
- **Optimistic Updates**: UI updates before server confirmation

### User Experience
- **Loading States**: Activity indicators
- **Error Messages**: User-friendly error messages
- **Success Feedback**: Toast notifications
- **Smooth Navigation**: Transitions and animations

### Security
- **Password Hashing**: Never store plain passwords
- **Token Expiration**: JWT tokens expire
- **Input Validation**: Server-side validation
- **Rate Limiting**: Prevent abuse

---

## 📝 Additional Notes

### Development Workflow
1. **Feature Development**: Create feature branch
2. **Testing**: Test on web and mobile
3. **Code Review**: Review before merge
4. **Documentation**: Update docs as needed

### Known Limitations
- File uploads stored locally (consider cloud storage for production)
- Real-time features require active connection
- OTP emails depend on SMTP configuration
- AI moderation requires API key

### Future Enhancements
- Cloud storage for media files
- Push notifications for web
- Advanced search with filters
- Analytics dashboard
- Mobile app store deployment

---

## 📞 Support & Contact

For questions or issues, refer to:
- **Server Setup**: `server/ENV_SETUP.md`
- **OTP Setup**: `server/OTP_SETUP.md`
- **Google OAuth**: `server/GOOGLE_OAUTH_BACKEND_SETUP.md`

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-22  
**Project**: GamerHive  
**Author**: Development Team
