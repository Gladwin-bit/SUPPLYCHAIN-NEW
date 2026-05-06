// Test hasRole function specifically
const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing hasRole function...");

    // Get the contract
    const contractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    const contract = SupplyChain.attach(contractAddress);

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Testing with account:", signer.address);

    try {
        // Test hasRole function
        const MANUFACTURER_ROLE = await contract.MANUFACTURER_ROLE();
        console.log("MANUFACTURER_ROLE:", MANUFACTURER_ROLE);

        const hasRole = await contract.hasRole(MANUFACTURER_ROLE, signer.address);
        console.log("Has MANUFACTURER_ROLE:", hasRole);

        console.log("✅ hasRole function working correctly!");

    } catch (error) {
        console.error("❌ hasRole test failed:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});