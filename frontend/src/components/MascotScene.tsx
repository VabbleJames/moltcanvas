'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

function Mascot() {
    const { scene } = useGLTF('/molty.glb');
    const ref = useRef<THREE.Group>(null);
    const { viewport } = useThree();

    // Store mouse position in a ref so useFrame can read it without re-renders
    const mouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Normalize to -1 to 1
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        const m = mouse.current;

        // Smooth rotation toward cursor
        ref.current.rotation.y = THREE.MathUtils.lerp(
            ref.current.rotation.y,
            m.x * 0.8,
            0.04
        );
        ref.current.rotation.x = THREE.MathUtils.lerp(
            ref.current.rotation.x,
            -m.y * 0.5,
            0.04
        );

        // Subtle position drift toward cursor + floating bob
        ref.current.position.x = THREE.MathUtils.lerp(
            ref.current.position.x,
            m.x * 0.3,
            0.03
        );
        ref.current.position.y = THREE.MathUtils.lerp(
            ref.current.position.y,
            m.y * 0.15 + Math.sin(t * 1.5) * 0.08,
            0.03
        );
    });

    // Clone scene so it doesn't get disposed if component remounts
    const clonedScene = scene.clone();

    return (
        <group ref={ref}>
            <primitive object={clonedScene} scale={1.2} />
        </group>
    );
}

// Preload the model
useGLTF.preload('/molty.glb');

export default function MascotScene() {
    return (
        <div className="w-[150px] h-[150px] sm:w-[200px] sm:h-[200px] md:w-[240px] md:h-[240px] mx-auto">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 40 }}
                style={{ background: 'transparent' }}
                gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.6 }}
            >
                {/* PBR environment for proper material rendering */}
                <Environment preset="studio" />

                {/* Lighting */}
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
