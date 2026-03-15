import mongoose from 'mongoose';
import User from './models/User.js';

async function checkDb() {
    try {
        await mongoose.connect('mongodb://localhost:27017/supplychain');
        console.log("Connected to MongoDB");
        const users = await User.find({}).select('+password');
        console.log("Found users (Count: " + users.length + "):");
        users.forEach(u => {
            console.log(`Email: ${u.email}, Role: ${u.role}, isVerified: ${u.isVerified}, isActive: ${u.isActive}, HasPassword: ${!!u.password}`);
        });
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

checkDb();
