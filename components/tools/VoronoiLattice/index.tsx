import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
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
import { FieldLabel, Select } from '../../ui/ToolUi';
import { FileDropzone, WorkflowNotice, WorkflowSteps } from '../shared/WorkflowUi';
import { useI18n } from '../../../src/i18n';
import { formatBytes } from '../shared/fileUtils';
import { useMeshStore, SharedMesh } from '../shared/meshStore';
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

const latticePresets: Array<{ id: string; label: string; options: VoronoiOptions }> = [
  { id: 'balanced', label: '均衡镂空', options: defaultOptions },
  { id: 'light', label: '轻盈大孔', options: { ...defaultOptions, holeDensity: 'low', thickness: 'thin' } },
  { id: 'dense', label: '密集粗杆', options: { ...defaultOptions, holeDensity: 'high', thickness: 'thick' } },
  { id: 'plane', label: '平面实验预览', options: { ...defaultOptions, holeDensity: 'low', thickness: 'plane' } },
];

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

const exportToStlBuffer = (positions: Float32Array, indices: Uint32Array): ArrayBuffer => {
  const faceCount = indices.length / 3;
  const buffer = new ArrayBuffer(84 + faceCount * 50);
  const view = new DataView(buffer);
  
  // Header (80 bytes)
  const headerBytes = new TextEncoder().encode("Shared Mesh Export");
  const headerView = new Uint8Array(buffer, 0, 80);
  headerView.set(headerBytes.length > 80 ? headerBytes.subarray(0, 80) : headerBytes);
  
  // Number of triangles (4 bytes)
  view.setUint32(80, faceCount, true);
  
  let offset = 84;
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i];
    const ib = indices[i + 1];
    const ic = indices[i + 2];
    
    // Normal (dummy normal)
    view.setFloat32(offset, 0, true);
    view.setFloat32(offset + 4, 0, true);
    view.setFloat32(offset + 8, 0, true);
    offset += 12;
    
    // Vertex A
    view.setFloat32(offset, positions[ia * 3], true);
    view.setFloat32(offset + 4, positions[ia * 3 + 1], true);
    view.setFloat32(offset + 8, positions[ia * 3 + 2], true);
    offset += 12;
    
    // Vertex B
    view.setFloat32(offset, positions[ib * 3], true);
    view.setFloat32(offset + 4, positions[ib * 3 + 1], true);
    view.setFloat32(offset + 8, positions[ib * 3 + 2], true);
    offset += 12;
    
    // Vertex C
    view.setFloat32(offset, positions[ic * 3], true);
    view.setFloat32(offset + 4, positions[ic * 3 + 1], true);
    view.setFloat32(offset + 8, positions[ic * 3 + 2], true);
    offset += 12;
    
    // Attribute byte count (2 bytes)
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  
  return buffer;
};

const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) => { useLocaleRender(); return (
  <div>
    <FieldLabel>{tr(label)}</FieldLabel>
    <div className="grid gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          className={`min-w-0 rounded-md px-2 py-2 text-center text-xs font-semibold transition disabled:opacity-50 ${
            value === option.value
              ? 'bg-white text-primary-800 shadow-sm ring-1 ring-primary-100'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          }`}
          onClick={() => onChange(option.value)}
        >
          <span className="block truncate">{tr(option.label)}</span>
          {option.hint && <span className="mt-0.5 block truncate text-[10px] font-medium opacity-70">{tr(option.hint)}</span>}
        </button>
      ))}
    </div>
  </div>
); };

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'warn' | 'good' }> = ({
  label,
  value,
  tone = 'default',
}) => {
  useLocaleRender();
  const toneClass = {
    default: 'text-slate-950',
    warn: 'text-amber-700',
    good: 'text-emerald-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{tr(label)}</div>
      <div className={`mt-1 truncate text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
};

