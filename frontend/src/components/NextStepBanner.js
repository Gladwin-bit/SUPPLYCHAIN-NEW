// src/components/NextStepBanner.js
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSupplyChainContext } from "../context/SupplyChainContext";
import { motion, AnimatePresence } from "framer-motion";
import "./NextStepBanner.css";

const normalizeRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : "");

/**
 * Computes the single most relevant next step for the logged-in user.
 * Returns null if nothing actionable right now.
 */
function computeNextStep({ user, account, pathname }) {
    if (!user) return null;
    const role = normalizeRole(user.role);

    // --- Step 1: Wallet not connected ---
    if (!account) {
        return {
            icon: "🦊",
            message: "Connect your MetaMask wallet to interact with the blockchain.",
            cta: "Connect Wallet",
            action: "connect",
            hideOnPaths: [],
        };
    }

    // --- Step 2: Wallet not linked to profile ---
    if (!user.walletAddress) {
        return {
            icon: "🔗",
            message: "Link your MetaMask wallet to your profile to enable on-chain actions.",
            cta: "Go to Profile",
            action: "navigate",
            path: "/profile",
            hideOnPaths: ["/profile"],
        };
    }

    // --- Role-specific steps ---
    if (role === "manufacturer") {
        return {
            icon: "✨",
            message: "Ready to register a new saree on the blockchain?",
            cta: "Register Saree",
            action: "navigate",
            path: "/create",
            hideOnPaths: ["/create", "/create-bulk"],
        };
    }

    if (role === "distributor" || role === "retailer" || role === "intermediate") {
        return {
            icon: "📦",
            message: "Waiting for a package? Upload the sender's waybill QR to accept custody.",
            cta: "Open Manage",
            action: "navigate",
            path: "/custody",
            hideOnPaths: ["/custody"],
        };
    }

    if (role === "customer") {
        return {
            icon: "🛡️",
            message: "Verify the authenticity of your saree using its product ID or QR code.",
            cta: "Verify Now",
            action: "navigate",
            path: "/verify",
            hideOnPaths: ["/verify"],
        };
    }

    return null;
}

const NextStepBanner = () => {
    const { user, isAuthenticated } = useAuth();
    const { account, connectWallet } = useSupplyChainContext();
    const location = useLocation();
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(false);
    const [prevPathname, setPrevPathname] = useState(location.pathname);

    // Reset dismiss when the user navigates to a new page
    useEffect(() => {
        if (location.pathname !== prevPathname) {
            setDismissed(false);
            setPrevPathname(location.pathname);
        }
    }, [location.pathname, prevPathname]);

    if (!isAuthenticated || dismissed) return null;

    const step = computeNextStep({ user, account, pathname: location.pathname });
    if (!step) return null;

    // Hide the banner on pages it links to (no redundant prompts)
    if (step.hideOnPaths?.includes(location.pathname)) return null;

    const handleCta = () => {
        if (step.action === "connect") {
            connectWallet();
        } else if (step.action === "navigate") {
            navigate(step.path);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="next-step-banner"
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="nsb-indicator" />

                <span className="nsb-icon">{step.icon}</span>

                <div className="nsb-body">
                    <span className="nsb-label">Next Step</span>
                    <span className="nsb-message">{step.message}</span>
                </div>

                <button className="nsb-cta" onClick={handleCta}>
                    {step.cta} →
                </button>

                <button
                    className="nsb-dismiss"
                    onClick={() => setDismissed(true)}
                    title="Dismiss"
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </motion.div>
        </AnimatePresence>
    );
};

export default NextStepBanner;
