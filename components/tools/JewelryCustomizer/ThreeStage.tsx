import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { GeometryResult } from './utils/geometry';

/**
 * Converts an SVG path data string (the `d` attribute) into a THREE.ShapePath
 * suitable for SVGLoader.createShapes().
 *
 * The generated paths use only M/L/Z commands, but the parser also handles
 * H, V, C, Q, A for forward compatibility.
 */
function svgPathToShapePath(d: string): THREE.ShapePath {
  const shapePath = new THREE.ShapePath();
  const firstPoint = new THREE.Vector2();
  const point = new THREE.Vector2();
  let isFirstPoint = true;

  // Match SVG path commands: a letter followed by its arguments
  const commands = d.match(/[a-df-z][^a-df-z]*/ig);
  if (!commands) return shapePath;

  for (const cmd of commands) {
    const type = cmd.charAt(0);
    const data = cmd.slice(1).trim();
    // Parse all numeric tokens from the argument portion
    const nums = [...data.matchAll(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map(m => parseFloat(m[0]));

    switch (type) {
      case 'M':
        shapePath.moveTo(nums[0], nums[1]);
        point.set(nums[0], nums[1]);
        if (isFirstPoint) {
          firstPoint.copy(point);
          isFirstPoint = false;
        }
        break;
      case 'L':
        for (let j = 0; j < nums.length; j += 2) {
          shapePath.lineTo(nums[j], nums[j + 1]);
          point.set(nums[j], nums[j + 1]);
        }
        break;
      case 'H':
        shapePath.lineTo(nums[0], point.y);
        point.x = nums[0];
        break;
      case 'V':
        shapePath.lineTo(point.x, nums[0]);
        point.y = nums[0];
        break;
      case 'C':
        for (let j = 0; j < nums.length; j += 6) {
          shapePath.bezierCurveTo(nums[j], nums[j + 1], nums[j + 2], nums[j + 3], nums[j + 4], nums[j + 5]);
          point.set(nums[j + 4], nums[j + 5]);
        }
        break;
      case 'Q':
        for (let j = 0; j < nums.length; j += 4) {
          shapePath.quadraticCurveTo(nums[j], nums[j + 1], nums[j + 2], nums[j + 3]);
          point.set(nums[j + 2], nums[j + 3]);
        }
        break;
      case 'Z':
      case 'z':
        if (shapePath.currentPath) {
          shapePath.currentPath.autoClose = true;
        }
        point.copy(firstPoint);
        isFirstPoint = true;
        break;
    }
  }

  return shapePath;
}

interface ThreeStageProps {
  width: number;
  height: number;
  geometry: GeometryResult | null;
  thicknessMm: number;
  unitsPerMm: number;
  materialType: 'gold' | 'platinum' | 'rose_gold' | 'silver';
  frameMaterialType?: 'gold' | 'platinum' | 'rose_gold' | 'silver';
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
  frameMaterialType,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Object3D | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

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
    cameraRef.current = camera;

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
    controlsRef.current = controls;

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
  // Handle Geometry and Material changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Helper to recursively dispose objects
    const disposeNode = (node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh) {
        if (node.geometry) node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((mat: THREE.Material) => mat.dispose());
        } else if (node.material) {
          node.material.dispose();
        }
      }
      node.children.forEach(disposeNode);
    };

    // Remove existing composite mesh/group
    if (meshRef.current) {
      scene.remove(meshRef.current);
      disposeNode(meshRef.current);
      meshRef.current = null;
    }

    // Ensure we have some text geometry to render
    const textPathStr = geometry?.textPath || geometry?.processedPath;
    if (!textPathStr) return;

    try {
      const group = new THREE.Group();

      // Materials
      const textPreset = MATERIAL_PRESETS[materialType];
      const textMaterial = new THREE.MeshPhysicalMaterial({
        color: textPreset.color,
        metalness: textPreset.metalness,
        roughness: textPreset.roughness,
        clearcoat: textPreset.clearcoat,
        clearcoatRoughness: textPreset.clearcoatRoughness,
        reflectivity: 0.9,
        side: THREE.DoubleSide, // Ensure double sided rendering to completely eliminate backface culling issues
      });

      const framePreset = MATERIAL_PRESETS[frameMaterialType || materialType];
      const frameMaterial = new THREE.MeshPhysicalMaterial({
        color: framePreset.color,
        metalness: framePreset.metalness,
        roughness: framePreset.roughness,
        clearcoat: framePreset.clearcoat,
        clearcoatRoughness: framePreset.clearcoatRoughness,
        reflectivity: 0.9,
        side: THREE.DoubleSide,
      });

      // Z-depth setup
      const hasFrame = geometry?.framePath ? true : false;
      const frameDepth = hasFrame ? thicknessMm * 0.4 * unitsPerMm : 0;
      const textDepth = thicknessMm * unitsPerMm;

      // 1. Text Mesh Extrusion
      const textShapes = SVGLoader.createShapes(svgPathToShapePath(textPathStr));
      const textSettings: THREE.ExtrudeGeometryOptions = {
        depth: textDepth,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.03 * unitsPerMm,
        bevelThickness: 0.05 * unitsPerMm,
      };
      const textGeo = new THREE.ExtrudeGeometry(textShapes, textSettings);
      textGeo.center(); // centers in X, Y, Z
      textGeo.scale(1, -1, -1); // Invert Y and Z directly on the geometry vertices
      
      const textMesh = new THREE.Mesh(textGeo, textMaterial);
      group.add(textMesh);

      // 2. Backing Frame Mesh Extrusion (if framePath exists)
      let frameMesh: THREE.Mesh | null = null;
      if (hasFrame && geometry?.framePath) {
        const frameShapes = SVGLoader.createShapes(svgPathToShapePath(geometry.framePath));
        const frameSettings: THREE.ExtrudeGeometryOptions = {
          depth: frameDepth,
          bevelEnabled: true,
          bevelSegments: 4,
          steps: 1,
          bevelSize: 0.03 * unitsPerMm,
          bevelThickness: 0.05 * unitsPerMm,
        };
        const frameGeo = new THREE.ExtrudeGeometry(frameShapes, frameSettings);
        frameGeo.center(); // centers in X, Y, Z
        frameGeo.scale(1, -1, -1); // Invert Y and Z directly on the geometry vertices
        
        frameMesh = new THREE.Mesh(frameGeo, frameMaterial);
        group.add(frameMesh);
      }

      // 3. Align their Z positions so text sits precisely on front face of frame
      if (frameMesh) {
        frameMesh.position.set(0, 0, -textDepth / 2);
        textMesh.position.set(0, 0, frameDepth / 2);
      } else {
        textMesh.position.set(0, 0, 0);
      }

      // 5. Add to scene and save ref
      scene.add(group);
      meshRef.current = group;

      // 6. Auto-fit camera to the object
      if (cameraRef.current && controlsRef.current) {
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Find the maximum dimension of the bounding box
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Calculate the camera distance needed to fit the object
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Add a margin to ensure the object is comfortably within view
        cameraZ *= 1.4;

        // Animate or instantly update the camera and controls
        cameraRef.current.position.set(center.x, center.y, cameraZ);
        cameraRef.current.near = cameraZ / 100;
        cameraRef.current.far = cameraZ * 100;
        cameraRef.current.updateProjectionMatrix();

        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    } catch (e) {
      console.error('Three.js geometry generation failed:', e);
    }
  }, [geometry, thicknessMm, unitsPerMm, materialType, frameMaterialType, width, height]);

  // Deep cleanup on unmount
  useEffect(() => {
    return () => {
      const disposeNode = (node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh) {
          if (node.geometry) node.geometry.dispose();
          if (Array.isArray(node.material)) {
            node.material.forEach((mat: THREE.Material) => mat.dispose());
          } else if (node.material) {
            node.material.dispose();
          }
        }
        node.children.forEach(disposeNode);
      };

      if (meshRef.current) {
        disposeNode(meshRef.current);
      }
      if (rendererRef.current) {
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
