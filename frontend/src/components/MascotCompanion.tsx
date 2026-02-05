'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

// =====================================================
// Mascot that follows mouse across the entire site
// =====================================================

function Mascot() {
    const { scene } = useGLTF('/molty.glb');
    const ref = useRef<THREE.Group>(null);
    const { viewport, camera } = useThree();

    // Track mouse in normalized device coords
    const mouse = useRef({ x: 0, y: 0 });
    // Track actual position for direction-based rotation
    const currentPos = useRef({ x: 0, y: 0 });
    // Track velocity for tilt
    const velocity = useRef({ x: 0, y: 0 });
    // Track if mouse is moving
    const lastMoveTime = useRef(Date.now());
    const isIdle = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Convert to world-ish coords spanning viewport
            mouse.current.x = ((e.clientX / window.innerWidth) * 2 - 1) * (viewport.width / 2) * 0.85;
            mouse.current.y = (-(e.clientY / window.innerHeight) * 2 + 1) * (viewport.height / 2) * 0.85;
            lastMoveTime.current = Date.now();
            isIdle.current = false;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [viewport]);

    useFrame((state: { clock: THREE.Clock }) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        const m = mouse.current;
        const pos = currentPos.current;
        const vel = velocity.current;

        // Check if idle (mouse stopped for 1.5s)
        if (Date.now() - lastMoveTime.current > 1500) {
            isIdle.current = true;
        }

        // --- MOVEMENT: Smooth follow with variable speed ---
        const dx = m.x - pos.x;
        const dy = m.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Move faster when far, slower when close (feels natural)
        const speed = THREE.MathUtils.clamp(distance * 0.06, 0.02, 0.12);

        const prevX = pos.x;
        const prevY = pos.y;
        pos.x = THREE.MathUtils.lerp(pos.x, m.x, speed);
        pos.y = THREE.MathUtils.lerp(pos.y, m.y, speed);

        // Velocity for tilt
        vel.x = pos.x - prevX;
        vel.y = pos.y - prevY;

        // Apply position with floating bob
        ref.current.position.x = pos.x;
        ref.current.position.y = pos.y + Math.sin(t * 2) * 0.06;

        // --- ROTATION: Face movement direction ---
        if (distance > 0.05) {
            // Rotate Y to face movement direction (left/right)
            const targetRotY = Math.atan2(dx, 0.5) * 0.6;
            ref.current.rotation.y = THREE.MathUtils.lerp(
                ref.current.rotation.y,
                targetRotY,
                0.06
            );

            // Tilt forward slightly when moving
            ref.current.rotation.x = THREE.MathUtils.lerp(
                ref.current.rotation.x,
                -vel.y * 3,
                0.08
            );

            // Bank into turns (z rotation)
            ref.current.rotation.z = THREE.MathUtils.lerp(
                ref.current.rotation.z,
                -vel.x * 4,
                0.06
            );
        } else {
            // Return to neutral when close to cursor
            ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, 0, 0.04);
            ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, 0, 0.04);
        }

        // --- IDLE: Gentle bobbing and looking around ---
        if (isIdle.current) {
            ref.current.rotation.y = THREE.MathUtils.lerp(
                ref.current.rotation.y,
                Math.sin(t * 0.5) * 0.4,
                0.02
            );
            ref.current.rotation.x = THREE.MathUtils.lerp(
                ref.current.rotation.x,
                Math.sin(t * 0.7) * 0.1,
                0.02
            );
        }

        // --- SCALE: Slight squash & stretch based on speed ---
        const speedMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const stretch = 1 + speedMag * 2;
        const squash = 1 - speedMag * 0.8;
        ref.current.scale.set(
            THREE.MathUtils.lerp(ref.current.scale.x, squash, 0.1),
            THREE.MathUtils.lerp(ref.current.scale.y, stretch, 0.1),
            THREE.MathUtils.lerp(ref.current.scale.z, squash, 0.1)
        );
    });

    const clonedScene = scene.clone();

    return (
        <group ref={ref} scale={1}>
            <primitive object={clonedScene} scale={0.13} />
        </group>
    );
}

useGLTF.preload('/molty.glb');

export default function MascotCompanion() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Don't render on mobile (no mouse to follow)
        const isMobile = window.innerWidth < 768;
        if (isMobile) return;

        // Small delay before showing so it doesn't flash on page load

        const timer = setTimeout(() => setVisible(true), 500);
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-50 pointer-events-none"
            style={{ isolation: 'isolate' }}
        >
            <Canvas
                camera={{ position: [0, 0, 8], fov: 40 }}
                style={{ background: 'transparent', pointerEvents: 'none' }}
                gl={{
                    alpha: true,
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.6,
                }}
            >
                <Environment preset="studio" />
                <ambientLight intensity={0.6} />
                <hemisphereLight args={[0xffffff, 0x444444, 0.8]} position={[0, 10, 0]} />
                <directionalLight position={[5, 8, 5]} intensity={1.2} />
                <directionalLight position={[-5, 2, -3]} intensity={0.3} color="#00e5ff" />
                <directionalLight position={[0, -2, -5]} intensity={0.3} color="#7c3aed" />
                <Mascot />
            </Canvas>
        </div>
    );
}
