// Test script for new ID formatting system
const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing New ID System...");

    // Get the contract
    const contractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    const contract = SupplyChain.attach(contractAddress);

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Testing with account:", signer.address);

    try {
        console.log("\n📊 Testing Number to Letters Conversion:");

        // Test the letter conversion function
        const testCases = [1, 2, 3, 26, 27, 28, 52, 53];
        for (const num of testCases) {
            try {
                const result = await contract.numberToLetters(num);
                console.log(`  ${num} → ${result}`);
            } catch (error) {
                console.log(`  ${num} → Error: ${error.message}`);
            }
        }

        console.log("\n📦 Testing Batch ID Formatting:");

        // Test batch ID formatting
        for (const batchId of [1, 2, 3, 26, 27]) {
            try {
                const result = await contract.getFormattedBatchId(batchId);
                console.log(`  Batch ${batchId} → ${result}`);
            } catch (error) {
                console.log(`  Batch ${batchId} → Error: ${error.message}`);
            }
        }

        console.log("\n✅ ID System Test Complete!");

    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});