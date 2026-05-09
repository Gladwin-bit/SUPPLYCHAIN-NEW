// src/components/BulkRegister.jsx
// Bulk Saree Registration — one blockchain tx, individual records, batch waybill
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { motion, AnimatePresence } from "framer-motion";
import { generateShortSecretCode, hashSecretCode } from "../utils/secretCodeGenerator";
import { QRCodeSVG } from "qrcode.react";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { encryptQR } from "../utils/qrEncryption";
import {
    Package, ShieldCheck, Key, Download, ChevronDown, ChevronUp,
    Eye, EyeOff, RefreshCw, Mail, ArrowLeft, CheckCircle, Layers,
    AlertCircle, Hash, Fingerprint
} from "lucide-react";
import "../pages/RecordProcedure.css";
import "./BulkRegister.css";

// ─────────────────────────────────────────────────────────────────
// ANTI-COUNTERFEITING LOGIC
//
// Every saree in a bulk batch gets on-chain:
//   1. Unique productId          — sequential, immutable
//   2. Unique consumerSecretHash — keccak256(scratchCode), stored on-chain
//   3. Shared currentHandoverHash — keccak256(batchHandoverKey)
//
// Security layers:
//   • consumerSecret  → printed under scratch-off label on the physical saree
//   • handoverKey     → given only to the first B2B recipient (cooperative/distributor)
//   • rolling key     → each B2B hop invalidates old key, stores new hash on-chain
//   • batchId link    → every product record points back to its batch — auditable
//   • End user scan   → buyer scans product QR → keccak256(code) compared on-chain
// ─────────────────────────────────────────────────────────────────

const MAX_QTY = 50;

const buildWaybillPayload = (batchId, handoverKey, sender, name, count) =>
    JSON.stringify({
        type: "BATCH_WAYBILL",
        batchId,
        handoverKey,
        senderAddress: sender,
        batchName: name,
        productCount: count,
        issuedAt: new Date().toISOString()
    });

// QR encodes a stable URL — secret is ONLY on the physical scratch-off label
// Customer scans QR → browser opens /product/:id?batch=batchId → views journey → enters scratch code
// IMPORTANT: REACT_APP_PUBLIC_URL must be the deployed domain in production (not localhost)
const APP_ORIGIN = process.env.REACT_APP_PUBLIC_URL?.replace(/\/$/, "") || window.location.origin;
const buildConsumerPayload = (productId, batchId) =>
    `${APP_ORIGIN}/product/${productId}?batch=${encodeURIComponent(batchId)}`;

