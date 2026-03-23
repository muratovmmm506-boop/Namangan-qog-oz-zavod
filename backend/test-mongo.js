const mongoose = require('mongoose');
const MONGO_URI = "mongodb+srv://muratovmuhammadsodiq506_db_user:zgiFgGwDCoFE1Phq@cluster0.rixnwlz.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection error:', err);
    process.exit(1);
  });
