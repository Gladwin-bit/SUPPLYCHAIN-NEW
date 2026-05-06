import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  
  // Try to estimate gas with a fallback
  let gasEstimate = 15000000; // Start with a lower estimate
  
  try {
    const estimation = await hre.ethers.provider.estimateGas({
      to: null,
      data: (await SupplyChain.getDeployTransaction()).data,
    });
    gasEstimate = Math.min(estimation + 500000n, 15000000n);
  } catch (e) {
    console.log("Gas estimation failed, using default:", gasEstimate);
  }
  
  const sc = await SupplyChain.deploy({
    gasLimit: gasEstimate,
  });
  await sc.waitForDeployment();

  const address = await sc.getAddress();
  console.log("SupplyChain deployed to:", address);

  // Save to frontend to avoid manual copy-paste errors
  const addressPath = path.join(process.cwd(), "frontend", "src", "contract-address.json");
  fs.writeFileSync(addressPath, JSON.stringify({ address }, null, 2));
  console.log("Address saved to:", addressPath);

  // Save to customer-app
  const customerAddressPath = path.join(process.cwd(), "customer-app", "src", "contract-address.json");
  if (fs.existsSync(path.dirname(customerAddressPath))) {
    fs.writeFileSync(customerAddressPath, JSON.stringify({ address }, null, 2));
    console.log("Address saved to customer-app:", customerAddressPath);
  }

  // Also copy the ABI so the frontend always matches the deployed contract
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "SupplyChain.sol", "SupplyChain.json");
  const abiDestPath = path.join(process.cwd(), "frontend", "src", "SupplyChain.json");
  fs.copyFileSync(artifactPath, abiDestPath);
  console.log("ABI copied to frontend:", abiDestPath);

  // Copy ABI to customer-app
  const customerAbiDestPath = path.join(process.cwd(), "customer-app", "src", "SupplyChain.json");
  if (fs.existsSync(path.dirname(customerAbiDestPath))) {
    fs.copyFileSync(artifactPath, customerAbiDestPath);
    console.log("ABI copied to customer-app:", customerAbiDestPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