// ─────────────────────────────────────────────────────────────────
export default function BulkRegister() {
    const { account, createProductsBulk, hasRole, getFormattedProductId, getFormattedBatchId } = useSupplyChain();

    // ── Form ──────────────────────────────────────────────────────
    const [batchName,      setBatchName]      = useState("");
    const [loomLocation,   setLoomLocation]   = useState("");
    const [weaveDate,      setWeaveDate]       = useState("");
    const [quantity,       setQuantity]        = useState(5);
    const [handoverKey,    setHandoverKey]     = useState("");
    const [certFile,       setCertFile]        = useState(null);
    const [recipientEmail, setRecipientEmail]  = useState("");

    // ── UI ────────────────────────────────────────────────────────
    const [step,        setStep]       = useState("form");   // form | loading | results
    const [statusLog,   setStatusLog]  = useState([]);
    const [registered,  setRegistered] = useState(null);
    const [revealed,    setRevealed]   = useState({});       // productId → bool
    const [showProducts, setShowProducts] = useState(true);
    const [emailSending, setEmailSending] = useState(false);
    const [roleOk,      setRoleOk]     = useState(null);
    const [formattedIds, setFormattedIds] = useState({});    // Store formatted IDs

    // Encrypted QR values for waybill and consumer labels
    const [encryptedWaybillQR, setEncryptedWaybillQR] = useState('');
    const [encryptedConsumerQRs, setEncryptedConsumerQRs] = useState({}); // productId → encrypted string

    const fileRef = useRef();
    const log = (msg, type = "info") =>
        setStatusLog(prev => [...prev, { msg, type, t: new Date().toLocaleTimeString() }]);

    const refreshKey = useCallback(() =>
        setHandoverKey(generateShortSecretCode("HANDOVER", "B2B")), []);

    useEffect(() => { if (!handoverKey) refreshKey(); }, [handoverKey, refreshKey]);

    useEffect(() => {
        if (!account) { setRoleOk(null); return; }
        hasRole("MANUFACTURER", account).then(setRoleOk);
    }, [account, hasRole]);

    // Encrypt waybill QR whenever registration results change
    useEffect(() => {
        if (!registered) { setEncryptedWaybillQR(''); return; }
        const payload = buildWaybillPayload(
            registered.batchId, registered.waybillKey,
            account, batchName, registered.products.length
        );
        encryptQR(payload).then(setEncryptedWaybillQR);
    }, [registered, account, batchName]); // eslint-disable-line react-hooks/exhaustive-deps

    // Encrypt per-product consumer QRs when results change
    useEffect(() => {
        if (!registered?.products?.length) { setEncryptedConsumerQRs({}); return; }
        const formattedBatchId = registered.formatted?.batchId || registered.batchId;
        const promises = registered.products.map(async (p) => {
            const url = buildConsumerPayload(p.productId, formattedBatchId);
            const enc = await encryptQR(url);
            return [p.productId, enc];
        });
        Promise.all(promises).then(pairs => {
            setEncryptedConsumerQRs(Object.fromEntries(pairs));
        });
    }, [registered]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─────────────────────────────────────────────────────────────
    // ID FORMATTING
    // ─────────────────────────────────────────────────────────────
    const formatRegistrationIds = async (batchId, productIds) => {
        try {
            // Format batch ID
            const formattedBatchId = await getFormattedBatchId(batchId);

            // Format all product IDs
            const formattedProductIds = {};
            for (const id of productIds) {
                formattedProductIds[id] = await getFormattedProductId(id);
            }

            setFormattedIds({ batchId: formattedBatchId, products: formattedProductIds });
            return { batchId: formattedBatchId, products: formattedProductIds };
        } catch (err) {
            console.error("Failed to format IDs:", err);
            // Fallback to numeric IDs
            const fallbackProductIds = {};
            productIds.forEach(id => { fallbackProductIds[id] = `#${id}`; });
            const fallback = { batchId: `#${batchId}`, products: fallbackProductIds };
            setFormattedIds(fallback);
            return fallback;
        }
    };

    // ─────────────────────────────────────────────────────────────
    // REGISTRATION
    // ─────────────────────────────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault();
        if (!account)                              { toast.error("Connect MetaMask first"); return; }
        if (!roleOk)                               { toast.error("MANUFACTURER_ROLE required"); return; }
        if (!certFile)                             { toast.error("Upload a batch certificate"); return; }
        if (!batchName || !loomLocation || !weaveDate) { toast.error("Fill all required fields"); return; }

        setStep("loading");
        setStatusLog([]);

        try {
            // Step 1 — certificate upload
            log("Uploading batch certificate…");
            const fd = new FormData();
            fd.append("certificate", certFile);
            const upRes  = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/upload-certificate`, { method: "POST", body: fd });
            const upData = await upRes.json();
            if (!upRes.ok || !upData.success) throw new Error(upData.message || "Certificate upload failed");
            log(`Certificate saved: ${upData.filename}`, "ok");

            // Step 2 — generate a UNIQUE consumer secret per saree
            log(`Generating ${quantity} unique scratch-off codes…`);
            const items       = [];
            const secretHashes = [];

            for (let i = 0; i < quantity; i++) {
                // Unique per-unit: uses index + timestamp to guarantee no two codes are equal
                const secret = generateShortSecretCode(`BLK-${i}-${Date.now()}`, batchName);
                secretHashes.push(hashSecretCode(secret));
                items.push({
                    index:         i,
                    name:          `${batchName} #${String(i + 1).padStart(3, "0")}`,
                    loomLocation,
                    weaveDate,
                    consumerSecret: secret,
                    handoverKey,
                    certFilename:  upData.filename
                });
            }

            // Step 3 — hash shared batch handover key
            const handoverHash   = hashSecretCode(handoverKey);
            const weaveDateEpoch = Math.floor(new Date(weaveDate).getTime() / 1000);

            // Step 4 — single blockchain transaction
            log("Submitting to blockchain (1 tx for all sarees)…");
            const bcResult = await createProductsBulk(
                batchName,
                loomLocation,
                weaveDateEpoch,
                secretHashes,
                handoverHash,
                upData.filename
            );
            log(`TX: ${bcResult.txHash.slice(0, 18)}…`, "ok");

            // Step 5 — Format IDs for display
            log("Formatting product and batch IDs…");
            const formatted = await formatRegistrationIds(bcResult.batchId, bcResult.productIds);
            log(`Batch ${formatted.batchId} — ${bcResult.productIds.length} products minted`, "ok");

            // Step 6 — map blockchain IDs
            const finalProducts = items.map((p, idx) => ({
                ...p,
                productId: bcResult.productIds[idx]
            }));

            // Step 7 — Enhanced DB sync with comprehensive batch data
            log("Syncing to database…");
            try {
                const weaveDateEpoch = Math.floor(new Date(weaveDate).getTime() / 1000);

                // Prepare enhanced products data with formatted IDs and secrets
                const enhancedProducts = finalProducts.map((p, idx) => ({
                    ...p,
                    formattedProductId: formatted.products[p.productId] || `#${p.productId}`,
                    consumerSecretHash: secretHashes[idx]
                }));

                const dbRes = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/bulk-register`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({
                        // Enhanced batch data
                        batchId: bcResult.batchId,
                        formattedBatchId: formatted.batchId,
                        batchName,
                        description: `Bulk batch of ${quantity} ${batchName} sarees`,
                        loomLocation,
                        weaveDate: weaveDateEpoch,

                        // Products with enhanced data
                        products: enhancedProducts,

                        // Manufacturer details
                        manufacturerAddress: account,

                        // Certificate information
                        certificateFilename: upData.filename,
                        certificatePath: upData.path, // Use the actual IPFS URL

                        // Blockchain data
                        txHash: bcResult.txHash,
                        blockNumber: bcResult.blockNumber,
                        gasUsed: bcResult.gasUsed
                    })
                });
                const dbData = await dbRes.json();

                if (dbRes.ok && dbData.success) {
                    log("Enhanced batch registered in database", "ok");
                    // Store waybill info if generated
                    if (dbData.waybill?.isGenerated) {
                        log("Waybill generated automatically", "ok");
                    }
                } else {
                    log(`DB note: ${dbData.message || "sync pending"}`, "warn");
                }
            } catch (err) {
                console.error("Database sync error:", err);
                log("DB sync skipped (blockchain is source of truth)", "warn");
            }

            // Step 8 — send handover key via email if requested
            if (recipientEmail) {
                log(`Sending handover key to ${recipientEmail}…`);
                try {
                    await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/email/send-batch-handover-key`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({
                            recipientEmail,
                            batchId:       formatted.batchId, // Use formatted ID for email
                            handoverKey,
                            senderAddress: account,
                            productCount:  quantity,
                            batchName
                        })
                    });
                    log("Email sent", "ok");
                } catch { log("Email failed (non-fatal)", "warn"); }
            }

            log("Registration complete!", "ok");
            setRegistered({
                batchId:   bcResult.batchId,
                txHash:    bcResult.txHash,
                products:  finalProducts,
                waybillKey: handoverKey,
                formatted: formatted  // Store formatted IDs
            });
            setStep("results");

        } catch (err) {
            console.error(err);
            log(`Error: ${err.message}`, "err");
            toast.error(err.message || "Registration failed");
            setStep("form");
        }
    };

    // ─────────────────────────────────────────────────────────────
    // DOWNLOAD ZIP
    // ─────────────────────────────────────────────────────────────
    const downloadZip = async () => {
        toast.info("Building ZIP…");
        try {
            const { default: QRCode } = await import("qrcode");
            const { default: JSZip }  = await import("jszip");

            const zip      = new JSZip();
            const qrFolder = zip.folder("consumer_qrcodes");

            // Batch waybill QR (encrypted)
            const waybillRaw = buildWaybillPayload(registered.batchId, registered.waybillKey, account, batchName, registered.products.length);
            const waybillEncrypted = await encryptQR(waybillRaw);
            const waybillPng = await QRCode.toDataURL(
                waybillEncrypted,
                { width: 400, errorCorrectionLevel: "H" }
            );
            zip.file("batch_waybill_qr.png", waybillPng.replace(/^data:image\/png;base64,/, ""), { base64: true });

                // Individual consumer QR per saree
            const formattedBatchId = registered.formatted?.batchId || registered.batchId;
            for (const p of registered.products) {
                const consumerRaw = buildConsumerPayload(p.productId, formattedBatchId);
                const consumerEncrypted = await encryptQR(consumerRaw);
                const png = await QRCode.toDataURL(
                    consumerEncrypted,
                    { width: 300, errorCorrectionLevel: "H" }
                );
                qrFolder.file(`product_${p.productId}_qr.png`, png.replace(/^data:image\/png;base64,/, ""), { base64: true });
            }

            // CSV for label printing
            const csvHeader = "ProductID,SerialName,ScratchCode,BatchHandoverKey,LoomLocation,WeaveDate,ConsumerQR_Data\n";
            const csvRows   = registered.products.map(p => {
                const qr = buildConsumerPayload(p.productId, formattedBatchId);
                return `${p.productId},"${p.name}","${p.consumerSecret}","${p.handoverKey}","${p.loomLocation}","${p.weaveDate}","${qr.replace(/"/g, '""')}"`;
            });
            zip.file("batch_data.csv", csvHeader + csvRows.join("\n"));

            // README
            zip.file("README.txt", [
                `Batch ${registered.formatted?.batchId || `#${registered.batchId}`} — ${batchName}`,
                `Registered: ${new Date().toLocaleString()}`,
                `TX Hash: ${registered.txHash}`,
                `Products: ${registered.products.length}`,
                "",
                "FILES INCLUDED:",
                "  batch_waybill_qr.png   — Scan on /custody page for B2B transfer",
                "  consumer_qrcodes/      — One QR per saree, print on physical labels",
                "  batch_data.csv         — All product IDs + scratch-off codes for printing",
                "",
                "CONSUMER VERIFICATION FLOW:",
                "  1. Each product label has a QR code + silver scratch-off panel",
                "  2. QR encodes a direct URL: /product/<id>",
                "  3. Customer scans QR with phone camera → browser opens product page",
                "  4. Page shows supply chain journey and blockchain proof",
                "  5. Customer scratches off panel → enters code → verified instantly",
                "  6. Customer connects wallet → claims on-chain ownership",
                "",
                "ANTI-COUNTERFEITING:",
                "  • Each saree has a UNIQUE scratch-off code, hash stored immutably on-chain",
                "  • QR does NOT contain the secret — only the physical label does",
                "  • batch_waybill_qr.png contains the handover key — B2B use ONLY",
                "  • Do NOT print the handover key on consumer-facing labels"
            ].join("\n"));

            const blob = await zip.generateAsync({ type: "blob" });
            const safeFilePathBatchId = registered.formatted?.batchId?.replace(/[^a-zA-Z0-9]/g, '') || registered.batchId;
            saveAs(blob, `batch_${safeFilePathBatchId}_export.zip`);
            toast.success("ZIP downloaded!");
        } catch (err) {
            console.error(err);
            toast.error("ZIP generation failed — check console");
        }
    };

    // ─────────────────────────────────────────────────────────────
    // DOWNLOAD WAYBILL
    // ─────────────────────────────────────────────────────────────
    const downloadWaybill = async () => {
        try {
            // Use the new batch API endpoint to get waybill
            const batchIdToUse = registered.formatted?.batchId || registered.batchId;
            const response = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/batch/${batchIdToUse}/waybill?format=qr`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Get the image blob
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // Create download link
            const link = document.createElement('a');
            link.href = url;
            const safeWaybillBatchId = registered.formatted?.batchId?.replace(/[^a-zA-Z0-9]/g, '') || registered.batchId;
            link.download = `batch_${safeWaybillBatchId}_waybill.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            window.URL.revokeObjectURL(url);

            toast.success("Waybill QR downloaded!");
        } catch (err) {
            console.error("Waybill download error:", err);
            toast.error(`Download failed: ${err.message}`);

            // Fallback to old method if new API fails
            try {
                const { default: QRCode } = await import("qrcode");

                const waybillData = buildWaybillPayload(
                    registered.batchId, registered.waybillKey, account,
                    batchName, registered.products.length
                );
                const waybillEncrypted = await encryptQR(waybillData);
                const waybillPng = await QRCode.toDataURL(waybillEncrypted, {
                    width: 400,
                    errorCorrectionLevel: "H"
                });

                // Create download link
                const link = document.createElement('a');
                link.href = waybillPng;
                const safeFallbackBatchId = registered.formatted?.batchId?.replace(/[^a-zA-Z0-9]/g, '') || registered.batchId;
                link.download = `batch_${safeFallbackBatchId}_waybill_fallback.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                toast.success("Waybill downloaded (fallback)!");
            } catch (fallbackErr) {
                console.error("Fallback download failed:", fallbackErr);
                toast.error("Download completely failed — check console");
            }
        }
    };

    // ─────────────────────────────────────────────────────────────
    // SEND EMAIL
    // ─────────────────────────────────────────────────────────────
    const sendEmail = async () => {
        if (!recipientEmail) { toast.error("Enter recipient email"); return; }
        setEmailSending(true);
        try {
            const res = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/email/send-batch-handover-key`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    recipientEmail,
                    batchId:       registered.formatted?.batchId || `#${registered.batchId}`,
                    handoverKey:   registered.waybillKey,
                    senderAddress: account,
                    productCount:  registered.products.length,
                    batchName
                })
            });
            if (res.ok) toast.success(`Key sent to ${recipientEmail}`);
            else        toast.error("Email failed — check backend SMTP config");
        } catch { toast.error("Email service unavailable"); }
        setEmailSending(false);
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="rp-page">

            {/* ── HEADER ─────────────────────────────────────────── */}
            <div className="rp-hero">
                <div className="rp-hero-inner">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                        <div>
                            <span className="rp-badge" style={{ background: "rgba(212,175,55,0.15)", marginBottom: "0.75rem", display: "block" }}>
                                BULK REGISTRY — BLOCKCHAIN BATCH MODE
                            </span>
                            <h1 className="rp-title">Bulk Saree Registration</h1>
                            <p className="rp-sub">
                                Each saree receives its own unique blockchain record and scratch-off code.<br/>
                                A shared waybill secures the batch through the B2B chain of custody.
                            </p>
                        </div>
                        {step === "form" && (
                            <Link to="/create" className="br-mode-btn">
                                <ArrowLeft size={14} /> Single Mode
                            </Link>
                        )}
                    </div>

                    <div className="br-pillars">
                        {[
                            [<Fingerprint size={16}/>, "Unique blockchain ID per saree"],
                            [<Hash size={16}/>,        "Unique scratch-off secret per unit"],
                            [<Key size={16}/>,         "Rolling B2B handover key"],
                            [<ShieldCheck size={16}/>, "Immutable on-chain record"]
                        ].map(([icon, text], i) => (
                            <div key={i} className="br-pillar">{icon}<span>{text}</span></div>
                        ))}
                    </div>
                </div>
            </div>

            <AnimatePresence mode="wait">

                {/* ── FORM ───────────────────────────────────────── */}
                {step === "form" && (
                    <motion.div key="form" className="rp-body"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                        {!account && (
                            <div className="br-alert">
                                <AlertCircle size={15}/> Connect MetaMask to register sarees on the blockchain.
                            </div>
                        )}
                        {account && roleOk === false && (
                            <div className="br-alert br-alert--warn">
                                <AlertCircle size={15}/> Your wallet lacks MANUFACTURER_ROLE. Ask an admin to grant it.
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="rp-card glass br-form">

                            <h3 className="br-section-title"><Package size={17}/> Batch Details</h3>

                            <div className="rp-field">
                                <label>Batch / Collection Name <span className="req">*</span></label>
                                <input type="text" placeholder='"Kasaragod Cotton — April 2026 Batch A"'
                                    value={batchName} onChange={e => setBatchName(e.target.value)} required/>
                                <small>Sarees in this batch will be named "{batchName || "Name"} #001", "#002"…</small>
                            </div>

                            <div className="rp-row">
                                <div className="rp-field">
                                    <label>Loom Location <span className="req">*</span></label>
                                    <input type="text" placeholder="e.g. Kasaragod Unit 4, Loom 12"
                                        value={loomLocation} onChange={e => setLoomLocation(e.target.value)} required/>
                                </div>
                                <div className="rp-field">
                                    <label>Date of Weaving <span className="req">*</span></label>
                                    <input type="date" value={weaveDate} onChange={e => setWeaveDate(e.target.value)} required/>
                                </div>
                            </div>

                            <div className="rp-row">
                                <div className="rp-field">
                                    <label>Quantity <small>Max {MAX_QTY}</small></label>
                                    <input type="number" min={1} max={MAX_QTY} value={quantity}
                                        onChange={e => setQuantity(Math.min(MAX_QTY, Math.max(1, +e.target.value)))} required/>
                                </div>
                                <div className="rp-field">
                                    <label>Batch Handover Key
                                        <small>Shared with first B2B recipient only</small>
                                    </label>
                                    <div className="br-key-row">
                                        <input type="text" className="rp-readonly key-input" value={handoverKey} readOnly/>
                                        <button type="button" className="br-icon-btn" onClick={refreshKey} title="Regenerate">
                                            <RefreshCw size={14}/>
                                        </button>
                                    </div>
                                    <small style={{ color: "var(--accent-gold)" }}>
                                        Never print this on saree labels — for logistics/cooperative use only.
                                    </small>
                                </div>
                            </div>

                            <div className="rp-field">
                                <label>Master Batch Certificate <span className="req">*</span>
                                    <small>PDF/PNG/JPG — linked to all sarees in this batch</small>
                                </label>
                                <div className="file-drop-zone" onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }}>
                                    {certFile
                                        ? <span className="file-chosen"><CheckCircle size={15} style={{ color: "var(--accent-success)" }}/> {certFile.name}</span>
                                        : <><span className="file-icon">📄</span><span>Click to upload certificate</span></>
                                    }
                                </div>
                                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg"
                                    style={{ display: "none" }} onChange={e => setCertFile(e.target.files[0] || null)}/>
                            </div>

                            <div className="rp-field">
                                <label>First Recipient Email
                                    <small>Optional — handover key will be emailed after registration</small>
                                </label>
                                <input type="email" placeholder="cooperative@example.com"
                                    value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}/>
                            </div>

                            <div className="tab-nav-row">
                                <Link to="/" className="btn btn-secondary">Cancel</Link>
                                <button type="submit" className="btn btn-primary register-btn"
                                    disabled={!account || !certFile || roleOk === false}>
                                    Register {quantity} Sarees on Blockchain
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}

                {/* ── LOADING ─────────────────────────────────────── */}
                {step === "loading" && (
                    <motion.div key="loading" className="br-loading-panel"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="br-loading-inner glass rp-card">
                            <div className="br-spinner"/>
                            <h3>Registering on Blockchain</h3>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0.25rem 0 1.5rem" }}>
                                {quantity} sarees — one transaction
                            </p>
                            <div className="br-log">
                                {statusLog.map((l, i) => (
                                    <div key={i} className={`br-log-line br-log--${l.type}`}>
                                        <span className="br-log-time">{l.t}</span>{l.msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── RESULTS ─────────────────────────────────────── */}
                {step === "results" && registered && (
                    <motion.div key="results" className="rp-body"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

                        {/* Summary */}
                        <div className="br-summary-card glass rp-card">
                            <div className="br-summary-header">
                                <CheckCircle size={22} style={{ color: "var(--accent-success)" }}/>
                                <div>
                                    <h3>Batch {registered.formatted?.batchId || `#${registered.batchId}`} Registered</h3>
                                    <p>{registered.products.length} sarees — each with a unique blockchain record &amp; scratch-off code</p>
                                </div>
                            </div>
                            <div className="br-summary-meta">
                                {[
                                    ["Batch ID",   registered.formatted?.batchId || `#${registered.batchId}`],
                                    ["TX Hash",    `${registered.txHash.slice(0, 12)}…${registered.txHash.slice(-6)}`],
                                    ["Products",   registered.products.length],
                                    ["Loom",       loomLocation],
                                    ["Weave Date", weaveDate]
                                ].map(([label, val]) => (
                                    <div key={label} className="br-meta-item">
                                        <label>{label}</label>
                                        <span className="br-mono">{val}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="br-security-badges">
                                <span className="br-badge-ok"><ShieldCheck size={12}/> {registered.products.length} unique consumer secrets on-chain</span>
                                <span className="br-badge-ok"><Key size={12}/> 1 batch handover key issued</span>
                                <span className="br-badge-ok"><Layers size={12}/> Batch {registered.formatted?.batchId || `#${registered.batchId}`} linked on-chain</span>
                            </div>
                        </div>

                        {/* Batch Waybill */}
                        <div className="br-waybill-card glass rp-card">
                            <h3 className="br-section-title">
                                <Package size={17}/> Batch Waybill (B2B)
                                <small style={{ fontWeight: 400, fontSize: "0.78rem", marginLeft: "0.5rem", color: "var(--text-secondary)" }}>
                                    Share with first recipient — contains handover key for custody transfer
                                </small>
                            </h3>
                            <div className="br-waybill-body">
                                <div className="br-waybill-qr">
                                    <QRCodeSVG
                                        value={encryptedWaybillQR || 'pending'}
                                        size={200} level="H" includeMargin
                                    />
                                    <div className="br-waybill-label">BATCH {registered.formatted?.batchId || `#${registered.batchId}`}</div>
                                </div>
                                <div className="br-waybill-details">
                                    {[
                                        ["Batch ID",     registered.formatted?.batchId || `#${registered.batchId}`],
                                        ["Products",     `${registered.products.length} sarees`],
                                        ["Sender",       `${account.slice(0, 8)}…${account.slice(-6)}`]
                                    ].map(([l, v]) => (
                                        <div key={l} className="br-detail-row">
                                            <label>{l}</label><span className="br-mono">{v}</span>
                                        </div>
                                    ))}
                                    <div className="br-detail-row">
                                        <label>Handover Key</label>
                                        <span className="br-mono br-key-display">{registered.waybillKey}</span>
                                    </div>

                                    <div className="br-waybill-actions">
                                        <div className="br-email-row">
                                            <input type="email" className="br-email-input"
                                                placeholder="Recipient email"
                                                value={recipientEmail}
                                                onChange={e => setRecipientEmail(e.target.value)}/>
                                            <button className="btn btn-secondary br-small-btn" onClick={sendEmail} disabled={emailSending}>
                                                <Mail size={13}/> {emailSending ? "Sending…" : "Send Key"}
                                            </button>
                                        </div>
                                        <div className="br-download-row" style={{ marginTop: "0.75rem" }}>
                                            <button className="btn btn-primary br-small-btn" onClick={downloadWaybill}>
                                                <Download size={13}/> Download Waybill QR
                                            </button>
                                        </div>
                                        <p className="br-security-note">
                                            Recipient scans this QR on the Manage Custody page (/custody) to accept the batch and generate the next handover key.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Individual Products Grid */}
                        <div className="br-products-card glass rp-card">
                            <div className="br-products-header" onClick={() => setShowProducts(v => !v)} style={{ cursor: "pointer" }}>
                                <h3 className="br-section-title" style={{ margin: 0 }}>
                                    <Fingerprint size={17}/> Individual Saree Records ({registered.products.length})
                                </h3>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span className="br-badge-ok" style={{ fontSize: "0.72rem" }}>Each verifiable independently by end-consumer</span>
                                    {showProducts ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
                                </div>
                            </div>

                            <AnimatePresence>
                                {showProducts && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                                        <div className="br-products-grid">
                                            {registered.products.map(p => (
                                                <div key={p.productId} className="br-product-item glass">
                                                    <div className="br-product-top">
                                                        <div>
                                                            <div className="br-product-id">
                                                                {registered.formatted?.products?.[p.productId] || `Product #${p.productId}`}
                                                            </div>
                                                            <div className="br-product-name">{p.name}</div>
                                                        </div>
                                                        <QRCodeSVG
                                                            value={encryptedConsumerQRs[p.productId] || 'pending'}
                                                            size={60} level="H" includeMargin
                                                        />
                                                    </div>
                                                    <div className="br-product-secret-row">
                                                        <label>Scratch-Off Code</label>
                                                        <div className="br-secret-val">
                                                            {revealed[p.productId]
                                                                ? <span className="br-mono">{p.consumerSecret}</span>
                                                                : <span style={{ opacity: 0.35, letterSpacing: "3px" }}>•••• •••• ••••</span>
                                                            }
                                                            <button className="br-reveal-btn"
                                                                onClick={() => setRevealed(prev => ({ ...prev, [p.productId]: !prev[p.productId] }))}>
                                                                {revealed[p.productId] ? <EyeOff size={12}/> : <Eye size={12}/>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <a href={`/product/${p.productId}`} target="_blank" rel="noreferrer" className="br-link">
                                                        View product page →
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Download / Actions */}
                        <div className="br-actions-card glass rp-card">
                            <h3 className="br-section-title"><Download size={17}/> Export &amp; Distribute</h3>
                            <p className="br-export-note">
                                ZIP includes: individual consumer QRs (print on labels), batch waybill QR (logistics), full CSV, and security README.
                            </p>
                            <div className="br-action-row">
                                <button className="btn btn-primary" onClick={downloadZip} style={{ flex: 1 }}>
                                    <Download size={15}/> Download ZIP (QRs + CSV + Waybill)
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }}
                                    onClick={() => { setStep("form"); setRegistered(null); setStatusLog([]); setCertFile(null); }}>
                                    Register Another Batch
                                </button>
                                <Link to="/" className="btn btn-secondary" style={{ flex: 1 }}>Back to Dashboard</Link>
                            </div>
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
