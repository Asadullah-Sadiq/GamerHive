/**
 * Script to remove unique index from username field in users collection
 * Run this once to fix the database index issue
 * 
 * Usage: node server/scripts/removeUsernameIndex.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const Url = process.env.URL;

if (!Url) {
  console.error("MongoDB connection string is not defined!");
  process.exit(1);
}

async function removeUsernameIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(Url);
    console.log("Connected to MongoDB");

    // Get the collection
    const collection = mongoose.connection.collection('users');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:", indexes.map(idx => idx.name));

    // Find and drop the unique username index
    const usernameIndex = indexes.find(idx => 
      idx.key && idx.key.username === 1 && idx.unique === true
    );

    if (usernameIndex) {
      console.log(`Found unique username index: ${usernameIndex.name}`);
      await collection.dropIndex(usernameIndex.name);
      console.log(`Successfully dropped index: ${usernameIndex.name}`);
    } else {
      console.log("No unique username index found. Index may have already been removed.");
    }

    // Verify indexes after removal
    const updatedIndexes = await collection.indexes();
    console.log("Updated indexes:", updatedIndexes.map(idx => idx.name));

    console.log("✅ Username unique index removal completed!");
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error removing index:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

removeUsernameIndex();

