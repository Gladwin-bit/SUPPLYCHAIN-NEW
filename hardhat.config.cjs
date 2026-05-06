// hardhat.config.cjs
require("@nomicfoundation/hardhat-toolbox");

// Deployer wallet for testnet deployment
const DEPLOYER_KEY = "0x6db5043466a13c0c279aaa5266b8f96e33c643d3200393aa8d564999e0f3dfc3";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      blockGasLimit: 100_000_000,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://localhost:8545",
    },
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [DEPLOYER_KEY],
      chainId: 11155111,
    },
    amoy: {
      url: "https://polygon-amoy.g.alchemy.com/v2/p87uDWYxVMHMteq3SARLY",
      accounts: [DEPLOYER_KEY],
      chainId: 80002,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
