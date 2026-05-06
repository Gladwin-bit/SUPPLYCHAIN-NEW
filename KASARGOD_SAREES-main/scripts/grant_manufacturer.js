import hre from "hardhat";
import fs from "fs";

async function main() {
    // Use deployed contract address from frontend build
    const contractAddress = JSON.parse(fs.readFileSync('frontend/src/contract-address.json', 'utf8')).address;
    // Replace with your wallet address (the UI shows 0xf39F...2266). Update if different.
    const userAddress = process.env.TARGET || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const Contract = await hre.ethers.getContractFactory("SupplyChain");
    const contract = await Contract.attach(contractAddress);

    // Get the MANUFACTURER_ROLE hash
    const MANUFACTURER_ROLE = await contract.MANUFACTURER_ROLE();

    console.log(`Granting MANUFACTURER_ROLE to ${userAddress}...`);

    // The deployer (Account #0) usually has the DEFAULT_ADMIN_ROLE and can grant roles
    const tx = await contract.grantRole(MANUFACTURER_ROLE, userAddress, { gasLimit: 500000 });
    await tx.wait();

    console.log("Role granted successfully!");

    // Verify
    const hasRole = await contract.hasRole(MANUFACTURER_ROLE, userAddress);
    console.log(`Has Role: ${hasRole}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
