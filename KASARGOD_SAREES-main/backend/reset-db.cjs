// backend/reset-db.cjs
// Drops products and users collections from the supplychain MongoDB database.
const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://localhost:27017/supplychain";

async function resetDB() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    const toDelete = ["products", "users", "batches"];

    for (const name of toDelete) {
        const exists = collections.find((c) => c.name === name);
        if (exists) {
            await db.collection(name).drop();
            console.log(`✅ Dropped collection: ${name}`);
        } else {
            console.log(`⚠️  Collection '${name}' does not exist — skipping.`);
        }
    }

    await mongoose.disconnect();
    console.log("\n🎉 MongoDB reset complete. Database is clean.");
}

resetDB().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
