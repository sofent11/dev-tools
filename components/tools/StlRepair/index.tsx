import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  AmbientLight,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  LineSegments,
  LineBasicMaterial,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Select, UploadPanel } from '../../ui/ToolUi';
import { formatBytes } from '../shared/fileUtils';
import { useMeshStore } from '../shared/meshStore';
import type {
  MeshBounds,
  MeshPreviewData,
  MeshStats,
  RepairOptions,
  RepairReport,
  RepairWorkerResponse,
} from './types';
import type { WallThicknessWorkerReport, WallThicknessWorkerResponse } from './wallThickness.worker';

const defaultOptions: RepairOptions = {
  targetFaces: 150000,
  weldTolerance: 0,
  targetError: 0.01,
  decimate: true,
  keepLargest: true,
  fillHoles: true,
  addBase: false,
};

const numberFormat = new Intl.NumberFormat('zh-CN');
const compactFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

const formatNumber = (value: number) => numberFormat.format(Math.round(value));

const formatSize = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 100) return compactFormat.format(value);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toPrecision(3);
};

const makeDownloadName = (name: string) => {
  const stem = name.replace(/\.[^.]+$/, '') || 'model';
  return `${stem}_fixed.stl`;
};

const CheckboxRow: React.FC<{
  checked: boolean;
  label: string;
  hint: string;
  onChange: (checked: boolean) => void;
}> = ({ checked, label, hint, onChange }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:bg-slate-50">
    <input
      type="checkbox"
      className="mt-0.5 h-4 w-4 flex-none"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
    />
    <span className="min-w-0">
      <span className="block font-medium text-slate-800">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>
    </span>
  </label>
);

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'good' | 'warn' }> = ({
  label,
  value,
  tone = 'default',
}) => {
  const toneClass = {
    default: 'text-slate-950',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
};

type WallThicknessReport = WallThicknessWorkerReport;
type WallThicknessMode = 'fast' | 'precise';

type EnvironmentPreset = 'studio' | 'warm' | 'cool' | 'contrast';

const environmentPresets: Record<EnvironmentPreset, {
  background: number;
  ambient: [number, number];
  key: [number, number];
  fill: [number, number];
}> = {
  studio: { background: 0xf8fafc, ambient: [0xffffff, 0.55], key: [0xffffff, 1.4], fill: [0x67e8f9, 0.55] },
  warm: { background: 0xfffbeb, ambient: [0xfff7ed, 0.72], key: [0xffedd5, 1.55], fill: [0xfacc15, 0.38] },
  cool: { background: 0xeff6ff, ambient: [0xdbeafe, 0.65], key: [0xbfdbfe, 1.35], fill: [0x22d3ee, 0.62] },
  contrast: { background: 0x111827, ambient: [0xffffff, 0.28], key: [0xffffff, 1.9], fill: [0x38bdf8, 0.9] },
};

const BoundsLine: React.FC<{ bounds: MeshBounds }> = ({ bounds }) => (
  <span>
    {formatSize(bounds.size[0])} x {formatSize(bounds.size[1])} x {formatSize(bounds.size[2])}
  </span>
);

const StatsGrid: React.FC<{ title: string; stats: MeshStats }> = ({ title, stats }) => (
  <div className="tool-panel p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <span
        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
          stats.watertight
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}
      >
        {stats.watertight ? '水密' : '有边界/非流形'}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      <Metric label="顶点" value={formatNumber(stats.vertices)} />
      <Metric label="三角面" value={formatNumber(stats.faces)} />
      <Metric label="连通块" value={formatNumber(stats.components)} />
      <Metric
        label="边界边"
        value={formatNumber(stats.boundaryEdges)}
        tone={stats.boundaryEdges ? 'warn' : 'good'}
      />
      <Metric
        label="非流形边"
        value={formatNumber(stats.nonManifoldEdges)}
        tone={stats.nonManifoldEdges ? 'warn' : 'good'}
      />
      <Metric label="包围盒" value={<BoundsLine bounds={stats.bounds} />} />
    </div>
  </div>
);

