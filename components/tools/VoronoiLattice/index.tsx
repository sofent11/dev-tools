import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Download,
  Eye,
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
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { FieldLabel, UploadPanel } from '../../ui/ToolUi';
import { formatBytes } from '../shared/fileUtils';
import type {
  HoleDensity,
  LatticeThickness,
  MeshPreviewData,
  PreviewMode,
  VoronoiOptions,
  VoronoiReport,
  VoronoiWorkerResponse,
} from './types';

const defaultOptions: VoronoiOptions = {
  holeDensity: 'standard',
  thickness: 'standard',
  showOriginal: true,
};

const densityOptions: Array<{ value: HoleDensity; label: string; hint: string }> = [
  { value: 'low', label: '少', hint: '大孔' },
  { value: 'standard', label: '标准', hint: '均衡' },
  { value: 'high', label: '多', hint: '密集' },
];

const thicknessOptions: Array<{ value: LatticeThickness; label: string; hint: string }> = [
  { value: 'plane', label: '平面', hint: '预览' },
  { value: 'thin', label: '细', hint: '轻量' },
  { value: 'standard', label: '标准', hint: '稳妥' },
  { value: 'thick', label: '粗', hint: '强烈' },
];

const viewModeOptions: Array<{ value: PreviewMode; label: string }> = [
  { value: 'mixed', label: '混合' },
  { value: 'lattice', label: '镂空' },
  { value: 'original', label: '原模' },
];

const numberFormat = new Intl.NumberFormat('zh-CN');
const compactFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 });

const formatNumber = (value: number) => numberFormat.format(Math.round(value));

const formatSize = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 100) return compactFormat.format(value);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toPrecision(3);
};

const makeDownloadName = (name: string) => {
  const stem = name.replace(/\.[^.]+$/, '') || 'model';
  return `${stem}_voronoi_lattice.stl`;
};

