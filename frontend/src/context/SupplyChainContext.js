import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import contractData from "../contract-address.json";
import SupplyChainArtifact from "../SupplyChain.json";

const SupplyChainContext = createContext();

const contractAddress = contractData.address;
const abi = SupplyChainArtifact.abi;

export const ROLES = {
    ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000",
    WEAVER: ethers.keccak256(ethers.toUtf8Bytes("WEAVER")),
    COOPERATIVE: ethers.keccak256(ethers.toUtf8Bytes("COOPERATIVE")),
    DISTRIBUTOR: ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR")),
    SHOP: ethers.keccak256(ethers.toUtf8Bytes("SHOP"))
};

export const PRODUCT_STATES = ["Created", "Verified", "In Transit", "At Shop", "Sold", "In Transit P2P"];


// Standard hook for accessing context directly
export const useSupplyChainContext = () => {
    const context = useContext(SupplyChainContext);
    if (!context) throw new Error("useSupplyChainContext must be used within SupplyChainProvider");
    return context;
};

// Aliased hook for backward compatibility if needed
export const useSupplyChain = useSupplyChainContext;

export const SupplyChainProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [contract, setContract] = useState(null);
    const [readOnlyContract, setReadOnlyContract] = useState(null);

    useEffect(() => {
        const initReadOnly = async () => {
            try {
                let provider;
                if (window.ethereum) {
                    provider = new ethers.BrowserProvider(window.ethereum);
                } else {
                    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
                }
                const sc = new ethers.Contract(contractAddress, abi, provider);
                setReadOnlyContract(sc);
            } catch (e) {
                console.warn("Read-only contract init failed", e);
            }
        };
        initReadOnly();
    }, []);

    const updateConnection = useCallback((addr, signer) => {
        setAccount(addr);
        const normalizedAddress = ethers.getAddress(contractAddress);
        const sc = new ethers.Contract(normalizedAddress, abi, signer);
        setContract(sc);
    }, []);

    const connectWallet = async () => {
        if (!window.ethereum) {
            toast.error("MetaMask not detected");
            return null;
        }
        try {
            const provider = new ethers.BrowserProvider(window.ethereum, "any");
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const addr = await signer.getAddress();
            updateConnection(addr, signer);
            return addr;
        } catch (e) {
            console.error(e);
            toast.error("Failed to connect wallet");
            return null;
        }
    };

    useEffect(() => {
        if (window.ethereum) {
            const handleAccounts = (accounts) => {
                if (accounts.length > 0) {
                    connectWallet();
                } else {
                    setAccount(null);
                    setContract(null);
                }
            };
            window.ethereum.on("accountsChanged", handleAccounts);
            window.ethereum.on("chainChanged", () => window.location.reload());
            return () => {
                window.ethereum.removeListener("accountsChanged", handleAccounts);
            };
        }
    }, [updateConnection]);

    const createProduct = async (name, loomLocation, weaveDate, consumerSecretHash, handoverKeyHash, productCertificate = "") => {
        if (!contract) throw new Error("Wallet not connected");
        toast.info("Registering Saree on Blockchain Ledgers...");

        const args = [name, loomLocation, weaveDate, consumerSecretHash, handoverKeyHash, productCertificate];

        // Get the product ID via staticCall (free simulation, no gas)
        const productId = (await contract.createProduct.staticCall(...args)).toString();

        // Now submit the real transaction
        const tx = await contract.createProduct(...args);
        await tx.wait();

        toast.success(`Saree #${productId} Registered! 🥻`);
        return { productId, txHash: tx.hash };
    };

    const createProductsBulk = async (name, loomLocation, weaveDate, consumerSecretHashes, handoverKeyHash, productCertificate = "") => {
        if (!contract) throw new Error("Wallet not connected");
        toast.info(`Registering ${consumerSecretHashes.length} Sarees on Blockchain...`);

        const args = [name, loomLocation, weaveDate, consumerSecretHashes, handoverKeyHash, productCertificate];

        // Submit the bulk transaction
        const tx = await contract.createProductsBulk(...args);
        const receipt = await tx.wait();

        // Parse IDs from events
        let newBatchId = null;
        const productIds = receipt.logs
            .map(log => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed.name === "BatchCreated") {
                        newBatchId = parsed.args.batchId.toString();
                    }
                    return parsed.name === "ProductCreated" ? parsed.args.id.toString() : null;
                } catch (e) {
                    return null;
                }
            })
            .filter(id => id !== null);

        toast.success(`${productIds.length} Sarees Registered in Bulk! Batch #${newBatchId || "N/A"} 🥻`);
        return { productIds, batchId: newBatchId, txHash: tx.hash };
    };



    const getProductData = async (id) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        const p = await targetContract.getProduct(id);
        if (!p.exists) throw new Error("Item not found on ledger (ID does not exist)");

        const [h, v] = await Promise.all([
            targetContract.getHistory(id),
            targetContract.getVerificationHistory(id)
        ]);

        return {
            id: p.id.toString(),
            name: p.name,
            loomLocation: p.loomLocation,
            weaveDate: new Date(Number(p.weaveDate) * 1000).toLocaleDateString(),
            currentOwner: p.currentOwner,
            state: PRODUCT_STATES[p.state],
            stateRaw: p.state,
            consumerSecretHash: p.consumerSecretHash,
            currentHandoverHash: p.currentHandoverHash,
            isConsumed: p.isConsumed,
            customerClaim: (p.customerClaim && p.customerClaim.isClaimed) ? {
                customerName: p.customerClaim.customerName,
                location: p.customerClaim.location,
                timestamp: new Date(Number(p.customerClaim.timestamp) * 1000).toLocaleString(),
                claimedBy: p.customerClaim.claimedBy,
                isClaimed: p.customerClaim.isClaimed
            } : null,
            verifyLog: null,
            history: h.map(entry => ({
                actor: entry.actor,
                state: PRODUCT_STATES[entry.state],
                timestamp: new Date(Number(entry.timestamp) * 1000).toLocaleString(),
                location: entry.location
            })),
            verifications: v.map(entry => ({
                verifier: entry.verifier,
                timestamp: new Date(Number(entry.timestamp) * 1000).toLocaleString(),
                location: entry.location,
                remarks: entry.remarks
            }))
        };
    };

    const getBatchData = async (batchId) => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) throw new Error("Initializing blockchain provider...");

        try {
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

    const transferBatchCustody = async (batchId, incomingKey, nextHash, location) => {
        if (!contract) throw new Error("Wallet not connected");
        toast.info(`Transferring Batch #${batchId}...`);

        const tx = await contract.transferBatchCustody(batchId, incomingKey, nextHash, location);
        await tx.wait();

        toast.success(`Batch #${batchId} Transferred! 🔄`);
        return { txHash: tx.hash, batchId };
    };

    const hasRole = async (role, address) => {
        if (!contract && !readOnlyContract) return false;
        const target = contract || readOnlyContract;
        return await target.hasRole(ROLES[role] || role, address);
    };

    return (
        <SupplyChainContext.Provider value={{
            account, connectWallet, createProduct, createProductsBulk, getProductData, getBatchData, hasRole,
            contract, readOnlyContract, ROLES, PRODUCT_STATES, transferBatchCustody
        }}>
            {children}
        </SupplyChainContext.Provider>
    );
};
