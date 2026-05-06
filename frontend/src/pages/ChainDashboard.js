// src/pages/ChainDashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useSupplyChainContext } from '../context/SupplyChainContext';
import contractAddressData from '../contract-address.json';
import SupplyChainArtifact from '../SupplyChain.json';
import './ChainDashboard.css';

const RPC_URL = 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = contractAddressData.address;

const ROLE_NAMES = {
    '0x0000000000000000000000000000000000000000000000000000000000000000': 'DEFAULT_ADMIN',
    [ethers.keccak256(ethers.toUtf8Bytes('MANUFACTURER'))]: 'MANUFACTURER',
    [ethers.keccak256(ethers.toUtf8Bytes('COOPERATIVE'))]: 'COOPERATIVE',
    [ethers.keccak256(ethers.toUtf8Bytes('DISTRIBUTOR'))]: 'DISTRIBUTOR',
    [ethers.keccak256(ethers.toUtf8Bytes('SHOP'))]: 'SHOP',
};

const STATE_LABELS = ['Created', 'Verified', 'In Transit', 'At Shop', 'Sold', 'In Transit P2P'];
const STATE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#10b981', '#f97316'];

const HARDHAT_ACCOUNTS = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
];

function truncate(str, front = 6, back = 4) {
    if (!str) return '—';
    if (str.length <= front + back + 3) return str;
    return `${str.slice(0, front)}...${str.slice(-back)}`;
}

function CopyBtn({ value }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button className="cd-copy-btn" onClick={copy} title="Copy">
            {copied ? '✓' : '⧉'}
        </button>
    );
}

function SectionHeader({ icon, title, live }) {
    return (
        <div className="cd-section-header">
            <span className="cd-section-icon">{icon}</span>
            <h2 className="cd-section-title">{title}</h2>
            {live && <span className="cd-live-badge">● LIVE</span>}
        </div>
    );
}

/* ─── NETWORK PANEL ─── */
function NetworkPanel({ data }) {
    if (!data) return <div className="cd-skeleton" style={{ height: 120 }} />;
    return (
        <div className="cd-stats-grid">
            {[
                { label: 'Network', value: data.network, icon: '🌐' },
                { label: 'Chain ID', value: data.chainId, icon: '⛓️' },
                { label: 'Latest Block', value: `#${data.blockNumber}`, icon: '📦' },
                { label: 'Gas Price', value: `${parseFloat(data.gasPrice).toFixed(4)} Gwei`, icon: '⛽' },
                { label: 'Pending Txns', value: data.pendingTxns, icon: '⏳' },
                { label: 'Connected', value: data.connected ? '✅ Yes' : '❌ No', icon: '📡' },
            ].map(s => (
                <motion.div
                    key={s.label}
                    className="cd-stat-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <span className="cd-stat-icon">{s.icon}</span>
                    <span className="cd-stat-label">{s.label}</span>
                    <span className="cd-stat-value">{s.value}</span>
                </motion.div>
            ))}
        </div>
    );
}

