// Quick deploy script that runs in-process then sends to localhost
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function main() {
  const userAddress = process.env.TARGET || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  // Connect to local node's JSON-RPC
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  
  // Use Account #0 (Hardhat default)
  const signer = await provider.getSigner(0);
  console.log("Deploying from:", await signer.getAddress());

  // Read contract artifact
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "SupplyChain.sol", "SupplyChain.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  
  // Deploy with ContractFactory - let the node decide gas
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  
  console.log("Deploying SupplyChain (this may take a moment)...");
  const sc = await factory.deploy();
  await sc.waitForDeployment();

  const address = await sc.getAddress();
  console.log("SupplyChain deployed to:", address);

  // Save to frontend
  const addressPath = path.join(process.cwd(), "frontend", "src", "contract-address.json");
  fs.writeFileSync(addressPath, JSON.stringify({ address }, null, 2));
  console.log("Address saved to:", addressPath);

  // Copy ABI
  const abiDestPath = path.join(process.cwd(), "frontend", "src", "SupplyChain.json");
  fs.copyFileSync(artifactPath, abiDestPath);
  console.log("ABI copied to:", abiDestPath);

  // Grant MANUFACTURER_ROLE
  const contract = new ethers.Contract(address, artifact.abi, signer);
  const MANUFACTURER_ROLE = await contract.MANUFACTURER_ROLE();
  console.log(`Granting MANUFACTURER_ROLE to ${userAddress}...`);
  const tx = await contract.grantRole(MANUFACTURER_ROLE, userAddress);
  await tx.wait();
  console.log("Role granted successfully!");

  const hasRole = await contract.hasRole(MANUFACTURER_ROLE, userAddress);
  console.log(`Has Role: ${hasRole}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
