// src/utils/blockchain.js
// READ-ONLY blockchain interaction for the Customer app
// No wallet needed - just reads data from the deployed contract
import { ethers } from 'ethers';
import { parseFormattedId } from './idConversion';
import SupplyChainArtifact from '../SupplyChain.json';

const ABI = SupplyChainArtifact.abi;

// State enum mapping (mirrors Solidity State enum)
export const PRODUCT_STATES = {
  0: 'Created',
  1: 'Verified',
  2: 'In Transit',
  3: 'At Shop',
  4: 'Sold',
  5: 'In Transit (P2P)',
};

// Create a read-only provider instance
let _provider = null;
let _contract = null;

const getRpcUrl = () => {
  return process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL || 'http://localhost:8545';
};

const getContractAddress = () => {
  return process.env.EXPO_PUBLIC_CONTRACT_ADDRESS || '';
};

export const getReadOnlyContract = () => {
  const rpcUrl = getRpcUrl();
  const contractAddress = getContractAddress();

  if (!contractAddress) {
    throw new Error('Contract address not configured. Check your .env file.');
  }

  if (!_contract) {
    _provider = new ethers.JsonRpcProvider(rpcUrl);
    _contract = new ethers.Contract(contractAddress, ABI, _provider);
  }
  return _contract;
};

// Reset cached contract (useful if env changes)
export const resetContract = () => {
  _provider = null;
  _contract = null;
};

/**
 * Fetch product data from blockchain
 * @param {number|string} numericId - The numeric product ID
 * @returns {Promise<object>} Formatted product data
 */
export const getProductData = async (numericId) => {
  const contract = getReadOnlyContract();

  const [product, history] = await Promise.all([
    contract.getProduct(numericId),
    contract.getHistory(numericId).catch(() => []),
  ]);

  if (!product.exists) {
    throw new Error(`Product #${numericId} does not exist on the blockchain`);
  }

  // Format history entries
  const formattedHistory = history.map((entry) => ({
    actor: entry.actor,
    state: PRODUCT_STATES[Number(entry.state)] || 'Unknown',
    timestamp: new Date(Number(entry.timestamp) * 1000).toLocaleString(),
    location: entry.location,
    dateObj: new Date(Number(entry.timestamp) * 1000),
  }));

  // Format customer claim
  const customerClaim = {
    isClaimed: product.customerClaim.isClaimed,
    customerName: product.customerClaim.customerName,
    location: product.customerClaim.location,
    timestamp: product.customerClaim.isClaimed
      ? new Date(Number(product.customerClaim.timestamp) * 1000).toLocaleString()
      : null,
    claimedBy: product.customerClaim.claimedBy,
  };

  return {
    id: Number(product.id),
    name: product.name,
    loomLocation: product.loomLocation,
    weaveDate: product.weaveDate
      ? new Date(Number(product.weaveDate) * 1000).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null,
    currentOwner: product.currentOwner,
    state: PRODUCT_STATES[Number(product.state)] || 'Unknown',
    stateCode: Number(product.state),
    consumerSecretHash: product.consumerSecretHash,
    isConsumed: product.isConsumed,
    exists: product.exists,
    customerClaim,
    productCertificate: product.productCertificate,
    batchId: Number(product.batchId),
    history: formattedHistory,
    verificationHistory: product.verificationHistory?.map(v => ({
      verifier: v.verifier,
      timestamp: new Date(Number(v.timestamp) * 1000).toLocaleString(),
      location: v.location,
      remarks: v.remarks,
    })) || [],
  };
};

/**
 * Smart product lookup - accepts formatted IDs (A1, B2, #3) or numeric
 * @param {string|number} idInput
 * @returns {Promise<object>} Product data with formattedId
 */
export const getProductDataSmart = async (idInput) => {
  const contract = getReadOnlyContract();

  let numericId;
  const inputStr = String(idInput).trim();

  // Parse the formatted ID
  const parsed = parseFormattedId(inputStr);

  switch (parsed.type) {
    case 'single':
    case 'numeric':
      numericId = parsed.numericId;
      break;

    case 'bulk_product': {
      // Need to resolve from batch: get batchId -> productIds -> position
      const batchData = await contract.batches(parsed.batchId);
      if (!batchData.exists) {
        throw new Error(`Batch ${parsed.batchId} not found`);
      }
      // batches() returns a tuple, productIds need separate call
      // For bulk products, use offset formula: batchProduct ID = 1000000 + position
      // (based on smart contract: _bulkProductCounter + 1000000)
      // Better: resolve via getFormattedProductId iteration (expensive) or use API
      // Simplified: direct fetch from contract using batch product index
      numericId = 1000000 + (parsed.batchId - 1) * 1000 + (parsed.productPosition - 1) + 1;
      // Fallback to search approach if needed
      break;
    }

    default:
      // Try as plain numeric
      numericId = parseInt(inputStr, 10);
      if (isNaN(numericId)) {
        throw new Error(`Invalid product ID format: ${idInput}`);
      }
  }

  // Fetch product data
  const productData = await getProductData(numericId);

  // Get formatted ID from contract
  let formattedId;
  try {
    formattedId = await contract.getFormattedProductId(numericId);
  } catch {
    formattedId = `#${numericId}`;
  }

  return {
    ...productData,
    formattedId,
    originalInput: idInput,
  };
};

/**
 * Verify a scratch-off code against the blockchain
 * @param {string|number} productId - Product ID (any format)
 * @param {string} secretCode - The scratch-off code entered by user
 * @returns {Promise<{verified: boolean, product: object, alreadyClaimed: boolean}>}
 */
export const verifyProduct = async (productId, secretCode) => {
  // Get product data (read-only)
  const product = await getProductDataSmart(productId);

  if (!product.exists) {
    throw new Error('Product not found on blockchain');
  }

  // Hash the entered secret code (keccak256) and compare
  const inputHash = ethers.keccak256(ethers.toUtf8Bytes(secretCode));
  const verified = product.consumerSecretHash === inputHash;

  const alreadyClaimed = product.isConsumed || product.customerClaim?.isClaimed;

  return {
    verified,
    alreadyClaimed,
    product,
  };
};
