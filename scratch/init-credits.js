const mongoose = require('mongoose');
const User = require('../backend/src/models/User');
require('dotenv').config({ path: './backend/.env' });

async function initCredits() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-marketing');
    const result = await User.updateMany({ credits: { $exists: false } }, { $set: { credits: 5 } });
    console.log(`Updated ${result.modifiedCount} users with 5 credits.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

initCredits();
