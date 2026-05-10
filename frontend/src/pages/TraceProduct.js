// src/pages/TraceProduct.js
import React, { useState } from "react";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { decryptQR } from "../utils/qrEncryption";
import { ProductTimeline } from "../components/ProductTimeline";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, ShieldCheck, Upload } from "lucide-react";
import contractData from "../contract-address.json";
import "./TraceProduct.css";

const TraceProduct = () => {
    const { account, connectWallet, getProductDataSmart } = useSupplyChain();
    const [product, setProduct] = useState(null);
    const [dbProduct, setDbProduct] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [qrFile, setQrFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [showChain, setShowChain] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    const copyField = (value, key) => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopiedField(key);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const truncate = (str, head = 10, tail = 8) =>
        str && str.length > head + tail + 3
            ? `${str.slice(0, head)}...${str.slice(-tail)}`
            : str || "—";

    const decodeQRAndTrace = async (file) => {
        if (!account) {
            setError("🔒 Connect wallet to access blockchain data");
            return;
        }
        if (!file) return;

        setLoading(true);
        setError("");
        setProduct(null);
        setQrFile(file);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const image = new Image();
                    image.src = e.target.result;
                    image.onload = async () => {
                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");
                        canvas.width = image.width;
                        canvas.height = image.height;
                        ctx.drawImage(image, 0, 0);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                        const jsQR = (await import("jsqr")).default;
                        const code = jsQR(imageData.data, imageData.width, imageData.height);

                        if (!code) {
                            setError("❌ No QR code found in the image. Please try a clearer image.");
                            setLoading(false);
                            return;
                        }

                        let scannedId = null;
                        let scannedBatchId = null;
                        let decryptedData = null;

                        try {
                            decryptedData = await decryptQR(code.data);
                        } catch (err) {
                            console.error("Decryption error:", err);
                            decryptedData = code.data;
                        }

                        try {
                            // Try waybill / legacy JSON format
                            const qrData = JSON.parse(decryptedData);
                            scannedId = qrData.productId || qrData.id;
                            scannedBatchId = qrData.batchId || null;
                        } catch (e) {
                            // Try URL format (individual product QR from BulkRegister)
                            try {
                                const url = new URL(decryptedData);
                                if (url.pathname.includes("/product/")) {
                                    const parts = url.pathname.split("/");
                                    scannedId = parts[parts.length - 1];
                                    scannedBatchId = url.searchParams.get("batch");
                                }
                            } catch (_) {
                                // Not a URL either
                            }
                        }

                        if (!scannedId) {
                            setError("❌ Invalid QR code format. Use a product label QR or batch waybill QR.");
                            setLoading(false);
                            return;
                        }

                        try {
                            const productData = await getProductDataSmart(scannedId);

                            // Merge batch history if a batchId was found
                            if (scannedBatchId) {
                                try {
                                    const batchRes = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/batch/${encodeURIComponent(scannedBatchId)}/analytics`);
                                    if (batchRes.ok) {
                                        const batchData = await batchRes.json();
                                        if (batchData.success && batchData.analytics?.handoverHistory?.length) {
                                            const batchEvents = batchData.analytics.handoverHistory.map(h => ({
                                                actor: h.toAddress || h.fromAddress || "Unknown",
                                                state: "In Transit (Batch)",
                                                timestamp: new Date(h.transferredAt).toLocaleString(),
                                                location: h.location || "Supply Chain Checkpoint",
                                                dateObj: new Date(h.transferredAt)
                                            }));
                                            const productEvents = (productData.history || []).map(h => ({
                                                ...h,
                                                dateObj: new Date(h.timestamp)
                                            }));
                                            const combined = [...productEvents, ...batchEvents].sort((a, b) => a.dateObj - b.dateObj);
                                            productData.history = combined;
                                        }
                                    }
                                } catch (batchErr) {
                                    console.warn("Could not fetch batch history:", batchErr);
                                }
                            }

                            setProduct(productData);

                            // Fetch DB metadata (txHash, certificate, manufacturer info)
                            try {
                                const numericId = productData.id;
                                const dbRes = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/${numericId}`);
                                const dbJson = await dbRes.json();
                                if (dbJson.success) setDbProduct(dbJson.product);
                            } catch (_) {
                                setDbProduct(null);
                            }
                        } catch (traceErr) {
                            console.error(traceErr);
                            setError(`Product not found on blockchain. The ID "${scannedId}" may be invalid.`);
                        } finally {
                            setLoading(false);
                        }
                    };
                } catch (err) {
                    console.error(err);
                    setError("❌ Failed to decode QR code image.");
                    setLoading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            setError("❌ Failed to read the uploaded file.");
            setLoading(false);
        }
    };

    const handleFileInput = (e) => {
        const file = e.target.files[0];
        if (file) decodeQRAndTrace(file);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) decodeQRAndTrace(file);
    };

    return (
        <div className="trace-product-page">
            <header className="page-header" style={{ textAlign: 'center', marginBottom: '4rem' }}>
                <h1 style={{ fontFamily: 'Space Grotesk', fontSize: '3.5rem', fontWeight: 700, letterSpacing: '-1px' }}>
                    Trace Asset Journey
                </h1>
                <p className="subtitle" style={{ letterSpacing: '4px', textTransform: 'uppercase', opacity: 0.7 }}>
                    Real-Time Supply Chain Audit
                </p>
            </header>

            {!account ? (
                <div className="connect-prompt" style={{ textAlign: 'center' }}>
                    <button className="btn btn-primary" onClick={connectWallet}>
                        Authorized Access Only
                    </button>
                </div>
            ) : (
                <div className="trace-content">
                    {/* QR UPLOAD SECTION */}
                    <div className="trace-search-section">
                        <div
                            className={`qr-trace-dropzone ${dragActive ? "drag-active" : ""} ${qrFile ? "has-file" : ""}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                id="trace-qr-input"
                                accept="image/*"
                                onChange={handleFileInput}
                                style={{ display: "none" }}
                                disabled={loading}
                            />
                            <label htmlFor="trace-qr-input" className="qr-trace-label">
                                <div className="qr-trace-icon">
                                    {qrFile ? <QrCode size={40} /> : <Upload size={40} />}
                                </div>
                                <h3>{qrFile ? `Scanned: ${qrFile.name}` : "Upload QR Code to Trace"}</h3>
                                <p>
                                    {qrFile
                                        ? "Upload a different QR to trace another product"
                                        : "Supports individual product labels and batch waybill QR codes"}
                                </p>
                                <span className="qr-trace-hint">JPG · PNG · WebP — drag & drop or click to browse</span>
                            </label>
                        </div>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                className="status-toast error"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                style={{ margin: '2rem auto' }}
                            >
                                {error}
                            </motion.div>
                        )}

                        {product && !loading && (
                            <div className="product-inspection">
                                {/* ASSET SUMMARY BOARD */}
                                <div className="asset-summary-card">
                                    <div className="asset-info-left">
                                        <div className="asset-badge">SAREE THREAD #{product.id}</div>
                                        <h2>{product.name}</h2>
                                        <div className="asset-meta">
                                            <div className="meta-item">
                                                <label>Status</label>
                                                <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{product.state}</span>
                                            </div>
                                            <div className="meta-item">
                                                <label>Loom Location</label>
                                                <span>{product.loomLocation || "N/A"}</span>
                                            </div>
                                            <div className="meta-item">
                                                <label>Weave Date</label>
                                                <span>{product.weaveDate || "N/A"}</span>
                                            </div>
                                            <div className="meta-item">
                                                <label>Current Owner</label>
                                                <span>{product.currentOwner.slice(0, 6)}...{product.currentOwner.slice(-4)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="asset-summary-right">
                                        <button
                                            className={`bcd-toggle-btn${showChain ? ' active' : ''}`}
                                            onClick={() => setShowChain(v => !v)}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="6" height="14" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="10" width="6" height="11" rx="1"/></svg>
                                            {showChain ? 'Hide' : 'View'} Blockchain Details
                                            <svg className={`bcd-chevron${showChain ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                        </button>
                                        <ShieldCheck size={64} color="#D4AF37" style={{ opacity: 0.08, marginTop: '0.5rem' }} />
                                    </div>
                                </div>

                                {/* ── BLOCKCHAIN DETAILS PANEL ── */}
                                <AnimatePresence>
                                {showChain && (
                                    <motion.div
                                        className="bcd-panel"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        {/* Panel header */}
                                        <div className="bcd-header">
                                            <span className="bcd-header-icon">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                            </span>
                                            <span className="bcd-header-title">On-Chain Verification Data</span>
                                            <span className="bcd-network-badge">
                                                <span className="bcd-net-dot" />
                                                Sepolia Testnet · Chain 11155111
                                            </span>
                                        </div>

                                        <div className="bcd-grid">

                                            {/* ── Column 1: Contract & Transaction ── */}
                                            <div className="bcd-col">
                                                <div className="bcd-section-label">Contract &amp; Transaction</div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Contract Address</span>
                                                    <span className="bcd-val bcd-mono">
                                                        {truncate(contractData.address, 10, 8)}
                                                        <button className="bcd-copy" onClick={() => copyField(contractData.address, 'contract')} title="Copy full address">
                                                            {copiedField === 'contract'
                                                                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                                            }
                                                        </button>
                                                    </span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Network</span>
                                                    <span className="bcd-val">Sepolia Testnet (Chain ID: 11155111)</span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Creation Tx Hash</span>
                                                    <span className="bcd-val bcd-mono">
                                                        {dbProduct?.blockchainTxHash
                                                            ? <>
                                                                {truncate(dbProduct.blockchainTxHash, 10, 8)}
                                                                <button className="bcd-copy" onClick={() => copyField(dbProduct.blockchainTxHash, 'tx')} title="Copy tx hash">
                                                                    {copiedField === 'tx'
                                                                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                                                    }
                                                                </button>
                                                              </>
                                                            : <span className="bcd-na">Not recorded</span>
                                                        }
                                                    </span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Registered At</span>
                                                    <span className="bcd-val">
                                                        {dbProduct?.createdAt
                                                            ? new Date(dbProduct.createdAt).toLocaleString()
                                                            : "—"}
                                                    </span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Manufacturer</span>
                                                    <span className="bcd-val bcd-mono">
                                                        {dbProduct?.manufacturer?.name
                                                            ? <span style={{color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', fontWeight: 600}}>{dbProduct.manufacturer.name}</span>
                                                            : truncate(product.currentOwner, 8, 6)
                                                        }
                                                    </span>
                                                </div>
                                            </div>

                                            {/* ── Column 2: On-Chain State ── */}
                                            <div className="bcd-col">
                                                <div className="bcd-section-label">On-Chain State</div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Product ID</span>
                                                    <span className="bcd-val bcd-mono bcd-id">#{product.id}</span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">State</span>
                                                    <span className={`bcd-state-pill bcd-state--${(product.state || '').toLowerCase().replace(/\s+/g, '-')}`}>
                                                        {product.state || "Unknown"}
                                                    </span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Custody Events</span>
                                                    <span className="bcd-val bcd-mono">{product.history?.length ?? 0}</span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Verifications</span>
                                                    <span className="bcd-val bcd-mono">{product.verifications?.length ?? 0}</span>
                                                </div>

                                                <div className="bcd-row">
                                                    <span className="bcd-key">Consumed</span>
                                                    <span className={`bcd-bool ${product.isConsumed ? 'bcd-bool--yes' : 'bcd-bool--no'}`}>
                                                        {product.isConsumed ? 'Yes — Claimed by Customer' : 'No — Still in Supply Chain'}
                                                    </span>
                                                </div>

                                            </div>

                                        </div>{/* /bcd-grid */}

                                        {/* ── Verification Log ── */}
                                        <div className="bcd-verif-section">
                                            <div className="bcd-section-label">Verification Log</div>
                                            {product.verifications?.length > 0
                                                ? <div className="bcd-verif-list">
                                                    {product.verifications.map((v, i) => (
                                                        <div className="bcd-verif-row" key={i}>
                                                            <div className="bcd-verif-idx">{i + 1}</div>
                                                            <div className="bcd-verif-body">
                                                                <div className="bcd-verif-addr">{truncate(v.verifier, 10, 8)}</div>
                                                                <div className="bcd-verif-meta">
                                                                    <span>{v.timestamp}</span>
                                                                    {v.location && <span>· {v.location}</span>}
                                                                    {v.remarks && <span className="bcd-verif-remark">"{v.remarks}"</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                  </div>
                                                : <div className="bcd-empty">No on-chain verifications recorded for this product.</div>
                                            }
                                        </div>

                                    </motion.div>
                                )}
                                </AnimatePresence>

                                {/* TIMELINE SECTION */}
                                <div className="journey-map-section" style={{ marginTop: '4rem' }}>
                                    <div className="map-header">
                                        <div className="live-indicator" />
                                        <h3>Geographic Audit Path</h3>
                                    </div>
                                    <ProductTimeline
                                        history={product.history}
                                        customerClaim={product.customerClaim}
                                    />
                                </div>
                            </div>
                        )}
                    </AnimatePresence>

                    {loading && <LoadingSpinner />}
                </div>
            )}
        </div>
    );
};

export default TraceProduct;
