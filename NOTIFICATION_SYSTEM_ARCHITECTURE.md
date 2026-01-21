# Real-Time Notification System Architecture

## Overview

Complete real-time notification system for GamerHive social & community-based application using Socket.IO, MongoDB, React, and React Native.

## MongoDB Schema

### Notification Model

```javascript
{
  senderId: ObjectId (ref: User, required),
  receiverId: ObjectId (ref: User, nullable, indexed),
  targetGroupId: ObjectId (ref: Community, nullable, indexed),
  type: ENUM [
    'post_like',
    'post_comment',
    'community_message',
    'direct_message',
    'game_added',
    'admin_community',
    'admin_tournament',
    'admin_game',
    'friend_request',
    'friend_request_accepted',
    'tournament',
    'system',
    'achievement',
    'feedback_reply'
  ],
  title: String (required),
  message: String (required),
  payload: Mixed (postId, messageId, gameId, etc.),
  isRead: Boolean (default: false, indexed),
  readAt: Date (nullable),
  createdAt: Date (indexed)
}
```

### Indexes

- `{ receiverId: 1, isRead: 1, createdAt: -1 }`
- `{ targetGroupId: 1, isRead: 1, createdAt: -1 }`
- `{ receiverId: 1, type: 1, createdAt: -1 }`
- `{ senderId: 1, receiverId: 1, type: 1, 'payload.postId': 1 }` (sparse, prevents duplicates)

## Backend Architecture

### Centralized Notification Service (`server/utils/notificationService.js`)

**Key Functions:**

1. **User Socket Management**
   - `registerUserSocket(userId, socketId)` - Track online users
   - `unregisterUserSocket(userId, socketId)` - Clean up on disconnect
   - `isUserOnline(userId)` - Check online status
   - `getUserSockets(userId)` - Get all sockets for a user

2. **Notification Creation & Delivery**
   - `createNotification(data)` - Create and persist notification
   - `deliverNotification(notification)` - Emit via Socket.IO
   - `syncNotificationsOnReconnect(userId, socketId)` - Sync missed notifications

3. **Use Case Handlers**
   - `notifyPostLike(postOwnerId, likerId, postId)`
   - `notifyPostComment(postOwnerId, commenterId, postId, commentText)`
   - `notifyCommunityMessage(communityId, senderId, messageId, messageContent)`
   - `notifyDirectMessage(receiverId, senderId, messageId, messageContent)`
   - `notifyGameAdded(gameOwnerId, gameId, gameTitle)`
   - `notifyAdminBroadcast(adminId, type, title, message, payload)`

### Socket.IO Integration

**Events Emitted:**
- `notification:new` - New notification (to receiver or community room)
- `notification:sync` - Batch sync on reconnect

**Room Management:**
- Users join `community:{communityId}` rooms for group notifications
- Direct notifications sent to user's socket IDs

### REST API Endpoints

**GET `/api/notification`**
- Query params: `userId`, `all` (optional)
- Returns: Notifications where user is receiver OR in targetGroupId communities
- Response includes unread count

**PATCH `/api/notification/read`**
- Body: `{ notificationId }`
- Marks single notification as read

**PUT `/api/notification/read-all`**
- Body: `{ userId }`
- Marks all user notifications as read

**DELETE `/api/notification/:id`**
- Deletes notification by ID

## Frontend Integration

### React Web (`web/src/`)

**Socket Service Updates:**
- Added `onNotification` and `onNotificationSync` handlers
- Notification types defined in `SocketEventHandlers`

**Usage Example:**
```typescript
import { socketService } from './utils/socketService';

socketService.setEventHandlers({
  onNotification: (notification) => {
    // Show toast notification
    // Update notification badge
    // Play sound
  },
  onNotificationSync: (data) => {
    // Handle batch sync on reconnect
  }
});
```

### React Native (`mobile/src/`)

**Socket Service Updates:**
- Same notification handlers as web
- Additional FCM integration ready (push tokens stored in User model)

