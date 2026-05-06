// ProductScan.js — Public consumer-facing product authenticity page
// Flow: QR scan → view journey → enter scratch-off code → claim ownership
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { useSupplyChainContext } from "../context/SupplyChainContext";
import "./ProductScan.css";

// Maps PRODUCT_STATES strings to display metadata
const STATE_DISPLAY = {
    "Created":       { icon: "🏭", color: "#10b981", label: "Manufactured",   desc: "Created by weaver, minted on blockchain" },
    "Verified":      { icon: "✅", color: "#3b82f6", label: "Co-op Verified", desc: "Authenticated by cooperative" },
    "In Transit":    { icon: "🚚", color: "#f59e0b", label: "In Transit",      desc: "Custody transferred along supply chain" },
    "At Shop":       { icon: "🏪", color: "#8b5cf6", label: "At Retailer",    desc: "Available at retail location" },
    "Sold":          { icon: "🛍️", color: "#ec4899", label: "Sold",           desc: "Purchased by customer" },
    "In Transit P2P":{ icon: "🔄", color: "#6b7280", label: "Resale",         desc: "Secondary market transfer" },
};

// Short address display
const shortAddr = (addr) => addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : "—";

export default function ProductScan() {
    const { id } = useParams();
    const { account, connectWallet, contract, readOnlyContract, getProductData } = useSupplyChainContext();

    const [product,      setProduct]      = useState(null);
    const [formattedId,  setFormattedId]  = useState(`#${id}`);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState("");

    // Verification state
    const [secretCode,   setSecretCode]   = useState("");
    const [verifying,    setVerifying]    = useState(false);
    const [verified,     setVerified]     = useState(false);
    const [verifyErr,    setVerifyErr]    = useState("");

    // Claim state
    const [customerName, setCustomerName] = useState("");
    const [claiming,     setClaiming]     = useState(false);
    const [claimed,      setClaimed]      = useState(false);
    const [claimErr,     setClaimErr]     = useState("");

    // ── Load product from blockchain on mount ──────────────────────
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            const numericId = parseInt(id, 10);
            if (isNaN(numericId) || numericId <= 0) {
                setError("Invalid product ID in QR code.");
                setLoading(false);
                return;
            }

            const tc = contract || readOnlyContract;
            if (!tc) {
                // Wait briefly for provider to initialise, then retry
                setTimeout(() => setLoading(prev => prev), 1500);
                setError("Connecting to blockchain…");
                setLoading(false);
                return;
            }

            try {
                const data = await getProductData(numericId);
                setProduct(data);

                // Format ID (e.g. "B3") via contract helper
                try {
                    const fmt = await tc.getFormattedProductId(numericId);
                    setFormattedId(fmt);
                } catch { setFormattedId(`#${numericId}`); }

                // Mark already-claimed
                if (data.customerClaim?.isClaimed) setClaimed(true);
            } catch (err) {
                console.error(err);
                setError("This product could not be found on the blockchain. Please verify the QR code is from an authentic Kasaragod Handloom product.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, contract, readOnlyContract, getProductData]);

    // ── Scratch-off code verification (client-side keccak256) ──────
    const handleVerify = async () => {
        if (!secretCode.trim() || !product) return;
        setVerifying(true);
        setVerifyErr("");
        try {
            const inputHash = ethers.keccak256(ethers.toUtf8Bytes(secretCode.trim()));
            if (inputHash === product.consumerSecretHash) {
                setVerified(true);
            } else {
                setVerifyErr("Incorrect code. Double-check the scratch-off panel on your product label.");
            }
        } catch {
            setVerifyErr("Verification error. Please try again.");
        } finally {
            setVerifying(false);
        }
    };

    // ── On-chain ownership claim ───────────────────────────────────
    const handleClaim = async () => {
        if (!contract) { connectWallet(); return; }
        if (!customerName.trim()) return;
        setClaiming(true);
        setClaimErr("");
        try {
            const { getLocationString } = await import("../utils/geolocation");
            const location = await getLocationString();
            const tx = await contract.claimOwnership(
                parseInt(id, 10),
                secretCode.trim(),
                customerName.trim(),
                location
            );
            await tx.wait();
            setClaimed(true);
            // Refresh for updated customerClaim data
            try {
                const updated = await getProductData(parseInt(id, 10));
                setProduct(updated);
            } catch { /* non-critical */ }
        } catch (err) {
            console.error(err);
            const msg = err.reason || err.message || "";
            if (msg.includes("already") || msg.includes("isConsumed")) {
                setClaimErr("This product has already been claimed by another customer.");
            } else if (msg.includes("user rejected") || msg.includes("User denied")) {
                setClaimErr("Transaction cancelled.");
            } else if (msg.includes("Invalid secret") || msg.includes("hash")) {
                setClaimErr("Secret code rejected by contract. Please re-enter.");
            } else {
                setClaimErr("Claim failed. Please try again.");
            }
        } finally {
            setClaiming(false);
        }
    };

    // ── Loading / Error states ─────────────────────────────────────
    if (loading) return (
        <div className="ps-page ps-center">
            <div className="ps-spinner" />
            <p className="ps-loading-text">Reading blockchain…</p>
        </div>
    );

    if (error) return (
        <div className="ps-page ps-center">
            <div className="ps-error-icon">⚠️</div>
            <h2 className="ps-error-title">Product Not Found</h2>
            <p className="ps-error-desc">{error}</p>
            <button className="ps-btn ps-btn-outline" onClick={() => window.location.reload()}>
                ↻ Try Again
            </button>
        </div>
    );

    const curState = STATE_DISPLAY[product.state] || STATE_DISPLAY["Created"];

    return (
        <div className="ps-page">

            {/* ── HEADER ───────────────────────────────────────── */}
            <div className="ps-header">
                <div className="ps-brand-row">
                    <span className="ps-brand-name">Kasaragod Handloom</span>
                    <span className="ps-brand-badge">🔗 Blockchain Verified</span>
                </div>
                <div className="ps-product-hero">
                    <span className="ps-product-id-tag">{formattedId}</span>
                    <h1 className="ps-product-name">{product.name}</h1>
                    <div className="ps-state-pill" style={{ background: curState.color + "22", borderColor: curState.color }}>
                        <span>{curState.icon}</span>
                        <span style={{ color: curState.color }}>{curState.label}</span>
                    </div>
                </div>
            </div>

            <div className="ps-body">

                {/* ── PRODUCT DETAILS ─────────────────────────── */}
                <motion.div className="ps-card"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="ps-card-title">Product Details</h2>
                    <div className="ps-detail-grid">
                        <div className="ps-detail-item">
                            <span className="ps-detail-label">Loom Location</span>
                            <span className="ps-detail-value">📍 {product.loomLocation || "—"}</span>
                        </div>
                        <div className="ps-detail-item">
                            <span className="ps-detail-label">Weave Date</span>
                            <span className="ps-detail-value">📅 {product.weaveDate || "—"}</span>
                        </div>
                        <div className="ps-detail-item">
                            <span className="ps-detail-label">Current Custodian</span>
                            <span className="ps-detail-value ps-mono">👤 {shortAddr(product.currentOwner)}</span>
                        </div>
                        <div className="ps-detail-item">
                            <span className="ps-detail-label">Chain State</span>
                            <span className="ps-detail-value">{curState.icon} {product.state}</span>
                        </div>
                    </div>
                    <div className="ps-chain-proof-row">
                        <span>🔗</span>
                        <div>
                            <span className="ps-proof-label">On-chain secret hash</span>
                            <span className="ps-proof-mono">{product.consumerSecretHash?.slice(0, 20)}…</span>
                        </div>
                        <span className="ps-proof-tick">✓</span>
                    </div>
                </motion.div>

                {/* ── SUPPLY CHAIN JOURNEY ────────────────────── */}
                <motion.div className="ps-card"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="ps-card-title">Supply Chain Journey</h2>
                    <p className="ps-card-sub">Every custody transfer, permanently recorded on-chain.</p>

                    {product.history && product.history.length > 0 ? (
                        <div className="ps-timeline">
                            {product.history.map((entry, i) => {
                                const meta = STATE_DISPLAY[entry.state] || STATE_DISPLAY["Created"];
                                const isLast = i === product.history.length - 1;
                                return (
                                    <div key={i} className="ps-tl-node">
                                        {/* Connector line */}
                                        {!isLast && <div className="ps-tl-line" />}

                                        {/* Dot */}
                                        <div className="ps-tl-dot" style={{ background: isLast ? meta.color : "#4b5563", boxShadow: isLast ? `0 0 0 4px ${meta.color}30` : "none" }}>
                                            {meta.icon}
                                        </div>

                                        {/* Content */}
                                        <div className={`ps-tl-content ${isLast ? "ps-tl-content--active" : ""}`}>
                                            <div className="ps-tl-state-row">
                                                <span className="ps-tl-state" style={{ color: isLast ? meta.color : "inherit" }}>
                                                    {entry.state}
                                                </span>
                                                <span className="ps-tl-time">{entry.timestamp}</span>
                                            </div>
                                            <div className="ps-tl-meta">
                                                <span>📍 {entry.location || "Location not recorded"}</span>
                                                <span>👤 {shortAddr(entry.actor)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="ps-no-history">No journey records yet.</div>
                    )}
                </motion.div>

                {/* ── VERIFY & CLAIM ──────────────────────────── */}
                <AnimatePresence mode="wait">
                    {claimed ? (
                        /* ─ Already claimed ─ */
                        <motion.div key="claimed" className="ps-card ps-claimed-card"
                            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                            <div className="ps-claimed-icon">🏆</div>
                            <h2>Ownership On Record</h2>
                            {product?.customerClaim ? (
                                <div className="ps-claimed-details">
                                    <div className="ps-claimed-row">
                                        <span className="ps-claimed-label">Owner</span>
                                        <span className="ps-claimed-val">{product.customerClaim.customerName}</span>
                                    </div>
                                    <div className="ps-claimed-row">
                                        <span className="ps-claimed-label">Location</span>
                                        <span className="ps-claimed-val">{product.customerClaim.location?.split("|")[1] || product.customerClaim.location}</span>
                                    </div>
                                    <div className="ps-claimed-row">
                                        <span className="ps-claimed-label">Claimed at</span>
                                        <span className="ps-claimed-val">{product.customerClaim.timestamp}</span>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ color: "#6b7280" }}>Ownership has been registered on the blockchain.</p>
                            )}
                        </motion.div>

                    ) : !verified ? (
                        /* ─ Step 1: Enter scratch-off code ─ */
                        <motion.div key="verify" className="ps-card ps-verify-card"
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

                            <div className="ps-verify-heading">
                                <div className="ps-verify-icon-ring">🛡️</div>
                                <h2>Verify Authenticity</h2>
                                <p>
                                    Find the <strong>scratch-off panel</strong> on your product's physical label.
                                    Scratch it to reveal the secret code and enter it below.
                                </p>
                            </div>

                            {/* Visual hint */}
                            <div className="ps-scratch-hint-box">
                                <div className="ps-scratch-tag">
                                    <span className="ps-scratch-label">Scratch-Off Code</span>
                                    <span className="ps-scratch-dots">● ● ● ● ● ● ● ●</span>
                                    <span className="ps-scratch-sub">Under silver coating on label</span>
                                </div>
                                <div className="ps-scratch-arrow">↓</div>
                                <div className="ps-scratch-input-hint">Enter code below</div>
                            </div>

                            <div className="ps-verify-form">
                                <input
                                    type="text"
                                    className="ps-input"
                                    placeholder="e.g. A3F2-X9PQ-8ZKL"
                                    value={secretCode}
                                    onChange={e => { setSecretCode(e.target.value); setVerifyErr(""); }}
                                    onKeyDown={e => e.key === "Enter" && handleVerify()}
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                />
                                <AnimatePresence>
                                    {verifyErr && (
                                        <motion.div className="ps-error-msg"
                                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                            ⚠️ {verifyErr}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <button className="ps-btn ps-btn-verify"
                                    onClick={handleVerify}
                                    disabled={verifying || !secretCode.trim()}>
                                    {verifying
                                        ? <><span className="ps-btn-spinner" /> Verifying…</>
                                        : <>🔍 Verify Code</>}
                                </button>
                            </div>
                        </motion.div>

                    ) : (
                        /* ─ Step 2: Verified → Claim Ownership ─ */
                        <motion.div key="claim" className="ps-card ps-claim-card"
                            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>

                            <div className="ps-verified-banner">
                                <span className="ps-verified-tick">✅</span>
                                <div>
                                    <h2>Authentic Product!</h2>
                                    <p>Your code matches the on-chain record. This is a genuine Kasaragod Handloom saree.</p>
                                </div>
                            </div>

                            <div className="ps-divider" />

                            <h3 className="ps-claim-title">Claim Ownership</h3>
                            <p className="ps-claim-sub">
                                Register yourself as the verified owner on the blockchain — permanent, immutable proof that this saree belongs to you.
                            </p>

                            <div className="ps-verify-form">
                                <input
                                    type="text"
                                    className="ps-input"
                                    placeholder="Your full name"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                />

                                {!account ? (
                                    <button className="ps-btn ps-btn-wallet" onClick={connectWallet}>
                                        🔌 Connect MetaMask to Claim
                                    </button>
                                ) : (
                                    <button className="ps-btn ps-btn-claim"
                                        onClick={handleClaim}
                                        disabled={claiming || !customerName.trim()}>
                                        {claiming
                                            ? <><span className="ps-btn-spinner" /> Claiming on blockchain…</>
                                            : <>🏆 Claim Ownership</>}
                                    </button>
                                )}

                                <AnimatePresence>
                                    {claimErr && (
                                        <motion.div className="ps-error-msg"
                                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                            ⚠️ {claimErr}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {account && (
                                    <p className="ps-wallet-addr">
                                        Wallet: {shortAddr(account)}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* ── FOOTER ─────────────────────────────────────── */}
            <div className="ps-footer">
                <p>Powered by Ethereum Blockchain · Kasaragod Handloom Trust</p>
            </div>
        </div>
    );
}
