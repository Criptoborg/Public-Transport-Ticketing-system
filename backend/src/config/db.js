const mongoose = require('mongoose');
const dns = require('node:dns');

const connectDB = async () => {
  try {
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || '')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    if (dnsServers.length) dns.setServers(dnsServers);

    const connection = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
