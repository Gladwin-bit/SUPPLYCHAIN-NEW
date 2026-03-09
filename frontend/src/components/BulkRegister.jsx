// src/components/BulkRegister.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { motion, AnimatePresence } from "framer-motion";
import { generateShortSecretCode, hashSecretCode } from "../utils/secretCodeGenerator";
import { ethers } from "ethers";
import { saveAs } from 'file-saver';
import { toast } from "react-toastify";
import "../pages/RecordProcedure.css"; // Reuse existing premium styles

const BulkRegister = () => {
    const { account, createProductsBulk } = useSupplyChain();

    // Form State
    const [form, setForm] = useState({
        name: "",
        loomLocation: "",
        weaveDate: "",
        handoverKey: "",
        quantity: 5,
        certificateFile: null
    });

    // UI State
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [createdProducts, setCreatedProducts] = useState(null);
    const [createdBatchId, setCreatedBatchId] = useState(null);

    // Auto-generate handover key on mount
    useEffect(() => {
        if (!form.handoverKey) {
            setForm(prev => ({ ...prev, handoverKey: generateShortSecretCode("HANDOVER", "B2B") }));
        }
    }, [form.handoverKey]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        setForm(prev => ({ ...prev, certificateFile: e.target.files[0] }));
    };

    const handleBulkRecord = async (e) => {
        e.preventDefault();
        if (!account) { setStatus("⚠️ Connect wallet first"); return; }
        if (!form.certificateFile) { setStatus("⚠️ Upload a product certificate"); return; }

        setLoading(true); setStatus(""); setCreatedProducts(null);
        try {
            setStatus("📤 Uploading master certificate...");
            const formData = new FormData();
            formData.append("certificate", form.certificateFile);

            const uploadRes = await fetch("http://localhost:5000/api/products/upload-certificate", {
                method: "POST",
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok || !uploadData.success) throw new Error(uploadData.message || "Certificate upload failed");

            const certFilename = uploadData.filename;

            setStatus(`🔐 Generating ${form.quantity} unique codes...`);
            const productsData = [];
            const consumerSecretHashes = [];

            for (let i = 0; i < form.quantity; i++) {
                const secret = generateShortSecretCode(`BULK-${i}`, form.name);
                const secretHash = hashSecretCode(secret);
                productsData.push({
                    name: `${form.name} #${i + 1}`,
                    loomLocation: form.loomLocation,
                    weaveDate: form.weaveDate,
                    consumerSecret: secret,
                    consumerSecretHash: secretHash,
                    handoverKey: form.handoverKey
                });
                consumerSecretHashes.push(secretHash);
            }

            setStatus("⛓️ Creating batch on blockchain (One transaction)...");
            const handoverKeyHash = hashSecretCode(form.handoverKey);
            const weaveDateTimestamp = Math.floor(new Date(form.weaveDate).getTime() / 1000);

            const bcResult = await createProductsBulk(
                form.name,
                form.loomLocation,
                weaveDateTimestamp,
                consumerSecretHashes,
                handoverKeyHash,
                certFilename
            );

            // Map blockchain results (productIds) back to our generated data
            const productsToRegister = productsData.map((p, idx) => ({
                ...p,
                productId: bcResult.productIds[idx]
            }));

            // ✅ Show CSV immediately after blockchain success — DB is secondary
            setCreatedProducts(productsToRegister);
            setCreatedBatchId(bcResult.batchId);
            setStatus(`✅ Batch #${bcResult.batchId || ''} of ${form.quantity} registered on blockchain! Saving to database...`);
            toast.success("Bulk registration complete! 🎉");

            // Non-fatal DB save — blockchain is source of truth
            try {
                const dbRes = await fetch("http://localhost:5000/api/products/bulk-register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        products: productsToRegister,
                        batchId: bcResult.batchId,
                        manufacturerAddress: account,
                        certificateFilename: certFilename,
                        txHash: bcResult.txHash
                    })
                });
                const dbData = await dbRes.json();
                if (dbRes.ok && dbData.success) {
                    setStatus(`✅ Batch of ${form.quantity} registered successfully!`);
                } else {
                    console.warn("DB save warning:", dbData.message);
                    setStatus(`✅ Blockchain registration complete. (DB note: ${dbData.message || "sync pending"})`);
                }
            } catch (dbErr) {
                console.warn("DB save failed (non-fatal):", dbErr.message);
                setStatus(`✅ Blockchain registration complete. Download your CSV below.`);
            }

        } catch (e) {
            console.error(e);
            setStatus(`❌ Error: ${e.message || "Bulk registration failed"}`);
            toast.error("Bulk registration failed");
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = async () => {
        if (!createdProducts) return;

        try {
            // Import dynamically to avoid issues if loading before interaction
            const QRCode = (await import('qrcode')).default;
            const JSZip = (await import('jszip')).default;

            const zip = new JSZip();
            const imagesFolder = zip.folder("qr_codes");

            const header = "ProductID,Product Name,ScratchCode,HandoverKey,LoomLocation,WeaveDate,QRCode_Data\n";
            let rows = [];

            setStatus("📦 Generating QR Codes and preparing ZIP...");
            setLoading(true);

            for (const p of createdProducts) {
                const qrDataObj = { productId: p.productId, secretCode: p.consumerSecret };
                const qrDataStr = JSON.stringify(qrDataObj);

                // Add to CSV rows (escaping quotes for CSV)
                rows.push(`${p.productId},"${p.name}",${p.consumerSecret},${p.handoverKey},"${p.loomLocation}",${p.weaveDate},"${qrDataStr.replace(/"/g, '""')}"`);

                // Generate QR image as Data URI
                const qrDataUri = await QRCode.toDataURL(qrDataStr, {
                    errorCorrectionLevel: 'H',
                    margin: 2,
                    width: 300
                });

                // Extract base64 part
                const base64Data = qrDataUri.replace(/^data:image\/png;base64,/, "");

                // Add to zip folder
                imagesFolder.file(`product_${p.productId}_qr.png`, base64Data, { base64: true });
            }

            // Add CSV to zip
            zip.file("batch_data.csv", header + rows.join("\n"));

            // Generate zip file
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `bulk_batch_${createdBatchId}_export.zip`);

            setStatus(`✅ Export complete! ZIP file downloaded.`);
            toast.success("Batch exported successfully!");
        } catch (error) {
            console.error("Error generating zip:", error);
            setStatus("❌ Error exporting batch data");
            toast.error("Failed to export ZIP file");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rp-page">
            <div className="rp-hero">
                <div className="rp-hero-inner">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span className="rp-badge" style={{ background: 'rgba(212,175,55,0.15)' }}>BULK REGISTRY MODE</span>
                            <h1 className="rp-title">Bulk Saree Entry</h1>
                            <p className="rp-sub">Register multiple authentic sarees in a single blockchain transaction</p>
                        </div>
                        <Link to="/create" className="rp-badge" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                            🔙 Single Mode
                        </Link>
                    </div>
                </div>
            </div>

            <div className="rp-body">
                <div className="rp-card glass">
                    <div className="rp-tab-content" style={{ padding: '2.5rem' }}>
                        <form onSubmit={handleBulkRecord} className="tab-fields">
                            <div className="rp-field">
                                <label>Batch Name (e.g. "Kasaragod Cotton — Batch A")</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Prefix for all sarees in this batch"
                                    value={form.name}
                                    onChange={handleChange}
                                    disabled={loading}
                                    required
                                />
                            </div>

                            <div className="rp-row">
                                <div className="rp-field">
                                    <label>Loom Location</label>
                                    <input
                                        type="text"
                                        name="loomLocation"
                                        placeholder="e.g. Unit 4, Loom 12"
                                        value={form.loomLocation}
                                        onChange={handleChange}
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                <div className="rp-field">
                                    <label>Date of Weaving</label>
                                    <input
                                        type="date"
                                        name="weaveDate"
                                        value={form.weaveDate}
                                        onChange={handleChange}
                                        disabled={loading}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="rp-row">
                                <div className="rp-field">
                                    <label>
                                        📦 Quantity
                                        <small>How many sarees to register? (1-50)</small>
                                    </label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        min="1"
                                        max="50"
                                        value={form.quantity}
                                        onChange={handleChange}
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                <div className="rp-field">
                                    <label>
                                        🔑 Shared Handover Key
                                        <small>Used for the first custody transfer</small>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.handoverKey}
                                        readOnly
                                        className="rp-readonly key-input"
                                    />
                                </div>
                            </div>

                            <div className="rp-field">
                                <label>📎 Master Certificate / Batch Asset</label>
                                <div className="file-drop-zone" onClick={() => !loading && document.getElementById("bulk-cert").click()}>
                                    {form.certificateFile ? (
                                        <span className="file-chosen">✓ {form.certificateFile.name}</span>
                                    ) : (
                                        <>
                                            <span className="file-icon">📄</span>
                                            <span>Click to upload PDF / PNG / JPG</span>
                                            <small>This certificate will be linked to all sarees in this batch</small>
                                        </>
                                    )}
                                </div>
                                <input
                                    id="bulk-cert"
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    style={{ display: "none" }}
                                    onChange={handleFileChange}
                                    disabled={loading}
                                />
                            </div>

                            {status && (
                                <div className={`rp-status ${status.startsWith("✅") ? "rp-status--ok" : status.startsWith("❌") ? "rp-status--err" : "rp-status--info"}`}>
                                    {status}
                                </div>
                            )}

                            <div className="tab-nav-row">
                                <Link to="/" className="btn btn-secondary">Cancel</Link>
                                <button type="submit" className="btn btn-primary register-btn" disabled={loading || !form.certificateFile}>
                                    {loading ? "Registering Batch..." : "⛓️ Register Saree Batch"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Success Overlay */}
            <AnimatePresence>
                {createdProducts && (
                    <motion.div className="rp-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="rp-result-card glass" style={{ maxWidth: '550px' }}>
                            <button className="rp-overlay-close" onClick={() => setCreatedProducts(null)}>×</button>
                            <h3>✅ Batch #{createdBatchId || "N/A"} Registered Successfully!</h3>
                            <div className="rp-status rp-status--ok" style={{ marginBottom: '1.5rem' }}>
                                {createdProducts.length} unique products are now recorded on the blockchain.
                            </div>

                            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Download the CSV file containing the scratch-off codes and product IDs.
                                    You will need these to print labels for each saree.
                                </p>
                            </div>

                            <div className="rp-result-actions">
                                <button onClick={downloadCSV} className="btn btn-primary" style={{ width: "100%", background: 'var(--accent-success)' }}>
                                    📥 Download Codes (CSV)
                                </button>
                                <Link to="/" className="btn btn-secondary" style={{ width: "100%" }}>
                                    ← Back to Dashboard
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BulkRegister;
