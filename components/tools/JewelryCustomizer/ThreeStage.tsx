import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { GeometryResult } from './utils/geometry';

interface ThreeStageProps {
  width: number;
  height: number;
  geometry: GeometryResult | null;
  thicknessMm: number;
  unitsPerMm: number;
  materialType: 'gold' | 'platinum' | 'rose_gold' | 'silver';
}

const MATERIAL_PRESETS = {
  gold: {
    color: 0xd4af37, // Rich metallic gold
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
  },
  platinum: {
    color: 0xe5e4e2, // Bright white platinum
    metalness: 1.0,
    roughness: 0.12,
    clearcoat: 0.7,
    clearcoatRoughness: 0.05,
  },
  rose_gold: {
    color: 0xb76e79, // Soft warm rose gold
    metalness: 1.0,
    roughness: 0.16,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
  },
  silver: {
    color: 0xdcdcdc, // Classic shiny silver
    metalness: 1.0,
    roughness: 0.14,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
  },
};

export const ThreeStage: React.FC<ThreeStageProps> = ({
  width,
  height,
  geometry,
  thicknessMm,
  unitsPerMm,
  materialType,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);

  // Setup scene, camera, lights, controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Match slate-100 bg
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 5000);
    camera.position.set(0, 0, 450);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 1.8; // Prevent rendering underground

    // Lighting (Premium studio setup for shiny PBR materials)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Front Main Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(200, 300, 300);
    scene.add(keyLight);

    // Top Light for metallic reflections
    const topLight = new THREE.DirectionalLight(0xffeeba, 0.7);
    topLight.position.set(0, 500, 50);
    scene.add(topLight);

    // Back rim light to create elegant outlines
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-200, 200, -300);
    scene.add(rimLight);

    // Warm fill light
    const fillLight = new THREE.PointLight(0xffebc2, 0.6, 1000);
    fillLight.position.set(-150, -100, 150);
    scene.add(fillLight);

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  // Handle Geometry and Material changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !geometry?.processedPath) return;

    // Remove existing mesh
    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      meshRef.current = null;
    }

    try {
      // 1. Convert SVG path to 2D Shapes using SVGLoader
      const shapes = SVGLoader.createShapes(geometry.processedPath);

      // 2. Extrude shapes into 3D geometry
      // We convert mm thickness to internal units using unitsPerMm
      const depth = thicknessMm * unitsPerMm;
      
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: depth,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.03 * unitsPerMm,
        bevelThickness: 0.05 * unitsPerMm,
      };

      const extrudeGeo = new THREE.ExtrudeGeometry(shapes, extrudeSettings);

      // Center geometry so it rotates nicely around its local origin
      extrudeGeo.center();

      // Invert Y and Z to orient standard CAD coordinates nicely in front of the camera
      extrudeGeo.scale(1, -1, -1);

      // 3. Setup premium physical material
      const preset = MATERIAL_PRESETS[materialType];
      const material = new THREE.MeshPhysicalMaterial({
        color: preset.color,
        metalness: preset.metalness,
        roughness: preset.roughness,
        clearcoat: preset.clearcoat,
        clearcoatRoughness: preset.clearcoatRoughness,
        reflectivity: 0.9,
      });
      materialRef.current = material;

      // 4. Create and add Mesh
      const mesh = new THREE.Mesh(extrudeGeo, material);
      scene.add(mesh);
      meshRef.current = mesh;
    } catch (e) {
      console.error('Three.js geometry generation failed:', e);
    }
  }, [geometry, thicknessMm, unitsPerMm, materialType]);

  // Deep cleanup on unmount
  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
      }
      if (materialRef.current) {
        materialRef.current.dispose();
      }
      if (rendererRef.current) {
        // Deep deallocate context
        rendererRef.current.forceContextLoss();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-inner flex items-center justify-center"
      style={{ width, height }}
    />
  );
};