const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={`min-w-0 rounded-md px-2 py-2 text-center text-xs font-semibold transition ${
            value === option.value
              ? 'bg-white text-primary-800 shadow-sm ring-1 ring-primary-100'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          }`}
          onClick={() => onChange(option.value)}
        >
          <span className="block truncate">{option.label}</span>
          {option.hint && <span className="mt-0.5 block truncate text-[10px] font-medium opacity-70">{option.hint}</span>}
        </button>
      ))}
    </div>
  </div>
);

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'warn' | 'good' }> = ({
  label,
  value,
  tone = 'default',
}) => {
  const toneClass = {
    default: 'text-slate-950',
    warn: 'text-amber-700',
    good: 'text-emerald-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
};

const ReportPanel: React.FC<{ report: VoronoiReport | null; outputSize: number }> = ({ report, outputSize }) => {
  if (!report) {
    return (
      <div className="tool-panel flex min-h-[13rem] flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
        <FileText className="h-9 w-9 text-slate-300" />
        <div>
          <div className="text-sm font-semibold text-slate-700">暂无生成报告</div>
          <div className="mt-1 text-xs">完成处理后会列出采样点、杆件数、输出面数和导出风险。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={report.nonPrintable ? 'status-warning p-3 text-sm' : 'status-success p-3 text-sm'}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <div className="font-semibold">
              {report.nonPrintable ? '平面预览厚度，导出仅供实验' : '已生成实验级镂空 STL'}
            </div>
            <div className="mt-1 text-xs leading-5">
              本工具生成的是表面杆件镂空效果，不执行实体布尔挖孔；打印前建议用修复工具或切片软件复检。
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="采样点" value={formatNumber(report.seedPoints)} />
        <Metric label="杆件" value={formatNumber(report.rods)} />
        <Metric label="输出三角面" value={formatNumber(report.outputFaces)} />
        <Metric label="导出大小" value={formatBytes(outputSize || report.outputBytes)} />
        <Metric label="输入三角面" value={formatNumber(report.inputFaces)} />
        <Metric label="输出顶点" value={formatNumber(report.outputVertices)} />
        <Metric label="杆半径" value={formatSize(report.radius)} tone={report.nonPrintable ? 'warn' : 'default'} />
        <Metric
          label="包围盒"
          value={`${formatSize(report.inputBounds.size[0])} x ${formatSize(report.inputBounds.size[1])} x ${formatSize(report.inputBounds.size[2])}`}
        />
      </div>

      <div className="tool-panel p-4 text-xs leading-5 text-slate-500">
        {report.notes.map(note => (
          <div key={note}>- {note}</div>
        ))}
      </div>
    </div>
  );
};

const makeGeometry = (mesh: MeshPreviewData) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
};

const MeshPreview: React.FC<{
  original: MeshPreviewData | null;
  lattice: MeshPreviewData | null;
  mode: PreviewMode;
  isProcessing: boolean;
}> = ({ original, lattice, mode, isProcessing }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootRef = useRef<Group | null>(null);
  const originalRef = useRef<Mesh | null>(null);
  const latticeRef = useRef<Mesh | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new Scene();
    scene.background = new Color(0xf4f7fb);

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 720, container.clientHeight || 480, true);
    renderer.domElement.className = 'absolute inset-0 h-full w-full';
    container.appendChild(renderer.domElement);

    const camera = new PerspectiveCamera(45, 1, 0.01, 100000);
    camera.position.set(120, -160, 120);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const root = new Group();
    scene.add(root);

    const grid = new GridHelper(240, 24, 0x94a3b8, 0xe2e8f0);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    scene.add(new AmbientLight(0xffffff, 0.58));

    const keyLight = new DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(100, -130, 170);
    scene.add(keyLight);

    const rimLight = new DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-140, 100, 120);
    scene.add(rimLight);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    rootRef.current = root;

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
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!root || !camera || !controls) return;

    root.children.forEach(child => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    root.clear();
    originalRef.current = null;
    latticeRef.current = null;

    if (original) {
      const material = new MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.85,
        metalness: 0.02,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      const object = new Mesh(makeGeometry(original), material);
      originalRef.current = object;
      root.add(object);
    }

    if (lattice) {
      const material = new MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x1f1200,
        roughness: 0.52,
        metalness: 0.18,
      });
      const object = new Mesh(makeGeometry(lattice), material);
      latticeRef.current = object;
      root.add(object);
    }

    if (!root.children.length) return;

    const bounds = new Box3().setFromObject(root);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const distance = maxDim * 2.35;

    root.position.set(-center.x, -center.y, -center.z);
    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = distance * 24;
    camera.position.set(distance, -distance * 1.18, distance * 0.82);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }, [original, lattice]);

  useEffect(() => {
    if (originalRef.current) originalRef.current.visible = mode !== 'lattice';
    if (latticeRef.current) latticeRef.current.visible = mode !== 'original';
  }, [mode, original, lattice]);

  return (
    <div ref={containerRef} className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {!original && !lattice && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center text-slate-500">
          <Boxes className="h-10 w-10 text-slate-300" />
          <div>
            <div className="text-sm font-semibold text-slate-700">等待 STL 模型</div>
            <div className="mt-1 text-xs">上传并生成后会显示可旋转镂空预览</div>
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-lg border border-cyan-100 bg-white/90 px-3 py-2 text-xs font-medium text-cyan-800 shadow-sm backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          生成中
        </div>
      )}
    </div>
  );
};