const MeshPreview: React.FC<{
  mesh: MeshPreviewData | null;
  isProcessing: boolean;
  materialType: 'default' | 'gold' | 'silver' | 'jade' | 'glass';
  showDiagnostics: boolean;
  wallThicknessEnabled: boolean;
  wallColors: Float32Array | null;
  environmentPreset: EnvironmentPreset;
  softShadows: boolean;
}> = ({
  mesh,
  isProcessing,
  materialType,
  showDiagnostics,
  wallThicknessEnabled,
  wallColors,
  environmentPreset,
  softShadows,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const lineRef = useRef<LineSegments | null>(null);
  const ambientLightRef = useRef<AmbientLight | null>(null);
  const keyLightRef = useRef<DirectionalLight | null>(null);
  const fillLightRef = useRef<DirectionalLight | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new Scene();
    scene.background = new Color(environmentPresets.studio.background);

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 420, true);
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = 'absolute inset-0 h-full w-full';
    container.appendChild(renderer.domElement);

    const camera = new PerspectiveCamera(45, 1, 0.01, 100000);
    camera.position.set(140, -180, 120);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const grid = new GridHelper(240, 24, 0x94a3b8, 0xe2e8f0);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const ambientLight = new AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const keyLight = new DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(90, -120, 180);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0x67e8f9, 0.55);
    fillLight.position.set(-120, 90, 100);
    scene.add(fillLight);
    ambientLightRef.current = ambientLight;
    keyLightRef.current = keyLight;
    fillLightRef.current = fillLight;

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, true);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      scene.traverse(object => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
        if (lineRef.current) {
          scene.remove(lineRef.current);
          lineRef.current.geometry.dispose();
          if (Array.isArray(lineRef.current.material)) {
            lineRef.current.material.forEach(m => m.dispose());
          } else {
            lineRef.current.material.dispose();
          }
          lineRef.current = null;
        }
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const ambientLight = ambientLightRef.current;
    const keyLight = keyLightRef.current;
    const fillLight = fillLightRef.current;
    if (!scene || !renderer || !ambientLight || !keyLight || !fillLight) return;

    const preset = environmentPresets[environmentPreset];
    scene.background = new Color(preset.background);
    ambientLight.color.setHex(preset.ambient[0]);
    ambientLight.intensity = preset.ambient[1];
    keyLight.color.setHex(preset.key[0]);
    keyLight.intensity = preset.key[1];
    fillLight.color.setHex(preset.fill[0]);
    fillLight.intensity = preset.fill[1];
    renderer.shadowMap.enabled = softShadows;
  }, [environmentPreset, softShadows]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach(material => material.dispose());
      } else {
        meshRef.current.material.dispose();
      }
      meshRef.current = null;
    }

    if (lineRef.current) {
      scene.remove(lineRef.current);
      lineRef.current.geometry.dispose();
      if (Array.isArray(lineRef.current.material)) {
        lineRef.current.material.forEach(m => m.dispose());
      } else {
        lineRef.current.material.dispose();
      }
      lineRef.current = null;
    }

    if (!mesh) return;

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    geometry.setIndex(new BufferAttribute(mesh.indices, 1));
    if (wallThicknessEnabled && wallColors && wallColors.length === mesh.positions.length) {
      geometry.setAttribute('color', new BufferAttribute(wallColors, 3));
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const materialCommon = {
      flatShading: false,
      vertexColors: wallThicknessEnabled,
      side: wallThicknessEnabled ? DoubleSide : undefined,
    };
    let material: MeshStandardMaterial;
    if (materialType === 'gold') {
      material = new MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.12,
        metalness: 0.96,
        ...materialCommon,
      });
    } else if (materialType === 'silver') {
      material = new MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 0.15,
        metalness: 0.90,
        ...materialCommon,
      });
    } else if (materialType === 'jade') {
      material = new MeshStandardMaterial({
        color: 0x34d399,
        roughness: 0.22,
        metalness: 0.05,
        emissive: 0x064e3b,
        emissiveIntensity: 0.12,
        ...materialCommon,
      });
    } else if (materialType === 'glass') {
      material = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.35,
        ...materialCommon,
      });
    } else {
      material = new MeshStandardMaterial({
        color: 0xd8f3dc,
        roughness: 0.72,
        metalness: 0.05,
        ...materialCommon,
      });
    }

    const object = new Mesh(geometry, material);
    meshRef.current = object;
    scene.add(object);

    const bounds = new Box3().setFromObject(object);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const distance = maxDim * 2.2;
    object.position.set(-center.x, -center.y, -center.z);
    object.castShadow = softShadows;
    object.receiveShadow = softShadows;
    object.updateMatrixWorld(true);

    if (showDiagnostics) {
      const boundaryIndices: number[] = [];
      const edgeCounts = new Map<string, number>();
      const edgeVertices = new Map<string, [number, number]>();
      const ind = mesh.indices;
      const pos = mesh.positions;
      
      for (let i = 0; i < ind.length; i += 3) {
        const ia = ind[i];
        const ib = ind[i + 1];
        const ic = ind[i + 2];
        const pairs = [[ia, ib], [ib, ic], [ic, ia]];
        for (const [v0, v1] of pairs) {
          const key = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
          edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
          edgeVertices.set(key, [v0, v1]);
        }
      }
      
      for (const [key, count] of edgeCounts.entries()) {
        if (count === 1 || count >= 3) {
          const [v0, v1] = edgeVertices.get(key)!;
          boundaryIndices.push(v0, v1);
        }
      }
      
      if (boundaryIndices.length > 0) {
        const boundaryPositions = new Float32Array(boundaryIndices.length * 3);
        for (let i = 0; i < boundaryIndices.length; i++) {
          const vIdx = boundaryIndices[i];
          boundaryPositions[i * 3] = pos[vIdx * 3];
          boundaryPositions[i * 3 + 1] = pos[vIdx * 3 + 1];
          boundaryPositions[i * 3 + 2] = pos[vIdx * 3 + 2];
        }
        
        const lineGeo = new BufferGeometry();
        lineGeo.setAttribute('position', new BufferAttribute(boundaryPositions, 3));
        const lineMat = new LineBasicMaterial({
          color: 0xff0055,
          linewidth: 2,
          depthTest: false,
          transparent: true,
          opacity: 0.95
        });
        const lineSegs = new LineSegments(lineGeo, lineMat);
        lineSegs.renderOrder = 999;
        lineSegs.position.set(-center.x, -center.y, -center.z);
        
        scene.add(lineSegs);
        lineRef.current = lineSegs;
      }
    }

    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = distance * 20;
    camera.position.set(distance, -distance * 1.25, distance * 0.8);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }, [mesh, materialType, showDiagnostics, wallThicknessEnabled, wallColors, softShadows]);

  return (
    <div ref={containerRef} className="relative min-h-[360px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {!mesh && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center text-slate-500">
          <Box className="h-10 w-10 text-slate-300" />
          <div>
            <div className="text-sm font-semibold text-slate-700">等待 STL 模型</div>
            <div className="mt-1 text-xs">上传并处理后会显示可旋转预览</div>
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-lg border border-cyan-100 bg-white/90 px-3 py-2 text-xs font-medium text-cyan-800 shadow-sm backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          处理中
        </div>
      )}
      {wallThicknessEnabled && mesh && (
        <div className="absolute left-3 top-3 z-20 rounded-lg border border-white/60 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
          壁厚热力图：红色高风险 · 橙色临界 · 绿色安全
        </div>
      )}
    </div>
  );
};

