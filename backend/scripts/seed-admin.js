require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');

const seedAdmin = async () => {
  const { MONGO_URI, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI || !SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error('MONGO_URI, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD are required');
  }
  if (SEED_ADMIN_PASSWORD.length < 16 || !/[a-z]/.test(SEED_ADMIN_PASSWORD) || !/[A-Z]/.test(SEED_ADMIN_PASSWORD) || !/\d/.test(SEED_ADMIN_PASSWORD) || !/[^A-Za-z0-9]/.test(SEED_ADMIN_PASSWORD)) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 16 characters and include lower/uppercase letters, a number, and a symbol');
  }

  await mongoose.connect(MONGO_URI);
  try {
    const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
    const existing = await User.findOne({ email }).select('role');
    if (existing && existing.role !== 'admin') throw new Error('Refusing to promote an existing non-admin account');
    if (existing) {
      console.log(`Admin account already exists for ${email}; no changes made`);
    } else {
      const password = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
      await User.create({ name: SEED_ADMIN_NAME.trim(), email, password, role: 'admin' });
      console.log(`Admin account provisioned for ${email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin().catch((error) => {
  console.error(`Admin seed failed: ${error.message}`);
  process.exitCode = 1;
});