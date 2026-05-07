// src/components/ReportsPanel.js
// Bell icon + slide-in panel for manufacturer to view customer-reported issues
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, AlertTriangle, ShieldAlert, Package, Wrench, HelpCircle, User, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import './ReportsPanel.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ISSUE_META = {
    code_already_used:    { label: 'Code Already Used', icon: '🔑', cls: 'code_used' },
    possible_counterfeit: { label: 'Possible Counterfeit', icon: '⚠️', cls: 'counterfeit' },
    product_damaged:      { label: 'Product Damaged', icon: '📦', cls: 'damaged' },
    wrong_product:        { label: 'Wrong Product', icon: '❌', cls: 'damaged' },
    other:                { label: 'Other Issue', icon: '🔔', cls: 'other' },
};

const STATUS_LABELS = {
    open:         'Open',
    under_review: 'In Review',
    resolved:     'Resolved',
    dismissed:    'Dismissed',
};

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

/* ── Main exported component ─────────────────────────── */
export default function ReportsPanel() {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('all');
    const [reports, setReports] = useState([]);
    const [openCount, setOpenCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const pollRef = useRef(null);

    // Fetch open count for badge (lightweight)
    const fetchCount = useCallback(async () => {
        try {
            const res = await fetch(`${API}/reports/count`);
            const data = await res.json();
            if (data.success) setOpenCount(data.openCount);
        } catch { /* silent */ }
    }, []);

    // Fetch full report list
    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const params = filter !== 'all' ? `?status=${filter}` : '';
            const res = await fetch(`${API}/reports${params}`);
            const data = await res.json();
            if (data.success) {
                setReports(data.reports);
                setOpenCount(data.openCount);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [filter]);

    // Poll badge count every 45 s when panel is closed
    useEffect(() => {
        fetchCount();
        pollRef.current = setInterval(fetchCount, 45000);
        return () => clearInterval(pollRef.current);
    }, [fetchCount]);

    // Re-fetch when panel opens or filter changes
    useEffect(() => {
        if (open) fetchReports();
    }, [open, filter, fetchReports]);

    const handleStatusUpdate = async (reportId, newStatus, e) => {
        e.stopPropagation();
        setUpdatingId(reportId);
        try {
            const res = await fetch(`${API}/reports/${reportId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                let errorData;
                try { errorData = JSON.parse(errorText); } catch { }
                console.error("Backend error status:", res.status, errorText);
                toast.error(errorData?.message || `Error ${res.status}: Failed to update status`);
                return;
            }

            const data = await res.json();
            if (data.success) {
                setReports(prev =>
                    prev.map(r => r._id === reportId ? { ...r, status: newStatus } : r)
                );
                if (newStatus !== 'open') {
                    setOpenCount(c => Math.max(0, c - 1));
                }
                toast.success(`Report marked as ${STATUS_LABELS[newStatus]}`);
            } else {
                toast.error(data.message || "Failed to update report status");
            }
        } catch (err) {
            console.error("Fetch error:", err);
            toast.error("Network error. Could not update report.");
        }
        finally { setUpdatingId(null); }
    };

    return (
        <>
            {/* ── Bell Button ──────────────────────────────────── */}
            <button
                id="reports-bell-btn"
                className={`reports-bell-btn${openCount > 0 ? ' has-alerts' : ''}`}
                onClick={() => setOpen(true)}
                title={openCount > 0 ? `${openCount} open customer report${openCount > 1 ? 's' : ''}` : 'Customer Reports'}
                aria-label="View customer reports"
            >
                <Bell size={17} strokeWidth={2} />
                {openCount > 0 && (
                    <span className="reports-badge">
                        {openCount > 99 ? '99+' : openCount}
                    </span>
                )}
            </button>

            {/* ── Backdrop ─────────────────────────────────────── */}
            {open && (
                <div
                    className="reports-overlay"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── Slide-in Panel ───────────────────────────────── */}
            {open && (
                <div className="reports-panel" role="dialog" aria-label="Customer Reports Panel">
                    {/* Header */}
                    <div className="rp-header">
                        <div className="rp-header-icon">
                            <ShieldAlert size={18} />
                        </div>
                        <div className="rp-header-text">
                            <h3>Customer Reports</h3>
                            <p>
                                {openCount > 0
                                    ? `${openCount} open issue${openCount > 1 ? 's' : ''} need your attention`
                                    : 'All reports reviewed — inbox clear'}
                            </p>
                        </div>
                        <button
                            className="rp-close-btn"
                            onClick={() => setOpen(false)}
                            aria-label="Close reports panel"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Filter tabs */}
                    <div className="rp-filters">
                        {['all', 'open', 'under_review', 'resolved', 'dismissed'].map(f => (
                            <button
                                key={f}
                                className={`rp-filter-btn${filter === f ? ' active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'All' : STATUS_LABELS[f]}
                            </button>
                        ))}
                    </div>

                    {/* Body */}
                    <div className="rp-body">
                        {loading ? (
                            <div className="rp-loading">
                                <div className="rp-spinner" />
                                <p>Loading reports…</p>
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="rp-empty">
                                <div className="rp-empty-icon">🔔</div>
                                <p>No {filter !== 'all' ? STATUS_LABELS[filter].toLowerCase() : ''} reports yet.</p>
                            </div>
                        ) : (
                            reports.map(report => (
                                <ReportCard
                                    key={report._id}
                                    report={report}
                                    onStatusChange={handleStatusUpdate}
                                    updating={updatingId === report._id}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

/* ── Individual report card ──────────────────────────── */
function ReportCard({ report, onStatusChange, updating }) {
    const [expanded, setExpanded] = useState(false);
    const meta = ISSUE_META[report.issueType] || ISSUE_META.other;

    return (
        <div
            className={`rp-card ${report.status}-card`}
            onClick={() => setExpanded(e => !e)}
        >
            <div className="rpc-top">
                <div className={`rpc-issue-icon ${meta.cls}`}>
                    {meta.icon}
                </div>
                <div className="rpc-meta">
                    <div className="rpc-product-id">Product #{report.productId}</div>
                    <div className="rpc-product-name">
                        {report.productName || `Saree #${report.productId}`}
                    </div>
                </div>
                <span className={`rpc-status-chip ${report.status}`}>
                    {STATUS_LABELS[report.status]}
                </span>
            </div>

            <div className="rpc-issue-type">{meta.label}</div>

            <div className="rpc-desc">{report.description}</div>

            {expanded && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.6rem' }}>
                    {report.purchaseLocation && (
                        <div><strong style={{ color: 'var(--text-muted)' }}>Purchased at:</strong> {report.purchaseLocation}</div>
                    )}
                    {report.claimedBy && (
                        <div><strong style={{ color: 'var(--text-muted)' }}>Claimed by:</strong> {report.claimedBy}</div>
                    )}
                    <div><strong style={{ color: 'var(--text-muted)' }}>Contact:</strong> {report.reporterContact}</div>
                </div>
            )}

            <div className="rpc-footer">
                <span className="rpc-reporter">
                    <User size={11} />
                    <strong>{report.reporterName}</strong>
                </span>
                <span className="rpc-date">
                    <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                    {timeAgo(report.createdAt)}
                </span>
            </div>

            {/* Action buttons — only shown if not yet resolved/dismissed */}
            {(report.status === 'open' || report.status === 'under_review') && (
                <div className="rpc-actions" onClick={e => e.stopPropagation()}>
                    {report.status === 'open' && (
                        <button
                            className="rpc-action-btn review"
                            disabled={updating}
                            onClick={(e) => onStatusChange(report._id, 'under_review', e)}
                        >
                            🔍 Mark In Review
                        </button>
                    )}
                    <button
                        className="rpc-action-btn resolve"
                        disabled={updating}
                        onClick={(e) => onStatusChange(report._id, 'resolved', e)}
                    >
                        ✅ Resolve
                    </button>
                    <button
                        className="rpc-action-btn dismiss"
                        disabled={updating}
                        onClick={(e) => onStatusChange(report._id, 'dismissed', e)}
                    >
                        ✕ Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}