const ReportPanel: React.FC<{ report: VoronoiReport | null; outputSize: number }> = ({ report, outputSize }) => {
  const { t } = useI18n();
  if (!report) {
    return (
      <div className="tool-panel flex min-h-[13rem] flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
        <FileText className="h-9 w-9 text-slate-300" />
        <div>
          <div className="text-sm font-semibold text-slate-700">{tr("暂无生成报告")}</div>
          <div className="mt-1 text-xs">{tr("完成处理后会列出采样点、杆件数、输出面数和导出风险。")}</div>
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
              {report.nonPrintable ? tr('平面预览厚度，导出仅供实验') : tr('已生成实验级镂空 STL')}
            </div>
            <div className="mt-1 text-xs leading-5">
              {tr("本工具生成的是表面杆件镂空效果，不执行实体布尔挖孔；打印前建议用修复工具或切片软件复检。")}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label={tr("采样点")} value={formatNumber(report.seedPoints)} />
        <Metric label={tr("杆件")} value={formatNumber(report.rods)} />
        <Metric label={tr("输出三角面")} value={formatNumber(report.outputFaces)} />
        <Metric label={tr("导出大小")} value={formatBytes(outputSize || report.outputBytes)} />
        <Metric label={tr("输入三角面")} value={formatNumber(report.inputFaces)} />
        <Metric label={tr("输出顶点")} value={formatNumber(report.outputVertices)} />
        <Metric label={tr("杆半径")} value={formatSize(report.radius)} tone={report.nonPrintable ? 'warn' : 'default'} />
        <Metric
          label={tr("包围盒")}
          value={`${formatSize(report.inputBounds.size[0])} x ${formatSize(report.inputBounds.size[1])} x ${formatSize(report.inputBounds.size[2])}`}
        />
      </div>

      <div className="tool-panel p-4 text-xs leading-5 text-slate-500">
        {report.notes.map(note => (
          <div key={note}>- {t(note)}</div>
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
  useLocaleRender();
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
            <div className="text-sm font-semibold text-slate-700">{tr("等待 STL 模型")}</div>
            <div className="mt-1 text-xs">{tr("上传并生成后会显示可旋转镂空预览")}</div>
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-lg border border-cyan-100 bg-white/90 px-3 py-2 text-xs font-medium text-cyan-800 shadow-sm backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tr("生成中")}</div>
      )}
    </div>
  );
};

export const VoronoiLatticeTool: React.FC = () => {
  const { t } = useI18n();
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const sharedMesh = useMeshStore(state => state.sharedMesh);
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<VoronoiOptions>(defaultOptions);
  const [viewMode, setViewMode] = useState<PreviewMode>('mixed');
  const [original, setOriginal] = useState<MeshPreviewData | null>(null);
  const [lattice, setLattice] = useState<MeshPreviewData | null>(null);
  const [report, setReport] = useState<VoronoiReport | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [processedOptions, setProcessedOptions] = useState<VoronoiOptions | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      workerRef.current?.terminate();
    };
  }, []);

  const importSharedMesh = (shared: SharedMesh) => {
    if (processing) return;
    try {
      const stlBuf = exportToStlBuffer(shared.positions, shared.indices);
      const newFile = new File([stlBuf], shared.fileName, { type: 'model/stl' });
      setFile(newFile);
      setOriginal({
        positions: shared.positions.slice(),
        indices: shared.indices.slice()
      });
      setLattice(null);
      setReport(null);
      setStlBuffer(null);
      setProcessedOptions(null);
      setError('');
    } catch (importError) { setError(`${t('无法导入共享网格')}：${(importError as Error).message}`); }
  };

  const outputSize = stlBuffer?.byteLength ?? 0;
  const canProcess = Boolean(file) && !processing;
  const staleOutput = Boolean(stlBuffer && processedOptions && (options.holeDensity !== processedOptions.holeDensity || options.thickness !== processedOptions.thickness));
  const selectedPreset = latticePresets.find(preset => preset.options.holeDensity === options.holeDensity && preset.options.thickness === options.thickness)?.id || 'custom';

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
    if (!nextFile || processing) return;
    if (!/\.stl$/i.test(nextFile.name) && !['model/stl', 'application/sla'].includes(nextFile.type)) { setError(t('请选择 STL 文件，支持 ASCII 与二进制格式。')); return; }
    if (!nextFile.size) { setError(t('文件为空，请选择包含模型数据的 STL。')); return; }
    requestIdRef.current += 1;
    setFile(nextFile);
    setOriginal(null);
    setLattice(null);
    setReport(null);
    setStlBuffer(null);
    setProcessedOptions(null);
    setError('');
  };

  const handleProcess = async () => {
    if (!file || processing) return;
    const submittedFile = file;
    const submittedOptions = { ...options };

    setProcessing(true);
    setError('');
    setReport(null);
    setStlBuffer(null);
    setLattice(null);
    setProcessedOptions(null);

    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    try {
      const buffer = await submittedFile.arrayBuffer();
      if (id !== requestIdRef.current) return;
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
        setProcessedOptions(submittedOptions);
        if (viewMode === 'original') setViewMode('mixed');
      };

      worker.onerror = event => {
        if (id !== requestIdRef.current) return;
        setProcessing(false);
        setError(event.message || 'Worker 执行失败');
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage({ id, fileName: submittedFile.name, buffer, options: submittedOptions }, [buffer]);
    } catch (readError) {
      if (id !== requestIdRef.current) return;
      setProcessing(false);
      setError(`${t('无法读取文件或启动处理线程')}：${(readError as Error).message}`);
    }
  };

  const handleDownload = () => {
    if (!stlBuffer || !file || processing || staleOutput) return;

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
    <div className="grid min-w-0 gap-4 xl:grid-cols-[23rem_minmax(0,1fr)] xl:items-start">
      <div className="xl:col-span-2"><WorkflowSteps steps={['选择 STL 模型', '设置镂空风格', '预览并导出']} active={report && !staleOutput ? 2 : file ? 1 : 0} /></div>
      <Card className="min-w-0">
        <CardHeader title={tr("STL 镂空/Voronoi")} description={t('选择源模型、设置镂空风格，再生成表面杆件与实验级 STL。')} />
        <CardContent className="space-y-4">
          <FileDropzone accept=".stl,model/stl,application/sla" title={tr("选择 STL 文件或拖到这里")} hint={tr("支持 ASCII / 二进制 STL，在浏览器本地处理")} fileName={file?.name} disabled={processing} onFiles={files => handleFile(files[0])} />
          {file && <p className="break-all text-xs text-slate-500">{file.name} · {formatBytes(file.size)}</p>}
          {sharedMesh && <div className="space-y-2 rounded-md border border-primary-100 bg-primary-50/30 p-3"><p className="text-xs leading-6 text-slate-600">{t('也可使用其他 CAD 工具已处理的共享模型。')}</p><Button variant="secondary" disabled={processing} onClick={() => importSharedMesh(sharedMesh)} className="w-full" icon={<Boxes className="h-4 w-4" />}>{t('导入共享网格')}<span className="max-w-36 truncate" title={sharedMesh.fileName}>{sharedMesh.fileName}</span></Button></div>}
          {error && <WorkflowNotice tone="error" onDismiss={() => setError('')}>{tr(error)}</WorkflowNotice>}
          <div><FieldLabel>{t('镂空风格预设')}</FieldLabel><Select aria-label={t('镂空风格预设')} value={selectedPreset} disabled={processing} onChange={event => { const preset = latticePresets.find(item => item.id === event.target.value); if (preset) setOptions({ ...preset.options }); }}>{latticePresets.map(preset => <option key={preset.id} value={preset.id}>{t(preset.label)}</option>)}<option value="custom" disabled>{t('自定义设置')}</option></Select></div>
          <details className="rounded-md border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-medium text-slate-600">{t('自定义孔数量与厚度')}</summary><div className="mt-3 space-y-4">
            <SegmentedControl label={tr("孔数量")} value={options.holeDensity} options={densityOptions} disabled={processing} onChange={value => updateOption('holeDensity', value)} />
            <SegmentedControl label={tr("厚度")} value={options.thickness} options={thicknessOptions} disabled={processing} onChange={value => updateOption('thickness', value)} />
          </div></details>
          {options.thickness === 'plane' && <WorkflowNotice>{t('平面厚度仅用于视觉实验，不能视为可打印的实体模型。')}</WorkflowNotice>}
          {staleOutput && <WorkflowNotice>{t('镂空参数已变化。当前预览是上次结果，请重新生成后导出。')}</WorkflowNotice>}
          <Button onClick={handleProcess} disabled={!canProcess} isLoading={processing} icon={<RefreshCw className="h-4 w-4" />} className="w-full">{staleOutput ? t('重新生成镂空') : tr('生成镂空')}</Button>
          <div role="status" className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs leading-6 text-slate-600">{processing && <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin" />}<span>{tr(statusText)}</span></div>
          <p className="text-xs leading-6 text-slate-500">{t('生成表面杆件效果，不执行实体布尔挖孔；打印前请用切片软件复检。')}</p>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader title={tr("镂空预览与报告")} description={tr("旋转比较原模与镂空结果；生成后检查报告并导出。")} actions={<Button variant="secondary" onClick={handleDownload} disabled={!stlBuffer || processing || staleOutput} icon={<Download className="h-4 w-4" />}>{tr("下载 STL")}</Button>} />
        <CardContent className="space-y-4">
          {report && <p className="flex min-w-0 items-center gap-2 break-all text-xs text-slate-500"><Eye className="h-4 w-4 shrink-0" />{report.fileName}</p>}
          {staleOutput && <WorkflowNotice>{t('此预览对应上次镂空参数，导出已暂停。')}</WorkflowNotice>}
          <SegmentedControl<PreviewMode> label={tr("预览")} value={viewMode} options={viewModeOptions} disabled={!original && !lattice} onChange={setViewMode} />
          <MeshPreview original={original} lattice={lattice} mode={viewMode} isProcessing={processing} />
          <ReportPanel report={report} outputSize={outputSize} />
        </CardContent>
      </Card>
    </div>
  );
};

export default VoronoiLatticeTool;
