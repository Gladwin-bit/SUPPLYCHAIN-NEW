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
            const uploadRes  = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/upload-certificate`, { method: "POST", body: formData });
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
            const dbRes  = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId, name, loomLocation, weaveDate,
                    manufacturerAddress: account,
                    consumerSecretHash,
                    currentHandoverKey: handoverKey,
                    certificateFilename: certFilename,
                    certificatePath: uploadData.path, // Pass the IPFS URL
                    txHash: result?.txHash || ""
                })
            });
            const dbData = await dbRes.json();
            if (!dbData.success) throw new Error(`Database save failed: ${dbData.message}`);

            if (threads[0].supplier || dyes[0].supplier || fabricSources[0].vendor) {
                await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/upload-materials-metadata`, {
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
                    const emailRes  = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/email/send-handover-key`, {
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

            {/* ── Success Screen — full-viewport takeover ──────── */}
            <AnimatePresence>
                {createdProduct && (
                    <motion.div
                        className="rps-screen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                    >
                        {/* Ambient glow blobs */}
                        <div className="rps-blob rps-blob--purple" aria-hidden="true" />
                        <div className="rps-blob rps-blob--cyan"   aria-hidden="true" />

                        {/* ── Header strip ── */}
                        <motion.div
                            className="rps-header"
                            initial={{ opacity: 0, y: -18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.4, ease: [0.22,1,0.36,1] }}
                        >
                            <div className="rps-header-left">
                                <span className="rps-check-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </span>
                                <div>
                                    <h2 className="rps-h2">Saree Registered Successfully</h2>
                                    <p className="rps-h2-sub">
                                        Product <strong>{formattedProductId || `#${createdProduct.id}`}</strong> is live on the blockchain
                                    </p>
                                </div>
                            </div>
                            <button className="rps-close" onClick={() => setCreatedProduct(null)} title="Close">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </motion.div>

                        {/* ── Main content: 3-column bento ── */}
                        <div className="rps-body">

                            {/* LEFT — QR card */}
                            <motion.div
                                className="rps-card rps-card--qr"
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.18, duration: 0.45, ease: [0.22,1,0.36,1] }}
                            >
                                <div className="rps-card-label">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/></svg>
                                    Product QR Code
                                </div>
                                <div className="rps-product-id-badge">
                                    <span className="rps-pid-label">Product ID</span>
                                    <span className="rps-pid-val">{formattedProductId || `#${createdProduct.id}`}</span>
                                </div>
                                <div className="rps-qr-frame">
                                    <QRCodeDisplay productId={createdProduct.id} secretCode={createdProduct.consumerSecret} />
                                </div>
                                <p className="rps-qr-hint">Scan to verify product authenticity</p>
                            </motion.div>

                            {/* CENTRE — Security keys */}
                            <motion.div
                                className="rps-card rps-card--keys"
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.26, duration: 0.45, ease: [0.22,1,0.36,1] }}
                            >
                                <div className="rps-card-label">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Security Keys
                                </div>

                                {/* Scratch code */}
                                <div className="rps-key-block rps-key-block--scratch">
                                    <div className="rps-key-top">
                                        <span className="rps-key-tag">Consumer Scratch Code</span>
                                        <span className="rps-key-badge-pill">Hidden on label</span>
                                    </div>
                                    <div className="rps-key-row">
                                        <code className="rps-key-mono rps-key-mono--purple">{createdProduct.consumerSecret}</code>
                                        <button className="rps-copy-btn" onClick={() => copyToClipboard(createdProduct.consumerSecret, 'scratch')} title="Copy">
                                            {copied === 'scratch'
                                                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            }
                                        </button>
                                    </div>
                                    <p className="rps-key-desc">Print on hidden scratch-off label — never put on QR</p>
                                </div>

                                {/* Handover key */}
                                <div className="rps-key-block rps-key-block--handover">
                                    <div className="rps-key-top">
                                        <span className="rps-key-tag">First Handover Key</span>
                                        <span className="rps-key-badge-pill rps-key-badge-pill--cyan">B2B Transfer</span>
                                    </div>
                                    <div className="rps-key-row">
                                        <code className="rps-key-mono rps-key-mono--cyan">{createdProduct.handoverKey}</code>
                                        <button className="rps-copy-btn" onClick={() => copyToClipboard(createdProduct.handoverKey, 'handover')} title="Copy">
                                            {copied === 'handover'
                                                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            }
                                        </button>
                                    </div>
                                    <p className="rps-key-desc">Share with Cooperative / Distributor at first custody transfer</p>
                                </div>

                                {/* Chain of custody mini-diagram */}
                                <div className="rps-custody-trail">
                                    {['Manufacturer', 'Cooperative', 'Distributor', 'Retailer', 'Customer'].map((node, i, arr) => (
                                        <React.Fragment key={node}>
                                            <span className={`rps-trail-node${i === 0 ? ' rps-trail-node--active' : ''}`}>{node}</span>
                                            {i < arr.length - 1 && <span className="rps-trail-arrow">→</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </motion.div>

                            {/* RIGHT — Actions */}
                            <motion.div
                                className="rps-card rps-card--actions"
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.34, duration: 0.45, ease: [0.22,1,0.36,1] }}
                            >
                                <div className="rps-card-label">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                                    Next Steps
                                </div>

                                <Link to={`/custody?id=${createdProduct.id}`} className="rps-action rps-action--primary">
                                    <span className="rps-action-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                                    </span>
                                    <div className="rps-action-text">
                                        <span className="rps-action-title">Generate Waybill</span>
                                        <span className="rps-action-desc">Create dispatch QR for custody transfer</span>
                                    </div>
                                    <svg className="rps-action-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </Link>

                                <Link to="/create" className="rps-action" onClick={() => setCreatedProduct(null)}>
                                    <span className="rps-action-icon rps-action-icon--dim">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    </span>
                                    <div className="rps-action-text">
                                        <span className="rps-action-title">Register Another</span>
                                        <span className="rps-action-desc">Start a new saree registration</span>
                                    </div>
                                    <svg className="rps-action-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </Link>

                                <Link to="/" className="rps-action">
                                    <span className="rps-action-icon rps-action-icon--dim">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                    </span>
                                    <div className="rps-action-text">
                                        <span className="rps-action-title">Back to Dashboard</span>
                                        <span className="rps-action-desc">View all your registered sarees</span>
                                    </div>
                                    <svg className="rps-action-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </Link>

                                {/* Blockchain confirmation pill */}
                                <div className="rps-confirm-pill">
                                    <span className="rps-confirm-dot" />
                                    <span>Transaction confirmed on Hardhat #31337</span>
                                </div>
                            </motion.div>

                        </div>{/* /rps-body */}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RecordProcedure;
