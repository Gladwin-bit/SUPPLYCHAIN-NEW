// VERSION: 3.4 - Cleaned up duplicates, using context logic
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useSupplyChainContext } from "../context/SupplyChainContext";

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
            const b = await targetContract.getBatch(batchId);
            if (!b.exists) return null;
            return {
                id: b.id.toString(),
                productIds: b.productIds.map(id => id.toString()),
                currentOwner: b.currentOwner,
                state: Number(b.state),
                exists: b.exists,
                isActive: b.isActive
            };
        } catch (err) {
            console.error("error fetching batch from blockchain", err);
            return null;
        }
    };

    return {
        account, connectWallet, contract, readOnlyContract,
        createProduct, createProductsBulk, transferCustody, transferBatchCustody, claimProduct, transferOwnership,
        getProductData, getBatchData, hasRole, grantRole, revokeRole, recordVerification,
        claimCustomerOwnership,  // Keep for backward compatibility during transition
        ROLES, PRODUCT_STATES
    };
};

export { ROLES, PRODUCT_STATES } from "../context/SupplyChainContext";
