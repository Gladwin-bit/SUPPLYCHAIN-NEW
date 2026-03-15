// src/pages/RecordProcedure.js
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSupplyChain } from "../hooks/useSupplyChain";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { motion, AnimatePresence } from "framer-motion";
import { generateShortSecretCode } from "../utils/secretCodeGenerator";
import { ethers } from "ethers";
import "./RecordProcedure.css";
import { ConnectButton } from "../components/ConnectButton";

const TABS = [
    { id: 0, label: "Basic Info",    icon: "📋", desc: "Saree name, loom & date" },
    { id: 1, label: "Materials",     icon: "🧵", desc: "Threads, dyes & vendors" },
    { id: 2, label: "Keys & Cert",   icon: "🔐", desc: "Secret codes & certificate" },
];

const RecordProcedure = () => {
    const { account, createProduct, hasRole, getFormattedProductId, ROLES } = useSupplyChain();

    // ── Form State ───────────────────────────────────────────────
    const [name,                  setName]                  = useState("");
    const [loomLocation,          setLoomLocation]          = useState("");
    const [weaveDate,             setWeaveDate]             = useState("");
    const [consumerSecret,        setConsumerSecret]        = useState("");
    const [handoverKey,           setHandoverKey]           = useState("");
    const [certificateFile,       setCertificateFile]       = useState(null);
    const [firstRecipientEmail,   setFirstRecipientEmail]   = useState("");

    // ── Material State ───────────────────────────────────────────
    const [threads,       setThreads]       = useState([{ supplier: "", type: "", colors: "", quantity: "", batchNumber: "" }]);
    const [dyes,          setDyes]          = useState([{ supplier: "", colorCode: "", colorName: "", batchNumber: "", type: "" }]);
    const [fabricSources, setFabricSources] = useState([{ vendor: "", material: "", quantity: "" }]);
    const [materialNotes, setMaterialNotes] = useState("");

    // ── UI State ─────────────────────────────────────────────────
    const [activeTab,     setActiveTab]     = useState(0);
    const [status,        setStatus]        = useState("");
    const [loading,       setLoading]       = useState(false);
    const [createdProduct, setCreatedProduct] = useState(null);
    const [copied,        setCopied]        = useState("");
    const [formattedProductId, setFormattedProductId] = useState("");

    // ── Auto-generate keys on mount ──────────────────────────────
    const regenerateKeys = useCallback(() => {
        setConsumerSecret(generateShortSecretCode("CONSUMER", "SCRATCH"));
        setHandoverKey(generateShortSecretCode("HANDOVER", "B2B"));
    }, []);

    useEffect(() => { regenerateKeys(); }, [regenerateKeys]);

    // ── Copy to clipboard ────────────────────────────────────────
    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(label);
            setTimeout(() => setCopied(""), 2000);
        });
    };

    // ── Thread helpers ───────────────────────────────────────────
    const addThread       = ()              => setThreads(prev => [...prev, { supplier: "", type: "", colors: "", quantity: "", batchNumber: "" }]);
    const updateThread    = (i, field, val) => setThreads(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
    const removeThread    = (i)             => setThreads(prev => prev.filter((_, idx) => idx !== i));

    // ── Dye helpers ──────────────────────────────────────────────
    const addDye          = ()              => setDyes(prev => [...prev, { supplier: "", colorCode: "", colorName: "", batchNumber: "", type: "" }]);
    const updateDye       = (i, field, val) => setDyes(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
    const removeDye       = (i)             => setDyes(prev => prev.filter((_, idx) => idx !== i));

    // ── Fabric source helpers ────────────────────────────────────
    const addFabricSource    = ()              => setFabricSources(prev => [...prev, { vendor: "", material: "", quantity: "" }]);
    const updateFabricSource = (i, field, val) => setFabricSources(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
    const removeFabricSource = (i)             => setFabricSources(prev => prev.filter((_, idx) => idx !== i));

    // ── Submit ───────────────────────────────────────────────────
    const handleRecord = async () => {
        if (!account)                           { setStatus("⚠️ Connect wallet first"); return; }
        if (!name || !loomLocation || !weaveDate) { setStatus("⚠️ Complete all Basic Info fields"); setActiveTab(0); return; }
        if (!certificateFile)                   { setStatus("⚠️ Upload a product certificate"); setActiveTab(2); return; }

        setLoading(true); setStatus(""); setCreatedProduct(null);

        try {
            const hasManufacturerRole = await hasRole(ROLES.MANUFACTURER, account);
            if (!hasManufacturerRole) {
                setStatus("⛔️ Your wallet does not have MANUFACTURER permissions. Contact admin.");
                setLoading(false);
                return;
            }

            setStatus("📤 Uploading certificate…");
            const formData = new FormData();
            formData.append("certificate", certificateFile);
            const uploadRes  = await fetch("http://localhost:5000/api/products/upload-certificate", { method: "POST", body: formData });
            const uploadData = await uploadRes.json();
            if (!uploadData.success) throw new Error("Certificate upload failed");

            const certFilename = uploadData.filename;

            setStatus("⛳️ Creating product on blockchain…");
            const consumerSecretHash = ethers.keccak256(ethers.toUtf8Bytes(consumerSecret));
            const handoverKeyHash    = ethers.keccak256(ethers.toUtf8Bytes(handoverKey));
            const weaveDateTimestamp = Math.floor(new Date(weaveDate).getTime() / 1000);

            let result, productId;
            try {
                result    = await createProduct(name, loomLocation, weaveDateTimestamp, consumerSecretHash, handoverKeyHash, certFilename);
                productId = result?.productId;
            } catch (err) {
                let errorMsg = err.reason || err.data?.message || err.message || "Failed to register Saree";
                if (err.error?.message) errorMsg = err.error.message;
                setStatus(`❌ Blockchain error: ${errorMsg}`);
                setLoading(false);
                return;
            }

            setStatus("💾 Saving to database…");
            await fetch("http://localhost:5000/api/products/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId, name, loomLocation, weaveDate,
                    manufacturerAddress: account,
                    consumerSecretHash,
                    currentHandoverKey: handoverKey,
                    certificateFilename: certFilename,
                    txHash: result?.txHash || ""
                })
            });

            if (threads[0].supplier || dyes[0].supplier || fabricSources[0].vendor) {
                await fetch("http://localhost:5000/api/products/upload-materials-metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productName: name, materials: { threads, dyes, fabricSources, notes: materialNotes } })
                });
            }

            setStatus("✅ Saree registered on blockchain!");

            // Format the product ID for display
            try {
                setStatus("🏷️ Formatting product ID...");
                const formatted = await getFormattedProductId(productId);
                setFormattedProductId(formatted);
            } catch (err) {
                console.warn("Failed to format product ID:", err);
                setFormattedProductId(`#${productId}`); // Fallback
            }

            setCreatedProduct({ id: productId, consumerSecret, handoverKey });

            if (firstRecipientEmail) {
                try {
                    setStatus("📧 Sending handover key to recipient…");
                    const emailRes  = await fetch("http://localhost:5000/api/email/send-handover-key", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ recipientEmail: firstRecipientEmail, productId, productName: name, handoverKey })
                    });
                    const emailData = await emailRes.json();
                    setStatus(emailData.success
                        ? `✅ Saree registered! Handover key emailed to ${firstRecipientEmail}`
                        : `✅ Saree registered! (Email failed: ${emailData.message})`);
                } catch {
                    setStatus("✅ Saree registered! (Could not send email)");
                }
            }

            // Reset
            setName(""); setLoomLocation(""); setWeaveDate(""); setCertificateFile(null);
            setFirstRecipientEmail("");
            setThreads([{ supplier: "", type: "", colors: "", quantity: "", batchNumber: "" }]);
            setDyes([{ supplier: "", colorCode: "", colorName: "", batchNumber: "", type: "" }]);
            setFabricSources([{ vendor: "", material: "", quantity: "" }]);
            setMaterialNotes("");
            regenerateKeys();
        } catch (e) {
            console.error(e);
            setStatus(`❌ Error: ${e.message || "Failed to register Saree"}`);
        } finally {
            setLoading(false);
        }
    };

    // ── Tab 0: Basic Info ────────────────────────────────────────
    const tab0 = (
        <div className="rp-tab-fields">
            <div className="rp-field">
                <label className="rp-label">Saree Name / ID</label>
                <input
                    className="rp-input"
                    type="text"
                    placeholder="e.g. Kasaragod Cotton — Batch 105"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={loading}
                />
            </div>
            <div className="rp-row">
                <div className="rp-field">
                    <label className="rp-label">Loom Location</label>
                    <input
                        className="rp-input"
                        type="text"
                        placeholder="e.g. Weaving Center A, Loom 4"
                        value={loomLocation}
                        onChange={e => setLoomLocation(e.target.value)}
                        disabled={loading}
                    />
                </div>
                <div className="rp-field">
                    <label className="rp-label">Date of Weaving</label>
                    <input
                        className="rp-input"
                        type="date"
                        value={weaveDate}
                        onChange={e => setWeaveDate(e.target.value)}
                        disabled={loading}
                    />
                </div>
            </div>
            <div className="rp-tab-nav">
                <span />
                <button
                    className="rp-btn rp-btn--primary"
                    onClick={() => setActiveTab(1)}
                    disabled={!name || !loomLocation || !weaveDate}
                >
                    Next: Materials <span className="rp-btn-arrow">→</span>
                </button>
            </div>
        </div>
    );

    // ── Tab 1: Materials ─────────────────────────────────────────
    const tab1 = (
        <div className="rp-tab-fields">
            {/* Threads */}
            <div className="mat-group">
                <div className="mat-group-hd">
                    <span className="mat-group-title"><span className="mat-icon">🧵</span> Thread Suppliers</span>
                    <button className="mat-add-btn" onClick={addThread} disabled={loading}>+ Add Row</button>
                </div>
                {threads.map((t, i) => (
                    <div key={i} className="mat-entry mat-entry--5">
                        <input className="rp-input rp-input--sm" placeholder="Supplier" value={t.supplier}    onChange={e => updateThread(i, "supplier",    e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Type"     value={t.type}        onChange={e => updateThread(i, "type",        e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Colours"  value={t.colors}      onChange={e => updateThread(i, "colors",      e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Qty"      value={t.quantity}    onChange={e => updateThread(i, "quantity",    e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Batch #"  value={t.batchNumber} onChange={e => updateThread(i, "batchNumber", e.target.value)} disabled={loading} />
                        {threads.length > 1 && <button className="mat-rm-btn" onClick={() => removeThread(i)}>✕</button>}
                    </div>
                ))}
            </div>

            {/* Dyes */}
            <div className="mat-group">
                <div className="mat-group-hd">
                    <span className="mat-group-title"><span className="mat-icon">🎨</span> Dye Suppliers</span>
                    <button className="mat-add-btn" onClick={addDye} disabled={loading}>+ Add Row</button>
                </div>
                {dyes.map((d, i) => (
                    <div key={i} className="mat-entry mat-entry--5">
                        <input className="rp-input rp-input--sm" placeholder="Supplier"    value={d.supplier}    onChange={e => updateDye(i, "supplier",    e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Colour code" value={d.colorCode}   onChange={e => updateDye(i, "colorCode",   e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Colour name" value={d.colorName}   onChange={e => updateDye(i, "colorName",   e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Batch #"     value={d.batchNumber} onChange={e => updateDye(i, "batchNumber", e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Type"        value={d.type}        onChange={e => updateDye(i, "type",        e.target.value)} disabled={loading} />
                        {dyes.length > 1 && <button className="mat-rm-btn" onClick={() => removeDye(i)}>✕</button>}
                    </div>
                ))}
            </div>

            {/* Fabric Vendors */}
            <div className="mat-group">
                <div className="mat-group-hd">
                    <span className="mat-group-title"><span className="mat-icon">🏭</span> Fabric & Material Vendors</span>
                    <button className="mat-add-btn" onClick={addFabricSource} disabled={loading}>+ Add Row</button>
                </div>
                {fabricSources.map((f, i) => (
                    <div key={i} className="mat-entry mat-entry--3">
                        <input className="rp-input rp-input--sm" placeholder="Vendor"   value={f.vendor}    onChange={e => updateFabricSource(i, "vendor",    e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Material" value={f.material}  onChange={e => updateFabricSource(i, "material",  e.target.value)} disabled={loading} />
                        <input className="rp-input rp-input--sm" placeholder="Qty"      value={f.quantity}  onChange={e => updateFabricSource(i, "quantity",  e.target.value)} disabled={loading} />
                        {fabricSources.length > 1 && <button className="mat-rm-btn" onClick={() => removeFabricSource(i)}>✕</button>}
                    </div>
                ))}
            </div>

            <div className="rp-field" style={{ marginTop: "1.25rem" }}>
                <label className="rp-label">📝 Additional Notes</label>
                <textarea
                    className="rp-input rp-textarea"
                    placeholder="Any additional information about materials, techniques, or processes…"
                    value={materialNotes}
                    onChange={e => setMaterialNotes(e.target.value)}
                    disabled={loading}
                    rows={3}
                />
            </div>

            <div className="rp-tab-nav">
                <button className="rp-btn rp-btn--ghost" onClick={() => setActiveTab(0)}>← Back</button>
                <button className="rp-btn rp-btn--primary" onClick={() => setActiveTab(2)}>Next: Keys & Cert <span className="rp-btn-arrow">→</span></button>
            </div>
        </div>
    );

    // ── Tab 2: Keys & Certificate ────────────────────────────────
    const tab2 = (
        <div className="rp-tab-fields">
            {/* Keys section */}
            <div className="rp-keys-grid">
                {/* Consumer Secret */}
                <div className="rp-key-card rp-key-card--consumer">
                    <div className="rp-key-header">
                        <div className="rp-key-icon">🎫</div>
                        <div>
                            <div className="rp-key-title">Consumer Scratch-Off Code</div>
                            <div className="rp-key-subtitle">Print on hidden scratch label — never changes</div>
                        </div>
                    </div>
                    <div className="rp-key-value-row">
                        <code className="rp-key-value">{consumerSecret || "Generating…"}</code>
                        <div className="rp-key-actions">
                            <button
                                className="rp-icon-btn"
                                title="Copy"
                                onClick={() => copyToClipboard(consumerSecret, "consumer")}
                            >
                                {copied === "consumer" ? "✓" : "⧉"}
                            </button>
                            <button
                                className="rp-icon-btn"
                                title="Regenerate"
                                onClick={() => setConsumerSecret(generateShortSecretCode("CONSUMER", "SCRATCH"))}
                            >
                                ↻
                            </button>
                        </div>
                    </div>
                </div>

                {/* Handover Key */}
                <div className="rp-key-card rp-key-card--handover">
                    <div className="rp-key-header">
                        <div className="rp-key-icon">🔑</div>
                        <div>
                            <div className="rp-key-title">First Handover Key</div>
                            <div className="rp-key-subtitle">Share with Cooperative / Distributor at first custody transfer</div>
                        </div>
                    </div>
                    <div className="rp-key-value-row">
                        <code className="rp-key-value">{handoverKey || "Generating…"}</code>
                        <div className="rp-key-actions">
                            <button
                                className="rp-icon-btn"
                                title="Copy"
                                onClick={() => copyToClipboard(handoverKey, "handover")}
                            >
                                {copied === "handover" ? "✓" : "⧉"}
                            </button>
                            <button
                                className="rp-icon-btn"
                                title="Regenerate"
                                onClick={() => setHandoverKey(generateShortSecretCode("HANDOVER", "B2B"))}
                            >
                                ↻
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <button className="rp-regen-all-btn" onClick={regenerateKeys} disabled={loading}>
                ↻ Regenerate Both Keys
            </button>

            {/* Email */}
            <div className="rp-field">
                <label className="rp-label">📧 First Recipient's Email <span className="rp-label-opt">(optional)</span></label>
                <input
                    className="rp-input rp-input--email"
                    type="email"
                    placeholder="e.g. distributor@example.com"
                    value={firstRecipientEmail}
                    onChange={e => setFirstRecipientEmail(e.target.value)}
                    disabled={loading}
                />
                <span className="rp-input-hint">Handover key will be automatically emailed after registration</span>
            </div>

            {/* Certificate upload */}
            <div className="rp-field">
                <label className="rp-label">📎 Asset Image / Certificate</label>
                <div
                    className={`rp-drop-zone ${certificateFile ? "rp-drop-zone--filled" : ""}`}
                    onClick={() => document.getElementById("cert-upload").click()}
                >
                    {certificateFile ? (
                        <div className="rp-drop-filled">
                            <span className="rp-drop-check">✓</span>
                            <span className="rp-drop-fname">{certificateFile.name}</span>
                            <button
                                className="rp-drop-clear"
                                onClick={e => { e.stopPropagation(); setCertificateFile(null); }}
                            >✕</button>
                        </div>
                    ) : (
                        <div className="rp-drop-empty">
                            <span className="rp-drop-icon">📄</span>
                            <span className="rp-drop-text">Click to upload PDF / PNG / JPG</span>
                            <span className="rp-drop-hint">Max 5 MB</span>
                        </div>
                    )}
                </div>
                <input
                    id="cert-upload"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    style={{ display: "none" }}
                    onChange={e => setCertificateFile(e.target.files[0])}
                    disabled={loading}
                />
            </div>

            {/* Status */}
            {status && (
                <div className={`rp-status ${
                    status.startsWith("✅") ? "rp-status--ok" :
                    status.startsWith("❌") || status.startsWith("⛔") ? "rp-status--err" :
                    "rp-status--info"
                }`}>
                    {status}
                </div>
            )}

            <div className="rp-tab-nav">
                <button className="rp-btn rp-btn--ghost" onClick={() => setActiveTab(1)} disabled={loading}>← Back</button>
                <button
                    className="rp-btn rp-btn--register"
                    onClick={handleRecord}
                    disabled={loading || !certificateFile}
                >
                    {loading
                        ? <><span className="rp-spinner" /> Registering…</>
                        : "⛓️ Register Saree"
                    }
                </button>
            </div>
        </div>
    );

    const tabContent = { 0: tab0, 1: tab1, 2: tab2 };

    return (
        <div className="rp-page">
            {/* ── Hero ─────────────────────────────────────────── */}
            <div className="rp-hero">
                <div className="rp-hero-inner">
                    <div className="rp-hero-top">
                        <div>
                            <span className="rp-badge">KASARAGOD WEAVERS</span>
                            <h1 className="rp-title">Saree Registry</h1>
                            <p className="rp-sub">Digitally certify authentic handloom sarees on the blockchain</p>
                        </div>
                        <Link to="/create-bulk" className="rp-hero-link">
                            📦 Bulk Mode
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────── */}
            <div className="rp-body">
                {!account ? (
                    <div className="rp-connect-wall">
                        <div className="rp-connect-icon">🔌</div>
                        <h3 className="rp-connect-title">Wallet Required</h3>
                        <p className="rp-connect-sub">Connect your MetaMask wallet to access the Saree Registry</p>
                        <ConnectButton onClick={() => {}} />
                    </div>
                ) : (
                    <div className="rp-card">
                        {/* ── Stepper ──────────────────────────── */}
                        <div className="rp-stepper">
                            {TABS.map((tab, i) => (
                                <React.Fragment key={tab.id}>
                                    <button
                                        className={`rp-step ${activeTab === tab.id ? "rp-step--active" : ""} ${i < activeTab ? "rp-step--done" : ""}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        disabled={loading}
                                    >
                                        <div className="rp-step-circle">
                                            {i < activeTab ? "✓" : <span className="rp-step-icon">{tab.icon}</span>}
                                        </div>
                                        <div className="rp-step-text">
                                            <span className="rp-step-label">{tab.label}</span>
                                            <span className="rp-step-desc">{tab.desc}</span>
                                        </div>
                                    </button>
                                    {i < TABS.length - 1 && <div className={`rp-step-connector ${i < activeTab ? "rp-step-connector--done" : ""}`} />}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* ── Progress ─────────────────────────── */}
                        <div className="rp-progress-track">
                            <div className="rp-progress-fill" style={{ width: `${((activeTab + 1) / TABS.length) * 100}%` }} />
                        </div>

                        {/* ── Tab Content ──────────────────────── */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="rp-content"
                            >
                                {tabContent[activeTab]}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* ── Success Overlay ─ Horizontal Tabbed Layout ──── */}
            <AnimatePresence>
                {createdProduct && (
                    <motion.div className="rp-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div
                            className="rp-success-panel"
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {/* Top bar */}
                            <div className="rps-topbar">
                                <div className="rps-topbar-left">
                                    <span className="rps-success-icon">✅</span>
                                    <div>
                                        <h2 className="rps-title">Saree Registered Successfully</h2>
                                        <p className="rps-subtitle">Product {formattedProductId || `#${createdProduct.id}`} is now live on the blockchain</p>
                                    </div>
                                </div>
                                <button className="rp-overlay-close" onClick={() => setCreatedProduct(null)}>×</button>
                            </div>

                            {/* Horizontal content grid */}
                            <div className="rps-grid">
                                {/* Column 1 — QR Code */}
                                <motion.div
                                    className="rps-col"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1, duration: 0.3 }}
                                >
                                    <div className="rps-col-header">
                                        <span className="rps-col-icon">📱</span>
                                        <span className="rps-col-label">Product QR Code</span>
                                    </div>
                                    <div className="rps-qr-area">
                                        <QRCodeDisplay productId={createdProduct.id} secretCode={createdProduct.consumerSecret} />
                                    </div>
                                </motion.div>

                                {/* Column 2 — Security Keys */}
                                <motion.div
                                    className="rps-col"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.3 }}
                                >
                                    <div className="rps-col-header">
                                        <span className="rps-col-icon">🔐</span>
                                        <span className="rps-col-label">Security Keys</span>
                                    </div>
                                    <div className="rps-keys">
                                        <div className="rps-key-card rps-key-card--gold">
                                            <span className="rps-key-badge">Consumer Scratch Code</span>
                                            <code className="rps-key-value rps-key-value--gold">{createdProduct.consumerSecret}</code>
                                            <p className="rps-key-hint">Share this with the end consumer for verification</p>
                                        </div>
                                        <div className="rps-key-card rps-key-card--blue">
                                            <span className="rps-key-badge">Handover Key</span>
                                            <code className="rps-key-value rps-key-value--blue">{createdProduct.handoverKey}</code>
                                            <p className="rps-key-hint">Used to transfer custody to the next party</p>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Column 3 — Next Steps */}
                                <motion.div
                                    className="rps-col"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3, duration: 0.3 }}
                                >
                                    <div className="rps-col-header">
                                        <span className="rps-col-icon">🚀</span>
                                        <span className="rps-col-label">Next Steps</span>
                                    </div>
                                    <div className="rps-actions">
                                        <Link to={`/custody?id=${createdProduct.id}`} className="rps-action-card rps-action-card--primary">
                                            <span className="rps-act-icon">📤</span>
                                            <div>
                                                <span className="rps-act-title">Generate Waybill</span>
                                                <span className="rps-act-desc">Create QR waybill to dispatch this saree</span>
                                            </div>
                                            <span className="rps-act-arrow">→</span>
                                        </Link>
                                        <Link to="/create" className="rps-action-card" onClick={() => setCreatedProduct(null)}>
                                            <span className="rps-act-icon">✨</span>
                                            <div>
                                                <span className="rps-act-title">Register Another</span>
                                                <span className="rps-act-desc">Start a new saree registration</span>
                                            </div>
                                            <span className="rps-act-arrow">→</span>
                                        </Link>
                                        <Link to="/" className="rps-action-card">
                                            <span className="rps-act-icon">🏠</span>
                                            <div>
                                                <span className="rps-act-title">Back to Dashboard</span>
                                                <span className="rps-act-desc">View all your registered sarees</span>
                                            </div>
                                            <span className="rps-act-arrow">→</span>
                                        </Link>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RecordProcedure;
