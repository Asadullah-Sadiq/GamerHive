# Troubleshooting Guide

## Network Request Failed Error

If you're getting "Network request failed" error, follow these steps:

### 1. Check if Server is Running
```bash
cd server
npm start
# or
npm run dev
```

You should see:
```
Server is running on port 5000
MongoDB is connected
```

### 2. Check MongoDB Connection
Make sure MongoDB is running:
- **Local MongoDB**: Start MongoDB service
- **MongoDB Atlas**: Check connection string in `.env` file

### 3. Fix API URL for Mobile App

#### For Android Emulator:
The URL `http://10.0.2.2:5000/api` should work automatically.

#### For Physical Android Device:
1. Find your computer's IP address:
   - Windows: Open CMD and type `ipconfig`
   - Mac/Linux: Open Terminal and type `ifconfig` or `ip addr`
   - Look for IPv4 address (e.g., `192.168.1.100`)

2. Update `mobile/src/components/AuthPage.tsx`:
```typescript
const API_BASE_URL = __DEV__ 
  ? Platform.OS === 'android' 
    ? "http://192.168.1.100:5000/api"  // Replace with your IP
    : "http://localhost:5000/api"
  : "https://your-production-api.com/api";
```

3. Make sure your phone and computer are on the same WiFi network

#### For iOS Simulator:
`http://localhost:5000/api` should work automatically.

#### For Physical iOS Device:
Same as Android - use your computer's IP address.

### 4. Test Server Connection

Test if server is accessible:
```bash
# From terminal
curl http://localhost:5000/api/health

# Should return:
# {"success":true,"message":"Server is running",...}
```

### 5. Check Firewall
Make sure your firewall allows connections on port 5000.

### 6. Check .env File
Make sure `.env` file exists in `server/` folder with:
```
PORT=5000
URL=mongodb://localhost:27017/gamerhive
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gamerhive
JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d
```

## Common Issues

### Issue: "MongoDB connection Error!"
**Solution**: 
- Check if MongoDB is running
- Verify connection string in `.env`
- For MongoDB Atlas, check network access settings

### Issue: "User with this email already exists"
**Solution**: This is normal - the user already exists. Try with a different email.

### Issue: Database not saving
**Solution**:
- Check MongoDB connection logs
- Verify database name in connection string
- Check server console for errors

## Testing

1. Start server: `cd server && npm start`
2. Check health endpoint: `http://localhost:5000/api/health`
3. Try signup from mobile app
4. Check server console for logs
5. Check MongoDB to verify user was saved

