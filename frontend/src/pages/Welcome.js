// src/pages/Welcome.js  — v2 Modern 3D Landing Page
import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
    ShieldCheck, Sparkles, Map, Award, ArrowRight, LogIn,
    Box, Link2, Eye, Zap
} from 'lucide-react';
import SmoothScroll from "../components/SmoothScroll";
import ScrollReveal from "../components/animations/ScrollReveal";
import WelcomeHero3D from "../components/3D/WelcomeHero3D";
import PageLoader from "../components/PageLoader";
import "./Welcome.css";

/* ─── Clip Reveal (text slides up through clipping mask) ─ */
const ClipReveal = ({ children, delay }) => (
    <div style={{ overflow: "hidden", lineHeight: 1.1 }}>
        <motion.div
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.78, delay, ease: [0.16, 1, 0.3, 1] }}
        >
            {children}
        </motion.div>
    </div>
);

/* ─── Feature cards ──────────────────────────────────── */
const FEATURES = [
    {
        title: "Blockchain Registry",
        desc: "Every saree is minted on-chain with an immutable certificate of authenticity. Forged provenance becomes technically impossible.",
        icon: <Box size={22} />,
        accent: "purple",
        wide: true,
    },
    {
        title: "Instant Verification",
        desc: "Scan the QR code — get the full provenance in seconds, right from your phone.",
        icon: <ShieldCheck size={22} />,
        accent: "cyan",
    },
    {
        title: "Full Custody Chain",
        desc: "Every handover — cooperative, distributor, retailer — timestamped immutably on-chain.",
        icon: <Link2 size={22} />,
        accent: "emerald",
    },
    {
        title: "Direct from Artisan",
        desc: "Transparent weaver-to-buyer journey supporting Kasaragod's heritage craft ecosystem with fair trade traceability.",
        icon: <Sparkles size={22} />,
        accent: "gold",
        wide: true,
    },
    {
        title: "Journey Tracing",
        desc: "Track every mile of your saree's path with GPS-indexed timestamps on the blockchain.",
        icon: <Map size={22} />,
        accent: "purple",
    },
    {
        title: "Live Network",
        desc: "Real-time blockchain explorer showing all active supply chain events and transfers.",
        icon: <Eye size={22} />,
        accent: "cyan",
    },
];

/* ─── Process steps ──────────────────────────────────── */
const STEPS = [
    {
        icon: <Award size={20} />,
        title: "Weaver Registers",
        desc: "Manufacturer registers saree on-chain with unique ID, certificate, and loom metadata.",
    },
    {
        icon: <Box size={20} />,
        title: "Certificate Minted",
        desc: "Blockchain mints a tamper-proof digital certificate of authenticity with timestamps.",
    },
    {
        icon: <Link2 size={20} />,
        title: "Chain of Custody",
        desc: "Each handover — cooperative → distributor → shop — is cryptographically recorded.",
    },
    {
        icon: <Zap size={20} />,
        title: "Buyer Verifies",
        desc: "Consumer scans QR code to instantly verify authenticity and view the full journey.",
    },
];

