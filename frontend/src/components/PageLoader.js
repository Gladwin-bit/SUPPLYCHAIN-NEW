// src/components/PageLoader.js — Fullscreen intro loader (mirrored from Thechaos)
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [12, 30, 50, 68, 84, 95, 100];

const PageLoader = () => {
    const [visible, setVisible] = useState(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Only show once per browser session
        const done = sessionStorage.getItem("ks-loaded");
        if (done) { setVisible(false); return; }

        let i = 0;
        const interval = setInterval(() => {
            if (i < STEPS.length) {
                setProgress(STEPS[i]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 220);

        const timer = setTimeout(() => {
            setVisible(false);
            sessionStorage.setItem("ks-loaded", "1");
        }, 1750);

        return () => { clearInterval(interval); clearTimeout(timer); };
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="page-loader"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 99999,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--bg-base, #09090F)",
                        cursor: "none",
                    }}
                >
                    {/* Radial glow */}
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: "radial-gradient(ellipse 50% 35% at 50% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)",
                    }} />

                    {/* Wordmark */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
                    >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 0, lineHeight: 1 }}>
                            <span style={{
                                fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                                fontWeight: 700,
                                fontStyle: "italic",
                                fontSize: 36,
                                color: "#D4AF37",
                                letterSpacing: "-0.01em",
                            }}>
                                Kasaragod
                            </span>
                            <span style={{
                                fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                                fontWeight: 400,
                                fontStyle: "italic",
                                fontSize: 36,
                                color: "rgba(240,237,232,0.7)",
                                letterSpacing: "-0.01em",
                                marginLeft: 10,
                            }}>
                                Sarees
                            </span>
                        </div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                            style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                color: "rgba(212,175,55,0.55)",
                                letterSpacing: "0.22em",
                                textTransform: "uppercase",
                            }}
                        >
                            Blockchain Heritage
                        </motion.p>
                    </motion.div>

                    {/* Progress bar */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        style={{
                            position: "absolute",
                            bottom: 0, left: 0, right: 0,
                        }}
                    >
                        <div style={{
                            position: "relative",
                            height: 1,
                            background: "rgba(255,255,255,0.06)",
                            width: "100%",
                            overflow: "hidden",
                        }}>
                            <motion.div
                                style={{
                                    position: "absolute",
                                    top: 0, left: 0,
                                    height: "100%",
                                    background: "linear-gradient(90deg, #D4AF37, #F0D060)",
                                }}
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.28, ease: "easeOut" }}
                            >
                                {/* glow tip */}
                                <div style={{
                                    position: "absolute",
                                    right: 0, top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 48, height: 3,
                                    background: "linear-gradient(to right, transparent, #F0D060)",
                                    filter: "blur(3px)",
                                }} />
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Counter */}
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        style={{
                            position: "absolute",
                            bottom: 10, right: 20,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            color: "rgba(255,255,255,0.18)",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {progress}%
                    </motion.span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PageLoader;
