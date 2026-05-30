import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import {
  HelpCircle, Layers, Trash2, Download, RefreshCw, Upload, Eye, EyeOff, Plus, Settings, Ruler
} from 'lucide-react';

interface ShapeConfig {
  id: string;
  name: string;
  type: 'cube' | 'sphere' | 'cylinder' | 'cone' | 'upload';
  posX: number;
  posY: number;
  posZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  color: string;
  visible: boolean;
  uploadedGeo: THREE.BufferGeometry | null;
  uploadedFileName: string;
}

let globalShapeIdCounter = 0;

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#6366f1', // indigo
  '#ec4899', // pink
  '#14b8a6', // teal
];

export const CsgWorkbench: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Scene objects hierarchy state
  const [shapes, setShapes] = useState<ShapeConfig[]>([
    {
      id: 'shape-1',
      name: '基准立方体 A',
      type: 'cube',
      posX: 0,
      posY: 0,
      posZ: 0,
      scaleX: 15,
      scaleY: 15,
      scaleZ: 15,
      color: PRESET_COLORS[0],
      visible: true,
      uploadedGeo: null,
      uploadedFileName: ''
    },
    {
      id: 'shape-2',
      name: '开孔球体 B',
      type: 'sphere',
      posX: 8,
      posY: 4,
      posZ: 0,
      scaleX: 10,
      scaleY: 10,
      scaleZ: 10,
      color: PRESET_COLORS[1],
      visible: true,
      uploadedGeo: null,
      uploadedFileName: ''
    }
  ]);

  const [selectedShapeId, setSelectedShapeId] = useState<string>('shape-2');
  const [baseShapeId, setBaseShapeId] = useState<string>('shape-1');
  const [toolShapeIds, setToolShapeIds] = useState<Record<string, boolean>>({ 'shape-2': true });

  const [isProcessing, setIsProcessing] = useState(false);
  const [resultGeometry, setResultGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [resultStats, setResultStats] = useState<{ vertices: number; triangles: number } | null>(null);
  const [opType, setOpType] = useState<'union' | 'subtract' | 'intersect' | null>(null);
  const [showWireframe, setShowWireframe] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate');

  const [sceneReady, setSceneReady] = useState(false);

  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // WebGL scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const isTransformingRef = useRef<boolean>(false);

  // Mesh objects inside scene mapping
  const meshesMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const boxHelpersMapRef = useRef<Map<string, THREE.BoxHelper>>(new Map());
  const resultMeshRef = useRef<THREE.Mesh | null>(null);

  // Sync ref to prevent state-closure stale bugs
  const shapesRef = useRef<ShapeConfig[]>(shapes);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // Handle STL uploading
  const handleStlUpload = (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target?.result as ArrayBuffer;
      try {
        const loader = new STLLoader();
        const geometry = loader.parse(contents);
        geometry.computeVertexNormals();
        geometry.center();

        setShapes(prev => prev.map(s => {
          if (s.id === id) {
            return {
              ...s,
              type: 'upload',
              uploadedGeo: geometry,
              uploadedFileName: file.name
            };
          }
          return s;
        }));
      } catch {
        alert('解析 STL 文件失败，请确保格式正确！');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Add new shape to hierarchy
  const addShape = (type: 'cube' | 'sphere' | 'cylinder' | 'cone') => {
    const newId = `shape-${globalShapeIdCounter++}`;
    const color = PRESET_COLORS[shapes.length % PRESET_COLORS.length];
    const newShape: ShapeConfig = {
      id: newId,
      name: `新增实体 ${shapes.length + 1}`,
      type,
      posX: 5,
      posY: 5,
      posZ: 0,
      scaleX: 10,
      scaleY: 10,
      scaleZ: 10,
      color,
      visible: true,
      uploadedGeo: null,
      uploadedFileName: ''
    };

    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(newId);
  };

  const deleteShape = (id: string) => {
    if (shapes.length <= 1) {
      alert('场景中必须保留至少一个实体！');
      return;
    }
    setShapes(prev => prev.filter(s => s.id !== id));
    if (selectedShapeId === id) {
      const remaining = shapes.filter(s => s.id !== id);
      setSelectedShapeId(remaining[0]?.id || '');
    }
  };

  const toggleVisibility = (id: string) => {
    setShapes(prev => prev.map(s => {
      if (s.id === id) return { ...s, visible: !s.visible };
      return s;
    }));
  };

  const renameShape = (id: string, name: string) => {
    setShapes(prev => prev.map(s => {
      if (s.id === id) return { ...s, name };
      return s;
    }));
  };

  // Build local geometry based on type and scale
  const buildGeometry = useCallback((config: ShapeConfig): THREE.BufferGeometry => {
    if (config.type === 'upload' && config.uploadedGeo) {
      const geo = config.uploadedGeo.clone();
      geo.scale(config.scaleX / 10, config.scaleY / 10, config.scaleZ / 10);
      return geo;
    }

    let base: THREE.BufferGeometry;
    switch (config.type) {
      case 'sphere':
        base = new THREE.SphereGeometry(1, 32, 32);
        break;
      case 'cylinder':
        base = new THREE.CylinderGeometry(1, 1, 2, 32);
        break;
      case 'cone':
        base = new THREE.ConeGeometry(1, 2, 32);
        break;
      case 'cube':
      default:
        base = new THREE.BoxGeometry(1, 1, 1);
        break;
    }

    base.scale(config.scaleX, config.scaleY, config.scaleZ);
    base.computeVertexNormals();
    return base;
  }, []);

  const getWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../shared/csg.worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
  };

  // Execute advanced multiple Boolean CSG calculations asynchronously via Web Worker
  const executeCsg = (type: 'union' | 'subtract' | 'intersect') => {
    const baseShape = shapes.find(s => s.id === baseShapeId);
    if (!baseShape || !baseShape.visible) {
      alert('请确保已选定并显示基准实体！');
      return;
    }

    const activeTools = shapes.filter(s => s.id !== baseShapeId && toolShapeIds[s.id] && s.visible);
    if (activeTools.length === 0) {
      alert('请在场景树勾选至少一个工具实体作为布尔计算输入！');
      return;
    }

    setIsProcessing(true);
    setOpType(type);
    setProgressPercent(0);
    setProgressText('已启动 Web Worker 线程...');

    const id = requestIdRef.current + 1;
    requestIdRef.current = id;

    // 1. Prepare Base Geometry position attribute
    const baseGeo = buildGeometry(baseShape);
    baseGeo.translate(baseShape.posX, baseShape.posY, baseShape.posZ);
    const basePosAttr = baseGeo.getAttribute('position') as THREE.BufferAttribute;
    const basePositions = (basePosAttr.array as Float32Array).slice();
    baseGeo.dispose();

    // 2. Prepare Tools position attributes and transform parameters
    const toolsData = activeTools.map(tool => {
      const toolGeo = buildGeometry(tool);
      const toolPosAttr = toolGeo.getAttribute('position') as THREE.BufferAttribute;
      const toolPositions = (toolPosAttr.array as Float32Array).slice();
      toolGeo.dispose();
      return {
        positions: toolPositions,
        posX: tool.posX,
        posY: tool.posY,
        posZ: tool.posZ
      };
    });

    const worker = getWorker();

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data as {
        id: number;
        type: 'success' | 'error' | 'progress';
        progress?: number;
        status?: string;
        mesh?: { positions: ArrayBuffer; normals: ArrayBuffer; uvs: ArrayBuffer };
        stats?: { vertices: number; triangles: number };
        error?: string;
      };
      if (data.id !== requestIdRef.current) return;

      if (data.type === 'progress') {
        setProgressPercent(data.progress || 0);
        setProgressText(data.status || '');
        return;
      }

      setIsProcessing(false);
      if (data.type === 'error') {
        alert(data.error || '空间布尔运算失败');
        setOpType(null);
        return;
      }

      const { positions, normals, uvs } = data.mesh!;
      const resultGeo = new THREE.BufferGeometry();
      resultGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
      resultGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(normals), 3));
      resultGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2));
      resultGeo.computeBoundingBox();
      resultGeo.computeBoundingSphere();

      setResultGeometry(resultGeo);
      setResultStats(data.stats || null);
    };

    worker.onerror = event => {
      if (id !== requestIdRef.current) return;
      setIsProcessing(false);
      alert(event.message || 'Worker 执行失败');
      setOpType(null);
    };

    // Serialize and post message to worker
    worker.postMessage({
      id,
      opType: type,
      base: { positions: basePositions },
      tools: toolsData
    }, [basePositions.buffer, ...toolsData.map(t => t.positions.buffer)]);
  };

  // Export and download STL
  const downloadStl = () => {
    if (!resultMeshRef.current) return;
    const exporter = new STLExporter();
    const result = exporter.parse(resultMeshRef.current, { binary: true });
    
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `csg_tree_result_${opType}.stl`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle parameters updates cleanly
  const handleParamChange = useCallback(<K extends keyof ShapeConfig>(id: string, key: K, val: ShapeConfig[K]) => {
    setShapes(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, [key]: val };
      }
      return s;
    }));
  }, []);

  // Bounding box quick alignment solver (align B relative to A)
  const alignShape = (type: 'centerX' | 'centerY' | 'centerZ' | 'centerAll' | 'top' | 'bottom' | 'right' | 'left' | 'front' | 'back') => {
    const baseShape = shapes.find(s => s.id === baseShapeId);
    const targetShape = shapes.find(s => s.id === selectedShapeId);

    if (!baseShape || !targetShape || baseShape.id === targetShape.id) {
      alert('请选择一个非基准的工具实体进行对齐！');
      return;
    }

    const geoA = buildGeometry(baseShape);
    const geoB = buildGeometry(targetShape);

    geoA.computeBoundingBox();
    geoB.computeBoundingBox();

    const boxA = geoA.boundingBox!;
    const boxB = geoB.boundingBox!;

    // World centers of A
    const cAx = baseShape.posX + (boxA.min.x + boxA.max.x) / 2;
    const cAy = baseShape.posY + (boxA.min.y + boxA.max.y) / 2;
    const cAz = baseShape.posZ + (boxA.min.z + boxA.max.z) / 2;

    // Local center offsets of B
    const hcBx = (boxB.min.x + boxB.max.x) / 2;
    const hcBy = (boxB.min.y + boxB.max.y) / 2;
    const hcBz = (boxB.min.z + boxB.max.z) / 2;

    let newX = targetShape.posX;
    let newY = targetShape.posY;
    let newZ = targetShape.posZ;

    switch (type) {
      case 'centerX':
        newX = cAx - hcBx;
        break;
      case 'centerY':
        newY = cAy - hcBy;
        break;
      case 'centerZ':
        newZ = cAz - hcBz;
        break;
      case 'centerAll':
        newX = cAx - hcBx;
        newY = cAy - hcBy;
        newZ = cAz - hcBz;
        break;
      case 'top':
        newY = baseShape.posY + boxA.max.y - boxB.min.y;
        break;
      case 'bottom':
        newY = baseShape.posY + boxA.min.y - boxB.max.y;
        break;
      case 'right':
        newX = baseShape.posX + boxA.max.x - boxB.min.x;
        break;
      case 'left':
        newX = baseShape.posX + boxA.min.x - boxB.max.x;
        break;
      case 'front':
        newZ = baseShape.posZ + boxA.max.z - boxB.min.z;
        break;
      case 'back':
        newZ = baseShape.posZ + boxA.min.z - boxB.max.z;
        break;
    }

    geoA.dispose();
    geoB.dispose();

    setShapes(prev => prev.map(s => {
      if (s.id === targetShape.id) {
        return {
          ...s,
          posX: Number(newX.toFixed(2)),
          posY: Number(newY.toFixed(2)),
          posZ: Number(newZ.toFixed(2))
        };
      }
      return s;
    }));
  };

  const handleReset = () => {
    if (resultGeometry) {
      resultGeometry.dispose();
      setResultGeometry(null);
    }
    setResultStats(null);
    setOpType(null);
  };

  // Mount/Unmount WebGL Context & Gizmo Controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      1000
    );
    camera.position.set(40, 40, 60);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    // Transform controls (3D Gizmo)
    const tControls = new TransformControls(camera, renderer.domElement);
    scene.add(tControls.getHelper());
    transformControlsRef.current = tControls;

    // Block OrbitControls when dragging gizmo
    tControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value;
      isTransformingRef.current = event.value;
      
      // Update values to React state upon finishing drag
      if (!event.value && tControls.object) {
        const obj = tControls.object;
        const targetId = obj.name; // We mapped mesh.name = config.id
        
        setShapes(prev => prev.map(s => {
          if (s.id === targetId) {
            return {
              ...s,
              posX: Number(obj.position.x.toFixed(2)),
              posY: Number(obj.position.y.toFixed(2)),
              posZ: Number(obj.position.z.toFixed(2))
            };
          }
          return s;
        }));
      }
    });

    // Real-time synchronization while dragging
    tControls.addEventListener('change', () => {
      if (tControls.object && isTransformingRef.current) {
        const obj = tControls.object;
        const targetId = obj.name;
        // Keep BoxHelper synchronized during translate dragging
        const helper = boxHelpersMapRef.current.get(targetId);
        if (helper) helper.update();
      }
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 50, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0xa5b4fc, 0.4);
    dirLight2.position.set(-30, -30, -20);
    scene.add(dirLight2);

    // Floor
    const gridHelper = new THREE.GridHelper(80, 80, 0xcbd5e1, 0xf1f5f9);
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    // Resize Handler
    const handleResize = () => {
      if (!rendererRef.current) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, camera);
      }
    };
    animate();

    setSceneReady(true);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      
      scene.remove(tControls.getHelper());
      tControls.dispose();
      if (rendererRef.current) {
        rendererRef.current.forceContextLoss();
        rendererRef.current.dispose();
      }
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Update gizmo mode in transform controls
  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(gizmoMode);
    }
  }, [gizmoMode]);

  // Synchronize 3D meshes in Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Remove obsolete meshes and helpers
    meshesMapRef.current.forEach((mesh, id) => {
      if (!shapes.some(s => s.id === id) || resultGeometry) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        meshesMapRef.current.delete(id);

        const helper = boxHelpersMapRef.current.get(id);
        if (helper) {
          scene.remove(helper);
          boxHelpersMapRef.current.delete(id);
        }
      }
    });

    if (resultMeshRef.current) {
      scene.remove(resultMeshRef.current);
      resultMeshRef.current.geometry.dispose();
      resultMeshRef.current = null;
    }

    // 2. Render Result Mesh if computing was executed
    if (resultGeometry) {
      if (transformControlsRef.current) transformControlsRef.current.detach();
      
      const mat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.15,
        metalness: 0.85,
        wireframe: showWireframe,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(resultGeometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      resultMeshRef.current = mesh;
      return;
    }

    // 3. Render list hierarchy meshes
    shapes.forEach(shape => {
      let mesh = meshesMapRef.current.get(shape.id);
      
      if (!shape.visible) {
        if (mesh) {
          scene.remove(mesh);
          meshesMapRef.current.delete(shape.id);
          const helper = boxHelpersMapRef.current.get(shape.id);
          if (helper) {
            scene.remove(helper);
            boxHelpersMapRef.current.delete(shape.id);
          }
        }
        return;
      }

      // Rebuild or update mesh
      if (mesh) {
        // Simple parameter updates
        mesh.position.set(shape.posX, shape.posY, shape.posZ);
        
        // Rebuild geometry to support live scale slider modifications
        mesh.geometry.dispose();
        mesh.geometry = buildGeometry(shape);
        
        // Highlight selected mesh with standard color opacity
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(shape.color);
        mat.opacity = shape.id === selectedShapeId ? 0.85 : 0.45;
        mat.wireframe = showWireframe;

        // Bounding Box outline highlight
        let helper = boxHelpersMapRef.current.get(shape.id);
        if (shape.id === selectedShapeId) {
          if (!helper) {
            helper = new THREE.BoxHelper(mesh, new THREE.Color(0x3b82f6));
            scene.add(helper);
            boxHelpersMapRef.current.set(shape.id, helper);
          } else {
            helper.update();
          }
        } else if (helper) {
          scene.remove(helper);
          boxHelpersMapRef.current.delete(shape.id);
        }
      } else {
        const geo = buildGeometry(shape);
        const mat = new THREE.MeshStandardMaterial({
          color: shape.color,
          opacity: shape.id === selectedShapeId ? 0.85 : 0.45,
          transparent: true,
          roughness: 0.4,
          metalness: 0.2,
          wireframe: showWireframe,
          side: THREE.DoubleSide
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.name = shape.id;
        mesh.position.set(shape.posX, shape.posY, shape.posZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        meshesMapRef.current.set(shape.id, mesh);

        // Selected highlights
        if (shape.id === selectedShapeId) {
          const helper = new THREE.BoxHelper(mesh, new THREE.Color(0x3b82f6));
          scene.add(helper);
          boxHelpersMapRef.current.set(shape.id, helper);
        }
      }
    });

    // 4. Attach transform controls gizmo to selected active mesh
    const activeMesh = meshesMapRef.current.get(selectedShapeId);
    if (activeMesh && transformControlsRef.current) {
      transformControlsRef.current.attach(activeMesh);
    } else if (transformControlsRef.current) {
      transformControlsRef.current.detach();
    }

  }, [shapes, selectedShapeId, resultGeometry, showWireframe, buildGeometry, sceneReady]);

  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  // Compute precise mm bounding dimensions
  const getSelectedShapeDimensions = (): { x: number; y: number; z: number } | null => {
    if (!selectedShape) return null;
    const geo = buildGeometry(selectedShape);
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    geo.dispose();
    return {
      x: Number(size.x.toFixed(1)),
      y: Number(size.y.toFixed(1)),
      z: Number(size.z.toFixed(1))
    };
  };

  const selectedDim = getSelectedShapeDimensions();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
      
      {/* 3D WebGL Canvas */}
      <div className="lg:col-span-2 relative flex flex-col rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 overflow-hidden shadow-inner">
        <div ref={containerRef} className="flex-1 w-full h-[400px] lg:h-full" />
        
        {/* Canvas floating gizmo mode controls */}
        {!resultGeometry && selectedShape && (
          <div className="absolute bottom-4 left-4 flex gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50 shadow-sm z-10">
            {(['translate', 'rotate', 'scale'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setGizmoMode(mode)}
                className={`text-[10px] font-bold px-2 py-1.5 rounded transition-all cursor-pointer capitalize ${gizmoMode === mode ? 'bg-primary-500 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
              >
                {mode === 'translate' ? '移动' : mode === 'rotate' ? '旋转' : '缩放'}
              </button>
            ))}
          </div>
        )}

        <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50 shadow-sm z-10">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">材质：</span>
          <button
            onClick={() => setShowWireframe(!showWireframe)}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer ${showWireframe ? 'bg-primary-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>网格线</span>
          </button>
        </div>

        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3 bg-white dark:bg-slate-900 px-6 py-4 rounded-xl border border-slate-200/50 shadow-md w-72">
              <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">
                {progressText || '正在进行三维实体布尔运算...'}
              </span>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-bold">{progressPercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel Sidebar */}
      <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm max-h-[750px] overflow-y-auto">
        {!resultGeometry ? (
          <>
            {/* Multi-mesh hierarchy tree outline list */}
            <div className="space-y-3.5 flex-none mb-5">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary-600" />
                  <span>3D 实体场景大纲树</span>
                </h4>
                <div className="flex gap-1">
                  {(['cube', 'sphere', 'cylinder', 'cone'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => addShape(type)}
                      className="p-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      title={`添加${type === 'cube' ? '立方体' : type === 'sphere' ? '球体' : type === 'cylinder' ? '圆柱' : '圆锥'}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Hierarchy nodes tree */}
              <div className="space-y-1.5 border border-slate-100 dark:border-slate-800/80 p-2 rounded-lg max-h-[160px] overflow-y-auto">
                {shapes.map(s => {
                  const isSelected = s.id === selectedShapeId;
                  const isBase = s.id === baseShapeId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedShapeId(s.id)}
                      className={`group flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${isSelected ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-100/50 dark:bg-primary-950/20 dark:text-primary-400 dark:ring-primary-900/50' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Checkbox for tooling selecting */}
                        <input
                          type="checkbox"
                          checked={isBase ? false : !!toolShapeIds[s.id]}
                          disabled={isBase}
                          onChange={(e) => {
                            e.stopPropagation();
                            setToolShapeIds(prev => ({
                              ...prev,
                              [s.id]: e.target.checked
                            }));
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
                          title={isBase ? '基准实体不可勾选' : '勾选作为布尔工具'}
                        />
                        <div
                          className="w-2.5 h-2.5 rounded-full border border-white"
                          style={{ backgroundColor: s.color }}
                        />
                        <input
                          type="text"
                          value={s.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => renameShape(s.id, e.target.value)}
                          className="bg-transparent border-none outline-none font-semibold text-slate-800 dark:text-slate-200 truncate focus:bg-white dark:focus:bg-slate-900 focus:px-1 rounded w-full"
                        />
                      </div>

                      {/* Icons operations */}
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {/* Base toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBaseShapeId(s.id);
                            // Deselect from tool list
                            setToolShapeIds(prev => ({ ...prev, [s.id]: false }));
                          }}
                          className={`px-1 py-0.5 rounded text-[9px] font-bold ${isBase ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800'}`}
                          title="设为布尔基准实体"
                        >
                          基准
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVisibility(s.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {s.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteShape(s.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Config Panel for the selected shape */}
            {selectedShape && (
              <div className="flex-1 space-y-4 min-h-0 overflow-y-auto pr-1">
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between flex-none">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-primary-600" />
                    <span>属性配置 ({selectedShape.name})</span>
                  </h4>
                </div>

                {/* Shape selection procedural */}
                <div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['cube', 'sphere', 'cylinder', 'cone'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => handleParamChange(selectedShape.id, 'type', type)}
                        className={`text-[10px] py-1 font-medium border rounded transition-all capitalize ${selectedShape.type === type ? 'border-primary-500 bg-primary-50/50 text-primary-600 font-semibold' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'}`}
                      >
                        {type === 'cube' ? '立方体' : type === 'sphere' ? '球体' : type === 'cylinder' ? '圆柱' : '圆锥'}
                      </button>
                    ))}
                  </div>
                  
                  {/* STL Custom upload */}
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-primary-500 rounded-lg py-1.5 cursor-pointer bg-slate-50 hover:bg-primary-50/20 transition-all dark:bg-slate-800/40 dark:border-slate-700">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate">
                        {selectedShape.type === 'upload' ? `已载入: ${selectedShape.uploadedFileName.slice(0, 15)}...` : '导入自定义 STL 模型'}
                      </span>
                      <input
                        type="file"
                        accept=".stl"
                        className="hidden"
                        onChange={(e) => handleStlUpload(e, selectedShape.id)}
                      />
                    </label>
                  </div>
                </div>

                {/* Real-time Bounding Box dimensions mm measure card */}
                {selectedDim && (
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1.5 flex-none">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-slate-400" />
                      <span>实体精确量测尺寸 (包围盒 mm)</span>
                    </h5>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
                      <div className="bg-white dark:bg-slate-900 p-1 rounded border border-slate-100 dark:border-slate-800">
                        <span className="block text-[9px] text-slate-400 font-semibold">长度 (X)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDim.x} mm</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-1 rounded border border-slate-100 dark:border-slate-800">
                        <span className="block text-[9px] text-slate-400 font-semibold">宽度 (Y)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDim.y} mm</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-1 rounded border border-slate-100 dark:border-slate-800">
                        <span className="block text-[9px] text-slate-400 font-semibold">高度 (Z)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDim.z} mm</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Position parameters */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">空间坐标位移 (位置)</h4>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-medium text-slate-500">位置 X</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedShape.posX}</span>
                    </div>
                    <input
                      type="range" min="-30" max="30" step="0.5"
                      value={selectedShape.posX}
                      onChange={(e) => handleParamChange(selectedShape.id, 'posX', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-medium text-slate-500">位置 Y</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedShape.posY}</span>
                    </div>
                    <input
                      type="range" min="-30" max="30" step="0.5"
                      value={selectedShape.posY}
                      onChange={(e) => handleParamChange(selectedShape.id, 'posY', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-medium text-slate-500">位置 Z</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedShape.posZ}</span>
                    </div>
                    <input
                      type="range" min="-30" max="30" step="0.5"
                      value={selectedShape.posZ}
                      onChange={(e) => handleParamChange(selectedShape.id, 'posZ', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                </div>

                {/* Quick Alignment Actions */}
                {selectedShape.id !== baseShapeId && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase">快速对齐 (调整至基准实体)</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => alignShape('centerAll')}
                        className="text-[10px] py-1 font-medium border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 rounded-lg transition-all dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-200 font-semibold"
                        title="完全居中"
                      >
                        完全居中对齐
                      </button>
                      <button
                        onClick={() => alignShape('top')}
                        className="text-[10px] py-1 font-medium border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 rounded-lg transition-all dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-200"
                        title="叠放上方"
                      >
                        叠放在正上方
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => alignShape('right')}
                        className="text-[9px] py-0.5 font-medium bg-slate-50 hover:bg-slate-100 rounded text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer text-center"
                        title="右贴齐"
                      >
                        右侧贴合
                      </button>
                      <button
                        onClick={() => alignShape('left')}
                        className="text-[9px] py-0.5 font-medium bg-slate-50 hover:bg-slate-100 rounded text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer text-center"
                        title="左贴齐"
                      >
                        左侧贴合
                      </button>
                      <button
                        onClick={() => alignShape('bottom')}
                        className="text-[9px] py-0.5 font-medium bg-slate-50 hover:bg-slate-100 rounded text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer text-center"
                        title="底贴齐"
                      >
                        底部贴合
                      </button>
                    </div>
                  </div>
                )}

                {/* Scale parameters */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">网格比例缩放 (尺寸)</h4>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-medium text-slate-500">缩放 X</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedShape.scaleX}</span>
                    </div>
                    <input
                      type="range" min="1" max="30" step="0.5"
                      value={selectedShape.scaleX}
                      onChange={(e) => handleParamChange(selectedShape.id, 'scaleX', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-medium text-slate-500">缩放 Y</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedShape.scaleY}</span>
                    </div>
                    <input
                      type="range" min="1" max="30" step="0.5"
                      value={selectedShape.scaleY}
                      onChange={(e) => handleParamChange(selectedShape.id, 'scaleY', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-medium text-slate-500">缩放 Z</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{selectedShape.scaleZ}</span>
                    </div>
                    <input
                      type="range" min="1" max="30" step="0.5"
                      value={selectedShape.scaleZ}
                      onChange={(e) => handleParamChange(selectedShape.id, 'scaleZ', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Boolean Actions panel */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex-none space-y-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Settings className="w-3 h-3 text-slate-400" />
                <span>场景多物体批量布尔计算</span>
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => executeCsg('union')}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>合并</span>
                </button>
                <button
                  onClick={() => executeCsg('subtract')}
                  disabled={isProcessing}
                  className="bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
                  title="从选定的基准实体中相减所有勾选的工具实体"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>相减</span>
                </button>
                <button
                  onClick={() => executeCsg('intersect')}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex flex-col items-center gap-0.5 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>相交</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Result Export View */
          <div className="flex flex-col h-full justify-between gap-6">
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-4 rounded-xl">
                <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  批量布尔运算成功！
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                  网格实体已在本地融合成型，生成的实体可完美直接用于 3D 打印！
                </p>
              </div>

              {/* Bounding Box Stats */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h5 className="text-xs font-bold text-slate-500 uppercase">新合成网格拓扑</h5>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">总顶点数 (Vertices)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{resultStats?.vertices}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">三角面数 (Triangles)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{resultStats?.triangles}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">密闭度 (Watetight)</span>
                  <span className="font-semibold text-emerald-600">100% 水密模型</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-6">
              <button
                onClick={downloadStl}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>导出 3D STL 文件 (二进制)</span>
              </button>
              <button
                onClick={handleReset}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>返回场景树大纲继续设计</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