**Usage Example:**
```typescript
import { socketService } from './utils/socketService';

socketService.setEventHandlers({
  onNotification: (notification) => {
    // Show in-app banner
    // Update badge count
    // Trigger FCM push (if app in background)
  }
});
```

## Notification Use Cases

### 1. Post Activity
- **Like**: `notifyPostLike()` → Notifies post owner
- **Comment**: `notifyPostComment()` → Notifies post owner
- **Duplicate Prevention**: Checks for existing unread notification within 60 seconds

### 2. Community Messages
- **Trigger**: When message sent in community chat
- **Recipients**: All community members except sender
- **Delivery**: Via Socket.IO room `community:{communityId}`
- **Integration**: Automatic in `socketHandler.js` `send_message` event

### 3. P2P Messaging
- **Trigger**: When direct message sent
- **Recipients**: Receiver only
- **Delivery**: Direct to receiver's socket IDs
- **Integration**: Automatic in `socketHandler.js` `send_direct_message` event

### 4. Game Borrow Page
- **Trigger**: When user adds new game
- **Recipients**: 
  - All friends
  - Other users (excluding owner)
- **Duplicate Prevention**: Checks for existing notification within 60 seconds
- **Integration**: `gameController.js` `addGame()` function

### 5. Admin Broadcast
- **Trigger**: When admin creates community/tournament/game
- **Recipients**: All active users
- **Types**: `admin_community`, `admin_tournament`, `admin_game`
- **Integration**: 
  - `communityController.js` `createCommunity()`
  - `tournamentController.js` `createTournament()`
  - `gameController.js` `addGame()` (if admin)

## Best Practices Implemented

✅ **SOLID Principles**
- Single Responsibility: NotificationService handles only notifications
- Open/Closed: Easy to add new notification types
- Dependency Inversion: Controllers depend on service abstraction

✅ **Clean Architecture**
- Business logic in service layer
- Controllers only orchestrate
- No business logic in routes

✅ **No Hard-coded Strings**
- All notification types in ENUM
- Constants for admin email

✅ **Typed Payload Contracts**
- Consistent payload structure per notification type
- TypeScript interfaces on frontend

✅ **No Duplicate Socket Emissions**
- Duplicate prevention logic
- User-socket mapping prevents multiple emissions

✅ **Graceful Reconnect Handling**
- `syncNotificationsOnReconnect()` syncs missed notifications
- Automatic reconnection with exponential backoff

✅ **Memory-safe Socket Cleanup**
- Proper unregister on disconnect
- Event listener cleanup

✅ **Zero Runtime Errors**
- Comprehensive try/catch blocks
- Error logging without breaking flow
- Non-blocking notification creation

## Example Notification Payloads

### Post Like
```json
{
  "senderId": "user123",
  "receiverId": "user456",
  "type": "post_like",
  "title": "New Like",
  "message": "john_doe liked your post",
  "payload": { "postId": "post789" }
}
```

### Community Message
```json
{
  "senderId": "user123",
  "targetGroupId": "community456",
  "type": "community_message",
  "title": "New message in PUBG Community",
  "message": "john_doe: Hey everyone!",
  "payload": {
    "communityId": "community456",
    "messageId": "msg789",
    "messageContent": "Hey everyone!"
  }
}
```

### Admin Broadcast
```json
{
  "senderId": "admin123",
  "receiverId": "user456",
  "type": "admin_tournament",
  "title": "New Tournament Created",
  "message": "Admin created a new tournament: Summer Championship",
  "payload": {
    "tournamentId": "tournament789",
    "tournamentName": "Summer Championship"
  }
}
```

## Performance Considerations

- **Indexes**: Optimized queries with compound indexes
- **Pagination**: GET endpoint limits to 100 most recent
- **Non-blocking**: Notification creation doesn't block main request flow
- **Batch Operations**: Admin broadcasts use `Promise.allSettled()`
- **Memory Management**: User-socket map cleaned on disconnect

## Future Enhancements

- Redis for user-socket mapping (scalability)
- Notification preferences per user
- Notification grouping (e.g., "5 new likes")
- Push notification queue (Bull/BullMQ)
- Notification analytics