const ReportSummary: React.FC<{ report: RepairReport | null; outputSize: number }> = ({ report, outputSize }) => {
  if (!report) {
    return (
      <div className="tool-panel flex min-h-[14rem] flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
        <FileText className="h-9 w-9 text-slate-300" />
        <div>
          <div className="text-sm font-semibold text-slate-700">暂无处理报告</div>
          <div className="mt-1 text-xs">完成处理后会列出清理、降面与水密性诊断。</div>
        </div>
      </div>
    );
  }

  const faceDelta = report.initial.faces - report.final.faces;

  return (
    <div className="space-y-3">
      <div className={report.final.watertight ? 'status-success p-3 text-sm' : 'status-warning p-3 text-sm'}>
        <div className="flex items-start gap-2">
          {report.final.watertight ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          )}
          <div>
            <div className="font-semibold">
              {report.final.watertight ? '当前拓扑检测为水密' : '仍检测到边界边或非流形边'}
            </div>
            <div className="mt-1 text-xs leading-5">
              {report.final.watertight
                ? '已按 Python 脚本语义完成清理、降面、法线修正和小孔补面；打印前仍建议在切片软件中复检尺寸与朝向。'
                : '已按 Python 脚本语义处理；脚本同样可能输出非完全水密模型，复杂坏面需要复检。'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="面数变化" value={`${formatNumber(report.initial.faces)} -> ${formatNumber(report.final.faces)}`} />
        <Metric label="减少面数" value={formatNumber(Math.max(faceDelta, 0))} tone={faceDelta > 0 ? 'good' : 'default'} />
        <Metric label="导出大小" value={formatBytes(outputSize)} />
        <Metric label="补洞数量" value={formatNumber(report.filledHoles)} tone={report.filledHoles ? 'good' : 'default'} />
      </div>

      <div className="tool-panel p-4">
        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div>删除退化面：{formatNumber(report.skippedDegenerateFaces)}</div>
          <div>删除重复面：{formatNumber(report.skippedDuplicateFaces)}</div>
          <div>移除碎片：{formatNumber(report.removedFragments)}</div>
          <div>降面小片：{formatNumber(report.removedPostSimplifyFragments)}</div>
          <div>非流形面：{formatNumber(report.removedNonManifoldFaces)}</div>
          <div>降面执行：{report.simplified ? '是' : '否'}</div>
          <div>补洞范围：单三角孔 / 单四边孔</div>
          <div>
            降面误差：{report.simplifyError === null ? '-' : report.simplifyError.toPrecision(3)}
          </div>
          <div>
            底座：{report.baseInfo ? `直径 ${formatSize(report.baseInfo.diameter)} / 厚度 ${formatSize(report.baseInfo.thickness)}` : '未添加'}
          </div>
        </div>
        {report.notes.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
            {report.notes.map(note => (
              <div key={note}>- {note}</div>
            ))}
          </div>
        )}
      </div>

      <StatsGrid title="输入模型" stats={report.initial} />
      <StatsGrid title="清理后模型" stats={report.afterCleanup} />
      <StatsGrid title="最终模型" stats={report.final} />
    </div>
  );
};

