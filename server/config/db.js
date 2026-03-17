const mongoose = require('mongoose');
const dns = require('dns');

// Use Google DNS only in non-serverless environments (local/railway)
// Vercel has its own DNS configuration
const isServerless = process.env.VERCEL === '1' || 
                     process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

if (!isServerless) {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

// Track connection state for serverless
let isConnected = false;

const connectDB = async () => {
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  // If already connected, skip connection attempt (for serverless warm invocations)
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Don't exit in serverless - let the function retry on next invocation
    // In production, consider using a connection pool or Atlas Data API
    throw error;
  }
};

module.exports = connectDB;