export const VoronoiLatticeTool: React.FC = () => {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<VoronoiOptions>(defaultOptions);
  const [viewMode, setViewMode] = useState<PreviewMode>('mixed');
  const [original, setOriginal] = useState<MeshPreviewData | null>(null);
  const [lattice, setLattice] = useState<MeshPreviewData | null>(null);
  const [report, setReport] = useState<VoronoiReport | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const outputSize = stlBuffer?.byteLength ?? 0;
  const canProcess = Boolean(file) && !processing;

  const getWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./voronoi.worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
  };

  const updateOption = <K extends keyof VoronoiOptions>(key: K, value: VoronoiOptions[K]) => {
    setOptions(previous => ({ ...previous, [key]: value }));
  };

  const handleFile = (nextFile?: File) => {
    if (!nextFile) return;
    setFile(nextFile);
    setOriginal(null);
    setLattice(null);
    setReport(null);
    setStlBuffer(null);
    setError('');
  };

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    setError('');
    setReport(null);
    setStlBuffer(null);

    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    const buffer = await file.arrayBuffer();
    const worker = getWorker();

    worker.onmessage = (event: MessageEvent<VoronoiWorkerResponse>) => {
      if (event.data.id !== requestIdRef.current) return;

      setProcessing(false);
      if (event.data.type === 'error') {
        setError(event.data.error);
        return;
      }

      setOriginal({
        positions: new Float32Array(event.data.original.positions),
        indices: new Uint32Array(event.data.original.indices),
      });
      setLattice({
        positions: new Float32Array(event.data.lattice.positions),
        indices: new Uint32Array(event.data.lattice.indices),
      });
      setReport(event.data.report);
      setStlBuffer(event.data.stl);
      if (viewMode === 'original') setViewMode('mixed');
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
    if (processing) return '正在本地采样表面并生成镂空杆件';
    if (report) return report.nonPrintable ? '已生成平面预览厚度结果' : '已生成实验级 STL';
    if (file) return '已选择 STL，等待生成';
    return '选择 STL 文件开始';
  }, [file, processing, report]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 xl:flex-row">
      <Card className="flex min-h-0 flex-col xl:w-[25rem] xl:flex-none">
        <CardHeader
          title="STL 镂空/Voronoi"
          description="纯浏览器本地生成表面蜂窝杆件，适合快速预览镂空风格并导出实验级 STL。"
        />
        <CardContent className="app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <UploadPanel className="min-h-[8.5rem]">
            <label className="flex w-full cursor-pointer flex-col items-center gap-2 p-5 text-center">
              <Upload className="h-8 w-8 text-primary-600" />
              <span className="max-w-full truncate text-sm font-semibold text-slate-700">
                {file ? file.name : '选择 STL 文件'}
              </span>
              <span className="text-xs text-slate-500">
                {file ? `${formatBytes(file.size)} · 全程本地处理` : '支持 ASCII / 二进制 STL'}
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
              {statusText}
            </div>
          </div>

          <div className="grid gap-4">
            <SegmentedControl
              label="孔数量"
              value={options.holeDensity}
              options={densityOptions}
              onChange={value => updateOption('holeDensity', value)}
            />
            <SegmentedControl
              label="厚度"
              value={options.thickness}
              options={thicknessOptions}
              onChange={value => updateOption('thickness', value)}
            />
            <SegmentedControl
              label="预览"
              value={viewMode}
              options={viewModeOptions}
              onChange={setViewMode}
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>第一版生成 Voronoi 风格表面杆件，不做实体布尔挖孔；导出结果请在打印前复检。</span>
            </div>
          </div>

          {error && <div className="status-error p-3 text-sm">{error}</div>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleProcess} disabled={!canProcess} isLoading={processing} icon={<RefreshCw className="h-4 w-4" />}>
              生成镂空
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
          title="镂空预览与报告"
          description="可旋转查看原模与镂空结果；参数变化后重新生成即可更新导出。"
          actions={
            report ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                <Eye className="h-3.5 w-3.5" />
                {report.fileName}
              </span>
            ) : null
          }
        />
        <CardContent className="app-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <MeshPreview original={original} lattice={lattice} mode={viewMode} isProcessing={processing} />
          <ReportPanel report={report} outputSize={outputSize} />
        </CardContent>
      </Card>
    </div>
  );
};

export default VoronoiLatticeTool;
