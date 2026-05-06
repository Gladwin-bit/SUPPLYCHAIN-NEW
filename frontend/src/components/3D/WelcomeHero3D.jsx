import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

/* ─── Floating particle cloud ─────────────────────────── */
function ParticleField({ count = 350 }) {
    const ref = useRef();

    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 3.5 + Math.random() * 4.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);
        }
        return pos;
    }, [count]);

    useFrame((state) => {
        if (!ref.current) return;
        ref.current.rotation.y = state.clock.elapsedTime * 0.022;
        ref.current.rotation.x = state.clock.elapsedTime * 0.011;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.027}
                color="#a855f7"
                sizeAttenuation
                transparent
                opacity={0.6}
            />
        </points>
    );
}

/* ─── Secondary cyan particle layer ──────────────────── */
function ParticleFieldCyan({ count = 150 }) {
    const ref = useRef();

    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 2 + Math.random() * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);
        }
        return pos;
    }, [count]);

    useFrame((state) => {
        if (!ref.current) return;
        ref.current.rotation.y = -state.clock.elapsedTime * 0.03;
        ref.current.rotation.z = state.clock.elapsedTime * 0.016;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.02}
                color="#00d4ff"
                sizeAttenuation
                transparent
                opacity={0.45}
            />
        </points>
    );
}

/* ─── Orbit ring ─────────────────────────────────────── */
function OrbitRing({ radius, color, speed, tiltX = 0, tiltZ = 0 }) {
    const groupRef = useRef();

    const points = useMemo(() => {
        const pts = [];
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }
        return pts;
    }, [radius]);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.z = state.clock.elapsedTime * speed;
        }
    });

    return (
        <group rotation={[tiltX, 0, tiltZ]} ref={groupRef}>
            <Line points={points} color={color} lineWidth={0.7} transparent opacity={0.2} />
        </group>
    );
}

/* ─── Orbiting glowing nodes ─────────────────────────── */
function OrbitingNodes({ count = 8, radius = 2.0 }) {
    const groupRef = useRef();
    const COLORS = ['#00d4ff', '#a855f7', '#00ff88', '#00d4ff', '#c084fc', '#00ff88', '#a855f7', '#00d4ff'];

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.elapsedTime * 0.38;
        }
    });

    return (
        <group ref={groupRef}>
            {Array.from({ length: count }).map((_, i) => {
                const angle = (i / count) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                const y = Math.sin(angle * 2) * 0.3;
                const color = COLORS[i % COLORS.length];
                return (
                    <Float key={i} speed={1.6 + i * 0.15} floatIntensity={0.12} rotationIntensity={0.05}>
                        <Sphere position={[x, y, z]} args={[0.065, 16, 16]}>
                            <meshStandardMaterial
                                color={color}
                                emissive={color}
                                emissiveIntensity={2.5}
                                metalness={1}
                                roughness={0}
                            />
                        </Sphere>
                    </Float>
                );
            })}
        </group>
    );
}

/* ─── Central supply chain orb ──────────────────────── */
function ChainOrb() {
    const solidRef = useRef();
    const wireRef  = useRef();

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (solidRef.current) solidRef.current.rotation.y =  t * 0.1;
        if (wireRef.current)  wireRef.current.rotation.y  = -t * 0.08;
    });

    return (
        <Float speed={1.4} rotationIntensity={0.18} floatIntensity={0.28}>
            {/* Solid core */}
            <mesh ref={solidRef}>
                <icosahedronGeometry args={[1.0, 2]} />
                <meshStandardMaterial
                    color="#0d0520"
                    emissive="#7c3aed"
                    emissiveIntensity={0.5}
                    metalness={0.95}
                    roughness={0.05}
                />
            </mesh>

            {/* Wireframe overlay */}
            <mesh ref={wireRef}>
                <icosahedronGeometry args={[1.02, 1]} />
                <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.18} />
            </mesh>

            {/* Outer glow halo */}
            <mesh>
                <sphereGeometry args={[1.38, 32, 32]} />
                <meshStandardMaterial
                    color="#7c3aed"
                    transparent
                    opacity={0.04}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Inner point light — orb glows outward */}
            <pointLight color="#a855f7" intensity={5} distance={4} />
        </Float>
    );
}

/* ─── Canvas root ────────────────────────────────────── */
export default function WelcomeHero3D() {
    return (
        <Canvas
            camera={{ position: [0, 0.4, 5.8], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 1.5]}
        >
            {/* Lights */}
            <ambientLight intensity={0.25} />
            <pointLight position={[5,  5,  5]} intensity={2.5} color="#a855f7" />
            <pointLight position={[-5, -3,  4]} intensity={1.8} color="#00d4ff" />
            <pointLight position={[0,  3,  2]} intensity={0.9} color="#00ff88" />

            {/* Deep star field */}
            <Stars radius={90} depth={70} count={1000} factor={3} saturation={0} fade speed={0.35} />

            {/* Particle clouds */}
            <ParticleField count={350} />
            <ParticleFieldCyan count={140} />

            {/* Central orb */}
            <ChainOrb />

            {/* Orbiting nodes */}
            <OrbitingNodes count={8} radius={1.95} />

            {/* Orbit rings at different orientations */}
            <OrbitRing radius={2.4}  color="#a855f7" speed={ 0.22} tiltX={0.45}  />
            <OrbitRing radius={2.7}  color="#00d4ff" speed={-0.16} tiltX={1.15}  />
            <OrbitRing radius={2.1}  color="#00ff88" speed={ 0.32} tiltX={1.75}  />
        </Canvas>
    );
}