/* ─── CONTRACT PANEL ─── */
function ContractPanel({ data }) {
    const funcs = SupplyChainArtifact.abi
        .filter(item => item.type === 'function')
        .map(f => ({
            name: f.name,
            inputs: f.inputs?.length || 0,
            mutability: f.stateMutability,
        }));
    const events = SupplyChainArtifact.abi.filter(item => item.type === 'event').map(e => e.name);

    return (
        <div className="cd-contract-panel">
            <div className="cd-contract-address-box">
                <span className="cd-label">Contract Address</span>
                <div className="cd-mono-row">
                    <span className="cd-mono">{CONTRACT_ADDRESS}</span>
                    <CopyBtn value={CONTRACT_ADDRESS} />
                </div>
            </div>

            {data && (
                <div className="cd-contract-meta-grid">
                    <div className="cd-meta-item">
                        <span className="cd-label">ETH Balance</span>
                        <span className="cd-value">{parseFloat(data.balance).toFixed(4)} ETH</span>
                    </div>
                    <div className="cd-meta-item">
                        <span className="cd-label">Code Size</span>
                        <span className="cd-value">{data.codeSize} bytes</span>
                    </div>
                    <div className="cd-meta-item">
                        <span className="cd-label">ABI Functions</span>
                        <span className="cd-value">{funcs.length}</span>
                    </div>
                    <div className="cd-meta-item">
                        <span className="cd-label">ABI Events</span>
                        <span className="cd-value">{events.length}</span>
                    </div>
                </div>
            )}

            <div className="cd-abi-section">
                <h4 className="cd-sub-title">📜 Functions</h4>
                <div className="cd-func-grid">
                    {funcs.map(f => (
                        <div key={f.name} className={`cd-func-chip cd-func-${f.mutability}`}>
                            <span className="cd-func-name">{f.name}</span>
                            <span className="cd-func-meta">{f.mutability} · {f.inputs} args</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="cd-abi-section">
                <h4 className="cd-sub-title">📡 Events</h4>
                <div className="cd-func-grid">
                    {events.map(e => (
                        <div key={e} className="cd-event-chip">{e}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── ROLES PANEL ─── */
function RolesPanel({ roleData, loading }) {
    if (loading) return <div className="cd-skeleton" style={{ height: 200 }} />;
    return (
        <div className="cd-roles-table-wrap">
            <table className="cd-roles-table">
                <thead>
                    <tr>
                        <th>Role</th>
                        <th>Address</th>
                        <th>Balance</th>
                        <th>Hash</th>
                    </tr>
                </thead>
                <tbody>
                    {roleData.map((r, i) => (
                        <motion.tr
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <td>
                                <span className={`cd-role-badge cd-role-${r.role.toLowerCase().replace('_', '-')}`}>
                                    {r.role}
                                </span>
                            </td>
                            <td className="cd-mono-cell">
                                {truncate(r.address, 8, 6)}
                                <CopyBtn value={r.address} />
                            </td>
                            <td>{r.balance} ETH</td>
                            <td className="cd-mono-cell cd-hash-cell">{truncate(r.roleHash, 8, 6)}</td>
                        </motion.tr>
                    ))}
                    {roleData.length === 0 && (
                        <tr><td colSpan={4} className="cd-empty-row">No role assignments found</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

/* ─── PRODUCTS PANEL ─── */
function ProductsPanel({ products, loading }) {
    if (loading) return <div className="cd-skeleton" style={{ height: 200 }} />;
    if (products.length === 0) return (
        <div className="cd-empty-state">
            <div className="cd-empty-icon">🏷️</div>
            <p>No products registered on-chain yet</p>
        </div>
    );
    return (
        <div className="cd-products-table-wrap">
            <table className="cd-roles-table">
                <thead>
                    <tr>
                        <th>Product ID</th>
                        <th>Name</th>
                        <th>State</th>
                        <th>Current Owner</th>
                        <th>Loom Location</th>
                        <th>Batch</th>
                        <th>Consumed</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((p, i) => (
                        <motion.tr
                            key={p.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                        >
                            <td><span className="cd-product-id">#{p.id}</span></td>
                            <td>{p.name}</td>
                            <td>
                                <span
                                    className="cd-state-badge"
                                    style={{ background: `${STATE_COLORS[p.stateRaw] || '#888'}22`, color: STATE_COLORS[p.stateRaw] || '#888', borderColor: STATE_COLORS[p.stateRaw] || '#888' }}
                                >
                                    {STATE_LABELS[p.stateRaw] || 'Unknown'}
                                </span>
                            </td>
                            <td className="cd-mono-cell">
                                {truncate(p.currentOwner)}
                                <CopyBtn value={p.currentOwner} />
                            </td>
                            <td>{p.loomLocation || '—'}</td>
                            <td>{p.batchId > 0 ? `Batch #${p.batchId}` : '—'}</td>
                            <td>{p.isConsumed ? <span style={{ color: '#10b981' }}>✓ Claimed</span> : <span style={{ color: '#6b7280' }}>No</span>}</td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ─── BLOCKS PANEL ─── */
function BlocksPanel({ blocks, contractAddr, loading }) {
    const [expanded, setExpanded] = useState(null);
    if (loading) return <div className="cd-skeleton" style={{ height: 200 }} />;

    const iface = new ethers.Interface(SupplyChainArtifact.abi);
    const decodeData = (data) => {
        if (!data || data === '0x') return null;
        try {
            const parsed = iface.parseTransaction({ data });
            if (!parsed) return null;
            return { name: parsed.name, args: Object.fromEntries(parsed.fragment.inputs.map((inp, i) => [inp.name, parsed.args[i]?.toString()])) };
        } catch { return null; }
    };

    return (
        <div className="cd-blocks-list">
            {blocks.length === 0 && (
                <div className="cd-empty-state">
                    <div className="cd-empty-icon">📭</div>
                    <p>No blocks found</p>
                </div>
            )}
            {blocks.map((block) => (
                <motion.div
                    key={block.hash}
                    className="cd-block-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="cd-block-header" onClick={() => setExpanded(expanded === block.number ? null : block.number)}>
                        <div className="cd-block-num">
                            <span className="cd-block-num-label">BLOCK</span>
                            <span className="cd-block-num-value">#{block.number}</span>
                        </div>
                        <div className="cd-block-info">
                            <span className="cd-block-hash mono">{truncate(block.hash, 10, 8)}</span>
                            <span className="cd-block-time">{new Date(block.timestamp * 1000).toLocaleTimeString()}</span>
                        </div>
                        <div className="cd-block-txcount">
                            <span>{block.transactions.length} txn{block.transactions.length !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="cd-expand-arrow">{expanded === block.number ? '▲' : '▼'}</span>
                    </div>

                    <AnimatePresence>
                        {expanded === block.number && block.transactions.length > 0 && (
                            <motion.div
                                className="cd-block-txns"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                            >
                                {block.transactions.map((tx, idx) => {
                                    const isContract = tx.to?.toLowerCase() === contractAddr?.toLowerCase();
                                    const decoded = isContract ? decodeData(tx.data) : null;
                                    return (
                                        <div key={tx.hash || idx} className="cd-tx-row">
                                            <span className={`cd-tx-type-badge ${isContract ? 'cd-tx-contract' : 'cd-tx-transfer'}`}>
                                                {isContract ? (decoded?.name?.toUpperCase() || 'CONTRACT CALL') : 'ETH TRANSFER'}
                                            </span>
                                            <span className="cd-tx-hash mono">{truncate(tx.hash, 10, 6)}</span>
                                            <CopyBtn value={tx.hash} />
                                            <span className="cd-tx-value">{ethers.formatEther(tx.value || 0)} ETH</span>
                                            {decoded && (
                                                <span className="cd-tx-decoded">
                                                    {Object.entries(decoded.args).slice(0, 2).map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 20 ? truncate(v) : v}`).join(' · ')}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            ))}
        </div>
    );
}

/* ─── ACCOUNTS PANEL ─── */
function AccountsPanel({ accounts }) {
    if (!accounts.length) return <div className="cd-skeleton" style={{ height: 200 }} />;
    return (
        <div className="cd-accounts-grid">
            {accounts.map((acc, i) => (
                <motion.div
                    key={acc.address}
                    className="cd-account-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                >
                    <div className="cd-account-index">#{i}</div>
                    <div className="cd-account-body">
                        <div className="cd-account-address mono">
                            {truncate(acc.address, 10, 8)}
                            <CopyBtn value={acc.address} />
                        </div>
                        <div className="cd-account-balance">{parseFloat(acc.balance).toFixed(4)} ETH</div>
                        {acc.role && <span className={`cd-role-badge cd-role-${acc.role.toLowerCase().replace('_', '-')}`}>{acc.role}</span>}
                        {acc.nonce > 0 && <span className="cd-account-nonce">Nonce: {acc.nonce}</span>}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

/* ─── EVENTS PANEL ─── */
function EventsPanel({ events, loading }) {
    if (loading) return <div className="cd-skeleton" style={{ height: 200 }} />;
    if (!events.length) return (
        <div className="cd-empty-state">
            <div className="cd-empty-icon">📡</div>
            <p>No contract events emitted yet</p>
        </div>
    );
    const EVENT_ICONS = {
        ProductCreated: '🏷️',
        ProductVerified: '✅',
        CustodyTransferred: '🔄',
        CustomerOwnershipClaimed: '👤',
        BatchCreated: '📦',
        CustodyTransferredBatch: '📦🔄',
        OwnershipTransferred: '🔀',
        UserCertificateRegistered: '📜',
    };
    return (
        <div className="cd-events-list">
            {events.map((ev, i) => (
                <motion.div
                    key={`${ev.txHash}-${i}`}
                    className="cd-event-item"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                >
                    <span className="cd-event-icon">{EVENT_ICONS[ev.name] || '⚡'}</span>
                    <div className="cd-event-body">
                        <span className="cd-event-name">{ev.name}</span>
                        <span className="cd-event-block">Block #{ev.blockNumber}</span>
                        <span className="cd-event-args">
                            {Object.entries(ev.args).slice(0, 3).map(([k, v]) => (
                                <span key={k} className="cd-event-arg"><span className="cd-arg-key">{k}:</span> {typeof v === 'string' && v.length > 20 ? truncate(v) : v}</span>
                            ))}
                        </span>
                    </div>
                    <div className="cd-event-tx">
                        <span className="mono">{truncate(ev.txHash, 8, 6)}</span>
                        <CopyBtn value={ev.txHash} />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const TABS = [
    { id: 'network', label: '🌐 Network', icon: '🌐' },
    { id: 'contract', label: '📋 Contract', icon: '📋' },
    { id: 'roles', label: '🔐 Roles', icon: '🔐' },
    { id: 'products', label: '🏷️ Products', icon: '🏷️' },
    { id: 'blocks', label: '📦 Blocks', icon: '📦' },
    { id: 'accounts', label: '👛 Accounts', icon: '👛' },
    { id: 'events', label: '📡 Events', icon: '📡' },
];

const ChainDashboard = () => {
    const { readOnlyContract, contract, ROLES } = useSupplyChainContext();
    const [activeTab, setActiveTab] = useState('network');
    const [networkData, setNetworkData] = useState(null);
    const [contractData2, setContractData2] = useState(null);
    const [roleData, setRoleData] = useState([]);
    const [products, setProducts] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [events, setEvents] = useState([]);
    const [loadingMap, setLoadingMap] = useState({});
    const [lastRefresh, setLastRefresh] = useState(null);
    const pollRef = useRef(null);

    const setLoading = (key, val) => setLoadingMap(m => ({ ...m, [key]: val }));

    const getProvider = useCallback(() => {
        try { return new ethers.JsonRpcProvider(RPC_URL); } catch { return null; }
    }, []);

    const fetchNetwork = useCallback(async () => {
        const provider = getProvider();
        if (!provider) return;
        try {
            const [blockNumber, network, feeData, pendingBlock] = await Promise.all([
                provider.getBlockNumber(),
                provider.getNetwork(),
                provider.getFeeData(),
                provider.getBlock('pending').catch(() => null),
            ]);
            setNetworkData({
                network: network.name === 'unknown' ? 'Hardhat Local' : network.name,
                chainId: network.chainId.toString(),
                blockNumber,
                gasPrice: ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'),
                pendingTxns: pendingBlock?.transactions?.length ?? '—',
                connected: true,
            });
        } catch {
            setNetworkData(prev => prev ? { ...prev, connected: false } : { connected: false, network: 'Disconnected', chainId: '—', blockNumber: '—', gasPrice: '—', pendingTxns: '—' });
        }
    }, [getProvider]);

    const fetchContractInfo = useCallback(async () => {
        const provider = getProvider();
        if (!provider) return;
        try {
            const [balance, code] = await Promise.all([
                provider.getBalance(CONTRACT_ADDRESS),
                provider.getCode(CONTRACT_ADDRESS),
            ]);
            setContractData2({
                balance: ethers.formatEther(balance),
                codeSize: Math.floor((code.length - 2) / 2),
            });
        } catch (e) { console.error(e); }
    }, [getProvider]);

    const fetchRoles = useCallback(async () => {
        const provider = getProvider();
        if (!provider) return;
        setLoading('roles', true);
        try {
            const sc = new ethers.Contract(CONTRACT_ADDRESS, SupplyChainArtifact.abi, provider);
            const roleEntries = [];
            for (const [roleName, roleHash] of Object.entries(ROLES)) {
                try {
                    const memberCount = await sc.getRoleMemberCount(roleHash).catch(() => null);
                    const count = memberCount ? Number(memberCount) : 0;
                    for (let i = 0; i < count; i++) {
                        const member = await sc.getRoleMember(roleHash, i).catch(() => null);
                        if (member) {
                            const bal = await provider.getBalance(member);
                            roleEntries.push({
                                role: roleName,
                                address: member,
                                balance: parseFloat(ethers.formatEther(bal)).toFixed(4),
                                roleHash,
                            });
                        }
                    }
                } catch { /* role may not support enumeration */ }
            }

            // Fallback: check known hardhat accounts
            if (roleEntries.length === 0) {
                const targetContract = contract || readOnlyContract;
                if (targetContract) {
                    for (const addr of HARDHAT_ACCOUNTS) {
                        for (const [roleName, roleHash] of Object.entries(ROLES)) {
                            try {
                                const has = await targetContract.hasRole(roleHash, addr);
                                if (has) {
                                    const bal = await provider.getBalance(addr);
                                    roleEntries.push({
                                        role: roleName,
                                        address: addr,
                                        balance: parseFloat(ethers.formatEther(bal)).toFixed(4),
                                        roleHash,
                                    });
                                }
                            } catch { /* skip */ }
                        }
                    }
                }
            }

            setRoleData(roleEntries);
        } catch (e) { console.error(e); }
        finally { setLoading('roles', false); }
    }, [getProvider, ROLES, contract, readOnlyContract]);

    const fetchProducts = useCallback(async () => {
        const targetContract = contract || readOnlyContract;
        if (!targetContract) return;
        setLoading('products', true);
        const found = [];
        try {
            // Probe both single product counter space (1–50) and bulk space (1000001–1000050)
            const ranges = [
                [...Array(50).keys()].map(i => i + 1),
                [...Array(50).keys()].map(i => i + 1000001),
            ];
            for (const range of ranges) {
                for (const id of range) {
                    try {
                        const p = await targetContract.getProduct(id);
                        if (p.exists) {
                            found.push({
                                id: p.id.toString(),
                                name: p.name,
                                loomLocation: p.loomLocation,
                                weaveDate: p.weaveDate.toString(),
                                currentOwner: p.currentOwner,
                                stateRaw: Number(p.state),
                                batchId: Number(p.batchId),
                                isConsumed: p.isConsumed,
                            });
                        }
                    } catch { /* product doesn't exist, skip */ }
                }
            }
        } catch (e) { console.error(e); }
        finally {
            setProducts(found);
            setLoading('products', false);
        }
    }, [contract, readOnlyContract]);

    const fetchBlocks = useCallback(async () => {
        const provider = getProvider();
        if (!provider) return;
        setLoading('blocks', true);
        try {
            const blockNumber = await provider.getBlockNumber();
            const count = Math.min(15, blockNumber + 1);
            const blockPromises = Array.from({ length: count }, (_, i) =>
                provider.getBlock(blockNumber - i, true).catch(() => null)
            );
            const resolved = (await Promise.all(blockPromises)).filter(Boolean);
            setBlocks(resolved);
        } catch (e) { console.error(e); }
        finally { setLoading('blocks', false); }
    }, [getProvider]);

    const fetchAccounts = useCallback(async () => {
        const provider = getProvider();
        const targetContract = contract || readOnlyContract;
        if (!provider) return;
        try {
            const results = await Promise.all(
                HARDHAT_ACCOUNTS.map(async (addr, i) => {
                    const [balRaw, nonce] = await Promise.all([
                        provider.getBalance(addr),
                        provider.getTransactionCount(addr),
                    ]);
                    let role = null;
                    if (targetContract) {
                        for (const [roleName, roleHash] of Object.entries(ROLES)) {
                            try {
                                const has = await targetContract.hasRole(roleHash, addr);
                                if (has) { role = roleName; break; }
                            } catch { /* skip */ }
                        }
                    }
                    return {
                        address: addr,
                        balance: ethers.formatEther(balRaw),
                        nonce,
                        role,
                    };
                })
            );
            setAccounts(results);
        } catch (e) { console.error(e); }
    }, [getProvider, contract, readOnlyContract, ROLES]);

    const fetchEvents = useCallback(async () => {
        const provider = getProvider();
        if (!provider) return;
        setLoading('events', true);
        try {
            const sc = new ethers.Contract(CONTRACT_ADDRESS, SupplyChainArtifact.abi, provider);
            const blockNumber = await provider.getBlockNumber();
            const fromBlock = Math.max(0, blockNumber - 500);

            const allEventNames = SupplyChainArtifact.abi
                .filter(item => item.type === 'event')
                .map(e => e.name);

            const allLogs = [];
            for (const evName of allEventNames) {
                try {
                    const logs = await sc.queryFilter(sc.filters[evName](), fromBlock, blockNumber);
                    logs.forEach(log => {
                        const args = {};
                        log.fragment?.inputs?.forEach((inp, i) => {
                            args[inp.name] = log.args[i]?.toString?.() ?? log.args[i];
                        });
                        allLogs.push({
                            name: evName,
                            blockNumber: log.blockNumber,
                            txHash: log.transactionHash,
                            args,
                        });
                    });
                } catch { /* event may not exist */ }
            }
            allLogs.sort((a, b) => b.blockNumber - a.blockNumber);
            setEvents(allLogs.slice(0, 50));
        } catch (e) { console.error(e); }
        finally { setLoading('events', false); }
    }, [getProvider]);

    const refreshAll = useCallback(async () => {
        await Promise.all([
            fetchNetwork(),
            fetchContractInfo(),
        ]);
        setLastRefresh(new Date().toLocaleTimeString());
    }, [fetchNetwork, fetchContractInfo]);

    // Initial data load per tab
    useEffect(() => {
        if (activeTab === 'network') { fetchNetwork(); fetchContractInfo(); }
        if (activeTab === 'contract') fetchContractInfo();
        if (activeTab === 'roles') fetchRoles();
        if (activeTab === 'products') fetchProducts();
        if (activeTab === 'blocks') fetchBlocks();
        if (activeTab === 'accounts') fetchAccounts();
        if (activeTab === 'events') fetchEvents();
    }, [activeTab]); // eslint-disable-line

    // Poll network stats every 5s
    useEffect(() => {
        pollRef.current = setInterval(refreshAll, 5000);
        refreshAll();
        return () => clearInterval(pollRef.current);
    }, [refreshAll]);

    return (
        <div className="cd-root">
            {/* ── Hero Header ── */}
            <div className="cd-hero">
                <motion.div
                    className="cd-hero-content"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="cd-hero-icon-wrap">
                        <span className="cd-hero-hex">⬡</span>
                        <span className="cd-hero-badge cd-live-badge">● LIVE</span>
                    </div>
                    <h1 className="cd-hero-title">Blockchain Dashboard</h1>
                    <p className="cd-hero-sub">
                        Real-time on-chain data · Kasaragod SareeChain · Local Hardhat Node
                    </p>
                    {networkData && (
                        <div className="cd-hero-pill-row">
                            <span className="cd-pill">🌐 {networkData.network}</span>
                            <span className="cd-pill">⛓️ Chain {networkData.chainId}</span>
                            <span className="cd-pill">📦 Block #{networkData.blockNumber}</span>
                            <span className="cd-pill">⛽ {parseFloat(networkData.gasPrice || 0).toFixed(2)} Gwei</span>
                        </div>
                    )}
                    <div className="cd-hero-actions">
                        <button className="cd-refresh-btn" onClick={() => {
                            refreshAll();
                            if (activeTab === 'roles') fetchRoles();
                            if (activeTab === 'products') fetchProducts();
                            if (activeTab === 'blocks') fetchBlocks();
                            if (activeTab === 'accounts') fetchAccounts();
                            if (activeTab === 'events') fetchEvents();
                            toast.info('🔄 Syncing...');
                        }}>
                            🔄 Sync Now
                        </button>
                        {lastRefresh && <span className="cd-last-refresh">Last synced {lastRefresh}</span>}
                    </div>
                </motion.div>
            </div>

            {/* ── Tabs ── */}
            <div className="cd-tabs-wrap">
                <div className="cd-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`cd-tab ${activeTab === tab.id ? 'cd-tab-active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="cd-content">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25 }}
                        className="cd-tab-panel"
                    >
                        {activeTab === 'network' && (
                            <>
                                <SectionHeader icon="🌐" title="Network Status" live />
                                <NetworkPanel data={networkData} />

                                <div style={{ marginTop: '2.5rem' }}>
                                    <SectionHeader icon="📋" title="Contract Overview" />
                                    <ContractPanel data={contractData2} />
                                </div>
                            </>
                        )}

                        {activeTab === 'contract' && (
                            <>
                                <SectionHeader icon="📋" title="Smart Contract Details" />
                                <ContractPanel data={contractData2} />
                            </>
                        )}

                        {activeTab === 'roles' && (
                            <>
                                <SectionHeader icon="🔐" title="Role Assignments (RBAC)" />
                                <p className="cd-help-text">
                                    Access control roles defined on-chain. Each role gates specific supply chain operations.
                                </p>
                                <RolesPanel roleData={roleData} loading={loadingMap.roles} />

                                <div className="cd-role-legend">
                                    <h4 className="cd-sub-title" style={{ marginBottom: '1rem' }}>Role Permissions</h4>
                                    <div className="cd-func-grid">
                                        {[
                                            { role: 'DEFAULT_ADMIN', perms: 'Grant/revoke all roles, full access' },
                                            { role: 'MANUFACTURER', perms: 'createProduct, createProductsBulk' },
                                            { role: 'COOPERATIVE', perms: 'verifyProduct' },
                                            { role: 'DISTRIBUTOR', perms: 'transferCustody (InTransit state)' },
                                            { role: 'SHOP', perms: 'transferCustody (AtShop state)' },
                                        ].map(r => (
                                            <div key={r.role} className="cd-role-perm-card">
                                                <span className={`cd-role-badge cd-role-${r.role.toLowerCase().replace('_', '-')}`}>{r.role}</span>
                                                <span className="cd-role-perm-text">{r.perms}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'products' && (
                            <>
                                <SectionHeader icon="🏷️" title={`On-Chain Products (${products.length} found)`} />
                                <p className="cd-help-text">All sarees registered on the blockchain. Probes IDs 1–50 (single) and 1000001–1000050 (bulk).</p>
                                <ProductsPanel products={products} loading={loadingMap.products} />
                            </>
                        )}

                        {activeTab === 'blocks' && (
                            <>
                                <SectionHeader icon="📦" title="Recent Blocks" live />
                                <p className="cd-help-text">Last 15 blocks. Click any block to expand transactions. Contract calls are decoded from ABI.</p>
                                <BlocksPanel blocks={blocks} contractAddr={CONTRACT_ADDRESS} loading={loadingMap.blocks} />
                            </>
                        )}

                        {activeTab === 'accounts' && (
                            <>
                                <SectionHeader icon="👛" title="Hardhat Test Accounts" />
                                <p className="cd-help-text">Default Hardhat node accounts with their balances, nonce, and assigned roles.</p>
                                <AccountsPanel accounts={accounts} />
                            </>
                        )}

                        {activeTab === 'events' && (
                            <>
                                <SectionHeader icon="📡" title={`Contract Events (${events.length})`} live />
                                <p className="cd-help-text">All emitted events from the SupplyChain contract in the last 500 blocks, newest first.</p>
                                <EventsPanel events={events} loading={loadingMap.events} />
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ChainDashboard;
