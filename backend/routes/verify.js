// backend/routes/verify.js
// Customer product verification + claiming routes
// Method B: Backend relayer signs claimOwnership() on behalf of customer

import express from 'express';
import { ethers } from 'ethers';
import {
  readProductStatus,
  relayClaimOwnership,
  getRelayerBalance,
} from '../services/blockchainRelayer.js';

const router = express.Router();

// ── Middleware: optional auth (extracts user from JWT if present) ──────────────
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
      const User = (await import('../models/User.js')).default;
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch {
    // Not logged in — that's OK for read-only verify
  }
  next();
}

// ── Middleware: require auth (for write operations) ───────────────────────────
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
    const User = (await import('../models/User.js')).default;
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/verify/check
 * @desc    Read-only: verify scratch code + return full product data
 *          Mobile app calls this instead of talking to blockchain directly.
 *          No wallet, no gas, no ethers on the phone.
 * @access  Public
 * Body: { productId, secretCode }
 */
router.post('/check', optionalAuth, async (req, res) => {
  try {
    const { productId, secretCode } = req.body;

    if (!productId || !secretCode) {
      return res.status(400).json({
        success: false,
        message: 'productId and secretCode are required',
      });
    }

    const numericId = parseInt(productId);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Get full product data from blockchain
    const product = await readProductStatus(numericId);

    if (!product.exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found on blockchain',
      });
    }

    // Hash the secret code and compare with on-chain hash
    const inputHash = ethers.keccak256(ethers.toUtf8Bytes(secretCode));
    const verified = product.consumerSecretHash === inputHash;

    // Optional sync only when the scratch code is valid for this product.
    // Prevents fake-code lookups from attaching other customers' claims to the current user.
    if (verified && (product.customerClaim?.isClaimed || product.isConsumed) && req.user?._id) {
      try {
        const claimName = String(product.customerClaim?.customerName || '').trim().toLowerCase();
        const claimWallet = String(product.customerClaim?.claimedBy || '').trim().toLowerCase();
        const currentName = String(req.user?.name || '').trim().toLowerCase();
        const currentWallet = String(req.user?.walletAddress || '').trim().toLowerCase();
        const isOwnerMatch =
          (claimName && currentName && claimName === currentName) ||
          (claimWallet && currentWallet && claimWallet === currentWallet);

        if (!isOwnerMatch) {
          // Do not link claim metadata to a different user account.
          const { consumerSecretHash, ...productData } = product;
          return res.json({
            success: true,
            verified,
            alreadyClaimed: product.customerClaim.isClaimed || product.isConsumed,
            product: productData,
          });
        }

        const Product = (await import('../models/Product.js')).default;
        await Product.findOneAndUpdate(
          { productId: numericId },
          {
            $set: {
              'customerClaim.isClaimed': true,
              'customerClaim.customerName': product.customerClaim?.customerName || '',
              'customerClaim.claimedBy': String(product.customerClaim?.claimedBy || '').toLowerCase(),
              'customerClaim.claimLocation': product.customerClaim?.location || 'Not specified',
              'customerClaim.claimedAt': product.customerClaim?.timestamp ? new Date(product.customerClaim.timestamp) : null,
              'customerClaim.customerUser': req.user._id,
            },
          },
          { new: false }
        );
      } catch (syncErr) {
        console.warn('Verify check metadata sync failed:', syncErr.message);
      }
    }

    // Don't send consumerSecretHash to client
    const { consumerSecretHash, ...productData } = product;

    return res.json({
      success: true,
      verified,
      alreadyClaimed: product.customerClaim.isClaimed || product.isConsumed,
      product: productData,   // Full product object for display
    });
  } catch (err) {
    console.error('Verify check error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Verification failed',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/verify/trace/:productId
 * @desc    Public trace endpoint: returns full product journey by product ID
 * @access  Public
 */
router.get('/trace/:productId', async (req, res) => {
  try {
    const raw = String(req.params.productId || '').trim();
    let numericId = NaN;

    if (raw.toUpperCase().startsWith('KS-')) numericId = parseInt(raw.slice(3), 10);
    else if (raw.startsWith('#')) numericId = parseInt(raw.slice(1), 10);
    else numericId = parseInt(raw, 10);

    if (isNaN(numericId) || numericId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await readProductStatus(numericId);
    if (!product?.exists) {
      return res.status(404).json({ success: false, message: 'Product not found on blockchain' });
    }

    const { consumerSecretHash, ...productData } = product;
    return res.json({
      success: true,
      alreadyClaimed: product.customerClaim?.isClaimed || product.isConsumed || false,
      product: productData,
    });
  } catch (err) {
    console.error('Trace product error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to trace product' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/verify/sync-claim
 * @desc    Sync on-chain claim metadata into Mongo (for MetaMask claims)
 * @access  Private
 * Body: { productId }
 */
router.post('/sync-claim', requireAuth, async (req, res) => {
  try {
    const numericId = parseInt(req.body?.productId, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const status = await readProductStatus(numericId);
    if (!status?.exists) {
      return res.status(404).json({ success: false, message: 'Product not found on blockchain' });
    }
    if (!status?.customerClaim?.isClaimed) {
      return res.status(409).json({ success: false, message: 'Product is not claimed yet' });
    }

    const Product = (await import('../models/Product.js')).default;
    await Product.findOneAndUpdate(
      { productId: numericId },
      {
        $set: {
          'customerClaim.isClaimed': true,
          'customerClaim.customerName': status.customerClaim?.customerName || '',
          'customerClaim.claimedBy': String(status.customerClaim?.claimedBy || '').toLowerCase(),
          'customerClaim.claimLocation': status.customerClaim?.location || 'Not specified',
          'customerClaim.claimedAt': status.customerClaim?.timestamp ? new Date(status.customerClaim.timestamp) : new Date(),
          'customerClaim.customerUser': req.user?._id || null,
        },
      },
      { new: false }
    );

    return res.json({
      success: true,
      message: 'Claim metadata synced',
      claim: {
        ownerName: status.customerClaim?.customerName || '',
        location: status.customerClaim?.location || 'Not specified',
        claimedAt: status.customerClaim?.timestamp || '',
      },
    });
  } catch (err) {
    console.error('Sync claim error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to sync claim metadata' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/verify/claim
 * @desc    Backend relayer calls claimOwnership() on behalf of the customer
 * @access  Private (requires JWT login)
 * Body: { productId, secretCode, location? }
 */
router.post('/claim', requireAuth, async (req, res) => {
  try {
    const { productId, secretCode, location } = req.body;
    const customerName = req.user.name; // Use the authenticated user's name

    if (!productId || !secretCode) {
      return res.status(400).json({
        success: false,
        message: 'productId and secretCode are required',
      });
    }

    const numericId = parseInt(productId);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Step 1: Read-only pre-check (saves gas if already claimed)
    const status = await readProductStatus(numericId);

    if (!status.exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found on blockchain',
      });
    }

    if (status.isConsumed || status.isClaimed) {
      return res.status(409).json({
        success: false,
        message: `This product has already been claimed by "${status.customerName || 'another customer'}"`,
        alreadyClaimed: true,
      });
    }

    // Step 2: Verify the scratch code (same hash check)
    const inputHash = ethers.keccak256(ethers.toUtf8Bytes(secretCode));
    if (status.consumerSecretHash !== inputHash) {
      return res.status(403).json({
        success: false,
        message: 'Invalid scratch-off code. Cannot claim this product.',
      });
    }

    // Step 3: Submit transaction via relayer
    console.log(`🔐 Customer "${customerName}" claiming product #${numericId}`);
    const result = await relayClaimOwnership(
      numericId,
      secretCode,
      customerName,
      location || 'Not specified'
    );

    // Step 4: Persist claim metadata in MongoDB for fast "My Products" lookups.
    try {
      const Product = (await import('../models/Product.js')).default;
      await Product.findOneAndUpdate(
        { productId: numericId },
        {
          $set: {
            'customerClaim.isClaimed': true,
            'customerClaim.customerName': customerName,
            'customerClaim.claimedBy': req.user?.walletAddress || '',
            'customerClaim.claimLocation': location || 'Not specified',
            'customerClaim.claimedAt': new Date(),
            'customerClaim.customerUser': req.user?._id || null,
          },
        },
        { new: false }
      );
    } catch (dbErr) {
      // Non-fatal: blockchain claim already succeeded.
      console.warn('Claim metadata save failed:', dbErr.message);
    }

    return res.json({
      success: true,
      message: `Product #${numericId} successfully claimed by ${customerName}`,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      blockNumber: result.blockNumber,
      claimedBy: customerName,
      claimLocation: location || 'Not specified',
    });
  } catch (err) {
    console.error('Backend relay claim error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Claim transaction failed',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/verify/my-products
 * @desc    List products claimed by the authenticated customer
 * @access  Private (requires JWT login)
 * Query: ?limit=100
 */
router.get('/my-products', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
    const Product = (await import('../models/Product.js')).default;
    const rows = await Product.find({
      'customerClaim.isClaimed': true,
      $or: [
        { 'customerClaim.claimedBy': (req.user?.walletAddress || '').toLowerCase() },
        { 'customerClaim.customerName': req.user?.name || '' },
      ],
    })
      .sort({ 'customerClaim.claimedAt': -1, updatedAt: -1 })
      .limit(limit)
      .select('productId name loomLocation weaveDate customerClaim productCertificate')
      .lean();

    const products = rows.map((p) => ({
      id: p.productId,
      formattedId: `KS-${String(p.productId).padStart(6, '0')}`,
      name: p.name,
      loomLocation: p.loomLocation,
      weaveDate: p.weaveDate
        ? new Date(p.weaveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—',
      state: 'Sold',
      productCertificate: p.productCertificate?.path || p.productCertificate?.filename || '',
      claimLocation: p.customerClaim?.claimLocation || 'Not specified',
      claimedAt: p.customerClaim?.claimedAt
        ? new Date(p.customerClaim.claimedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '',
      ownerName: p.customerClaim?.customerName || '',
    }));

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error('Get my products error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load claimed products',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/verify/relayer-status
 * @desc    Check if relayer wallet is funded (health check)
 * @access  Public
 */
router.get('/relayer-status', async (req, res) => {
  try {
    const balance = await getRelayerBalance();
    const hasSufficientFunds = parseFloat(balance.balanceEth) > 0.001; // Need at least 0.001 ETH

    return res.json({
      success: true,
      relayer: {
        address: balance.address,
        balance: balance.balanceEth + ' ETH',
        ready: hasSufficientFunds,
        message: hasSufficientFunds
          ? 'Relayer is funded and ready'
          : 'Relayer has insufficient funds — please add Sepolia ETH',
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Could not check relayer status: ' + err.message,
    });
  }
});

export default router;
