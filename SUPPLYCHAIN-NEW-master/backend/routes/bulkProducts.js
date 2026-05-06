// backend/routes/bulkProducts.js
import express from 'express';
import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * POST /api/products/bulk
 * Register multiple sarees in a single transaction.
 */
router.post('/bulk', async (req, res) => {
    try {
        const {
            name,
            loomLocation,
            weaveDate,
            handoverKey,
            quantity,
            productCertificate
        } = req.body;

        if (!name || !loomLocation || !weaveDate || !handoverKey || !quantity) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // 1️⃣ Generate unique scratch‑off codes
        const generateCodes = (qty) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const codes = [];
            for (let i = 0; i < qty; i++) {
                let code = '';
                for (let j = 0; j < 8; j++) {
                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                codes.push(code);
            }
            return codes;
        };
        const scratchCodes = generateCodes(Number(quantity));

        // 2️⃣ Hash codes & handover key
        const consumerSecretHashes = scratchCodes.map((c) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(c)));
        const firstHandoverHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(handoverKey));

        // 3️⃣ Contract interaction
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contractArtifact = JSON.parse(fs.readFileSync(path.resolve('artifacts/contracts/SupplyChain.sol/SupplyChain.json'), 'utf8'));
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractArtifact.abi, wallet);

        const tx = await contract.createProductsBulk(
            name,
            loomLocation,
            Number(weaveDate),
            consumerSecretHashes,
            firstHandoverHash,
            productCertificate || ''
        );
        const receipt = await tx.wait();

        // 4️⃣ Extract IDs from events
        const ids = receipt.events
            .filter((e) => e.event === 'ProductCreated')
            .map((e) => e.args.id.toNumber());

        // 5️⃣ Respond with mapping
        const result = ids.map((id, idx) => ({ productId: id, scratchCode: scratchCodes[idx] }));
        res.json({ success: true, products: result });
    } catch (error) {
        console.error('Bulk registration error:', error);
        res.status(500).json({ success: false, message: 'Bulk registration failed', error: error.message });
    }
});

export default router;
