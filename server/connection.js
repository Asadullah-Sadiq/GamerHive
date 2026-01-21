const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// MongoDB Atlas connection string
const Url =process.env.URL;

if (!Url) {
    console.error("MongoDB connection string is not defined in environment variables!");
    console.error("Please set MONGODB_URI or URL in your .env file");
    process.exit(1);
}

// MongoDB connection options for Atlas
const options = {
    serverSelectionTimeoutMS: 5000, 
    socketTimeoutMS: 45000,
};

mongoose.connect(Url, options)
    .then(() => {
        console.log("MongoDB Atlas connected successfully!");
    })
    .catch((err) => {
        console.error("MongoDB Atlas connection error:", err.message);
        process.exit(1);
    });

const db = mongoose.connection;

db.on("connected", async () => {
    console.log("MongoDB is connected");
    
    // Remove unique index from username field if it exists (one-time migration)
    try {
        const collection = db.collection('users');
        const indexes = await collection.indexes();
        
        const usernameUniqueIndex = indexes.find(idx => 
            idx.key && idx.key.username === 1 && idx.unique === true
        );
        
        if (usernameUniqueIndex) {
            console.log(`Removing unique index on username: ${usernameUniqueIndex.name}`);
            await collection.dropIndex(usernameUniqueIndex.name);
            console.log('✅ Username unique index removed successfully');
        }
    } catch (error) {
        // Don't fail startup if index removal fails, just log it
        console.warn('Warning: Could not remove username unique index:', error.message);
        console.warn('You can manually run: node server/scripts/removeUsernameIndex.js');
    }
});

db.on("error", (err) => {
    console.error("MongoDB connection Error:", err.message);
});

db.on("disconnected", () => {
    console.log("MongoDB is disconnected");
});

// Handle process termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
});

module.exports = db;