/* ─── Page component ─────────────────────────────────── */
const Welcome = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) navigate('/');
    }, [isAuthenticated, navigate]);

    return (
        <SmoothScroll>
            <div className="welcome-page">

                {/* ── Intro loader overlay ── */}
                <PageLoader />



                {/* ══════════════════════════════════════════════
                    HERO — split layout: text left, 3D right
                    ══════════════════════════════════════════════ */}
                <section className="w-hero">
                    {/* Left column */}
                    <div className="w-hero__left">
                        <motion.div
                            className="w-hero__badge"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 2.0, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <span className="badge-pulse" />
                            Kasaragod Handloom Heritage
                        </motion.div>

                        <div className="w-hero__heading">
                            <ClipReveal delay={2.15}>
                                <span>Blockchain-Secured</span>
                            </ClipReveal>
                            <ClipReveal delay={2.32}>
                                <span className="gtext">Authenticity</span>
                            </ClipReveal>
                            <ClipReveal delay={2.46}>
                                <span>For Every Thread</span>
                            </ClipReveal>
                        </div>

                        <motion.p
                            className="w-hero__desc"
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.65, delay: 2.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                            Verify the authenticity of your handloom saree with immutable blockchain
                            technology. Every thread tells a transparent story — from the artisan's
                            loom to your hands.
                        </motion.p>

                        <motion.div
                            className="w-hero__cta"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.65, delay: 2.78, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Link to="/register" className="btn-hero-primary">
                                Register Your Business <ArrowRight size={17} />
                            </Link>
                            <Link to="/login" className="btn-hero-ghost">
                                <LogIn size={17} /> Sign In
                            </Link>
                        </motion.div>


                    </div>

                    {/* Right column — 3D canvas */}
                    <motion.div
                        className="w-hero__right"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.2, delay: 0.2 }}
                    >
                        <div className="canvas-wrap">
                            <WelcomeHero3D />
                        </div>

                        {/* Floating HUD cards */}
                        <motion.div
                            className="hud-card hud-card--left"
                            animate={{ y: [0, -9, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <ShieldCheck size={13} className="hud-ico hud-ico--green" />
                            <div>
                                <div className="hud-title">Block Verified</div>
                                <div className="hud-sub">0xf39f…2266</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="hud-card hud-card--right"
                            animate={{ y: [0, 9, 0] }}
                            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                        >
                            <Zap size={13} className="hud-ico hud-ico--purple" />
                            <div>
                                <div className="hud-title">Tx Confirmed</div>
                                <div className="hud-sub">Chain #31337</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="hud-card hud-card--bottom"
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                        >
                            <Award size={13} className="hud-ico hud-ico--gold" />
                            <div>
                                <div className="hud-title">Authenticity</div>
                                <div className="hud-sub">Certified ✓</div>
                            </div>
                        </motion.div>
                    </motion.div>
                </section>

                {/* ══════════════════════════════════════════════
                    FEATURES — bento grid
                    ══════════════════════════════════════════════ */}
                <section className="w-features">
                    <div className="w-container">
                        <ScrollReveal direction="up" distance={30}>
                            <div className="w-section-header">
                                <span className="w-tag">Platform Features</span>
                                <h2>Blockchain-Powered<br /><span className="gtext">Authenticity System</span></h2>
                                <p>Preserving Kasaragod's heritage craft through cutting-edge distributed ledger technology.</p>
                            </div>
                        </ScrollReveal>

                        <div className="bento-grid">
                            {FEATURES.map((f, i) => (
                                <motion.div
                                    key={i}
                                    className={`bento-card bento-card--${f.accent}${f.wide ? ' bento-card--wide' : ''}`}
                                    initial={{ opacity: 0, y: 28 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-50px' }}
                                    transition={{ delay: i * 0.07 }}
                                    whileHover={{ y: -5, transition: { duration: 0.22 } }}
                                >
                                    <div className="bento-icon">{f.icon}</div>
                                    <h3>{f.title}</h3>
                                    <p>{f.desc}</p>
                                    <div className="bento-glow" aria-hidden="true" />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════
                    PROCESS — how it works
                    ══════════════════════════════════════════════ */}
                <section className="w-process">
                    <div className="w-container">
                        <ScrollReveal direction="up" distance={30}>
                            <div className="w-section-header">
                                <span className="w-tag">Process</span>
                                <h2>How <span className="gtext">Kasaragod Sarees</span> Works</h2>
                            </div>
                        </ScrollReveal>

                        <div className="process-steps">
                            {STEPS.map((s, i) => (
                                <motion.div
                                    key={i}
                                    className="process-step"
                                    initial={{ opacity: 0, y: 24 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.12 }}
                                >
                                    <div className="step-num">
                                        <span className="step-num-inner">{i + 1}</span>
                                    </div>
                                    <div className="step-ico">{s.icon}</div>
                                    <h3>{s.title}</h3>
                                    <p>{s.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════
                    CTA
                    ══════════════════════════════════════════════ */}
                <section className="w-cta">
                    <div className="w-container">
                        <ScrollReveal direction="up" distance={40}>
                            <motion.div
                                className="cta-glass"
                                whileHover={{ scale: 1.004 }}
                                transition={{ type: "spring", stiffness: 280 }}
                            >
                                <div className="cta-blob" aria-hidden="true" />
                                <span className="w-tag">Join the Network</span>
                                <h2>Ready to register your sarees?</h2>
                                <p>Join Kasaragod's verified network of weavers, cooperatives, and authentic saree sellers.</p>
                                <div className="cta-actions">
                                    <Link to="/register" className="btn-hero-primary">
                                        Create Account <ArrowRight size={17} />
                                    </Link>
                                    <Link to="/login" className="btn-hero-ghost">
                                        <LogIn size={17} /> Sign In
                                    </Link>
                                </div>
                            </motion.div>
                        </ScrollReveal>
                    </div>
                </section>

            </div>
        </SmoothScroll>
    );
};

export default Welcome;

