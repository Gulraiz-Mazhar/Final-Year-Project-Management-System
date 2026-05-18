const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in the environment variables.');
    }
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log(`✅ Database connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    if (err.message.includes('SSL alert number 80')) {
      console.error('💡 IP connection blocked. Verify MongoDB Atlas Network Access configuration.');
    }
    process.exit(1);
  }
};

module.exports = connectDB;