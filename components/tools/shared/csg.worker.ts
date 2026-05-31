/// <reference lib="webworker" />

import * as THREE from 'three';
import { CSGExporter } from './csg';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

interface CsgWorkerRequest {
  id: number;
  opType: 'union' | 'subtract' | 'intersect';
  base: {
    positions: Float32Array;
  };
  tools: Array<{
    positions: Float32Array;
    posX: number;
    posY: number;
    posZ: number;
  }>;
}

interface CsgWorkerResponse {
  id: number;
  type: 'success' | 'error' | 'progress';
  progress?: number;
  status?: string;
  mesh?: {
    positions: ArrayBuffer;
    normals: ArrayBuffer;
    uvs: ArrayBuffer;
  };
  stats?: {
    vertices: number;
    triangles: number;
  };
  error?: string;
}

const reportProgress = (id: number, status: string, progress: number) => {
  ctx.postMessage({ id, type: 'progress', status, progress } as CsgWorkerResponse);
};

const runCsgCalculation = async (request: CsgWorkerRequest): Promise<CsgWorkerResponse> => {
  reportProgress(request.id, '初始化 Web Worker 3D 引擎...', 15);

  const baseGeo = new THREE.BufferGeometry();
  baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(request.base.positions, 3));

  let finalGeo = baseGeo;

  for (let i = 0; i < request.tools.length; i++) {
    const tool = request.tools[i];
    const percentage = Math.round(15 + (i / request.tools.length) * 70);
    reportProgress(request.id, `正在合并工具实体 ${i + 1}/${request.tools.length}...`, percentage);

    const toolGeo = new THREE.BufferGeometry();
    toolGeo.setAttribute('position', new THREE.Float32BufferAttribute(tool.positions, 3));
    toolGeo.translate(tool.posX, tool.posY, tool.posZ);

    let resultGeo: THREE.BufferGeometry;
    if (request.opType === 'union') {
      resultGeo = CSGExporter.union(finalGeo, toolGeo);
    } else if (request.opType === 'subtract') {
      resultGeo = CSGExporter.subtract(finalGeo, toolGeo);
    } else {
      resultGeo = CSGExporter.intersect(finalGeo, toolGeo);
    }

    // Dispose old temporary geometries to prevent memory leaks in worker thread
    if (finalGeo !== baseGeo) finalGeo.dispose();
    toolGeo.dispose();

    finalGeo = resultGeo;
  }

  reportProgress(request.id, '正在优化 3D 网格表面并打包数据...', 90);
  finalGeo.computeVertexNormals();

  const finalPosAttr = finalGeo.getAttribute('position') as THREE.BufferAttribute;
  const finalNormAttr = finalGeo.getAttribute('normal') as THREE.BufferAttribute;
  const finalUvAttr = finalGeo.getAttribute('uv') as THREE.BufferAttribute;

  const finalPos = finalPosAttr ? (finalPosAttr.array as Float32Array) : new Float32Array(0);
  const finalNorm = finalNormAttr ? (finalNormAttr.array as Float32Array) : new Float32Array(finalPos.length);
  const finalUv = finalUvAttr ? (finalUvAttr.array as Float32Array) : new Float32Array((finalPos.length / 3) * 2);

  // Buffer clones for zero-copy transferable memory transfer
  const positions = finalPos.slice().buffer;
  const normals = finalNorm.slice().buffer;
  const uvs = finalUv.slice().buffer;

  const vCount = finalPos.length / 3;

  // Free memory
  if (finalGeo !== baseGeo) finalGeo.dispose();
  baseGeo.dispose();

  return {
    id: request.id,
    type: 'success',
    mesh: { positions, normals, uvs },
    stats: {
      vertices: vCount,
      triangles: Math.floor(vCount / 3)
    }
  };
};

ctx.onmessage = async (event: MessageEvent<CsgWorkerRequest>) => {
  try {
    const response = await runCsgCalculation(event.data);
    ctx.postMessage(response, [response.mesh!.positions, response.mesh!.normals, response.mesh!.uvs]);
  } catch (err) {
    ctx.postMessage({
      id: event.data.id,
      type: 'error',
      error: err instanceof Error ? err.message : '空间布尔运算失败'
    } as CsgWorkerResponse);
  }
};
