# GamerHive Backend Server

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the server directory with the following variables:
```
PORT=3000
NODE_ENV=development

URL=mongodb://localhost:27017/gamerhive
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gamerhive?retryWrites=true&w=majority

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
```

3. Start the server:
```bash
npm run dev
```

## API Endpoints

### POST /api/auth/signup
Sign up a new user.

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Passwords do not match"
}
```

## Technologies Used
- Express.js
- MongoDB with Mongoose
- bcrypt for password hashing
- JWT for authentication
- Passport.js (for future authentication strategies)
- CORS for cross-origin requests
- dotenv for environment variables

