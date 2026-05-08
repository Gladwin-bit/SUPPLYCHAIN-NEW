// backend/services/blockchainRelayer.js
// Backend wallet relay service — signs claimOwnership() on behalf of customers
// The backend wallet pays gas; customer name is recorded on-chain

import { ethers } from 'ethers';

// Load ABI — only the function we need
const CLAIM_ABI = [
  'function claimOwnership(uint256 _id, string memory _scratchCode, string memory _customerName, string memory _location) external',
  'function getProduct(uint256 _id) external view returns (tuple(uint256 id, string name, string loomLocation, uint256 weaveDate, address currentOwner, uint8 state, bytes32 consumerSecretHash, bytes32 currentHandoverHash, bool isConsumed, bool exists, tuple(address verifier, uint256 timestamp, string location, string remarks)[] verificationHistory, tuple(string customerName, string location, uint256 timestamp, address claimedBy, bool isClaimed) customerClaim, string productCertificate, uint256 batchId))',
];

let _provider = null;
let _wallet = null;
let _contract = null;

/**
 * Initialize the relayer wallet and contract instance.
 * Called lazily on first use.
 */
function getRelayer() {
  if (_contract) return _contract;

  const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL;
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!privateKey) {
    throw new Error('RELAYER_PRIVATE_KEY is not set in backend .env');
  }
  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS is not set in backend .env');
  }
  if (!rpcUrl) {
    throw new Error('ALCHEMY_RPC_URL is not set in backend .env');
  }

  _provider = new ethers.JsonRpcProvider(rpcUrl);
  _wallet = new ethers.Wallet(privateKey, _provider);
  _contract = new ethers.Contract(contractAddress, CLAIM_ABI, _wallet);

  console.log(`✅ Blockchain relayer ready. Wallet: ${_wallet.address}`);
  return _contract;
}

const STATE_LABELS = ['Created', 'InTransit', 'InTransit', 'InTransit', 'InTransit'];

function deriveStateLabel(product) {
  const claimed = Boolean(product?.isConsumed || product?.customerClaim?.isClaimed);
  if (claimed) return 'Sold';
  return STATE_LABELS[Number(product?.state)] || 'InTransit';
}

/**
 * Read full product data from the blockchain (read-only, no gas).
 * Returns everything the mobile app needs for display + verification.
 * @param {number} productId
 * @returns Full product object
 */
export async function readProductStatus(productId) {
  const contract = getRelayer();
  const product = await contract.getProduct(productId);

  if (!product.exists) {
    return { exists: false };
  }

  // Format verification history
  const stateLabel = deriveStateLabel(product);
  const history = (product.verificationHistory || []).map((entry) => ({
    verifier: entry.verifier,
    timestamp: new Date(Number(entry.timestamp) * 1000).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    }),
    location: entry.location,
    remarks: entry.remarks,
    state: stateLabel,
  }));

  return {
    exists: true,
    id: Number(product.id),
    formattedId: `KS-${String(Number(product.id)).padStart(6, '0')}`,
    name: product.name,
    loomLocation: product.loomLocation,
    weaveDate: product.weaveDate
      ? new Date(Number(product.weaveDate) * 1000).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      : '—',
    currentOwner: product.currentOwner,
    state: stateLabel,
    isConsumed: product.isConsumed,
    consumerSecretHash: product.consumerSecretHash,
    productCertificate: product.productCertificate || '',
    batchId: Number(product.batchId),
    history,
    customerClaim: {
      isClaimed: product.customerClaim.isClaimed,
      customerName: product.customerClaim.customerName || '',
      location: product.customerClaim.location || '',
      claimedBy: product.customerClaim.claimedBy || '',
      timestamp: product.customerClaim.timestamp
        ? new Date(Number(product.customerClaim.timestamp) * 1000).toLocaleDateString('en-IN')
        : '',
    },
  };
}

/**
 * Submit claimOwnership() transaction via backend relayer wallet.
 * @param {number} productId - numeric product ID
 * @param {string} scratchCode - plaintext scratch-off code (contract hashes it internally)
 * @param {string} customerName - name to record on blockchain
 * @param {string} location - customer location
 * @returns {{ txHash: string, explorerUrl: string }}
 */
export async function relayClaimOwnership(productId, scratchCode, customerName, location) {
  const contract = getRelayer();

  console.log(`📡 Relayer submitting claimOwnership for product #${productId} by "${customerName}"`);

  // Estimate gas first to catch revert errors before spending gas
  try {
    await contract.claimOwnership.estimateGas(
      productId,
      scratchCode,
      customerName,
      location || 'Not specified'
    );
  } catch (estimateErr) {
    // Parse common revert reasons
    const msg = estimateErr.message || '';
    if (msg.includes('Invalid scratch-off code')) {
      throw new Error('Invalid scratch-off code. Please check and try again.');
    }
    if (msg.includes('Already claimed')) {
      throw new Error('This product has already been claimed.');
    }
    throw new Error(`Transaction would fail: ${msg}`);
  }

  // Submit the actual transaction
  const tx = await contract.claimOwnership(
    productId,
    scratchCode,
    customerName,
    location || 'Not specified',
    {
      gasLimit: 300000, // Safe upper bound for this function
    }
  );

  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  // Wait for 1 confirmation
  const receipt = await tx.wait(1);

  const explorerUrl = `https://sepolia.etherscan.io/tx/${receipt.hash}`;
  console.log(`✅ Confirmed: ${explorerUrl}`);

  return {
    txHash: receipt.hash,
    explorerUrl,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed?.toString(),
  };
}

/**
 * Get the relayer wallet's current balance (for health checks)
 */
export async function getRelayerBalance() {
  const contract = getRelayer(); // ensures _provider and _wallet are initialized
  const balance = await _provider.getBalance(_wallet.address);
  return {
    address: _wallet.address,
    balanceWei: balance.toString(),
    balanceEth: ethers.formatEther(balance),
  };
}
