// src/pages/ManageCustody.js
import React, { useState, useEffect } from "react";
import { useSupplyChain } from "../hooks/useSupplyChain";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import WaybillCertificate from "../components/WaybillCertificate";
import { generateShortSecretCode } from "../utils/secretCodeGenerator";
import { Truck, Upload, Search, Download, ShieldCheck, MapPin, Camera } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import "./ManageCustody.css";
import { encryptQR, decryptQR } from "../utils/qrEncryption";

import { ConnectButton } from "../components/ConnectButton";

const ManageCustody = () => {
    const { account, connectWallet, transferCustody, transferBatchCustody, getProductData, getBatchData, hasRole, getFormattedProductId, getFormattedBatchId, getProductDataSmart, getBatchDataSmart } = useSupplyChain();

    // Tab state: 'single' or 'bulk'
    const [activeTab, setActiveTab] = useState('single');
    const [searchParams] = useSearchParams();

    const [productId, setProductId] = useState(searchParams.get('id') || "");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [productDetail, setProductDetail] = useState(null);

    // Handover States
    const [incomingKey, setIncomingKey] = useState(""); // Key from previous owner
    const [nextKey, setNextKey] = useState(""); // Key for next recipient (auto-generated)
    const [location, setLocation] = useState(""); // Current location
    const [isVerified, setIsVerified] = useState(false); // N-1 Integrity Status
    const [recipientEmail, setRecipientEmail] = useState(""); // Email of next recipient
    const [emailSending, setEmailSending] = useState(false); // Email sending state

    // Auto-load product from URL query param (?id=X)
    React.useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl && account) {
            setProductId(idFromUrl);
            // checkProduct is defined below; use a small timeout to let state settle
            setTimeout(() => {
                document.getElementById('custody-search-btn')?.click();
            }, 300);
        }
    }, [account]); // run once wallet is connected

    // QR Waybill States
    const [scannedWaybill, setScannedWaybill] = useState(null); // Parsed QR data

    // Encrypted QR state for waybill displays (both single and bulk)
    const [encryptedSingleQR, setEncryptedSingleQR] = useState('');
    const [encryptedBulkQR,   setEncryptedBulkQR]   = useState('');
    const [waybillValid, setWaybillValid] = useState(false); // Sender verification status

    // Bulk Transfer States
    const [bulkBatchId, setBulkBatchId] = useState("");
    const [bulkBatchNumericId, setBulkBatchNumericId] = useState(""); // resolved numeric ID
    const [bulkHandoverKey, setBulkHandoverKey] = useState("");
    const [bulkDispatchKey, setBulkDispatchKey] = useState(null); // Stored key fetched from backend for Dispatch QR
    const [bulkTransferSuccess, setBulkTransferSuccess] = useState(false); // Shows new dispatch QR after transfer
    const [bulkLocation, setBulkLocation] = useState("");
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkStatus, setBulkStatus] = useState("");
    const [bulkResult, setBulkResult] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null); // Uploaded QR file

    // New Bulk Waybill States
    const [bulkScannedWaybill, setBulkScannedWaybill] = useState(null);
    const [bulkWaybillValid, setBulkWaybillValid] = useState(false);
    const [bulkAction, setBulkAction] = useState('dispatch'); // 'dispatch' or 'receive'
    const [bulkBatchDetails, setBulkBatchDetails] = useState(null);

    // Formatted IDs for display
    const [formattedProductId, setFormattedProductId] = useState("");
    const [formattedBatchId, setFormattedBatchId] = useState("");

    // Fetch batch details dynamically (DB with Blockchain fallback)
    React.useEffect(() => {
        const fetchBatchInfo = async () => {
            if (!bulkBatchId || bulkAction !== 'dispatch') {
                setBulkBatchDetails(null);
                return;
            }
            try {
                // Try Backend first — /api/batch handles both numeric and formatted IDs (A, B, etc.)
                const response = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/batch/${bulkBatchId}`);
                const data = await response.json();

                if (data.success && data.batch) {
                    setBulkBatchDetails(data.batch);
                } else {
                    // Fallback to Blockchain via smart lookup
                    console.info("Batch not found in DB, checking blockchain...");
                    const bcData = await getBatchDataSmart(String(bulkBatchId));
                    if (bcData) {
                        setBulkBatchDetails(bcData);
                    } else {
                        setBulkBatchDetails(null);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch batch details", err);
                // Last ditch effort: Smart blockchain lookup
                try {
                    const bcData = await getBatchDataSmart(String(bulkBatchId));
                    setBulkBatchDetails(bcData);
                } catch { setBulkBatchDetails(null); }
            }
        };

        const timer = setTimeout(fetchBatchInfo, 500);
        return () => clearTimeout(timer);
    }, [bulkBatchId, bulkAction]);

    // Resolve formatted batch ID (e.g. "A") → numeric ID for blockchain calls
    React.useEffect(() => {
        const resolveNumericId = async () => {
            if (!bulkBatchId) { setBulkBatchNumericId(""); return; }
            if (!isNaN(bulkBatchId)) { setBulkBatchNumericId(Number(bulkBatchId)); return; }
            try {
                const batchData = await getBatchDataSmart(String(bulkBatchId));
                setBulkBatchNumericId(Number(batchData.id));
            } catch { setBulkBatchNumericId(""); }
        };
        const timer = setTimeout(resolveNumericId, 400);
        return () => clearTimeout(timer);
    }, [bulkBatchId]);

    // Fetch stored handover key from backend whenever numeric batch ID is available
    // This is the key generated from the LAST verified N-1 blockchain transfer (or initial registration)
    React.useEffect(() => {
        const fetchStoredDispatchKey = async () => {
            if (!bulkBatchNumericId) { setBulkDispatchKey(null); return; }
            try {
                const res = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/batch/${bulkBatchNumericId}/handover-key`);
                const data = await res.json();
                if (data.success && data.handoverKey) {
                    setBulkDispatchKey(data.handoverKey);
                } else {
                    setBulkDispatchKey(null);
                }
            } catch {
                setBulkDispatchKey(null);
            }
        };
        fetchStoredDispatchKey();
    }, [bulkBatchNumericId]);

    // ── Encrypt single-product waybill QR whenever nextKey/productDetail changes ──
    useEffect(() => {
        if (!nextKey || !productDetail) { setEncryptedSingleQR(''); return; }
        const payload = JSON.stringify({
            productId:     productDetail.id,
            handoverKey:   nextKey,
            senderAddress: account,
            timestamp:     Date.now()
        });
        encryptQR(payload).then(setEncryptedSingleQR);
    }, [nextKey, productDetail, account]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Encrypt bulk waybill QR whenever bulkDispatchKey changes ─────────────────
    useEffect(() => {
        if (!bulkDispatchKey) { setEncryptedBulkQR(''); return; }
        const payload = JSON.stringify({
            isBulk:        true,
            batchId:       bulkBatchNumericId || parseInt(bulkBatchId),
            handoverKey:   bulkDispatchKey,
            senderAddress: account,
            timestamp:     Date.now()
        });
        encryptQR(payload).then(setEncryptedBulkQR);
    }, [bulkDispatchKey, bulkBatchNumericId, bulkBatchId, account]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-reset or refresh on account change
    React.useEffect(() => {
        if (productDetail) {
            // If the account changes, we need to re-verify or at least 
            // reset the "verified" badge since context changed.
            setIsVerified(false);
            // Optional: checkProduct(false) to refresh owner/active labels
        }
    }, [account]);

    // Updated checkProduct to allow preserving state during refresh
    const checkProduct = async (shouldResetSecrets = true) => {
        if (!productId) return;
        setLoading(true);
        // Only reset state if explicit new search (default behavior)
        if (shouldResetSecrets) {
            setProductDetail(null);
            setIsVerified(false);
        }

        try {
            // Use smart lookup that handles formatted IDs (A1, B2, #3, etc.)
            const data = await getProductDataSmart(productId);
            setProductDetail(data);
            setIsVerified(true);
            setStatus(`✅ Product Found (${data.formattedId})`);

            // Set the formatted ID for display
            setFormattedProductId(data.formattedId);

            // Fetch the stored handover key from backend using the numeric ID
            await fetchHandoverKey(data.id);
        } catch (e) {
            // Try to get formatted ID for error message too (if it's a valid format)
            try {
                const formatted = await getFormattedProductId(productId);
                setStatus(`❌ Product ${formatted} not found. Make sure it's created and the contract is connected.`);
            } catch {
                setStatus(`❌ Product ${productId} not found or invalid format. Use formats like: #1, #2 (single products), A1, A2, B1 (bulk products).`);
            }
            toast.error(`Lookup Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };



    const verifyAuthenticity = (data) => {
        if (!data.history || data.history.length === 0) {
            setStatus("❌ No history found for this asset.");
            setIsVerified(false);
            return;
        }

        // N-1 Node Principle: Validate the link between last recorded action and current state
        const lastEntry = data.history[data.history.length - 1];
        const isIntegrityValid = lastEntry.actor.toLowerCase() === data.currentOwner.toLowerCase();

        if (isIntegrityValid) {
            setIsVerified(true);
            toast.success("✅ N-1 Node Integrity Verified: Product is Authentic!");
            setStatus("🛡️ Asset Authenticity Verified via Blockchain History");
        } else {
            setIsVerified(false);
            toast.error("⚠️ Warning: Chain Integrity Check Failed!");
            setStatus("❌ Warning: History Mismatch. Possible Unauthorized Handover.");
        }
    };

    // Fetch handover key from backend
    const fetchHandoverKey = async (id) => {
        try {
            const response = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/${id}/handover-key`);
            const data = await response.json();

            if (data.success && data.handoverKey) {
                setNextKey(data.handoverKey);
                console.log("Fetched handover key from backend:", data.handoverKey);
            } else {
                // No key stored yet, generate a new one
                const randomKey = Math.random().toString(36).slice(-8).toUpperCase();
                setNextKey(randomKey);
                console.log("No stored key, generated new:", randomKey);
            }
        } catch (error) {
            console.error("Error fetching handover key:", error);
            // Fallback to generating a new key
            const randomKey = Math.random().toString(36).slice(-8).toUpperCase();
            setNextKey(randomKey);
        }
    };

    // Auto-generate next key when component loads or when needed
    React.useEffect(() => {
        if (!nextKey) {
            const randomKey = Math.random().toString(36).slice(-8).toUpperCase();
            setNextKey(randomKey);
        }
    }, []);

    // Send handover key via email to recipient
    const sendHandoverKeyViaEmail = async () => {
        if (!recipientEmail) {
            toast.warn("⚠️ Please enter the recipient's email address");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            toast.error("❌ Invalid email address");
            return;
        }
        setEmailSending(true);
        try {
            const response = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/email/send-handover-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientEmail,
                    productId: productDetail.id,
                    productName: productDetail.name,
                    handoverKey: nextKey
                })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`✅ Handover key sent to ${recipientEmail}`);
            } else {
                toast.error(`❌ Failed to send email: ${data.message}`);
            }
        } catch (error) {
            console.error('Email send error:', error);
            toast.error('❌ Failed to send email. Check your network connection.');
        } finally {
            setEmailSending(false);
        }
    };

    // Send BATCH handover key via email
    const sendBulkHandoverKeyViaEmail = async () => {
        if (!recipientEmail) {
            toast.warn("⚠️ Please enter the recipient's email address");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            toast.error("❌ Invalid email address");
            return;
        }
        setEmailSending(true);
        try {
            const response = await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/email/send-batch-handover-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientEmail,
                    batchId: bulkBatchId,
                    handoverKey: bulkDispatchKey
                })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`✅ Batch Handover key sent to ${recipientEmail}`);
            } else {
                toast.error(`❌ Failed to send email: ${data.message}`);
            }
        } catch (error) {
            console.error('Email send error:', error);
            toast.error('❌ Failed to send email. Check your network connection.');
        } finally {
            setEmailSending(false);
        }
    };

    // TRANSFER CUSTODY (B2B Handover)
    const handleTransferCustody = async () => {
        if (!incomingKey || !location) {
            setStatus("⚠️ Enter the Handover Key and Location");
            return;
        }
        setLoading(true);
        setStatus("Verifying key & transferring custody...");

        try {
            // Re-verify if not already verified via QR
            if (!isVerified) {
                const lastActor = productDetail.history[productDetail.history.length - 1].actor;
                if (lastActor.toLowerCase() !== productDetail.currentOwner.toLowerCase()) {
                    throw new Error("Chain Integrity Error: Blockchain history mismatch (N-1 Check Failed)");
                }
            }

            // Role Verification (Distributor -> Retailer)
            if (productDetail.stateRaw === 1) {
                const isRetailer = await hasRole("RETAILER", account);
                if (!isRetailer) {
                    setStatus("⚠️ Warning: You are not a registered Retailer. Status will remain 'In Transit'.");
                }
            }

            console.log("About to transfer custody:", { productId, incomingKey, nextKey, location });
            await transferCustody(productId, incomingKey, nextKey, location);

            // Save the new handover key to backend for next transfer
            try {
                await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/${productId}/handover-key`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handoverKey: nextKey })
                });
                console.log("Saved new handover key to backend:", nextKey);
            } catch (error) {
                console.error("Failed to save handover key:", error);
            }

            setStatus("✅ Custody Transferred! You are now the custodian.");

            // Generate new key for next transfer
            const newRandomKey = Math.random().toString(36).slice(-8).toUpperCase();
            setNextKey(newRandomKey);
            setIncomingKey("");
            setLocation("");

            await checkProduct(false);
        } catch (e) {
            console.error(e);
            const msg = e?.reason || e?.error?.message || e?.message || "Transfer failed";
            if (typeof msg === "string" && msg.toLowerCase().includes("invalid handover key")) {
                setStatus("❌ Handover key mismatch. Please check you entered the latest key (no spaces) and try again.");
            } else {
                setStatus(`❌ Transfer Failed: ${msg}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // BULK TRANSFER CUSTODY
    const handleBulkTransfer = async () => {
        if (!bulkHandoverKey || !bulkLocation) {
            setBulkStatus("⚠️ Enter the Handover Key and Location");
            return;
        }
        setBulkLoading(true);
        setBulkStatus("⛓️ Submitting N-1 verification to blockchain...");
        setBulkResult(null);
        setBulkTransferSuccess(false);

        // Generate the new dispatch key NOW (at the moment of transfer, not on page load)
        // This key is only stored if the blockchain N-1 check succeeds
        const newDispatchKey = Math.random().toString(36).slice(-8).toUpperCase();

        try {
            const numericId = bulkBatchNumericId || bulkBatchId;
            // transferBatchCustody verifies hash(bulkHandoverKey) == storedHash on-chain (N-1 check)
            await transferBatchCustody(numericId, bulkHandoverKey, newDispatchKey, bulkLocation);

            // ✅ Blockchain N-1 check passed — now persist the new dispatch key for the next transfer
            try {
                await fetch(`${(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')}/products/batch/${numericId}/handover-key`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handoverKey: newDispatchKey })
                });
            } catch (err) {
                console.error(`Failed to save new dispatch key for Batch #${bulkBatchId}:`, err);
            }

            // Update dispatch key state — the Dispatch tab can now show the new QR
            setBulkDispatchKey(newDispatchKey);
            setBulkStatus(`✅ N-1 Verified & Batch #${bulkBatchId} transferred! Your dispatch QR for the next entity is ready.`);
            setBulkResult({ batchId: bulkBatchId, txHash: 'confirmed' });
            setBulkTransferSuccess(true);
            setBulkHandoverKey("");
            setBulkLocation("");
        } catch (e) {
            console.error(e);
            const msg = e?.reason || e?.error?.message || e?.message || "Bulk transfer failed";
            if (typeof msg === "string" && msg.toLowerCase().includes("invalid handover key")) {
                setBulkStatus("❌ Handover key mismatch. Please verify you have the latest batch handover key (no spaces) and try again.");
            } else {
                setBulkStatus(`❌ Bulk Transfer Failed: ${msg}`);
            }
        } finally {
            setBulkLoading(false);
        }
    };

    // DOWNLOAD BULK WAYBILL QR (Sender Side)
    const downloadBulkWaybill = () => {
        const svg = document.getElementById('bulk-waybill-qr');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `bulk-waybill-batch-${bulkBatchId}.png`;
                link.click();
                URL.revokeObjectURL(url);
                toast.success('Bulk Waybill downloaded successfully!');
            });
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    // UPLOAD & PARSE BULK WAYBILL QR (Receiver Side)
    const handleBulkQRWaybillUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setUploadedFile(file);

        try {
            const html5QrCode = new Html5Qrcode("bulk-qr-reader-hidden");

            const qrCodeSuccessCallback = async (decodedText) => {
                try {
                    console.log("Bulk QR Code Scanned - Raw Text:", decodedText);
                    const decryptedText = await decryptQR(decodedText);
                    console.log("Bulk QR Decrypted:", decryptedText);
                    const waybillData = JSON.parse(decryptedText);
                    console.log("Parsed Bulk Waybill Data:", waybillData);

                    // Validate required fields for bulk
                    // Accept both legacy {isBulk: true} format and new {type: "BATCH_WAYBILL"} format
                    const isBulkWaybill = waybillData.isBulk === true || waybillData.type === "BATCH_WAYBILL";
                    if (!isBulkWaybill || !waybillData.batchId || !waybillData.handoverKey || !waybillData.senderAddress) {
                        throw new Error("Invalid bulk waybill format");
                    }

                    setBulkScannedWaybill(waybillData);
                    setBulkBatchId(waybillData.batchId);
                    // Security: handover key is NOT auto-filled from QR.
                    // Receiver must enter it manually (received out-of-band via email/phone).

                    setBulkWaybillValid(true);

                    toast.success(`✅ Waybill scanned! Batch #${waybillData.batchId} loaded. Enter the handover key you received separately.`);
                    setBulkStatus("🛡️ Batch Identified — Enter your handover key to proceed.");
                } catch (parseError) {
                    console.error("Parse error:", parseError);
                    toast.error("Invalid bulk waybill data format");
                    setBulkStatus("❌ Invalid QR code format");
                }

                html5QrCode.clear();
            };

            await html5QrCode.scanFile(file, true)
                .then(qrCodeSuccessCallback)
                .catch(err => {
                    console.error("QR scan error:", err);
                    toast.error("Failed to read QR code");
                    setBulkStatus("❌ Could not read QR code");
                });

        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to process bulk waybill");
        } finally {
            setLoading(false);
        }
    };

    // DOWNLOAD WAYBILL QR (Sender Side)
    const downloadWaybill = () => {
        const svg = document.getElementById('waybill-qr');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `waybill-product-${productDetail.id}.png`;
                link.click();
                URL.revokeObjectURL(url);
                toast.success('Waybill downloaded successfully!');
            });
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    // UPLOAD & PARSE WAYBILL QR (Receiver Side)
    const handleQRWaybillUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setUploadedFile(file);

        try {
            const html5QrCode = new Html5Qrcode("qr-reader-hidden");

            const qrCodeSuccessCallback = async (decodedText) => {
                try {
                    console.log("QR Code Scanned - Raw Text:", decodedText);
                    const decryptedText = await decryptQR(decodedText);
                    console.log("Single QR Decrypted:", decryptedText);
                    const waybillData = JSON.parse(decryptedText);
                    console.log("Parsed Waybill Data:", waybillData);

                    // Validate required fields
                    if (!waybillData.productId || !waybillData.handoverKey || !waybillData.senderAddress) {
                        throw new Error("Invalid waybill format");
                    }

                    setScannedWaybill(waybillData);
                    // Security: handover key is NOT auto-filled from QR.
                    // Receiver must type it manually (received out-of-band).
                    const productData = await getProductData(waybillData.productId);
                    const senderMatches = productData.currentOwner.toLowerCase() === waybillData.senderAddress.toLowerCase();

                    setWaybillValid(senderMatches);
                    setProductId(waybillData.productId);
                    setProductDetail(productData);

                    if (senderMatches) {
                        toast.success("✅ Waybill verified! Product loaded. Enter your handover key (received separately) to accept custody.");
                        setStatus("🛡️ Product Identified — Enter handover key received privately to transfer.");
                    } else {
                        toast.warn("⚠️ Warning: Sender address does not match current owner!");
                        setStatus("⚠️ Sender Mismatch - Verify before accepting");
                    }
                } catch (parseError) {
                    console.error("Parse error:", parseError);
                    toast.error("Invalid waybill data format");
                    setStatus("❌ Invalid QR code format");
                }

                html5QrCode.clear();
            };

            await html5QrCode.scanFile(file, true)
                .then(qrCodeSuccessCallback)
                .catch(err => {
                    console.error("QR scan error:", err);
                    toast.error("Failed to read QR code");
                    setStatus("❌ Could not read QR code");
                });

        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to process waybill");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="manage-custody">
            <header className="page-header">
                <h2><Truck className="header-icon" size={48} /> Rolling Supply Chain</h2>
                <p className="subtitle">Dynamic QR Handover Protocol</p>

                {/* Tab Switcher */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                    <button
                        className={`btn ${activeTab === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.5rem 1.5rem', borderRadius: '100px', fontSize: '0.85rem' }}
                        onClick={() => setActiveTab('single')}
                    >
                        📦 Single Transfer
                    </button>
                    <button
                        className={`btn ${activeTab === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.5rem 1.5rem', borderRadius: '100px', fontSize: '0.85rem' }}
                        onClick={() => setActiveTab('bulk')}
                    >
                        📦📦 Bulk Transfer
                    </button>
                </div>
            </header>

            {!account ? (
                <div className="connect-prompt">
                    <ConnectButton onClick={connectWallet} className="btn-connect pulse" />
                </div>
            ) : activeTab === 'bulk' ? (
                /* ======== BULK TRANSFER TAB ======== */
                <div className="custody-grid">
                    <div className="glass-panel">
                        <div className="details-card-inner">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <Truck size={24} color="#D4AF37" /> Bulk Custody Transfer
                            </h3>
                            <p className="help-text" style={{ marginBottom: '1.5rem' }}>
                                Transfer custody of multiple products that share the same handover key in a single blockchain transaction.
                            </p>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <button
                                    className={`btn ${bulkAction === 'receive' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}
                                    onClick={() => setBulkAction('receive')}
                                >
                                    📥 Receive Batch (Scan Waybill)
                                </button>
                                <button
                                    className={`btn ${bulkAction === 'dispatch' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}
                                    onClick={() => setBulkAction('dispatch')}
                                >
                                    📤 Dispatch Batch (Create Waybill)
                                </button>
                            </div>

                            {bulkAction === 'dispatch' ? (
                                // DISPATCH FLOW
                                <div className="bulk-dispatch-flow">
                                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Step 1: Define Batch Parameters</h4>
                                    <div className="custody-input-stack" style={{ gap: '1rem', marginBottom: '2rem' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.3rem' }}>Batch ID</label>
                                                <input
                                                    type="text"
                                                    className="input-modern"
                                                    placeholder="e.g. 1, A, B"
                                                    value={bulkBatchId}
                                                    onChange={(e) => setBulkBatchId(e.target.value)}
                                                    disabled={bulkLoading}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Step 2: Generate Digital Waybill</h4>
                                    <div className="digital-waybill" style={{ marginTop: 0 }}>
                                        <div className="qr-frame">
                                            {bulkDispatchKey ? (
                                                encryptedBulkQR ? (
                                                <QRCodeSVG
                                                    id="bulk-waybill-qr"
                                                    value={encryptedBulkQR}
                                                    size={220}
                                                    level="H"
                                                    includeMargin={false}
                                                />
                                                ) : (
                                                    <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '0.8rem', textAlign: 'center' }}>Encrypting…</div>
                                                )
                                            ) : (
                                                <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(212,175,55,0.7)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem', border: '1px dashed rgba(212,175,55,0.3)', borderRadius: 8 }}>
                                                    🔐 No dispatch key.<br />First accept custody of this batch via the Receive tab.
                                                </div>
                                            )}
                                        </div>

                                        <div className="waybill-meta">
                                            <div className="meta-row">
                                                <span>Target Batch</span>
                                                <span>#{bulkBatchId}</span>
                                            </div>

                                            {bulkBatchDetails ? (
                                                <div className="meta-row" style={{ marginTop: '0.2rem', color: 'var(--text-tertiary)' }}>
                                                    <span>Size/Quantity:</span>
                                                    <span>📦 {bulkBatchDetails.quantity || bulkBatchDetails.products?.length || bulkBatchDetails.productIds?.length || 0} items</span>
                                                </div>
                                            ) : (
                                                <div className="meta-row" style={{ marginTop: '0.2rem', color: 'rgba(255,100,100,0.8)' }}>
                                                    <span>Status:</span>
                                                    <span>⚠️ Batch Not Found</span>
                                                </div>
                                            )}

                                            <div className="meta-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(212,175,55,0.2)' }}>
                                                <span>Handover Key</span>
                                                <span className="key-highlight">{bulkDispatchKey || '—'}</span>
                                            </div>
                                        </div>

                                        {/* Email recipient input for bulk */}
                                        <div style={{ width: '100%', marginTop: '1rem' }}>
                                            <input
                                                type="email"
                                                className="input-modern"
                                                placeholder="Next Facility's Email Address"
                                                value={recipientEmail}
                                                onChange={(e) => setRecipientEmail(e.target.value)}
                                                style={{ width: '100%', marginBottom: '0.75rem' }}
                                            />
                                            <button
                                                className="btn btn-secondary"
                                                onClick={sendBulkHandoverKeyViaEmail}
                                                disabled={emailSending || !recipientEmail || !bulkBatchDetails || !bulkDispatchKey}
                                                style={{ width: '100%', height: '48px', marginBottom: '0.75rem', background: 'linear-gradient(135deg, #1a472a, #2d6a4f)', border: '1px solid #52b788', color: '#d8f3dc' }}
                                            >
                                                {emailSending ? '📧 Sending Key Array...' : '📧 Send Secure Key via Email'}
                                            </button>
                                        </div>

                                        <button
                                            className="btn btn-primary btn-download-premium"
                                            onClick={downloadBulkWaybill}
                                            disabled={bulkLoading || !bulkBatchDetails || !bulkDispatchKey}
                                        >
                                            <Download size={20} /> Download Bulk Waybill
                                        </button>
                                    </div>
                                    <p className="instruction-text" style={{ textAlign: 'center', marginTop: '1rem' }}>
                                        Provide this encoded QR waybill to the carrier or next recipient. They will scan it to accept custody.
                                    </p>
                                </div>
                            ) : (
                                // RECEIVE FLOW
                                <div className="bulk-receive-flow">
                                    {!bulkScannedWaybill ? (
                                        <div className="search-card-content details-card-inner" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                                            <div className="qr-upload-zone" style={{ borderStyle: 'solid', borderWidth: '1px', marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <label className="dropzone">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleBulkQRWaybillUpload}
                                                        style={{ display: 'none' }}
                                                        disabled={loading}
                                                    />
                                                    <div className="dropzone-content" style={{ padding: '2rem 1rem' }}>
                                                        <div className="upload-icon" style={{ marginBottom: '1rem' }}><Camera size={40} /></div>
                                                        <p style={{ fontSize: '1rem' }}>Verify Bulk Waybill QR</p>
                                                    </div>
                                                </label>
                                            </div>
                                            <div id="bulk-qr-reader-hidden" style={{ display: 'none' }}></div>
                                        </div>
                                    ) : (
                                        <div className="verification-terminal">
                                            {/* We can reuse WaybillCertificate but hack the display for bulk, or build a custom one. Doing a custom inline one for simplicity */}
                                            <div className="waybill-certificate fade-in" style={{ marginBottom: '1.5rem' }}>
                                                <div className="cert-header">
                                                    <ShieldCheck size={28} color="#52b788" />
                                                    <h4>Bulk Digital Waybill Verified</h4>
                                                </div>
                                                <div className="cert-body">
                                                    <div className="cert-row">
                                                        <span>Batch Target:</span>
                                                        <span className="cert-value">Batch #{bulkScannedWaybill.batchId}</span>
                                                    </div>
                                                    <div className="cert-row">
                                                        <span>Sender Signature:</span>
                                                        <span className="cert-value address-value">
                                                            {bulkScannedWaybill.senderAddress.slice(0, 10)}...{bulkScannedWaybill.senderAddress.slice(-8)}
                                                        </span>
                                                    </div>
                                                    <div className="cert-row timestamp-row">
                                                        <span>Generated:</span>
                                                        <span className="cert-value">
                                                            {new Date(bulkScannedWaybill.timestamp || bulkScannedWaybill.issuedAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Review & Accept Custody</h4>

                                            <div className="custody-input-stack" style={{ gap: '1rem' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.3rem' }}>Handover Key <span style={{ color: 'rgba(239,68,68,0.8)', fontSize: '0.75rem' }}>(enter key received out-of-band)</span></label>
                                                    <input
                                                        type="text"
                                                        className="input-modern"
                                                        placeholder="Enter the secret key you received separately"
                                                        value={bulkHandoverKey}
                                                        onChange={(e) => setBulkHandoverKey(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.3rem' }}>Target Location / Facility</label>
                                                    <input
                                                        type="text"
                                                        className="input-modern"
                                                        placeholder="e.g. Distribution Center Alpha"
                                                        value={bulkLocation}
                                                        onChange={(e) => setBulkLocation(e.target.value)}
                                                        disabled={bulkLoading}
                                                    />
                                                </div>
                                            </div>

                                            <div className="btn-stack" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                                <button
                                                    className="btn btn-primary btn-accept"
                                                    style={{ flex: 1, padding: '1rem' }}
                                                    onClick={handleBulkTransfer}
                                                    disabled={bulkLoading || !bulkWaybillValid || !bulkLocation || !bulkHandoverKey}
                                                >
                                                    {bulkLoading ? "⛓️ Processing..." : `🔄 Accept Batch #${bulkBatchId}`}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '1rem 2rem' }}
                                                    onClick={() => {
                                                        setBulkScannedWaybill(null);
                                                        setBulkWaybillValid(false);
                                                    }}
                                                >
                                                    Reset
                                                </button>
                                            </div>

                                            {bulkWaybillValid && (
                                                <div className="verification-badge" style={{ marginTop: '1rem' }}>
                                                    <ShieldCheck size={20} /> Integrity Verified
                                                </div>
                                            )}

                                            {bulkTransferSuccess && bulkDispatchKey && (
                                                <div style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                                                    <h4 style={{ color: '#34d399', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <ShieldCheck size={20} /> N-1 Verified — Dispatch Key Generated
                                                    </h4>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                                        Blockchain transfer confirmed. A new dispatch key was generated from this verified N-1 transfer. Switch to <strong>Dispatch Batch</strong> to send the waybill QR to the next entity.
                                                    </p>
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.6rem 1.5rem' }}
                                                        onClick={() => { setBulkAction('dispatch'); setBulkTransferSuccess(false); }}
                                                    >
                                                        📤 View Dispatch QR for Next Entity
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {bulkStatus && (
                                <div style={{
                                    marginTop: '1.5rem', padding: '0.8rem 1rem', borderRadius: '12px', fontSize: '0.9rem',
                                    background: bulkStatus.includes('✅') ? 'rgba(52,211,153,0.08)' : bulkStatus.includes('❌') ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.08)',
                                    border: `1px solid ${bulkStatus.includes('✅') ? 'rgba(52,211,153,0.2)' : bulkStatus.includes('❌') ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.2)'}`,
                                    color: bulkStatus.includes('✅') ? '#34d399' : bulkStatus.includes('❌') ? '#ef4444' : '#60a5fa'
                                }}>
                                    {bulkStatus}
                                </div>
                            )}

                            {bulkResult && (
                                <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                                    <p style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 600, marginBottom: '0.5rem' }}>
                                        ✅ Batch #{bulkResult.batchId} transfer confirmed on blockchain.
                                    </p>
                                    {bulkResult.ids?.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {bulkResult.ids.map(id => (
                                                <span key={id} style={{ padding: '0.25rem 0.7rem', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>#{id}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="custody-grid">
                    <div className="glass-panel">
                        {/* SEARCH & UPLOAD VIEW */}
                        {!productDetail ? (
                            <div className="search-card-content details-card-inner">
                                <h3><Upload size={24} color="#D4AF37" /> Upload Waybill to Begin</h3>
                                <p className="help-text">
                                    Upload the digital waybill provided by the current custodian to verify asset integrity and start the handover process.
                                </p>

                                <div className="qr-upload-zone">
                                    <label className="dropzone">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleQRWaybillUpload}
                                            style={{ display: 'none' }}
                                            disabled={loading}
                                        />
                                        <div className="dropzone-content">
                                            <div className="upload-icon"><Camera size={56} /></div>
                                            <p>{loading ? "Scanning Secure Protocol..." : "Drop Waybill QR Here"}</p>
                                            <small>Authenticated PNG / JPG Assets Only</small>
                                        </div>
                                    </label>
                                    <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
                                </div>

                                <div className="lookup-section">
                                    <span className="lookup-label">Authorized Lookup</span>
                                    <div className="search-group">
                                        <input
                                            type="text"
                                            className="input-modern"
                                            placeholder="Asset ID (e.g. #1, A, A1)"
                                            value={productId}
                                            onChange={(e) => setProductId(e.target.value)}
                                        />
                                        <button id="custody-search-btn" className="btn-search" onClick={() => checkProduct(true)}>
                                            <Search size={22} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* PRODUCT DETAILS VIEW */
                            <div className="details-card-inner">
                                <header className="details-header">
                                    <span className="id-badge">ASSET #{productDetail.id}</span>
                                    <span className="status-pill">{productDetail.state}</span>
                                </header>

                                <div className="details-grid-layout">
                                    {/* PANEL 1: Blockchain Data */}
                                    <div className="details-box">
                                        <div className="data-grid">
                                            <div className="data-item">
                                                <label>Current Custodian</label>
                                                <div className="data-value address-value" style={{ fontSize: '1.25rem' }}>
                                                    {productDetail.currentOwner === account ? "YOU (Active Custodian)" : productDetail.currentOwner.slice(0, 10) + "..." + productDetail.currentOwner.slice(-8)}
                                                </div>
                                            </div>
                                            <div className="data-item">
                                                <label>Asset Description</label>
                                                <div className="data-value" style={{ fontSize: '1.25rem' }}>{productDetail.name}</div>
                                            </div>
                                            <div className="data-item">
                                                <label>Loom Origin</label>
                                                <div className="data-value" style={{ fontSize: '1.1rem' }}>{productDetail.loomLocation || "—"}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PANEL 2: JOURNEY TRACKER */}
                                    {productDetail.history && productDetail.history.length > 0 && (
                                        <div className="details-box journey-section">
                                            <h4><MapPin size={18} /> Verified Chain Custody</h4>
                                            <div className="journey-list">
                                                {productDetail.history.slice().reverse().map((entry, idx) => (
                                                    <div key={idx} className="journey-item">
                                                        <span className="j-actor">{entry.actor.slice(0, 8)}...</span>
                                                        <span className="j-arrow">➔</span>
                                                        <span className="j-loc">
                                                            {entry.location && entry.location.includes('|')
                                                                ? entry.location.split('|')[1]
                                                                : (entry.location || "Initial Hub")}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* PANEL 3: ACTIONS (Sender or Receiver) */}
                                    {productDetail.currentOwner === account ? (
                                        <div className="details-box action-box">
                                            <h4>Digital Waybill Terminal</h4>
                                            <p className="instruction-text">Authorize the next handover by downloading this encoded waybill.</p>

                                            <div className="digital-waybill">
                                                <div className="qr-frame">
                                                    {nextKey ? (
                                                        encryptedSingleQR ? (
                                                        <QRCodeSVG
                                                            id="waybill-qr"
                                                            value={encryptedSingleQR}
                                                            size={220}
                                                            level="H"
                                                            includeMargin={false}
                                                        />
                                                        ) : (
                                                            <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '0.85rem', textAlign: 'center', border: '1px dashed rgba(212,175,55,0.3)', borderRadius: 8 }}>Encrypting…</div>
                                                        )
                                                    ) : (
                                                        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '0.85rem', textAlign: 'center', border: '1px dashed rgba(212,175,55,0.3)', borderRadius: 8 }}>
                                                            Generating key...
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="waybill-meta">
                                                    <div className="meta-row">
                                                        <span>Ref ID</span>
                                                        <span>#{productDetail.id}</span>
                                                    </div>
                                                    <div className="meta-row">
                                                        <span>Handover Key</span>
                                                        <span className="key-highlight">{nextKey}</span>
                                                    </div>
                                                </div>

                                                {/* Email recipient input */}
                                                <div style={{ width: '100%', marginTop: '1rem' }}>
                                                    <input
                                                        type="email"
                                                        className="input-modern"
                                                        placeholder="Next Recipient's Email Address"
                                                        value={recipientEmail}
                                                        onChange={(e) => setRecipientEmail(e.target.value)}
                                                        style={{ width: '100%', marginBottom: '0.75rem' }}
                                                    />
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={sendHandoverKeyViaEmail}
                                                        disabled={emailSending || !recipientEmail}
                                                        style={{ width: '100%', height: '48px', marginBottom: '0.75rem', background: 'linear-gradient(135deg, #1a472a, #2d6a4f)', border: '1px solid #52b788', color: '#d8f3dc' }}
                                                    >
                                                        {emailSending ? '📧 Sending...' : '📧 Send Key via Email'}
                                                    </button>
                                                </div>

                                                <button
                                                    className="btn btn-primary btn-download-premium"
                                                    onClick={downloadWaybill}
                                                    disabled={loading}
                                                >
                                                    <Download size={20} /> Secure Download
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="details-box action-box">
                                            <h4>Handover Verification</h4>
                                            <p className="instruction-text">Complete the N-1 Node integrity check to accept custody.</p>

                                            {!scannedWaybill ? (
                                                <div className="qr-upload-zone" style={{ borderStyle: 'solid', borderWidth: '1px', marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                    <label className="dropzone">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleQRWaybillUpload}
                                                            style={{ display: 'none' }}
                                                            disabled={loading}
                                                        />
                                                        <div className="dropzone-content" style={{ padding: '2rem 1rem' }}>
                                                            <div className="upload-icon" style={{ marginBottom: '1rem' }}><Camera size={40} /></div>
                                                            <p style={{ fontSize: '1rem' }}>Verify Waybill QR</p>
                                                        </div>
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="verification-terminal">
                                                    <WaybillCertificate
                                                        waybill={scannedWaybill}
                                                        isVerified={waybillValid}
                                                        productData={productDetail}
                                                    />

                                                    <div className="custody-input-stack">
                                                        <input
                                                            type="text"
                                                            className="input-modern"
                                                            placeholder="Secret Handover Key"
                                                            value={incomingKey}
                                                            onChange={(e) => setIncomingKey(e.target.value)}
                                                        />
                                                        <input
                                                            type="text"
                                                            className="input-modern"
                                                            placeholder="Dispatch / Target Location"
                                                            value={location}
                                                            onChange={(e) => setLocation(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="btn-stack" style={{ display: 'flex', gap: '1rem' }}>
                                                        <button
                                                            className="btn btn-primary btn-accept"
                                                            onClick={handleTransferCustody}
                                                            disabled={loading || !waybillValid || !location || !incomingKey}
                                                        >
                                                            {loading ? "Authorizing..." : "Accept Custody"}
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ height: '60px', padding: '0 2rem' }}
                                                            onClick={() => {
                                                                setScannedWaybill(null);
                                                                setWaybillValid(false);
                                                                setProductDetail(null);
                                                            }}
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>

                                                    {isVerified && (
                                                        <div className="verification-badge">
                                                            <ShieldCheck size={20} /> Integrity Verified
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {status && (
                        <div className={`status-toast ${status.includes('❌') ? 'error' : (status.includes('⚠️') ? 'warning' : 'success')} slide-up`}>
                            {status}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ManageCustody;
