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
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, UploadPanel } from '../../ui/ToolUi';
import { formatBytes } from '../shared/fileUtils';
import type {
  MeshBounds,
  MeshPreviewData,
  MeshStats,
  RepairOptions,
  RepairReport,
  RepairWorkerResponse,
} from './types';

const defaultOptions: RepairOptions = {
  targetFaces: 150000,
  weldTolerance: 0.0001,
  targetError: 0.01,
  decimate: true,
  keepLargest: true,
  fillHoles: true,
  holeEdgeLimit: 64,
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

const MeshPreview: React.FC<{ mesh: MeshPreviewData | null; isProcessing: boolean }> = ({ mesh, isProcessing }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<Mesh | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new Scene();
    scene.background = new Color(0xf8fafc);

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 420, false);
    container.appendChild(renderer.domElement);

    const camera = new PerspectiveCamera(45, 1, 0.01, 100000);
    camera.position.set(140, -180, 120);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const grid = new GridHelper(240, 24, 0x94a3b8, 0xe2e8f0);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    scene.add(new AmbientLight(0xffffff, 0.55));

    const keyLight = new DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(90, -120, 180);
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0x67e8f9, 0.55);
    fillLight.position.set(-120, 90, 100);
    scene.add(fillLight);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
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

    if (!mesh) return;

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    geometry.setIndex(new BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const material = new MeshStandardMaterial({
      color: 0xd8f3dc,
      roughness: 0.72,
      metalness: 0.05,
      flatShading: false,
    });
    const object = new Mesh(geometry, material);
    meshRef.current = object;
    scene.add(object);

    const bounds = new Box3().setFromObject(object);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const distance = maxDim * 2.2;
    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = distance * 20;
    camera.position.set(center.x + distance, center.y - distance * 1.25, center.z + distance * 0.8);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }, [mesh]);

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
              这是浏览器端轻量修复结果，适合快速清理和降面；复杂坏面模型仍建议进入专业修复软件复检。
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
          <div>降面执行：{report.simplified ? '是' : '否'}</div>
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
  const requestIdRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<RepairOptions>(defaultOptions);
  const [mesh, setMesh] = useState<MeshPreviewData | null>(null);
  const [report, setReport] = useState<RepairReport | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
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

  const handleFile = (nextFile?: File) => {
    if (!nextFile) return;
    setFile(nextFile);
    setMesh(null);
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

    worker.onmessage = (event: MessageEvent<RepairWorkerResponse>) => {
      if (event.data.id !== requestIdRef.current) return;

      setProcessing(false);
      if (event.data.type === 'error') {
        setError(event.data.error);
        return;
      }

      setMesh({
        positions: new Float32Array(event.data.mesh.positions),
        indices: new Uint32Array(event.data.mesh.indices),
      });
      setReport(event.data.report);
      setStlBuffer(event.data.stl);
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
    if (processing) return '正在清理网格、诊断拓扑并导出 STL';
    if (report) return report.final.watertight ? '处理完成，拓扑检测为水密' : '处理完成，仍建议复检';
    if (file) return '已选择文件，等待处理';
    return '选择 STL 文件开始';
  }, [file, processing, report]);

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
              {statusText}
            </div>
          </div>

          <div className="grid gap-3">
            <div>
              <FieldLabel hint={`${formatNumber(options.targetFaces)} 面`}>目标三角面上限</FieldLabel>
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
              <FieldLabel hint="顶点坐标容差">焊接容差</FieldLabel>
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
            <div>
              <FieldLabel hint={`${options.holeEdgeLimit} 条边以内`}>小孔补面上限</FieldLabel>
              <Input
                type="number"
                min={3}
                max={256}
                step={1}
                disabled={!options.fillHoles}
                value={options.holeEdgeLimit}
                onChange={event => updateOption('holeEdgeLimit', Math.max(3, Number(event.target.value) || 3))}
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
              hint="仅对简单边界环做三角扇补面，不承诺工业级修复。"
              onChange={checked => updateOption('fillHoles', checked)}
            />
            <CheckboxRow
              checked={options.addBase}
              label="添加圆形底座"
              hint="按 Python 脚本同款比例生成，直接合并到 STL。"
              onChange={checked => updateOption('addBase', checked)}
            />
          </div>

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
          <MeshPreview mesh={mesh} isProcessing={processing} />
          <ReportSummary report={report} outputSize={outputSize} />
        </CardContent>
      </Card>
    </div>
  );
};

export default StlRepairTool;
