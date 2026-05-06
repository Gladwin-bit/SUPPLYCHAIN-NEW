import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const userAddress = process.env.TARGET || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  // Raise the Hardhat node's per-tx gas cap
  await hre.network.provider.send("evm_setBlockGasLimit", ["0x5F5E100"]); // 100M

  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const sc = await SupplyChain.deploy({ gasLimit: 10_000_000 });
  await sc.waitForDeployment();

  const address = await sc.getAddress();
  console.log("SupplyChain deployed to:", address);

  // Save to frontend
  const addressPath = path.join(process.cwd(), "frontend", "src", "contract-address.json");
  fs.writeFileSync(addressPath, JSON.stringify({ address }, null, 2));
  console.log("Address saved to:", addressPath);

  // Save to customer-app
  const customerAddressPath = path.join(process.cwd(), "customer-app", "src", "contract-address.json");
  if (fs.existsSync(path.dirname(customerAddressPath))) {
    fs.writeFileSync(customerAddressPath, JSON.stringify({ address }, null, 2));
    console.log("Address saved to customer-app:", customerAddressPath);
  }

  // copy ABI
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "SupplyChain.sol", "SupplyChain.json");
  const abiDestPath = path.join(process.cwd(), "frontend", "src", "SupplyChain.json");
  fs.copyFileSync(artifactPath, abiDestPath);
  console.log("ABI copied to:", abiDestPath);

  // Copy ABI to customer-app
  const customerAbiDestPath = path.join(process.cwd(), "customer-app", "src", "SupplyChain.json");
  if (fs.existsSync(path.dirname(customerAbiDestPath))) {
    fs.copyFileSync(artifactPath, customerAbiDestPath);
    console.log("ABI copied to customer-app:", customerAbiDestPath);
  }

  // Grant MANUFACTURER_ROLE to userAddress
  const MANUFACTURER_ROLE = await sc.MANUFACTURER_ROLE();
  console.log(`Granting MANUFACTURER_ROLE to ${userAddress}...`);
  const tx = await sc.grantRole(MANUFACTURER_ROLE, userAddress);
  await tx.wait();
  console.log("Role granted successfully!");

  const hasRole = await sc.hasRole(MANUFACTURER_ROLE, userAddress);
  console.log(`Has Role: ${hasRole}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