export const StlRepairTool: React.FC = () => {
  const workerRef = useRef<Worker | null>(null);
  const wallWorkerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const wallRequestIdRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<RepairOptions>(defaultOptions);
  const [mesh, setMesh] = useState<MeshPreviewData | null>(null);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [materialType, setMaterialType] = useState<'default' | 'gold' | 'silver' | 'jade' | 'glass'>('default');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [wallThicknessEnabled, setWallThicknessEnabled] = useState(false);
  const [wallThicknessThreshold, setWallThicknessThreshold] = useState(0.8);
  const [wallThicknessMode, setWallThicknessMode] = useState<WallThicknessMode>('fast');
  const [wallReport, setWallReport] = useState<WallThicknessReport | null>(null);
  const [wallColors, setWallColors] = useState<Float32Array | null>(null);
  const [wallAnalysisRunning, setWallAnalysisRunning] = useState(false);
  const [wallAnalysisProgress, setWallAnalysisProgress] = useState(0);
  const [environmentPreset, setEnvironmentPreset] = useState<EnvironmentPreset>('studio');
  const [softShadows, setSoftShadows] = useState(true);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      wallWorkerRef.current?.terminate();
    };
  }, []);

  const canProcess = Boolean(file) && !processing;
  const outputSize = stlBuffer?.byteLength ?? 0;

  const updateOption = <K extends keyof RepairOptions>(key: K, value: RepairOptions[K]) => {
    setOptions(previous => ({ ...previous, [key]: value }));
  };

  const getWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./stlRepair.worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
  };

  const getWallWorker = () => {
    if (!wallWorkerRef.current) {
      wallWorkerRef.current = new Worker(new URL('./wallThickness.worker.ts', import.meta.url), { type: 'module' });
    }
    return wallWorkerRef.current;
  };

  const cancelWallAnalysis = () => {
    wallWorkerRef.current?.terminate();
    wallWorkerRef.current = null;
    wallRequestIdRef.current += 1;
    setWallAnalysisRunning(false);
    setWallAnalysisProgress(0);
  };

  const runWallAnalysis = (targetMesh = mesh) => {
    if (!targetMesh || !wallThicknessEnabled) {
      setWallReport(null);
      setWallColors(null);
      return;
    }

    cancelWallAnalysis();
    setWallAnalysisRunning(true);
    setWallAnalysisProgress(0);
    setWallReport(null);
    setWallColors(null);
    const id = wallRequestIdRef.current + 1;
    wallRequestIdRef.current = id;
    const worker = getWallWorker();
    const positions = targetMesh.positions.slice();
    const indices = targetMesh.indices.slice();

    worker.onmessage = (event: MessageEvent<WallThicknessWorkerResponse>) => {
      if (event.data.id !== wallRequestIdRef.current) return;
      if (event.data.type === 'progress') {
        setWallAnalysisProgress(event.data.progress);
        return;
      }
      setWallAnalysisRunning(false);
      if (event.data.type === 'error') {
        setError(`壁厚分析失败: ${event.data.error}`);
        return;
      }
      setWallAnalysisProgress(100);
      setWallReport(event.data.report);
      setWallColors(event.data.colors);
    };

    worker.onerror = event => {
      if (id !== wallRequestIdRef.current) return;
      setWallAnalysisRunning(false);
      setError(event.message || '壁厚分析 Worker 执行失败');
    };

    worker.postMessage({
      id,
      positions,
      indices,
      threshold: wallThicknessThreshold,
      mode: wallThicknessMode,
    }, [positions.buffer, indices.buffer]);
  };

  const handleFile = (nextFile?: File) => {
    if (!nextFile) return;
    setFile(nextFile);
    setMesh(null);
    setReport(null);
    setWallReport(null);
    setWallColors(null);
    setStlBuffer(null);
    setError('');
    cancelWallAnalysis();
  };

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    setError('');
    setReport(null);
    setWallReport(null);
    setWallColors(null);
    setStlBuffer(null);
    setProgressPercent(0);
    setProgressText('已启动 Web Worker 线程...');

    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    const buffer = await file.arrayBuffer();
    const worker = getWorker();

    worker.onmessage = (event: MessageEvent<RepairWorkerResponse>) => {
      if (event.data.id !== requestIdRef.current) return;

      if (event.data.type === 'progress') {
        setProgressPercent(event.data.progress);
        setProgressText(event.data.status);
        return;
      }

      setProcessing(false);
      if (event.data.type === 'error') {
        setError(event.data.error);
        return;
      }

      const pos = new Float32Array(event.data.mesh.positions);
      const ind = new Uint32Array(event.data.mesh.indices);
      setMesh({
        positions: pos,
        indices: ind,
      });
      setReport(event.data.report);
      setStlBuffer(event.data.stl);

      // Save to global mesh store for cross-tab sharing
      useMeshStore.getState().setSharedMesh({
        positions: pos.slice(),
        indices: ind.slice(),
        fileName: file.name,
      });

      if (wallThicknessEnabled) {
        runWallAnalysis({ positions: pos, indices: ind });
      }
    };

    worker.onerror = event => {
      if (id !== requestIdRef.current) return;
      setProcessing(false);
      setError(event.message || 'Worker 执行失败');
    };

    worker.postMessage({ id, fileName: file.name, buffer, options }, [buffer]);
  };

  const handleDownload = () => {
    if (!stlBuffer || !file) return;

    const blob = new Blob([stlBuffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = makeDownloadName(file.name);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const statusText = useMemo(() => {
    if (processing) return '正在按 Python 脚本语义清理、降面并导出 STL';
    if (wallAnalysisRunning) return `正在 Worker 中执行壁厚采样分析 (${wallAnalysisProgress}%)`;
    if (report) return report.final.watertight ? '处理完成，拓扑检测为水密' : '处理完成，仍建议复检';
    if (file) return '已选择文件，等待处理';
    return '选择 STL 文件开始';
  }, [file, processing, report, wallAnalysisProgress, wallAnalysisRunning]);

  useEffect(() => {
    if (wallThicknessEnabled && mesh) {
      runWallAnalysis(mesh);
    } else {
      cancelWallAnalysis();
      setWallReport(null);
      setWallColors(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallThicknessEnabled, wallThicknessThreshold, wallThicknessMode]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 xl:flex-row">
      <Card className="flex min-h-0 flex-col xl:w-[24rem] xl:flex-none">
        <CardHeader
          title="STL 修复/降面"
          description="浏览器本地处理，适合快速清理碎片、降面和导出可复检 STL。"
        />
        <CardContent className="app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <UploadPanel className="min-h-[8.5rem]">
            <label className="flex w-full cursor-pointer flex-col items-center gap-2 p-5 text-center">
              <Upload className="h-8 w-8 text-primary-600" />
              <span className="max-w-full truncate text-sm font-semibold text-slate-700">
                {file ? file.name : '选择 STL 文件'}
              </span>
              <span className="text-xs text-slate-500">
                {file ? `${formatBytes(file.size)} · 不会上传到服务器` : '支持 ASCII / 二进制 STL'}
              </span>
              <input
                className="hidden"
                type="file"
                accept=".stl,model/stl,application/sla"
                onChange={event => handleFile(event.target.files?.[0])}
              />
            </label>
          </UploadPanel>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-800">
              {processing ? <Loader2 className="h-4 w-4 animate-spin text-primary-700" /> : <RefreshCw className="h-4 w-4 text-primary-700" />}
              {processing && progressText ? progressText : statusText}
            </div>
            {processing && (
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            {wallAnalysisRunning && (
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${wallAnalysisProgress}%` }}
                />
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div>
              <FieldLabel hint={`${formatNumber(options.targetFaces)} 面`}>目标三角面数上限</FieldLabel>
              <Input
                type="number"
                min={1000}
                step={1000}
                value={options.targetFaces}
                disabled={!options.decimate}
                onChange={event => updateOption('targetFaces', Math.max(1000, Number(event.target.value) || 1000))}
              />
            </div>
            <div>
              <FieldLabel hint="0 为脚本同款精确去重">焊接容差</FieldLabel>
              <Input
                type="number"
                min={0}
                step={0.0001}
                value={options.weldTolerance}
                onChange={event => updateOption('weldTolerance', Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            <div>
              <FieldLabel hint="meshoptimizer 相对误差">降面误差</FieldLabel>
              <Input
                type="number"
                min={0.0001}
                max={1}
                step={0.001}
                disabled={!options.decimate}
                value={options.targetError}
                onChange={event => updateOption('targetError', Math.max(0.0001, Number(event.target.value) || 0.01))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <CheckboxRow
              checked={options.keepLargest}
              label="只保留最大连通块"
              hint="清除扫描或生成模型里常见的小碎片。"
              onChange={checked => updateOption('keepLargest', checked)}
            />
            <CheckboxRow
              checked={options.decimate}
              label="超过目标时自动降面"
              hint="使用 meshoptimizer，结果可能受原模型拓扑限制。"
              onChange={checked => updateOption('decimate', checked)}
            />
            <CheckboxRow
              checked={options.fillHoles}
              label="尝试补小孔"
              hint="对齐 Trimesh fill_holes 的轻量范围，仅补单三角孔和单四边孔。"
              onChange={checked => updateOption('fillHoles', checked)}
            />
            <CheckboxRow
              checked={options.addBase}
              label="添加圆形底座"
              hint="按 Python 脚本同款比例生成，直接合并到 STL。"
              onChange={checked => updateOption('addBase', checked)}
            />
          </div>

          <div className="grid gap-3 border-t border-slate-200 pt-3">
            <div>
              <FieldLabel>预览渲染材质</FieldLabel>
              <Select value={materialType} onChange={event => setMaterialType(event.target.value as typeof materialType)}>
                <option value="default">默认 (Matte Green)</option>
                <option value="gold">🏆 皇家黄金 (Gold PBR)</option>
                <option value="silver">🥈 抛光白银 (Silver PBR)</option>
                <option value="jade">🍀 冰种温润翡翠 (Jade SSS)</option>
                <option value="glass">💎 钢化玻璃 (Glass Refract)</option>
              </Select>
            </div>
            <CheckboxRow
              checked={showDiagnostics}
              label="开启坏面霓虹诊断模式"
              hint="自动在 3D 视口中以高对比度亮红线标出未闭合边界与缺陷缝隙。"
              onChange={checked => setShowDiagnostics(checked)}
            />
            <CheckboxRow
              checked={wallThicknessEnabled}
              label="开启壁厚热力图"
              hint="在 Worker 中采样估算薄壁风险：红色低于阈值，橙色接近阈值，绿色相对安全。"
              onChange={checked => setWallThicknessEnabled(checked)}
            />
            <div>
              <FieldLabel>壁厚分析模式</FieldLabel>
              <Select
                value={wallThicknessMode}
                disabled={!wallThicknessEnabled}
                onChange={event => setWallThicknessMode(event.target.value as WallThicknessMode)}
              >
                <option value="fast">快速采样 (推荐)</option>
                <option value="precise">精细采样 (较慢)</option>
              </Select>
            </div>
            <div>
              <FieldLabel hint={`${formatSize(wallThicknessThreshold)} mm`}>壁厚风险阈值</FieldLabel>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={wallThicknessThreshold}
                disabled={!wallThicknessEnabled}
                onChange={event => setWallThicknessThreshold(Math.max(0.1, Number(event.target.value) || 0.8))}
              />
            </div>
            <div>
              <FieldLabel>环境光预设</FieldLabel>
              <Select value={environmentPreset} onChange={event => setEnvironmentPreset(event.target.value as EnvironmentPreset)}>
                <option value="studio">明亮工作室</option>
                <option value="warm">暖金展示台</option>
                <option value="cool">冷蓝工程灯</option>
                <option value="contrast">深色高对比</option>
              </Select>
            </div>
            <CheckboxRow
              checked={softShadows}
              label="柔和阴影"
              hint="为 PBR 预览启用更有空间感的阴影表现。"
              onChange={checked => setSoftShadows(checked)}
            />
          </div>

          {wallReport && (
            <div className={wallReport.thinFaces > 0 ? 'status-warning p-3 text-xs' : 'status-success p-3 text-xs'}>
              <div className="font-semibold">壁厚采样诊断</div>
              <div className="mt-1 leading-5">
                已采样 {formatNumber(wallReport.sampledFaces)} 个面，低于 {formatSize(wallReport.threshold)} mm 的风险面 {formatNumber(wallReport.thinFaces)} 个；
                最小估算厚度 {wallReport.minThickness === null ? '未命中对向面' : `${formatSize(wallReport.minThickness)} mm`}；
                采样率 {(wallReport.sampleRate * 100).toFixed(1)}%，置信度 {wallReport.confidence}，耗时 {Math.round(wallReport.elapsedMs)} ms。
              </div>
              <div className="mt-1 leading-5 text-amber-700">
                该分析是浏览器端工程辅助估算，不等价专业切片软件或工业级测厚结果。
              </div>
            </div>
          )}
          {wallAnalysisRunning && (
            <Button variant="secondary" onClick={cancelWallAnalysis}>
              取消壁厚分析
            </Button>
          )}

          {error && <div className="status-error p-3 text-sm">{error}</div>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleProcess} disabled={!canProcess} isLoading={processing} icon={<RefreshCw className="h-4 w-4" />}>
              开始处理
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={!stlBuffer || processing}
              icon={<Download className="h-4 w-4" />}
            >
              下载 STL
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader
          title="模型预览与报告"
          description="可旋转查看修复结果；报告展示拓扑风险，不把轻量清理误报为完整修复。"
          actions={
            report ? (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                {report.fileName}
              </span>
            ) : null
          }
        />
        <CardContent className="app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <MeshPreview
            mesh={mesh}
            isProcessing={processing}
            materialType={materialType}
            showDiagnostics={showDiagnostics}
            wallThicknessEnabled={wallThicknessEnabled}
            wallColors={wallColors}
            environmentPreset={environmentPreset}
            softShadows={softShadows}
          />
          <ReportSummary report={report} outputSize={outputSize} />
        </CardContent>
      </Card>
    </div>
  );
};

export default StlRepairTool;
