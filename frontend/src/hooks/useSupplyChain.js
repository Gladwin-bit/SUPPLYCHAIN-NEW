// VERSION: 3.4 - Cleaned up duplicates, using context logic
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useSupplyChainContext } from "../context/SupplyChainContext";
import { formattedIdToNumeric, parseFormattedId } from "../utils/idConversion";

export const useSupplyChain = () => {
    const context = useSupplyChainContext();
    const {
        account, contract, readOnlyContract, connectWallet,
        createProduct, createProductsBulk, getProductData, hasRole,
        ROLES, PRODUCT_STATES
    } = context;

    const transferCustody = async (id, incomingKey, nextKey, location) => {
        if (!contract) throw new Error("Connection: Wallet not connected");

        try {
            console.log("Transfer Custody - Input:", { id, incomingKey, nextKey, location });
            // Contract expects: incomingKey as STRING, nextKeyHash as BYTES32
            const nextHash = ethers.keccak256(ethers.toUtf8Bytes(nextKey));
            console.log("Next Hash:", nextHash);

            toast.info("Transferring Custody & Rolling Key...");
            // Pass incomingKey as plain string, nextHash as bytes32
            const tx = await contract.transferCustody(id, incomingKey, nextHash, location);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();
            toast.success("Custody Transferred! 🔄");
        } catch (error) {
            console.error("Transfer Custody Error:", error);
            console.error("Error message:", error.message);
            console.error("Error reason:", error.reason);
            throw error;
        }
    };

    const transferBatchCustody = async (batchId, incomingKey, nextKey, location) => {
        if (!contract) throw new Error("Connection: Wallet not connected");

        try {
            console.log("Batch Transfer Custody - Input:", { batchId, incomingKey, nextKey, location });
            const nextHash = ethers.keccak256(ethers.toUtf8Bytes(nextKey));

            toast.info(`Transferring Batch #${batchId}...`);
            const tx = await contract.transferBatchCustody(batchId, incomingKey, nextHash, location);
            console.log("Batch transaction sent:", tx.hash);
            await tx.wait();
            toast.success(`Batch #${batchId} Transferred! 🔄`);
            return { txHash: tx.hash, batchId };
        } catch (error) {
            console.error("Batch Transfer Custody Error:", error);
            throw error;
        }
    };

    const verifyAndClaim = async (id, secretKey) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Verifying Secret & Claiming Authenticity...");
        const tx = await contract.verifyAndClaim(id, secretKey);
        const receipt = await tx.wait();

        const claimedEvent = receipt.logs.some(log => {
            try { return contract.interface.parseLog(log).name === "ProductClaimed"; } catch (e) { return false; }
        });

        if (claimedEvent) {
            toast.success("SUCCESS: Authenticity Verified & Ownership Claimed! 🎉");
            return { status: "claimed" };
        } else {
            toast.info("Authenticity Verified! Showing History Log.");
            return { status: "reverified" };
        }
    };

    const claimProduct = async (id, secretCode) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Performing Cryptographic Handshake...");
        const tx = await contract.claimProduct(id, secretCode);
        await tx.wait();
        toast.success("Authenticity Verified & Ownership Swapped! 🛡️");
    };

    const transferOwnership = async (id, toAddress) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Recording Peer-to-Peer Ownership Swap...");
        const tx = await contract.transferOwnership(id, toAddress);
        await tx.wait();
        toast.success("P2P Ownership Transfer Complete! 🔄");
    };

    const recordVerification = async (id, location, remarks) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Signing Digital Guestbook...");
        const tx = await contract.recordVerification(id, location, remarks);
        await tx.wait();
        toast.success("Verification Recorded on Blockchain! ✅");
    };

    const claimCustomerOwnership = async (id, secretKey, customerName, location) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Claiming product ownership...");
        const tx = await contract.claimOwnership(id, secretKey, customerName, location);
        const receipt = await tx.wait();

        const claimedEvent = receipt.logs.some(log => {
            try { return contract.interface.parseLog(log).name === "CustomerOwnershipClaimed"; } catch (e) { return false; }
        });

        if (claimedEvent) {
            toast.success("SUCCESS: Ownership Claimed! 🎉");
            return { status: "claimed" };
        } else {
            toast.error("Claim failed");
            return { status: "failed" };
        }
    };

    const grantRole = async (role, address) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Granting Role...");
        const tx = await contract.grantRole(ROLES[role] || role, address);
        await tx.wait();
        toast.success("Role Granted Successfully! 👑");
    };

    const revokeRole = async (role, address) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Revoking Role...");
        const tx = await contract.revokeRole(ROLES[role] || role, address);
        await tx.wait();
        toast.error("Role Revoked! 🛑");
    };

    const getBatchData = async (batchId) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        try {
            // batches is a public mapping on the contract, not a view function
            const b = await targetContract.batches(batchId);
            if (!b.exists) return null;
            return {
                id: b.id.toString(),
                currentOwner: b.currentOwner,
                state: Number(b.state),
                exists: b.exists,
                isActive: b.isActive,
                currentHandoverHash: b.currentHandoverHash
            };
        } catch (err) {
            console.error("error fetching batch from blockchain", err);
            return null;
        }
    };

    const verifyProduct = async (id, location, remarks) => {
        if (!contract) throw new Error("Connection: Wallet not connected");
        toast.info("Submitting cooperative verification...");
        const tx = await contract.verifyProduct(id, location, remarks);
        await tx.wait();
        toast.success("Product Verified on Blockchain! ✅");
    };

    const getFormattedProductId = async (id) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        try {
            return await targetContract.getFormattedProductId(id);
        } catch (err) {
            console.error("Error getting formatted product ID:", err);
            return `#${id}`; // Fallback to numeric
        }
    };

    const getFormattedBatchId = async (batchId) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        try {
            return await targetContract.getFormattedBatchId(batchId);
        } catch (err) {
            console.error("Error getting formatted batch ID:", err);
            return batchId.toString(); // Fallback to numeric
        }
    };

    // ─────────────────────────────────────────────────────────────
    // SMART LOOKUP FUNCTIONS (Accept both formatted and numeric IDs)
    // ─────────────────────────────────────────────────────────────

    /**
     * Smart product lookup that accepts formatted IDs (A1, B2, #3, etc.)
     * @param {string|number} idInput - Can be formatted ID (A1, #3) or numeric ID
     * @return {Promise<object>} Product data with formatted ID info
     */
    const getProductDataSmart = async (idInput) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        try {
            let numericId;
            let idInfo;

            // If it's a string, try to parse it as formatted ID
            if (typeof idInput === 'string') {
                idInfo = parseFormattedId(idInput);

                if (idInfo.type === 'invalid') {
                    throw new Error(`Invalid ID format: ${idInput}`);
                }

                numericId = await formattedIdToNumeric(idInput, targetContract);

                if (!numericId) {
                    throw new Error(`Could not resolve ID: ${idInput}`);
                }
            } else {
                // Numeric input
                numericId = idInput;
                idInfo = { type: 'numeric', numericId };
            }

            // Get product data from blockchain
            const productData = await getProductData(numericId);

            // Add formatted ID info
            let formattedId;
            try {
                formattedId = await getFormattedProductId(numericId);
            } catch (err) {
                formattedId = `#${numericId}`;
            }

            return {
                ...productData,
                formattedId,
                originalInput: idInput,
                idInfo
            };

        } catch (err) {
            console.error("Smart lookup error:", err);
            throw new Error(`Product lookup failed: ${err.message}`);
        }
    };

    /**
     * Smart batch lookup that accepts formatted IDs (A, B, etc.)
     * @param {string|number} idInput - Can be formatted ID (A, B) or numeric ID
     * @return {Promise<object>} Batch data with formatted ID info
     */
    const getBatchDataSmart = async (idInput) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        try {
            let numericId;
            let idInfo;

            // If it's a string, try to parse it as formatted ID
            if (typeof idInput === 'string') {
                idInfo = parseFormattedId(idInput);

                if (idInfo.type !== 'batch' && idInfo.type !== 'numeric') {
                    throw new Error(`Not a batch ID: ${idInput}`);
                }

                numericId = await formattedIdToNumeric(idInput, targetContract);

                if (!numericId) {
                    throw new Error(`Could not resolve batch ID: ${idInput}`);
                }
            } else {
                // Numeric input
                numericId = idInput;
                idInfo = { type: 'numeric', batchId: numericId };
            }

            // Get batch data from blockchain
            const batchData = await getBatchData(numericId);

            if (!batchData) {
                throw new Error(`Batch not found: ${idInput}`);
            }

            // Add formatted ID info
            let formattedId;
            try {
                formattedId = await getFormattedBatchId(numericId);
            } catch (err) {
                formattedId = `#${numericId}`;
            }

            return {
                ...batchData,
                formattedId,
                originalInput: idInput,
                idInfo
            };

        } catch (err) {
            console.error("Smart batch lookup error:", err);
            throw new Error(`Batch lookup failed: ${err.message}`);
        }
    };

    return {
        account, connectWallet, contract, readOnlyContract,
        createProduct, createProductsBulk, transferCustody, transferBatchCustody, claimProduct, transferOwnership,
        getProductData, getBatchData, hasRole, grantRole, revokeRole, recordVerification, verifyProduct,
        claimCustomerOwnership, getFormattedProductId, getFormattedBatchId,
        getProductDataSmart, getBatchDataSmart, // New smart lookup functions
        ROLES, PRODUCT_STATES
    };
};

export { ROLES, PRODUCT_STATES } from "../context/SupplyChainContext";
