// src/pages/BatchShowcase.js
import React, { useState } from "react";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { motion, AnimatePresence } from "framer-motion";
import "./BatchShowcase.css";

const PRODUCT_STATES = ["Created", "Verified", "In Transit", "At Shop", "Sold", "In Transit P2P"];
const STATE_CLASSES = ["state-created", "state-verified", "state-intransit", "state-atshop", "state-sold", "state-intransit"];

const BatchShowcase = () => {
    const { readOnlyContract, contract } = useSupplyChain();
    const [startId, setStartId] = useState(1);
    const [count, setCount] = useState(5);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [queried, setQueried] = useState(false);

    const fetchBatch = async () => {
        const target = contract || readOnlyContract;
        if (!target) {
            setError("Blockchain connection not available. Connect your wallet or wait for provider.");
            return;
        }

        setLoading(true);
        setError("");
        setProducts([]);
        setQueried(true);

        try {
            const results = [];
            for (let i = 0; i < count; i++) {
                const id = startId + i;
                try {
                    const p = await target.getProduct(id);
                    if (p.exists) {
                        results.push({
                            id: p.id.toString(),
                            name: p.name,
                            loomLocation: p.loomLocation,
                            weaveDate:
                                Number(p.weaveDate) > 0
                                    ? new Date(Number(p.weaveDate) * 1000).toLocaleDateString()
                                    : "N/A",
                            currentOwner: p.currentOwner,
                            stateIndex: Number(p.state),
                            state: PRODUCT_STATES[Number(p.state)] || "Unknown",
                            consumerSecretHash: p.consumerSecretHash,
                            currentHandoverHash: p.currentHandoverHash,
                            isConsumed: p.isConsumed,
                            certificate: p.productCertificate,
                        });
                    }
                } catch (e) {
                    console.log(`Product #${id} not found`);
                }
            }
            setProducts(results);
            if (results.length === 0) {
                setError("No products found in this range. Make sure the products are registered on the blockchain.");
            }
        } catch (e) {
            console.error("Batch fetch error:", e);
            setError(e.message || "Failed to fetch products from blockchain");
        } finally {
            setLoading(false);
        }
    };

    const uniqueOwners = [...new Set(products.map((p) => p.currentOwner))].length;
    const uniqueHashes = [...new Set(products.map((p) => p.consumerSecretHash))].length;

    const truncate = (str, start = 6, end = 4) => {
        if (!str || str.length < start + end + 3) return str;
        return `${str.slice(0, start)}...${str.slice(-end)}`;
    };

    return (
        <div className="batch-showcase">
            {/* ── Top Strip: Hero + Query panel ── */}
            <div className="batch-top-strip">
                {/* Hero */}
                <div className="batch-hero">
                    <span className="batch-hero-badge">⛓️ Blockchain Proof</span>
                    <h1>Batch Showcase</h1>
                    <p>
                        Verify that each bulk-registered saree is stored as a{" "}
                        <strong>separate, independent entity</strong> on the blockchain — with its own unique ID,
                        secret hash, and ownership trail.
                    </p>
                </div>

                {/* Query Panel */}
                <div className="batch-query-panel">
                    <div className="batch-query-panel-title">Query the Blockchain</div>
                    <div className="batch-query-fields-row">
                        <div className="batch-query-field">
                            <label>Start ID</label>
                            <input
                                type="number"
                                min="1"
                                value={startId}
                                onChange={(e) => setStartId(Math.max(1, parseInt(e.target.value) || 1))}
                                disabled={loading}
                            />
                        </div>
                        <div className="batch-query-field">
                            <label>Count</label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={count}
                                onChange={(e) =>
                                    setCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))
                                }
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <button className="batch-query-btn" onClick={fetchBatch} disabled={loading}>
                        {loading ? "⏳ Querying Chain..." : "🔍 Fetch from Blockchain"}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && <div className="batch-error">⚠️ {error}</div>}

            {/* Loading */}
            {loading && (
                <div className="batch-loading">
                    <div className="batch-loading-spinner" />
                    <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
                        Querying {count} products from the blockchain…
                    </p>
                </div>
            )}

            {/* Results */}
            {!loading && products.length > 0 && (
                <>
                    {/* Stats Bar */}
                    <motion.div
                        className="batch-stats-bar"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        <div className="batch-stat-item">
                            <span className="batch-stat-icon">📦</span>
                            <div className="batch-stat-text">
                                <span className="batch-stat-label">Products Found</span>
                                <span className="batch-stat-value">{products.length}</span>
                            </div>
                        </div>
                        <div className="batch-stat-item">
                            <span className="batch-stat-icon">👤</span>
                            <div className="batch-stat-text">
                                <span className="batch-stat-label">Unique Owners</span>
                                <span className="batch-stat-value info">{uniqueOwners}</span>
                            </div>
                        </div>
                        <div className="batch-stat-item">
                            <span className="batch-stat-icon">🔐</span>
                            <div className="batch-stat-text">
                                <span className="batch-stat-label">Unique Hashes</span>
                                <span className="batch-stat-value success">{uniqueHashes}</span>
                            </div>
                        </div>
                        <div className="batch-stat-item">
                            <span className="batch-stat-icon">⛓️</span>
                            <div className="batch-stat-text">
                                <span className="batch-stat-label">Storage</span>
                                <span
                                    className="batch-stat-value"
                                    style={{ fontSize: "1rem", color: "var(--accent-gold)" }}
                                >
                                    Individual On-Chain
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Section Title */}
                    <div className="batch-section-title">
                        <h2>🧵 Individual Blockchain Records</h2>
                        <div className="section-line" />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                            {products.length} records
                        </span>
                    </div>

                    {/* Product Cards */}
                    <div className="batch-products-grid">
                        <AnimatePresence>
                            {products.map((product, index) => (
                                <motion.div
                                    key={product.id}
                                    className="batch-product-card"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.06, duration: 0.35 }}
                                >
                                    {/* Card Header */}
                                    <div className="batch-card-header">
                                        <div className="batch-card-id">
                                            <span className="id-label">Product ID</span>
                                            <span className="id-value">#{product.id}</span>
                                        </div>
                                        <span
                                            className={`batch-card-state ${STATE_CLASSES[product.stateIndex] || ""}`}
                                        >
                                            {product.state}
                                        </span>
                                    </div>

                                    {/* Card Body */}
                                    <div className="batch-card-body">
                                        <div className="batch-card-field">
                                            <span className="field-label">Name</span>
                                            <span className="field-value">{product.name}</span>
                                        </div>
                                        <div className="batch-card-field">
                                            <span className="field-label">Loom</span>
                                            <span className="field-value">{product.loomLocation}</span>
                                        </div>
                                        <div className="batch-card-field">
                                            <span className="field-label">Weave Date</span>
                                            <span className="field-value">{product.weaveDate}</span>
                                        </div>
                                        <div className="batch-card-field">
                                            <span className="field-label">Owner</span>
                                            <span className="field-value mono">
                                                {truncate(product.currentOwner, 8, 6)}
                                            </span>
                                        </div>

                                        {/* Hash Highlight */}
                                        <div className="hash-highlight">
                                            <div className="batch-card-field" style={{ marginBottom: 0 }}>
                                                <span className="field-label">🔐 Secret Hash</span>
                                                <span className="field-value mono">
                                                    {truncate(product.consumerSecretHash, 10, 8)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="batch-card-footer">
                                        <div className="onchain-dot" />
                                        <span>Verified on-chain · Independent entry</span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </>
            )}

            {/* Empty State */}
            {!loading && queried && products.length === 0 && !error && (
                <div className="batch-empty-state">
                    <div className="batch-empty-icon">📭</div>
                    <h3>No Products Found</h3>
                    <p>No products exist in the given ID range. Try registering some sarees first.</p>
                </div>
            )}

            {/* Initial State */}
            {!queried && !loading && (
                <div className="batch-empty-state">
                    <div className="batch-empty-icon">🔍</div>
                    <h3>Ready to Query</h3>
                    <p>
                        Enter a starting ID and count in the panel above, then click{" "}
                        <strong>"Fetch from Blockchain"</strong> to see each saree's independent on-chain record.
                    </p>
                </div>
            )}
        </div>
    );
};

export default BatchShowcase;
