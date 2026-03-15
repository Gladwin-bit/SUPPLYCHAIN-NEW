// src/pages/TraceProduct.js
import React, { useState } from "react";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { ProductTimeline } from "../components/ProductTimeline";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, ShieldCheck, Upload } from "lucide-react";
import "./TraceProduct.css";

const TraceProduct = () => {
    const { account, connectWallet, getProductDataSmart } = useSupplyChain();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [qrFile, setQrFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);

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

                        try {
                            // Try waybill / legacy JSON format
                            const qrData = JSON.parse(code.data);
                            scannedId = qrData.productId || qrData.id;
                            scannedBatchId = qrData.batchId || null;
                        } catch (e) {
                            // Try URL format (individual product QR from BulkRegister)
                            try {
                                const url = new URL(code.data);
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
                                    const batchRes = await fetch(`http://localhost:5000/api/batch/${encodeURIComponent(scannedBatchId)}/analytics`);
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
                                    <ShieldCheck size={80} color="#D4AF37" style={{ opacity: 0.1 }} />
                                </div>

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
