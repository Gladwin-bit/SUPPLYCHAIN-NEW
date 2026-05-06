// BlockchainBg.js — Fullscreen Canvas Blockchain Network Animation
// Replaces the aurora-bg orbs as the landing page background visual.
import React, { useEffect, useRef } from 'react';

const BlockchainBg = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        const mouse = { x: -9999, y: -9999 };

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);

        // ── Nodes ──────────────────────────────────────────────────────
        const NODE_COUNT = 52;

        const createNode = () => {
            const rand = Math.random();
            const color = rand < 0.2 ? '#C9A84C'
                        : rand < 0.55 ? '#00d4ff'
                        : '#0ea5e9';
            const baseR = 3 + Math.random() * 5;
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                baseR,
                r: baseR,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                color,
                glow: 0,
            };
        };

        const nodes = Array.from({ length: NODE_COUNT }, createNode);

        const updateNode = (n) => {
            // Gravitational pull toward mouse
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120 && dist > 0) {
                const force = ((120 - dist) / 120) * 0.04;
                n.vx += (dx / dist) * force;
                n.vy += (dy / dist) * force;
                n.glow = Math.min(1, n.glow + 0.08);
            } else {
                n.glow = Math.max(0, n.glow - 0.04);
            }
            // Clamp speed
            const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (speed > 1.2) {
                n.vx = (n.vx / speed) * 1.2;
                n.vy = (n.vy / speed) * 1.2;
            }
            n.x += n.vx;
            n.y += n.vy;
            // Bounce off edges
            if (n.x < n.baseR)          { n.x = n.baseR;            n.vx = Math.abs(n.vx); }
            if (n.x > width - n.baseR)  { n.x = width - n.baseR;    n.vx = -Math.abs(n.vx); }
            if (n.y < n.baseR)          { n.y = n.baseR;            n.vy = Math.abs(n.vy); }
            if (n.y > height - n.baseR) { n.y = height - n.baseR;   n.vy = -Math.abs(n.vy); }
        };

        const drawNode = (n) => {
            const r = n.baseR + n.glow * 3;
            ctx.save();
            if (n.glow > 0) {
                ctx.shadowBlur = 18 * n.glow;
                ctx.shadowColor = n.color;
            }
            ctx.globalAlpha = 0.85 + n.glow * 0.15;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.fill();
            ctx.restore();
        };

        // ── Connection lines ───────────────────────────────────────────
        const CONN_DIST = 180;
        const CONN_DIST_SQ = CONN_DIST * CONN_DIST;

        const drawConnections = () => {
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 <= CONN_DIST_SQ) {
                        const dist = Math.sqrt(d2);
                        const alpha = (1 - dist / CONN_DIST) * 0.4;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(0,212,255,${alpha.toFixed(3)})`;
                        ctx.lineWidth = 0.8;
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }
        };

        // ── Data packets ───────────────────────────────────────────────
        const packets = [];
        let lastPacketSpawn = 0;

        const spawnPacket = (timestamp) => {
            if (packets.length >= 12) return;
            if (timestamp - lastPacketSpawn < 400) return;
            lastPacketSpawn = timestamp;

            const pairs = [];
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    if (dx * dx + dy * dy <= CONN_DIST_SQ) pairs.push([i, j]);
                }
            }
            if (!pairs.length) return;

            const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
            const rev = Math.random() < 0.5;
            packets.push({
                fromIdx: rev ? b : a,
                toIdx:   rev ? a : b,
                progress: 0,
                // 1.5–2 s travel time at ~60fps
                speed: 1 / (60 * (1.5 + Math.random() * 0.5)),
            });
        };

        const updateDrawPackets = () => {
            for (let i = packets.length - 1; i >= 0; i--) {
                const p = packets[i];
                const from = nodes[p.fromIdx];
                const to   = nodes[p.toIdx];
                const x = from.x + (to.x - from.x) * p.progress;
                const y = from.y + (to.y - from.y) * p.progress;

                ctx.save();
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#00ff88';
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#00ff88';
                ctx.fill();
                ctx.restore();

                p.progress += p.speed;
                if (p.progress >= 1) packets.splice(i, 1);
            }
        };

        // ── Block confirmation pulses ──────────────────────────────────
        const blockPulses = [];
        let lastBlockTime = 0;
        let nextBlockInterval = 4000 + Math.random() * 2000;

        const triggerBlock = (timestamp) => {
            if (timestamp - lastBlockTime < nextBlockInterval) return;
            lastBlockTime = timestamp;
            nextBlockInterval = 4000 + Math.random() * 2000;
            const n = nodes[Math.floor(Math.random() * nodes.length)];
            blockPulses.push({ x: n.x, y: n.y, size: 8, alpha: 1 });
        };

        const drawBlockPulses = () => {
            for (let i = blockPulses.length - 1; i >= 0; i--) {
                const bp = blockPulses[i];
                bp.size += 0.7;
                bp.alpha = Math.max(0, 1 - (bp.size - 8) / 42);
                if (bp.alpha <= 0) { blockPulses.splice(i, 1); continue; }

                ctx.save();
                ctx.globalAlpha = bp.alpha;
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#C9A84C';
                ctx.strokeStyle = '#C9A84C';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const angle = (k / 6) * Math.PI * 2 - Math.PI / 6;
                    const hx = bp.x + bp.size * Math.cos(angle);
                    const hy = bp.y + bp.size * Math.sin(angle);
                    k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
        };

        // ── Click ripples ──────────────────────────────────────────────
        const clickRipples = [];

        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const handleClick = (e) => {
            clickRipples.push({ x: e.clientX, y: e.clientY, r: 0, alpha: 0.7 });
            nodes.forEach((n) => {
                const dx = n.x - e.clientX;
                const dy = n.y - e.clientY;
                if (dx * dx + dy * dy < 150 * 150) n.glow = 1;
            });
        };

        const drawClickRipples = () => {
            for (let i = clickRipples.length - 1; i >= 0; i--) {
                const rp = clickRipples[i];
                rp.r += 3.5;
                rp.alpha = Math.max(0, 0.7 * (1 - rp.r / 130));
                if (rp.alpha <= 0) { clickRipples.splice(i, 1); continue; }

                ctx.save();
                ctx.globalAlpha = rp.alpha;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#00d4ff';
                ctx.strokeStyle = '#00d4ff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleClick);

        // ── Animation loop ─────────────────────────────────────────────
        const loop = (timestamp) => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#020d18';
            ctx.fillRect(0, 0, width, height);

            drawConnections();
            spawnPacket(timestamp);
            updateDrawPackets();
            triggerBlock(timestamp);
            drawBlockPulses();
            drawClickRipples();

            nodes.forEach((n) => {
                updateNode(n);
                drawNode(n);
            });

            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
        };
    }, []);

    return (
        <>
            {/* Blockchain network canvas */}
            <canvas
                ref={canvasRef}
                id="blockchain-bg"
                aria-hidden="true"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 0,
                    pointerEvents: 'none',
                    display: 'block',
                }}
            />
            {/* Dark gradient overlay — keeps hero text readable */}
            <div
                aria-hidden="true"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to bottom, rgba(2,13,24,0.3) 0%, rgba(2,13,24,0.7) 100%)',
                    zIndex: 0,
                    pointerEvents: 'none',
                }}
            />
        </>
    );
};

export default BlockchainBg;
