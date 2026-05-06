// src/pages/Home.js
import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { useSupplyChain } from "../hooks/useSupplyChain";
import { useAuth } from "../context/AuthContext";
import { ConnectButton } from "../components/ConnectButton";
import { useSupplyChainContext } from "../context/SupplyChainContext";
import "./Home.css";

const STATE_META = {
    0: { label: "Created",    cls: "s-created",  icon: "🟢" },
    1: { label: "In Transit", cls: "s-transit",   icon: "🟡" },
    2: { label: "Verified",   cls: "s-verified",  icon: "🔵" },
    3: { label: "Claimed",    cls: "s-claimed",   icon: "⚪" },
};

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toLowerCase() : '');

const Home = () => {
    const { contract, readOnlyContract, account, connectWallet } = useSupplyChainContext();
    const { getProductData } = useSupplyChain();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [sarees, setSarees] = useState([]);         // single products only
    const [batchGroups, setBatchGroups] = useState([]); // grouped batches
    const [stats, setStats] = useState({ total: 0, inCustody: 0, transferred: 0 });
    const [loading, setLoading] = useState(false);
    const [fetchErr, setFetchErr] = useState("");
    const [expanded, setExpanded] = useState(null);
    const [claimedProducts, setClaimedProducts] = useState([]);

    const fetchMyProducts = useCallback(async () => {
        if (!account) return;
        setLoading(true); setFetchErr("");
        try {
            // ── Step 1: Load from MongoDB (works even after chain reset) ──
            let dbProducts = [];
            let dbBatches = [];
            try {
                const dbRes = await fetch(`http://localhost:5000/api/products/by-manufacturer/${account}`);
                const dbData = await dbRes.json();
                if (dbData.success) {
                    dbProducts = dbData.products;
                    dbBatches = dbData.batches || [];
                }
            } catch { /* DB unavailable */ }

            const tc = contract || readOnlyContract;

            if (dbProducts.length === 0 && tc) {
                // ── Step 2: Fallback to blockchain events if DB empty ──
                try {
                    const events = await tc.queryFilter(tc.filters.ProductCreated());
                    const mine = events.filter(e =>
                        e.args?.weaver?.toLowerCase() === account.toLowerCase()
                    );
                    dbProducts = mine.map(e => ({
                        productId: Number(e.args.id),
                        name: null,
                        type: 'single'
                    }));
                } catch { /* chain unavailable */ }
            }

            if (!dbProducts.length) {
                // For non-manufacturers (distributors, retailers, cooperatives):
                // Reconstruct product list entirely from blockchain custody events
                if (tc) {
                    try {
                        // 1. All product IDs this account has ever received (covers single + batch transfers)
                        const receivedEvents = await tc.queryFilter(tc.filters.CustodyTransferred(null, null, account));
                        const allReceivedIds = [...new Set(receivedEvents.map(e => Number(e.args.id)))];

                        // 2. All batch IDs this account has ever received
                        let batchIdsReceived = [];
                        try {
                            const batchEvents = await tc.queryFilter(tc.filters.CustodyTransferredBatch(null, null, account));
                            batchIdsReceived = [...new Set(batchEvents.map(e => Number(e.args.batchId)))];
                        } catch { /* no batch events */ }

                        // 3. Build batch groups: one chain call per batch (not per product)
                        const batchProductIdSet = new Set();
                        const custodyBatchGroups = [];

                        for (const batchId of batchIdsReceived) {
                            try {
                                // Fetch DB metadata (names, location, weave date)
                                let batchMeta = null;
                                try {
                                    const metaRes = await fetch(`http://localhost:5000/api/products/batch/${batchId}`);
                                    const metaData = await metaRes.json();
                                    if (metaData.success) batchMeta = metaData.batch;
                                } catch { /* use chain-only data */ }

                                // Single chain call for batch state and product IDs
                                const batchOnChain = await tc.batches(batchId);
                                const productIds = batchOnChain.productIds
                                    ? batchOnChain.productIds.map(id => Number(id))
                                    : (batchMeta?.products?.map(p => p.productId) || []);

                                productIds.forEach(pid => batchProductIdSet.add(pid));

                                const batchOwner = batchOnChain.currentOwner;
                                const isBatchMine = batchOwner?.toLowerCase() === account.toLowerCase();
                                const batchStateRaw = Number(batchOnChain.state || 0);

                                // Build items from DB metadata; ownership shared at batch level
                                const batchItems = productIds.map(pid => {
                                    const dbItem = batchMeta?.products?.find(p => p.productId === pid);
                                    return {
                                        productId: pid,
                                        formattedProductId: dbItem?.formattedProductId || `#${pid}`,
                                        name: dbItem?.name || `Product #${pid}`,
                                        currentOwner: batchOwner || account,
                                        stateRaw: batchStateRaw
                                    };
                                });

                                custodyBatchGroups.push({
                                    batchId,
                                    formattedBatchId: batchMeta?.formattedBatchId || `#${batchId}`,
                                    name: batchMeta?.name || `Batch #${batchId}`,
                                    quantity: batchItems.length,
                                    status: batchMeta?.status || (isBatchMine ? 'in_transit' : 'delivered'),
                                    loomLocation: batchMeta?.loomLocation || '—',
                                    weaveDate: batchMeta?.weaveDate
                                        ? new Date(batchMeta.weaveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                        : '—',
                                    registeredAt: batchMeta?.createdAt || new Date().toISOString(),
                                    items: batchItems,
                                    chainSynced: true,
                                    isMine: isBatchMine
                                });
                            } catch (err) {
                                console.error(`Error processing batch ${batchId}:`, err);
                            }
                        }

                        // 4. Single products = received IDs not covered by any batch
                        const singleIds = allReceivedIds.filter(pid => !batchProductIdSet.has(pid));
                        const custodySingles = [];
                        for (const pid of singleIds) {
                            try {
                                const p = await tc.getProduct(pid);
                                if (p.exists) {
                                    const stateRaw = Number(p.state);
                                    custodySingles.push({
                                        id: pid,
                                        name: p.name || `Product #${pid}`,
                                        stateRaw,
                                        state: STATE_META[stateRaw]?.label || 'Unknown',
                                        currentOwner: p.currentOwner,
                                        loomLocation: p.loomLocation || '—',
                                        weaveDate: '—',
                                        chainSynced: true
                                    });
                                }
                            } catch { /* skip */ }
                        }
                        custodySingles.sort((a, b) => b.id - a.id);

                        // 5. Compute accurate stats
                        const inCusSingles = custodySingles.filter(s =>
                            s.currentOwner?.toLowerCase() === account.toLowerCase()
                        ).length;
                        const inCusBatch = custodyBatchGroups
                            .filter(b => b.isMine)
                            .reduce((sum, b) => sum + b.quantity, 0);
                        const totalItems = custodySingles.length + custodyBatchGroups.reduce((sum, b) => sum + b.quantity, 0);
                        const totalInCustody = inCusSingles + inCusBatch;

                        setStats({ total: totalItems, inCustody: totalInCustody, transferred: Math.max(0, totalItems - totalInCustody) });
                        setSarees(custodySingles);
                        setBatchGroups(custodyBatchGroups.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)));

                    } catch (err) {
                        console.error('Custody scan error:', err);
                        setStats({ total: 0, inCustody: 0, transferred: 0 });
                        setSarees([]);
                        setBatchGroups([]);
                    }
                } else {
                    setStats({ total: 0, inCustody: 0, transferred: 0 });
                    setSarees([]);
                    setBatchGroups([]);
                }
                return;
            }

            // ── Step 3: Separate singles from bulk products ──
            const singles = dbProducts.filter(p => p.type === 'single');
            const bulkItems = dbProducts.filter(p => p.type === 'bulk');

            // ── Step 4: Build batch groups from DB batch data + bulk items ──
            const batchMap = {};

            // First seed from dbBatches (has batch-level metadata)
            for (const b of dbBatches) {
                batchMap[b.batchId] = {
                    batchId: b.batchId,
                    formattedBatchId: b.formattedBatchId || `#${b.batchId}`,
                    name: b.name,
                    quantity: b.quantity || 0,
                    status: b.status || "created",
                    loomLocation: b.loomLocation || "—",
                    weaveDate: b.weaveDate
                        ? new Date(b.weaveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "—",
                    registeredAt: b.registeredAt,
                    items: [],
                    chainSynced: false
                };
            }

            // Then populate items from bulk product list
            for (const p of bulkItems) {
                const bid = p.batchId;
                if (!batchMap[bid]) {
                    batchMap[bid] = {
                        batchId: bid,
                        formattedBatchId: p.formattedBatchId || `#${bid}`,
                        name: p.batchName || `Batch #${bid}`,
                        quantity: 0,
                        status: "created",
                        loomLocation: p.loomLocation || "—",
                        weaveDate: p.weaveDate
                            ? new Date(p.weaveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "—",
                        registeredAt: p.registeredAt,
                        items: [],
                        chainSynced: false
                    };
                }
                batchMap[bid].items.push({
                    productId: p.productId,
                    formattedProductId: p.formattedProductId || `#${p.productId}`,
                    name: p.name
                });
            }

            // Finalize quantities
            for (const bid of Object.keys(batchMap)) {
                if (batchMap[bid].items.length > 0) {
                    batchMap[bid].quantity = batchMap[bid].items.length;
                }
            }

            // ── Step 5: Enrich single products with blockchain data ──
            const enrichedSingles = await Promise.all(singles.map(async p => {
                const id = p.productId;
                const formattedDate = p.weaveDate
                    ? new Date(p.weaveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—";

                if (tc) {
                    try {
                        const data = await getProductData(id);
                        return {
                            id,
                            name: data.name || p.name || `Saree #${id}`,
                            stateRaw: data.stateRaw,
                            state: data.state,
                            currentOwner: data.currentOwner,
                            loomLocation: p.loomLocation || data.loomLocation || "—",
                            weaveDate: formattedDate,
                            chainSynced: true
                        };
                    } catch { /* fall through */ }
                }

                return {
                    id,
                    name: p.name || `Saree #${id}`,
                    stateRaw: 0,
                    state: "Created",
                    currentOwner: account,
                    loomLocation: p.loomLocation || "—",
                    weaveDate: formattedDate,
                    chainSynced: false
                };
            }));

            enrichedSingles.sort((a, b) => b.id - a.id);
            setSarees(enrichedSingles);

            const batchGroupsList = Object.values(batchMap).sort(
                (a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)
            );
            setBatchGroups(batchGroupsList);

            const totalItems = enrichedSingles.length + batchGroupsList.reduce((sum, b) => sum + b.quantity, 0);
            const inCusSingles = enrichedSingles.filter(s => s.currentOwner?.toLowerCase() === account.toLowerCase()).length;
            const inCusBatch = batchGroupsList.reduce((sum, b) => sum + b.quantity, 0); // all batch items in custody until transferred
            const totalInCustody = inCusSingles + inCusBatch;
            setStats({ total: totalItems, inCustody: totalInCustody, transferred: Math.max(0, totalItems - totalInCustody) });

        } catch (err) {
            console.error(err);
            setFetchErr("Could not load sarees. Check your connection.");
        } finally {
            setLoading(false);
        }
    }, [contract, readOnlyContract, account, getProductData]);

    const fetchCustomerClaimedProducts = useCallback(async () => {
        if (!account) return;
        setLoading(true); setFetchErr("");
        // Immediately hydrate from localStorage cache for instant render
        const cacheKey = `customer-claimed-${account.toLowerCase()}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                setClaimedProducts(parsed);
                setStats({ total: parsed.length, inCustody: parsed.length, transferred: 0 });
            }
        } catch { /* corrupt cache, ignore */ }

        const tc = contract || readOnlyContract;
        if (!tc) { setLoading(false); return; }
        try {
            const events = await tc.queryFilter(tc.filters.CustomerOwnershipClaimed(null, account));
            const claimedIds = [...new Set(events.map(e => Number(e.args.id)))];
            const products = await Promise.all(
                claimedIds.map(async (id) => {
                    try { return await getProductData(id); } catch { return null; }
                })
            );
            const valid = products.filter(Boolean);
            setClaimedProducts(valid);
            setStats({ total: valid.length, inCustody: valid.length, transferred: 0 });
            try { localStorage.setItem(cacheKey, JSON.stringify(valid)); } catch { /* storage full */ }
        } catch (err) {
            console.error('Customer claimed fetch error:', err);
            setFetchErr("Could not load your claimed products.");
        } finally {
            setLoading(false);
        }
    }, [contract, readOnlyContract, account, getProductData]);

    useEffect(() => {
        if (normalizeRole(user?.role) === 'customer') {
            fetchCustomerClaimedProducts();
        } else {
            fetchMyProducts();
        }
    }, [user, fetchMyProducts, fetchCustomerClaimedProducts]);

    // ── Font injection for luxury typography ────────────────────────
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,700&family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@400;600;700;800&display=swap';
        document.head.appendChild(link);
        return () => { try { document.head.removeChild(link); } catch {} };
    }, []);

    const pending = sarees.filter(s => s.currentOwner?.toLowerCase() === account?.toLowerCase() && s.stateRaw === 0);
    const firstName = user?.name ? user.name.split(" ")[0] : "Weaver";
    const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
    const role = normalizeRole(user?.role);
    const isManufacturer = !role || role === 'manufacturer';
    const isCustomer = role === 'customer';
    const roleLabel = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Manufacturer';

    // ── Animated counter for claimed products section ─────────────────
    const [displayCount, setDisplayCount] = React.useState(0);
    useEffect(() => {
        if (!isCustomer || claimedProducts.length === 0) { setDisplayCount(0); return; }
        let start = 0;
        const end = claimedProducts.length;
        const duration = 800;
        const step = Math.ceil(duration / (end * 16));
        const timer = setInterval(() => {
            start += 1;
            setDisplayCount(start);
            if (start >= end) clearInterval(timer);
        }, step);
        return () => clearInterval(timer);
    }, [claimedProducts.length, isCustomer]);

    // ── Batch Card Component ──────────────────────────────────────────
    const BatchCard = ({ batch, index }) => {
        const isOpen = expanded === `batch-${batch.batchId}`;
        const [expandedBatch, setExpandedBatch] = React.useState(false);

        return (
            <motion.div
                className="saree-card batch-card"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
                <div className="saree-card-accent s-created" />

                <div className="saree-card-header">
                    <span className="saree-card-id batch-id-chip">
                        📦 {batch.formattedBatchId}
                    </span>
                    <div className="saree-card-status-row">
                        <span className="state-chip s-created">🟢 {batch.status}</span>
                        <span className="you-chip">● You</span>
                    </div>
                </div>

                <h3 className="saree-card-name">{batch.name}</h3>

                <div className="saree-card-meta">
                    <div className="saree-meta-item">
                        <span className="meta-icon">📍</span>
                        <div>
                            <span className="meta-label">Loom</span>
                            <span className="meta-value">{batch.loomLocation}</span>
                        </div>
                    </div>
                    <div className="saree-meta-item">
                        <span className="meta-icon">📅</span>
                        <div>
                            <span className="meta-label">Woven</span>
                            <span className="meta-value">{batch.weaveDate}</span>
                        </div>
                    </div>
                    <div className="saree-meta-item">
                        <span className="meta-icon">🧵</span>
                        <div>
                            <span className="meta-label">Items</span>
                            <span className="meta-value">{batch.quantity} sarees</span>
                        </div>
                    </div>
                </div>

                {/* Expandable item list */}
                <button
                    className="batch-expand-toggle"
                    onClick={(e) => { e.stopPropagation(); setExpandedBatch(!expandedBatch); }}
                >
                    {expandedBatch ? "▲ Hide items" : `▼ Show ${batch.items.length} items`}
                </button>

                <AnimatePresence>
                    {expandedBatch && batch.items.length > 0 && (
                        <motion.div
                            className="batch-items-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                            {batch.items.map(item => (
                                <div key={item.productId} className="batch-item-row">
                                    <span className="batch-item-id">{item.formattedProductId}</span>
                                    <span className="batch-item-name">{item.name}</span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="saree-card-actions" onClick={e => e.stopPropagation()}>
                    <Link to="/custody" className="sa-btn sa-btn--primary" title="Transfer Batch Custody">
                        📤 Waybill
                    </Link>
                    <Link to="/trace" className="sa-btn sa-btn--ghost" title="Trace Batch">
                        🔍 Trace
                    </Link>
                </div>
            </motion.div>
        );
    };

    // ── Saree Card Component ────────────────────────────────────────
    const SareeCard = ({ saree, index }) => {
        const sm = STATE_META[saree.stateRaw] || STATE_META[0];
        const isMine = saree.currentOwner?.toLowerCase() === account?.toLowerCase();
        const isOpen = expanded === saree.id;

        return (
            <motion.div
                className={`saree-card ${isOpen ? "saree-card--open" : ""}`}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    delay: index * 0.06,
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1]
                }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => setExpanded(isOpen ? null : saree.id)}
            >
                {/* Top accent line */}
                <div className={`saree-card-accent ${sm.cls}`} />

                <div className="saree-card-header">
                    <span className="saree-card-id">#{saree.id}</span>
                    <div className="saree-card-status-row">
                        <span className={`state-chip ${sm.cls}`}>
                            {sm.icon} {sm.label}
                        </span>
                        {isMine && <span className="you-chip">● You</span>}
                    </div>
                </div>

                <h3 className="saree-card-name">{saree.name}</h3>

                <div className="saree-card-meta">
                    <div className="saree-meta-item">
                        <span className="meta-icon">📍</span>
                        <div>
                            <span className="meta-label">Loom</span>
                            <span className="meta-value">{saree.loomLocation}</span>
                        </div>
                    </div>
                    <div className="saree-meta-item">
                        <span className="meta-icon">📅</span>
                        <div>
                            <span className="meta-label">Woven</span>
                            <span className="meta-value">{saree.weaveDate}</span>
                        </div>
                    </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="saree-card-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                            <div className="saree-detail-grid">
                                <div className="saree-detail-item">
                                    <span className="detail-label">Custodian</span>
                                    <span className="detail-value mono">
                                        {isMine ? "You (Active)" : `${saree.currentOwner?.slice(0, 10)}…${saree.currentOwner?.slice(-8)}`}
                                    </span>
                                </div>
                                <div className="saree-detail-item">
                                    <span className="detail-label">Chain State</span>
                                    <span className="detail-value">{saree.state}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="saree-card-actions" onClick={e => e.stopPropagation()}>
                    {isMine && saree.stateRaw === 0 && (
                        <Link to="/custody" className="sa-btn sa-btn--primary" title="Generate Waybill">
                            📤 Waybill
                        </Link>
                    )}
                    <Link to="/trace" className="sa-btn sa-btn--ghost" title="Trace">
                        🔍 Trace
                    </Link>
                </div>
            </motion.div>
        );
    };

    // ── Claimed Product Card (customer ownership view) ──────────────
    const ClaimedProductCard = ({ product, index }) => {
        const [open, setOpen] = React.useState(false);
        return (
            <motion.div
                className="saree-card"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => setOpen(!open)}
            >
                <div className="card-img-placeholder loaded"><span className="card-img-icon">🧣</span></div>
                <div className="saree-card-accent s-claimed" />
                <div className="saree-card-header">
                    <span className="saree-card-id">#{product.id}</span>
                    <div className="saree-card-status-row">
                        <span className="state-chip s-claimed">⚪ {product.state}</span>
                        <span className="you-chip">✓ Yours</span>
                    </div>
                </div>
                <h3 className="saree-card-name">{product.name}</h3>
                <div className="saree-card-meta">
                    <div className="saree-meta-item">
                        <span className="meta-icon">📍</span>
                        <div>
                            <span className="meta-label">Loom</span>
                            <span className="meta-value">{product.loomLocation || '—'}</span>
                        </div>
                    </div>
                    <div className="saree-meta-item">
                        <span className="meta-icon">📅</span>
                        <div>
                            <span className="meta-label">Woven</span>
                            <span className="meta-value">{product.weaveDate || '—'}</span>
                        </div>
                    </div>
                    {product.customerClaim && (
                        <div className="saree-meta-item">
                            <span className="meta-icon">🕐</span>
                            <div>
                                <span className="meta-label">Claimed</span>
                                <span className="meta-value">{product.customerClaim.timestamp}</span>
                            </div>
                        </div>
                    )}
                </div>
                <AnimatePresence>
                    {open && (
                        <motion.div
                            className="saree-card-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                            <div className="saree-detail-grid">
                                {product.customerClaim && (
                                    <div className="saree-detail-item">
                                        <span className="detail-label">Registered As</span>
                                        <span className="detail-value">{product.customerClaim.customerName}</span>
                                    </div>
                                )}
                                <div className="saree-detail-item">
                                    <span className="detail-label">Chain State</span>
                                    <span className="detail-value">{product.state}</span>
                                </div>
                                <div className="saree-detail-item">
                                    <span className="detail-label">Custody Steps</span>
                                    <span className="detail-value">{product.history?.length || 0} entries</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="saree-card-actions" onClick={e => e.stopPropagation()}>
                    <Link to="/trace" className="sa-btn sa-btn--ghost">🔍 Trace</Link>
                    <Link to="/verify" className="sa-btn sa-btn--ghost">🛡️ Verify</Link>
                </div>
            </motion.div>
        );
    };

    // ── Content States ──────────────────────────────────────────────
    const SareeContent = () => {
        if (!account) return (
            <div className="content-state">
                <div className="state-visual">🔌</div>
                <h3 className="state-title">Wallet Not Connected</h3>
                <p className="state-desc">{isCustomer ? 'Connect your MetaMask wallet to view your claimed products.' : 'Connect your MetaMask wallet to view your registered sarees.'}</p>
                <ConnectButton onClick={connectWallet} />
            </div>
        );
        if (loading) return (
            <div className="content-state">
                <motion.div
                    className="state-visual"
                    animate={{ rotateY: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >⬡</motion.div>
                <h3 className="state-title">Loading from Blockchain</h3>
                <p className="state-desc">Fetching your registered sarees…</p>
                <div className="loading-bar">
                    <div className="loading-bar-fill" />
                </div>
            </div>
        );
        if (fetchErr) return (
            <div className="content-state content-state--error">
                <div className="state-visual">⚠️</div>
                <h3 className="state-title">Connection Issue</h3>
                <p className="state-desc">{fetchErr}</p>
                <button className="btn btn-secondary" onClick={isCustomer ? fetchCustomerClaimedProducts : fetchMyProducts}>↻ Try Again</button>
            </div>
        );
        // Customer-specific view: show only claimed products
        if (isCustomer) {
            if (!claimedProducts.length) return (
                <div className="content-state">
                    <div className="state-visual">🏷️</div>
                    <h3 className="state-title">No Claimed Products Yet</h3>
                    <p className="state-desc">You haven't claimed any products. Go to Verify and use your physical scratch-off code to claim ownership.</p>
                    <Link to="/verify" className="btn btn-primary">🛡️ Verify a Product</Link>
                </div>
            );
            return (
                <div className="saree-grid">
                    {claimedProducts.map((p, i) => (
                        <ClaimedProductCard key={p.id} product={p} index={i} />
                    ))}
                </div>
            );
        }

        if (!sarees.length && !batchGroups.length) return (
            <div className="content-state">
                <div className="state-visual">📭</div>
                <h3 className="state-title">{isManufacturer ? 'No Sarees Yet' : 'No Products In Custody'}</h3>
                <p className="state-desc">
                    {isManufacturer
                        ? "You haven't registered any sarees. Get started by registering your first one!"
                        : "No products have been transferred to your custody yet."}
                </p>
                {isManufacturer && <Link to="/create" className="btn btn-primary">✨ Register First Saree</Link>}
            </div>
        );
        return (
            <div className="saree-grid">
                {batchGroups.map((b, i) => (
                    <BatchCard key={`batch-${b.batchId}`} batch={b} index={i} />
                ))}
                {sarees.map((s, i) => (
                    <SareeCard key={s.id} saree={s} index={i + batchGroups.length} />
                ))}
            </div>
        );
    };

    return (
        <div className="dash">

            {/* ─── HERO BAND ─────────────────────────────────────── */}
            <div className="hero-band dash-section--1">
                <div className="hero-content">
                    <div className="hero-left">
                        <span className="hero-eyebrow">{greeting}</span>
                        <h1 className="hero-name">{firstName}</h1>
                        <p className="hero-sub">Kasaragod Handloom · {roleLabel} Portal</p>
                    </div>
                    <div className="hero-right">
                        {account ? (
                            <div className="wallet-chip" onClick={() => {
                                navigator.clipboard.writeText(account);
                                toast.success("Address copied!", { autoClose: 1800 });
                            }} title="Click to copy address">
                                <span className="wdot" />
                                <div>
                                    <span className="wlbl">MetaMask Connected</span>
                                    <span className="waddr">{account.slice(0, 8)}…{account.slice(-6)}</span>
                                </div>
                                <span className="wallet-copy-hint">COPY</span>
                            </div>
                        ) : (
                            <div className="wallet-prompt">
                                <p>Connect wallet to load your data</p>
                                <ConnectButton onClick={connectWallet} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="dash-body">

                {/* ─── PENDING ALERT ─────────────────────────────── */}
                <AnimatePresence>
                    {pending.length > 0 && (
                        <motion.div className="pending-bar"
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <span>📬</span>
                            <div>
                                <strong>{pending.length} saree{pending.length > 1 ? "s" : ""} pending dispatch</strong>
                                <p>Still in your custody — generate a waybill to proceed.</p>
                            </div>
                            <button className="btn btn-primary" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
                                onClick={() => navigate("/custody")}>Dispatch Now →</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── KPI CARDS (non-customer only) ─────────────── */}
                {!isCustomer && (
                <div className="kpi-row dash-section--2">
                    {[
                        { label: "Total Registered", value: stats.total, icon: "◈", gradient: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(0,212,255,0.06))", accent: "#a855f7" },
                        { label: "In My Custody", value: stats.inCustody, icon: "📦", gradient: "linear-gradient(135deg, rgba(181,89,26,0.12), rgba(251,191,36,0.06))", accent: "#fbbf24" },
                        { label: "Transferred Out", value: stats.transferred, icon: "🚚", gradient: "linear-gradient(135deg, rgba(30,122,80,0.12), rgba(52,211,153,0.06))", accent: "#34d399" },
                    ].map((k, i) => (
                        <motion.div key={k.label} className="kpi-card"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            style={{ background: k.gradient }}
                        >
                            <div className="kpi-header">
                                <span className="kpi-ico">{k.icon}</span>
                                <span className="kpi-lbl">{k.label}</span>
                            </div>
                            <div className="kpi-num" style={{ color: k.accent }}>
                                {loading ? (
                                    <motion.span
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 1.2, repeat: Infinity }}
                                    >·</motion.span>
                                ) : k.value}
                            </div>
                            <div className="kpi-track">
                                <motion.div
                                    className="kpi-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: stats.total ? `${Math.round((k.value / stats.total) * 100)}%` : "0%" }}
                                    transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ background: k.accent }}
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>
                )}

                {/* ─── MAIN CONTENT ─────────────────────────────── */}
                <div className="main-content-grid">

                    {/* Quick Actions - horizontal strip */}
                    <motion.div className="quick-actions-strip dash-section--3"
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="strip-header">
                            <span className="strip-title">Quick Actions</span>
                        </div>
                        {isCustomer ? (
                            <div className="strip-actions strip-actions--customer">
                                {[
                                    { to: "/trace",  icon: "🔍", title: "Trace a Product",  desc: "Track journey",
                                      backTitle: "Provenance Trace", backDesc: "Follow your saree's complete custody chain from loom to your hands.", cta: "Trace Now →" },
                                    { to: "/verify", icon: "🛡️", title: "Verify & Claim",   desc: "Scan your product",
                                      backTitle: "Claim Ownership", backDesc: "Use your physical scratch-off code to verify and register ownership on-chain.", cta: "Verify Now →" },
                                ].map((a) => (
                                    <div className="flip-card-wrap" key={a.to}>
                                        <div className="flip-card-inner">
                                            <div className="flip-card-front">
                                                <span className="flip-icon">{a.icon}</span>
                                                <span className="strip-action-title">{a.title}</span>
                                                <span className="strip-action-desc">{a.desc}</span>
                                            </div>
                                            <div className="flip-card-back">
                                                <span className="flip-back-title">{a.backTitle}</span>
                                                <span className="flip-back-desc">{a.backDesc}</span>
                                                <Link to={a.to} className="btn-gold">{a.cta}</Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="strip-actions">
                                {[
                                    { to: "/create",  icon: "✨", title: "Register New Saree",  desc: "Mint on-chain", primary: true },
                                    { to: "/custody", icon: "📤", title: "Manage Handover",     desc: "Transfer custody" },
                                    { to: "/trace",   icon: "🔍", title: "Trace a Saree",       desc: "Track journey" },
                                ].map((a, i) => (
                                    <motion.div
                                        key={a.to}
                                        whileHover={{ y: -3, scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Link to={a.to} className={`strip-action ${a.primary ? "strip-action--primary" : ""}`}>
                                            <span className="strip-action-icon">{a.icon}</span>
                                            <span className="strip-action-title">{a.title}</span>
                                            <span className="strip-action-desc">{a.desc}</span>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Sarees Section */}
                    <motion.section className="sarees-section dash-section--4"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                        <div className="section-hd">
                            <div>
                                <h2 className="section-title">
                                {isCustomer ? 'My Claimed Products' : isManufacturer ? 'My Registered Sarees' : 'Products In My Custody'}
                                {isCustomer && claimedProducts.length > 0 && (
                                    <span className="section-counter-num">{displayCount}</span>
                                )}
                            </h2>
                                <p className="section-sub">
                                    {!loading && !fetchErr && (isCustomer
                                        ? `${claimedProducts.length} claimed product${claimedProducts.length !== 1 ? 's' : ''}`
                                        : `${sarees.length} record${sarees.length !== 1 ? 's' : ''} on the blockchain`
                                    )}
                                </p>
                            </div>
                            <button className="refresh-btn" onClick={isCustomer ? fetchCustomerClaimedProducts : fetchMyProducts} disabled={loading}>
                                <motion.span
                                    animate={loading ? { rotate: 360 } : {}}
                                    transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                                    style={{ display: "inline-block" }}
                                >↻</motion.span>
                                {loading ? " Loading…" : " Refresh"}
                            </button>
                        </div>
                        <SareeContent />
                    </motion.section>

                </div>
            </div>
        </div>
    );
};

export default Home;