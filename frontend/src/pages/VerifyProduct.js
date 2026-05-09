import React, { useState } from "react";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
    ShieldCheck,
    QrCode,
    Package,
    User,
    MapPin,
    Clock,
    AlertTriangle,
    CheckCircle2,
    FileText,
    Upload,
    Info,
    ArrowRight
} from "lucide-react";
import { getLocationString, isGeolocationAvailable } from "../utils/geolocation";
import CertificateViewer from "../components/CertificateViewer";
import { decryptQR } from "../utils/qrEncryption";
import "./VerifyProduct.css";

const VerifyProduct = () => {
    const { account, connectWallet, claimCustomerOwnership, getProductData, getFormattedProductId, getProductDataSmart } = useSupplyChain();
    const [productId, setProductId] = useState("");
    const [secretCode, setSecretCode] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [status, setStatus] = useState({ type: "", msg: "", title: "", icon: null });
    const [loading, setLoading] = useState(false);
    const [product, setProduct] = useState(null);
    const [showCertificates, setShowCertificates] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [waybillFile, setWaybillFile] = useState(null);
    const [waybillUploaded, setWaybillUploaded] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');
    const [formattedProductId, setFormattedProductId] = useState(""); // For display
    const [loadedFrom, setLoadedFrom] = useState(""); // 'qr' | 'manual'
    const [batchInfo, setBatchInfo] = useState(null);  // batch data when BATCH_WAYBILL scanned
    const [batchMode, setBatchMode] = useState(false); // true when a batch waybill was uploaded

    // Already-Claimed: report issue state
    const [wasItYou, setWasItYou] = useState(null);       // null | true | false
    const [reporterName, setReporterName] = useState('');
    const [reporterContact, setReporterContact] = useState('');
    const [reportIssueType, setReportIssueType] = useState('code_already_used');
    const [reportDesc, setReportDesc] = useState('');
    const [reportPurchaseLocation, setReportPurchaseLocation] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportFiled, setReportFiled] = useState(null); // short ID after submit

    // Handle waybill QR upload
    const handleWaybillUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        setWaybillFile(file);

        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const html5QrCode = new Html5Qrcode("qr-reader-hidden");

            const qrCodeSuccessCallback = async (decodedText) => {
                try {
                    console.log("Waybill QR Scanned:", decodedText);
                    // Decrypt first (handles both encrypted and legacy plain-text QRs)
                    const decryptedText = await decryptQR(decodedText);
                    let scannedId = null;
                    let isWaybill = false;

                    try {
                        const waybillData = JSON.parse(decryptedText);

                        // ── BATCH_WAYBILL: B2B batch handover document ──────────────
                        if (waybillData.type === "BATCH_WAYBILL") {
                            const batchId = waybillData.batchId;
                            try {
                                const batchRes = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/batch/${encodeURIComponent(batchId)}`);
                                if (batchRes.ok) {
                                    const batchJson = await batchRes.json();
                                    if (batchJson.success && batchJson.batch) {
                                        setBatchInfo(batchJson.batch);
                                        setBatchMode(true);
                                        setWaybillUploaded(true);
                                        // Auto-select first product
                                        if (batchJson.batch.products && batchJson.batch.products.length > 0) {
                                            const first = batchJson.batch.products[0];
                                            setProductId(String(first.productId));
                                            setFormattedProductId(first.formattedProductId || `#${first.productId}`);
                                        }
                                        setStatus({
                                            type: "info",
                                            title: "BATCH WAYBILL DETECTED",
                                            msg: `Batch "${batchJson.batch.name}" · ${batchJson.batch.quantity} products. Select your product from the list and enter your scratch-off code.`,
                                            icon: <CheckCircle2 className="status-icon" />
                                        });
                                        toast.success("Batch detected — select your product and enter scratch code.");
                                        html5QrCode.clear();
                                        setLoading(false);
                                        return;
                                    }
                                }
                            } catch (apiErr) {
                                console.warn("Batch API fetch failed:", apiErr);
                            }
                            // Fallback: batch not in DB — let user type their product ID
                            setBatchMode(true);
                            setBatchInfo({ name: waybillData.batchName || batchId, batchId, quantity: waybillData.productCount || "?", products: [] });
                            setWaybillUploaded(true);
                            setStatus({
                                type: "info",
                                title: "BATCH WAYBILL DETECTED",
                                msg: `Batch "${waybillData.batchName || batchId}" — enter your product ID (e.g. B1, B2…) and scratch-off code.`,
                                icon: <CheckCircle2 className="status-icon" />
                            });
                            toast.success("Batch detected — enter your product ID and scratch code.");
                            html5QrCode.clear();
                            setLoading(false);
                            return;
                        }

                        // ── Regular single-product waybill / legacy JSON ────────────
                        scannedId = waybillData.productId || waybillData.id;
                        isWaybill = true;
                    } catch (e) {
                        try {
                            const url = new URL(decryptedText);
                            if (url.pathname.includes('/product/')) {
                                const parts = url.pathname.split('/');
                                scannedId = parts[parts.length - 1];
                            }
                        } catch (urlErr) {
                            // Not a valid URL
                        }
                    }

                    if (scannedId) {
                        setProductId(scannedId);
                        setWaybillUploaded(true);

                        // Fetch full product data immediately to check claim status
                        try {
                            const data = await getProductDataSmart(scannedId);
                            setProduct(data);
                            setFormattedProductId(data.formattedId || `#${scannedId}`);
                            setLoadedFrom('manual');

                            const isClaimed = data.isConsumed || (data.customerClaim && data.customerClaim.isClaimed);
                            if (isClaimed) {
                                setStatus({
                                    type: "info",
                                    title: "ALREADY CLAIMED",
                                    msg: `This product is authentic and has already been claimed by ${data.customerClaim?.customerName || "a customer"}.`,
                                    icon: <CheckCircle2 className="status-icon" />
                                });
                                toast.info("Product already claimed — ownership info shown below.");
                            } else {
                                setStatus({
                                    type: "info",
                                    title: "PRODUCT IDENTIFIED",
                                    msg: `Product ${data.formattedId || `#${scannedId}`} identified. Enter your scratch-off code to verify authenticity.`,
                                    icon: <CheckCircle2 className="status-icon" />
                                });
                                toast.success("Product found — enter your scratch-off code.");
                            }
                        } catch (err) {
                            // Blockchain fetch failed — still allow manual entry
                            const formatted = `#${scannedId}`;
                            setFormattedProductId(formatted);
                            setStatus({
                                type: "info",
                                title: "PRODUCT IDENTIFIED",
                                msg: `Product ${formatted} identified. Enter your scratch-off code to verify authenticity.`,
                                icon: <CheckCircle2 className="status-icon" />
                            });
                            toast.success("Product QR scanned — enter your scratch-off code.");
                        }
                    } else {
                        throw new Error("Invalid format");
                    }
                } catch (parseError) {
                    console.error("Parse error:", parseError);
                    toast.error("Invalid QR code format");
                    setStatus({
                        type: "error",
                        title: "INVALID QR CODE",
                        msg: "Could not read this QR code. Try uploading the individual product QR (not the batch waybill) or enter your product ID manually.",
                        icon: <AlertTriangle className="status-icon" />
                    });
                }
                html5QrCode.clear();
            };

            await html5QrCode.scanFile(file, true)
                .then(qrCodeSuccessCallback)
                .catch(err => {
                    console.error("QR scan error:", err);
                    toast.error("Failed to read QR code");
                });

        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to process waybill");
        } finally {
            setLoading(false);
        }
    };

    const handleManualVerify = async () => {
        if (!productId || !secretCode) {
            toast.warn("Please upload waybill and enter scratch-off code");
            return;
        }

        setLoading(true);
        setStatus({
            type: "loading",
            title: "VERIFYING ASSET",
            msg: "Checking blockchain records...",
            icon: <ShieldCheck className="status-icon animate-spin" />
        });

        try {
            // Use smart lookup that handles formatted IDs (A1, B2, #3, etc.)
            const data = await getProductDataSmart(productId);
            setProduct(data);
            setLoadedFrom('manual');

            // Update formatted ID from the smart lookup result
            setFormattedProductId(data.formattedId);

            // Fetch the Keccak256 hash of the entered secret to compare
            const { ethers } = await import("ethers");
            const inputHash = ethers.keccak256(ethers.toUtf8Bytes(secretCode));

            if (data.consumerSecretHash === inputHash) {
                if (data.isConsumed || (data.customerClaim && data.customerClaim.isClaimed)) {
                    setStatus({
                        type: "info",
                        title: "ALREADY CLAIMED",
                        msg: "This product is authentic but has already been claimed.",
                        icon: <CheckCircle2 className="status-icon" />
                    });
                } else {
                    setStatus({
                        type: "success",
                        title: "AUTHENTICITY VERIFIED",
                        msg: "Secret key matches! You can now claim ownership below.",
                        icon: <ShieldCheck className="status-icon" />
                    });
                    toast.success("✅ Asset Verified Successfully!");
                }
            } else {
                setStatus({
                    type: "error",
                    title: "VERIFICATION FAILED",
                    msg: "The secret key entered does not match this product's record.",
                    icon: <AlertTriangle className="status-icon" />
                });
                toast.error("Verification failed: Invalid Secret Key");
            }
        } catch (err) {
            console.error(err);
            setStatus({
                type: "error",
                title: "NOT FOUND",
                msg: `Product ${formattedProductId || `#${productId}`} could not be located on the blockchain.`,
                icon: <AlertTriangle className="status-icon" />
            });
            toast.error("Product not found");
        } finally {
            setLoading(false);
        }
    };

    const handleQRUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const image = new Image();
            image.src = event.target.result;
            image.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                const jsQR = (await import('jsqr')).default;
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    // Decrypt before trying to parse the QR content
                    const rawData = await decryptQR(code.data);
                    try {
                        let scannedId = null;
                        let scannedSecret = null;
                        let scannedBatchId = null;

                        try {
                            // Try JSON format first (old way)
                            const qrData = JSON.parse(rawData);
                            scannedId = qrData.productId || qrData.id;
                            scannedSecret = qrData.secretCode || qrData.secret;
                        } catch (e) {
                            // Try parsing as URL (new way from BulkRegister)
                            try {
                                const url = new URL(rawData);
                                if (url.pathname.includes('/product/')) {
                                    const parts = url.pathname.split('/');
                                    scannedId = parts[parts.length - 1]; // get ID from path
                                    scannedBatchId = url.searchParams.get('batch'); // get batch from query string
                                }
                            } catch (urlErr) {
                                // Not a valid URL
                            }
                        }

                        if (scannedId) {
                            setProductId(scannedId);
                            if (scannedSecret) setSecretCode(scannedSecret);

                            // Fetch product data using smart lookup
                            const data = await getProductDataSmart(scannedId);
                            
                            // ----------------------------------------------------
                            // Retrieve batch history if part of a batch
                            // ----------------------------------------------------
                            if (scannedBatchId) {
                                try {
                                    const batchRes = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/batch/${encodeURIComponent(scannedBatchId)}/analytics`);
                                    if (batchRes.ok) {
                                        const batchData = await batchRes.json();
                                        if (batchData.success && batchData.analytics?.handoverHistory?.length) {
                                            // Map batch handovers into timeline events
                                            const batchEvents = batchData.analytics.handoverHistory.map(h => ({
                                                actor: h.toAddress || h.fromAddress || "Unknown",
                                                state: "In Transit (Batch)",
                                                timestamp: new Date(h.transferredAt).toLocaleString(),
                                                location: h.location || "Supply Chain Checkpoint",
                                                dateObj: new Date(h.transferredAt)
                                            }));

                                            // Parse product dates for sorting
                                            const productEvents = (data.history || []).map(h => ({
                                                ...h,
                                                dateObj: new Date(h.timestamp)
                                            }));

                                            // Merge and sort
                                            const combinedEvents = [...productEvents, ...batchEvents].sort((a, b) => a.dateObj - b.dateObj);
                                            data.history = combinedEvents;
                                        }
                                    }
                                } catch (batchErr) {
                                    console.warn("Could not fetch batch trace history:", batchErr);
                                }
                            }
                            
                            setProduct(data);
                            setFormattedProductId(data.formattedId);
                            setLoadedFrom('qr');

                            // QR scan only loads product details — never verifies authenticity
                            setStatus({
                                type: "info",
                                title: "PRODUCT DETAILS LOADED",
                                msg: "QR code scanned — full product details are shown below. QR codes can be duplicated and cannot prove authenticity. Use the Manual Audit tab with your physical scratch-off code to verify ownership.",
                                icon: <CheckCircle2 className="status-icon" />
                            });
                            toast.info("Product loaded — use Manual Audit to verify.");

                        } else {
                            toast.error("Invalid QR code format");
                        }
                    } catch (err) {
                        console.error(err);
                        toast.error("An error occurred reading the QR code data");
                    }
                } else {
                    toast.error("No QR code found in image");
                }
                setLoading(false);
            };
        };
        reader.readAsDataURL(file);
    };

    const handleClaimOwnership = async () => {
        if (!account) {
            toast.error("Please connect your wallet first");
            return;
        }

        if (!productId || !secretCode) {
            toast.error("Please scan a valid QR code first");
            return;
        }

        if (!customerName.trim()) {
            toast.error("Please enter your name");
            return;
        }

        if (!isGeolocationAvailable()) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setLoading(true);
        setLocationLoading(true);
        setStatus({
            type: "loading",
            title: "FETCHING LOCATION",
            msg: "Please allow location access when prompted...",
            icon: <MapPin className="status-icon animate-pulse" />
        });

        try {
            // Get user's location
            const location = await getLocationString();
            setLocationLoading(false);

            setStatus({
                type: "loading",
                title: "CLAIMING OWNERSHIP",
                msg: "Processing your claim on the blockchain...",
                icon: <Package className="status-icon animate-spin" />
            });

            // Claim ownership on blockchain
            const result = await claimCustomerOwnership(productId, secretCode, customerName, location);

            if (result.status === "claimed") {
                // Refresh product data using smart lookup
                const updatedData = await getProductDataSmart(productId);
                setProduct(updatedData);
                setFormattedProductId(updatedData.formattedId);

                setStatus({
                    type: "success",
                    title: "OWNERSHIP CLAIMED",
                    msg: "Congratulations! You are now the verified owner of this product.",
                    icon: <CheckCircle2 className="status-icon" />
                });
            } else {
                setStatus({
                    type: "error",
                    title: "CLAIM FAILED",
                    msg: "Failed to claim ownership. Please try again.",
                    icon: <AlertTriangle className="status-icon" />
                });
            }
        } catch (error) {
            console.error("=== CLAIM OWNERSHIP ERROR ===");
            console.error("Full error:", error);
            console.error("Error message:", error.message);
            console.error("Error reason:", error.reason);
            console.error("Error code:", error.code);
            console.error("Error data:", error.data);
            setLocationLoading(false);

            let errorMsg = "Failed to claim ownership";

            // Check for specific error types
            if (error.message) {
                if (error.message.includes("All location methods failed") ||
                    error.message.includes("check your connection")) {

                    errorMsg = "Unable to determine your location. Please check your internet connection or try a different network.";

                    setStatus({
                        type: "error",
                        title: "LOCATION FAILED",
                        msg: errorMsg,
                        icon: <MapPin className="status-icon" />
                    });
                } else if (error.message.includes("permission") || error.message.includes("denied")) {
                    errorMsg = "Location access was denied. I'll try to find you via IP, but if that fails, please enable location in settings.";
                } else if (error.message.includes("Invalid secret") || error.message.includes("Security:")) {
                    errorMsg = "Invalid QR code or product already claimed.";
                } else if (error.message.includes("user rejected") || error.message.includes("User denied")) {
                    errorMsg = "Transaction rejected. Please approve the transaction in MetaMask.";
                } else if (error.reason) {
                    errorMsg = `Transaction failed: ${error.reason}`;
                } else {
                    errorMsg = `Failed to claim: ${error.message}`;
                }
            }

            setStatus({
                type: "error",
                title: "CLAIM FAILED",
                msg: errorMsg,
                icon: <AlertTriangle className="status-icon" />
            });
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const formatLocation = (locString) => {
        if (!locString) return { coords: "Unknown", address: "" };

        // Handle the new format: "lat,lng|City, State, Country"
        if (locString.includes('|')) {
            const [coords, address] = locString.split('|');
            const [lat, lng] = coords.split(',');
            return {
                coords: `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°`,
                address: address
            };
        }

        // Handle old format: "lat,lng"
        const [lat, lng] = locString.split(',');
        return {
            coords: `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°`,
            address: ""
        };
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return "Unknown";
        return new Date(timestamp).toLocaleString();
    };

    return (
        <motion.div
            className="verify-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <header className="verify-header">
                <div className="header-badge">
                    <ShieldCheck size={16} />
                    <span>Trust Verification Protocol</span>
                </div>
                <h1>Asset Identification</h1>
                <p>Authenticate your luxury items via blockchain-backed provenance auditing.</p>
            </header>

            <div className="verify-content">
                {/* Method Selector Tabs */}
                <div className="method-tabs">
                    <button
                        className={`tab-btn ${activeTab === "qr" ? "active" : ""}`}
                        onClick={() => { setActiveTab("qr"); setProduct(null); setLoadedFrom(""); setStatus({ type: "", msg: "", title: "", icon: null }); setProductId(""); setFormattedProductId(""); }}
                    >
                        <QrCode size={18} />
                        Identity Scan
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "manual" ? "active" : ""}`}
                        onClick={() => { setActiveTab("manual"); setProduct(null); setLoadedFrom(""); setStatus({ type: "", msg: "", title: "", icon: null }); setSecretCode(""); setFormattedProductId(""); setBatchMode(false); setBatchInfo(null); setWaybillUploaded(false); setProductId(""); }}
                    >
                        <FileText size={18} />
                        Manual Audit
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === "qr" ? (
                        /* QR Upload Section */
                        <motion.div
                            key="qr-section"
                            className="qr-upload-section glass-panel"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <div className="upload-icon-wrapper">
                                <QrCode size={40} />
                            </div>
                            <h3>Identity Card Scan</h3>
                            <p>Upload the high-security QR code from your physical packaging.</p>

                            <label className="upload-button">
                                <Upload size={20} />
                                <span>Scan Media Archive</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleQRUpload}
                                    hidden
                                    disabled={loading}
                                />
                            </label>

                            {loading && activeTab === "qr" && (
                                <div className="loading-state" style={{ marginTop: '2rem' }}>
                                    <div className="spinner"></div>
                                    <p>Decrypting Identity Matrix...</p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        /* Manual Entry Section */
                        <motion.div
                            key="manual-section"
                            className="manual-entry-section glass-panel"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <div className="form-header">
                                <h3>Manual Node Verification</h3>
                                <p>Provide secure identifiers from your digital waybill.</p>
                            </div>

                            <div className="manual-form">
                                {/* Waybill / Product QR Upload */}
                                <div className="input-field-group">
                                    <label>Product QR or Batch Waybill</label>
                                    <div id="qr-reader-hidden" style={{ display: "none" }}></div>
                                    <div className="file-input-wrapper">
                                        <Upload size={24} style={{ marginBottom: '0.5rem', color: '#666' }} />
                                        <p style={{ fontSize: '0.85rem', color: '#888' }}>
                                            {waybillUploaded ? (batchMode ? `✓ Batch waybill staged` : "✓ QR Staged") : "Drop product QR or batch waybill to upload"}
                                        </p>
                                        <input type="file" accept="image/*" onChange={handleWaybillUpload} disabled={loading} />
                                    </div>
                                </div>

                                {/* ── BATCH MODE: product selector ─────────────────── */}
                                {batchMode && batchInfo && (
                                    <div style={{
                                        background: 'rgba(212,175,55,0.07)',
                                        border: '1px solid rgba(212,175,55,0.22)',
                                        borderRadius: '14px',
                                        padding: '1rem 1.25rem',
                                        marginBottom: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <Package size={15} style={{ color: '#D4AF37' }} />
                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                Batch: {batchInfo.name} · {batchInfo.quantity} products
                                            </span>
                                        </div>
                                        {batchInfo.products && batchInfo.products.length > 0 ? (
                                            <div className="input-field-group" style={{ marginBottom: 0 }}>
                                                <label>Select Your Product</label>
                                                <select
                                                    value={productId}
                                                    onChange={(e) => {
                                                        setProductId(e.target.value);
                                                        const picked = batchInfo.products.find(p => String(p.productId) === e.target.value);
                                                        if (picked) setFormattedProductId(picked.formattedProductId || `#${picked.productId}`);
                                                    }}
                                                    disabled={loading}
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                                                >
                                                    {batchInfo.products.map(p => (
                                                        <option key={p.productId} value={String(p.productId)} style={{ background: '#1a1a1a' }}>
                                                            {p.formattedProductId || `#${p.productId}`} — {p.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="input-field-group" style={{ marginBottom: 0 }}>
                                                <label>Your Product ID</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. B1, B2, A3…"
                                                    value={formattedProductId}
                                                    onChange={(e) => { setFormattedProductId(e.target.value); setProductId(e.target.value); }}
                                                    disabled={loading}
                                                />
                                                <p style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.3rem' }}>Find this printed on your product label</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── SINGLE MODE: manual product ID input (when not batch, no QR yet) */}
                                {!batchMode && !waybillUploaded && (
                                    <div className="input-field-group">
                                        <label>Product ID <span style={{ fontWeight: 400, opacity: 0.6 }}>(or upload QR above)</span></label>
                                        <input
                                            type="text"
                                            placeholder="e.g. #1, A1, B3…"
                                            value={productId}
                                            onChange={(e) => setProductId(e.target.value)}
                                            disabled={loading}
                                        />
                                    </div>
                                )}

                                <div className="input-field-group">
                                    <label>Scratch-Off Verification Code</label>
                                    <input
                                        type="text"
                                        placeholder="EX: 43D2-X90A-..."
                                        value={secretCode}
                                        onChange={(e) => setSecretCode(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary btn-large"
                                    onClick={handleManualVerify}
                                    disabled={loading || !productId || !secretCode}
                                >
                                    {loading ? "Decrypting..." : "Execute Verification"}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Status Display */}
                <AnimatePresence mode="wait">
                    {status.msg && (
                        <motion.div
                            className={`status-card ${status.type}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="status-icon-wrapper">
                                {status.icon}
                            </div>
                            <div className="status-info">
                                <h3>{status.title}</h3>
                                <p>{status.msg}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Product Info & Claim Section */}
                {product && (
                    <motion.div
                        className="product-section glass-panel"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Product Header - shown for both QR and Manual */}
                        <div className="product-hero">
                            <div className="product-icon-box">
                                <Package size={40} />
                            </div>
                            <div className="product-title-group">
                                <h2>{product.name}</h2>
                                <span className="id-badge">ASSET NODE {formattedProductId || `#${productId}`}</span>
                            </div>
                        </div>

                        {loadedFrom === 'qr' ? (
                            /* ─── QR SCAN PATH: Info-only view, no claim ─── */
                            <div className="qr-info-view">
                                {/* Warning banner */}
                                <div className="qr-info-banner">
                                    <AlertTriangle size={20} className="qr-banner-icon" />
                                    <div className="qr-banner-text">
                                        <strong>Identity Scan — Read Only</strong>
                                        <span>QR codes can be duplicated and cannot prove ownership. Full product details are shown for reference only. To verify authenticity, use the <strong>Manual Audit</strong> tab and enter your physical scratch-off code.</span>
                                    </div>
                                    <div className="qr-banner-arrow">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>

                                {/* Basic product info grid */}
                                <div className="product-detail-grid">
                                    <div className="detail-card">
                                        <label>Loom Location</label>
                                        <p>{product.loomLocation || "—"}</p>
                                    </div>
                                    <div className="detail-card">
                                        <label>Weave Date</label>
                                        <p>{product.weaveDate || "—"}</p>
                                    </div>
                                    <div className="detail-card">
                                        <label>Current Status</label>
                                        <p><span className="state-pill">{product.state || "—"}</span></p>
                                    </div>
                                    <div className="detail-card">
                                        <label>Current Custodian</label>
                                        <p className="addr-compact">{product.currentOwner
                                            ? `${product.currentOwner.slice(0, 6)}…${product.currentOwner.slice(-4)}`
                                            : "—"}</p>
                                    </div>
                                </div>

                                {/* Ownership claim status */}
                                {product.customerClaim && product.customerClaim.isClaimed && (
                                    <div className="claimed-badge-row">
                                        <CheckCircle2 size={16} />
                                        <span>Claimed by <strong>{product.customerClaim.customerName}</strong> on {formatTimestamp(product.customerClaim.timestamp)}</span>
                                    </div>
                                )}

                                {/* Inline custody history timeline */}
                                {product.history && product.history.length > 0 && (
                                    <div className="history-timeline">
                                        <h4 className="timeline-heading">
                                            <FileText size={15} /> Custody Chain ({product.history.length} entries)
                                        </h4>
                                        <div className="timeline-track">
                                            {product.history.map((entry, i) => (
                                                <div key={i} className="timeline-entry">
                                                    <div className="timeline-dot" />
                                                    <div className="timeline-body">
                                                        <span className="timeline-state">{entry.state}</span>
                                                        <span className="timeline-actor">
                                                            {entry.actor
                                                                ? `${entry.actor.slice(0, 6)}…${entry.actor.slice(-4)}`
                                                                : "Unknown"}
                                                        </span>
                                                        <span className="timeline-ts">
                                                            <Clock size={11} /> {entry.timestamp}
                                                        </span>
                                                        {entry.location && (
                                                            <span className="timeline-loc">
                                                                <MapPin size={11} /> {entry.location.includes('|') ? entry.location.split('|')[1] : entry.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Certificates button */}
                                {product.history && product.history.length > 0 && (
                                    <button
                                        className="btn-certificates"
                                        onClick={() => setShowCertificates(true)}
                                    >
                                        <FileText size={18} />
                                        AUDIT PROVENANCE CERTIFICATES
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* ─── MANUAL AUDIT PATH: Verification + claim ─── */
                            <>
                                {product.customerClaim && product.customerClaim.isClaimed ? (
                                    /* ─── ALREADY CLAIMED: Authenticity + Report Issue ─── */
                                    <div className="ac-root">

                                        {/* 1. Authenticity confirmed strip */}
                                        <div className="ac-authentic-strip">
                                            <ShieldCheck size={18} />
                                            <span>Blockchain Verified — this product exists on the Kasaragod Handloom ledger &amp; the code matched.</span>
                                        </div>

                                        {/* 2. Already-claimed card */}
                                        <div className="ac-claimed-card">
                                            <div className="ac-claimed-header">
                                                <AlertTriangle size={20} />
                                                <span>Already Claimed</span>
                                            </div>
                                            <p className="ac-claimed-body">
                                                This product was already registered to an owner. The scratch-off code can only be used <strong>once</strong> — ownership is locked on-chain and cannot be transferred.
                                            </p>
                                            <div className="ac-claimed-meta">
                                                <div className="ac-meta-item">
                                                    <User size={14} />
                                                    <span className="ac-meta-label">Claimed by</span>
                                                    <span className="ac-meta-value">{product.customerClaim.customerName || 'Unknown'}</span>
                                                </div>
                                                <div className="ac-meta-item">
                                                    <Clock size={14} />
                                                    <span className="ac-meta-label">Claimed on</span>
                                                    <span className="ac-meta-value">{formatTimestamp(product.customerClaim.timestamp)}</span>
                                                </div>
                                                {product.customerClaim.location && (
                                                    <div className="ac-meta-item">
                                                        <MapPin size={14} />
                                                        <span className="ac-meta-label">Location</span>
                                                        <span className="ac-meta-value">{formatLocation(product.customerClaim.location).coords}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. Was it you? */}
                                        {!reportFiled && (
                                            <div className="ac-was-it-you">
                                                <p className="ac-wiy-question">Were you the one who first claimed this product?</p>
                                                <div className="ac-wiy-buttons">
                                                    <button
                                                        className={`ac-wiy-btn ac-wiy-yes${wasItYou === true ? ' ac-wiy-active' : ''}`}
                                                        onClick={() => { setWasItYou(true); }}
                                                    >
                                                        <CheckCircle2 size={16} /> Yes, this is my product
                                                    </button>
                                                    <button
                                                        className={`ac-wiy-btn ac-wiy-no${wasItYou === false ? ' ac-wiy-active' : ''}`}
                                                        onClick={() => { setWasItYou(false); }}
                                                    >
                                                        <AlertTriangle size={16} /> No, I did not claim this
                                                    </button>
                                                </div>

                                                {/* If YES */}
                                                <AnimatePresence>
                                                    {wasItYou === true && (
                                                        <motion.div
                                                            className="ac-reassurance"
                                                            key="reassurance"
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0 }}
                                                        >
                                                            <CheckCircle2 size={18} />
                                                            <span>Your ownership is secured on-chain. No further action is needed. Keep your scratch-off code private and do not share it with anyone.</span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* If NO — show report form */}
                                                <AnimatePresence>
                                                    {wasItYou === false && (
                                                        <motion.div
                                                            className="ac-report-form"
                                                            key="report-form"
                                                            initial={{ opacity: 0, y: 14 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0 }}
                                                        >
                                                            <p className="ac-rf-heading">
                                                                <AlertTriangle size={15} /> Report an Issue
                                                            </p>
                                                            <p className="ac-rf-sub">
                                                                This may indicate a counterfeit product or a stolen/resold item. Please fill in the details below and we will investigate.
                                                            </p>

                                                            <div className="ac-rf-fields">
                                                                <div className="ac-rf-field">
                                                                    <label>Issue Type <span className="ac-req">*</span></label>
                                                                    <select
                                                                        value={reportIssueType}
                                                                        onChange={e => setReportIssueType(e.target.value)}
                                                                    >
                                                                        <option value="code_already_used">Code was already used — possible resale</option>
                                                                        <option value="possible_counterfeit">I suspect this is a counterfeit product</option>
                                                                        <option value="product_damaged">Product is damaged or incorrect</option>
                                                                        <option value="wrong_product">Wrong product received</option>
                                                                        <option value="other">Other issue</option>
                                                                    </select>
                                                                </div>

                                                                <div className="ac-rf-row">
                                                                    <div className="ac-rf-field">
                                                                        <label>Your Name <span className="ac-req">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Full name"
                                                                            value={reporterName}
                                                                            onChange={e => setReporterName(e.target.value)}
                                                                            maxLength={100}
                                                                        />
                                                                    </div>
                                                                    <div className="ac-rf-field">
                                                                        <label>Contact (email or phone) <span className="ac-req">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="email@example.com or +91 …"
                                                                            value={reporterContact}
                                                                            onChange={e => setReporterContact(e.target.value)}
                                                                            maxLength={100}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="ac-rf-field">
                                                                    <label>Where did you purchase this product?</label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Store name, city, or online platform"
                                                                        value={reportPurchaseLocation}
                                                                        onChange={e => setReportPurchaseLocation(e.target.value)}
                                                                        maxLength={200}
                                                                    />
                                                                </div>

                                                                <div className="ac-rf-field">
                                                                    <label>Describe the issue <span className="ac-req">*</span></label>
                                                                    <textarea
                                                                        rows={4}
                                                                        placeholder="Please describe what happened in detail…"
                                                                        value={reportDesc}
                                                                        onChange={e => setReportDesc(e.target.value)}
                                                                        maxLength={1000}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <button
                                                                className="ac-rf-submit"
                                                                disabled={reportSubmitting}
                                                                onClick={async () => {
                                                                    if (!reporterName.trim() || !reporterContact.trim() || !reportDesc.trim()) {
                                                                        toast.error('Please fill in your name, contact, and a description.');
                                                                        return;
                                                                    }
                                                                    setReportSubmitting(true);
                                                                    try {
                                                                        const res = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/reports`, {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                productId: product.id,
                                                                                reporterName: reporterName.trim(),
                                                                                reporterContact: reporterContact.trim(),
                                                                                issueType: reportIssueType,
                                                                                description: reportDesc.trim(),
                                                                                purchaseLocation: reportPurchaseLocation.trim(),
                                                                                productName: product.name || '',
                                                                                productState: product.state || '',
                                                                                claimedBy: product.customerClaim?.customerName || '',
                                                                                claimedAt: formatTimestamp(product.customerClaim?.timestamp)
                                                                            })
                                                                        });
                                                                        const data = await res.json();
                                                                        if (data.success) {
                                                                            const shortId = String(data.reportId).slice(-6).toUpperCase();
                                                                            setReportFiled(shortId);
                                                                        } else {
                                                                            toast.error(data.error || 'Could not file report. Please try again.');
                                                                        }
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                        toast.error('Network error. Please try again.');
                                                                    } finally {
                                                                        setReportSubmitting(false);
                                                                    }
                                                                }}
                                                            >
                                                                {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                                                                {!reportSubmitting && <ArrowRight size={15} />}
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* After successful report */}
                                        {reportFiled && (
                                            <motion.div
                                                className="ac-report-success"
                                                initial={{ opacity: 0, scale: 0.97 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                            >
                                                <CheckCircle2 size={22} />
                                                <div>
                                                    <p className="ac-rs-title">Report #{reportFiled} submitted</p>
                                                    <p className="ac-rs-sub">Our team will investigate and reach out to you via the contact you provided. Thank you for helping protect Kasaragod weavers.</p>
                                                </div>
                                            </motion.div>
                                        )}

                                    </div>
                                ) : (
                                    /* Not Claimed - Show Claim Form */
                                    <div className="claim-form">
                                        <div className="form-title-row">
                                            <h3>Custodian Registration</h3>
                                        </div>
                                        <p className="form-description" style={{ color: '#666', marginBottom: '2rem' }}>
                                            Establish final point-of-consumption ownership on the immutable ledger.
                                        </p>

                                        {!account ? (
                                            <div className="wallet-notice">
                                                <AlertTriangle size={24} color="#d4af37" />
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontWeight: '600', color: '#1a1a1a' }}>Web3 Auth Required</p>
                                                    <p style={{ fontSize: '0.85rem', color: '#666' }}>Connect your secure wallet to claim this asset.</p>
                                                </div>
                                                <button className="btn btn-primary" onClick={connectWallet} style={{ padding: '0.8rem 1.5rem', borderRadius: '12px' }}>
                                                    INITIATE AUTH
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="manual-form">
                                                <div className="input-field-group">
                                                    <label> Legal Name of Custodian</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter full legal name"
                                                        value={customerName}
                                                        onChange={(e) => setCustomerName(e.target.value)}
                                                        disabled={loading}
                                                    />
                                                </div>

                                                <div className="location-pill">
                                                    <MapPin size={14} />
                                                    <span>Geo-tagging active (Automatic Fetch)</span>
                                                </div>

                                                <button
                                                    className="btn btn-primary btn-large"
                                                    onClick={handleClaimOwnership}
                                                    disabled={loading || !customerName.trim()}
                                                >
                                                    {loading ? (
                                                        <>
                                                            <div className="spinner-small"></div>
                                                            <span>Securing Registry...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck size={20} />
                                                            <span>Claim Custody</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Certificates button */}
                                {product.history && product.history.length > 0 && (
                                    <button
                                        className="btn-certificates"
                                        onClick={() => setShowCertificates(true)}
                                    >
                                        <FileText size={18} />
                                        AUDIT PROVENANCE CERTIFICATES
                                    </button>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Certificate Viewer Modal */}
            {showCertificates && product && (
                <CertificateViewer
                    productHistory={product.history}
                    productId={productId}
                    onClose={() => setShowCertificates(false)}
                />
            )}
        </motion.div>
    );
};

export default VerifyProduct;



