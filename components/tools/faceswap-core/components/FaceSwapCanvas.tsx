import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ModelFacePack, SourceFacePack } from '../types';
import { createProgram, loadTexture } from '../utils/webglUtils';

interface FaceSwapCanvasProps {
  model: ModelFacePack;
  source: SourceFacePack;
  width?: number;
  height?: number;
  className?: string;
}

// Vertex shader: Transforms model landmarks to screen coordinates,
// and passes through the source texture coordinates
const VS_SOURCE = `#version 300 es
in vec2 a_modelPosition;   // Position in model image (pixels)
in vec2 a_sourceTexCoord;  // Position in source texture (pixels, 0-512)

uniform vec2 u_modelResolution;     // Model image size
uniform vec2 u_sourceResolution;    // Source texture size (512x512)

out vec2 v_sourceUV;   // UV for source face texture
out vec2 v_modelUV;    // UV for target/mask sampling

void main() {
  // Convert model pixel coords to clip space
  vec2 normalizedPos = a_modelPosition / u_modelResolution;
  vec2 clipSpace = (normalizedPos * 2.0) - 1.0;
  
  // Flip Y for WebGL (origin at bottom-left)
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  
  // Source texture UV (0-1 range)
  v_sourceUV = a_sourceTexCoord / u_sourceResolution;
  
  // Model UV for target/mask sampling
  v_modelUV = normalizedPos;
}
`;

// Fragment shader: Samples source face, applies color correction, blends with mask
const FS_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D u_sourceTexture;  // The new face to paste
uniform sampler2D u_targetTexture;  // Original model image (for lighting reference)
uniform sampler2D u_maskTexture;    // Alpha mask for blending

uniform vec3 u_sourceMean;  // Source face color stats
uniform vec3 u_targetMean;  // Target face color stats

in vec2 v_sourceUV;
in vec2 v_modelUV;

out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  // Sample the source face texture
  vec4 srcColor = texture(u_sourceTexture, v_sourceUV);
  
  // Sample the target for lighting reference
  vec4 tgtColor = texture(u_targetTexture, v_modelUV);
  
  // Get mask alpha
  float maskAlpha = texture(u_maskTexture, v_modelUV).r;
  
  // --- Color correction: shift source colors to match target ---
  vec3 colorDiff = u_targetMean - u_sourceMean;
  vec3 corrected = srcColor.rgb + colorDiff;
  corrected = clamp(corrected, 0.0, 1.0);
  
  // --- Luminance matching: apply target lighting ---
  float srcLuma = getLuma(corrected);
  float tgtLuma = getLuma(tgtColor.rgb);
  
  // Relight the source using target's luminance
  vec3 relit = corrected * (tgtLuma / max(srcLuma, 0.01));
  
  // Blend a bit of target to smooth extreme cases
  relit = mix(relit, tgtColor.rgb, 0.1);
  relit = clamp(relit, 0.0, 1.0);
  
  // Apply soft edge falloff
  float alpha = smoothstep(0.0, 0.5, maskAlpha);
  
  fragColor = vec4(relit, alpha);
}
`;

const FaceSwapCanvas: React.FC<FaceSwapCanvasProps> = ({
  model,
  source,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const initializeCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (!canvas) {
      glRef.current = null;
      programRef.current = null;
      return;
    }

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true
    });

    if (!gl) {
      setRenderError('WebGL2 not supported');
      return;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const program = createProgram(gl, VS_SOURCE, FS_SOURCE);
    if (!program) {
      setRenderError('Failed to compile shaders');
      return;
    }

    glRef.current = gl;
    programRef.current = program;
    setRenderError(null);
  }, []);

  // Render when model or source changes
  useEffect(() => {
    const render = async () => {
      const gl = glRef.current;
      const program = programRef.current;
      if (!gl || !program) return;

      // Validate data
      if (model.landmarks.length === 0 || source.landmarks.length === 0) {
        console.error('No landmarks detected');
        setRenderError('No face landmarks detected');
        return;
      }

      if (model.landmarks.length !== source.landmarks.length) {
        console.error(`Landmark count mismatch: model=${model.landmarks.length}, source=${source.landmarks.length}`);
        setRenderError('Face landmark count mismatch');
        return;
      }

      if (model.triangles.length === 0) {
        console.error('No triangles for mesh');
        setRenderError('No triangulation data');
        return;
      }

      try {
        // Load all textures
        const [sourceTex, targetTex, maskTex] = await Promise.all([
          loadTexture(gl, source.textureUrl),
          loadTexture(gl, model.imageUrl),
          loadTexture(gl, model.maskUrl)
        ]);

        // Set canvas size to match model
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = model.width;
          canvas.height = model.height;
        }

        gl.viewport(0, 0, model.width, model.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        // Create and bind VAO
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        // --- Setup vertex positions (model landmarks) ---
        const modelPositions = new Float32Array(
          model.landmarks.flatMap(p => [p.x, p.y])
        );
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, modelPositions, gl.STATIC_DRAW);

        const aModelPos = gl.getAttribLocation(program, 'a_modelPosition');
        gl.enableVertexAttribArray(aModelPos);
        gl.vertexAttribPointer(aModelPos, 2, gl.FLOAT, false, 0, 0);

        // --- Setup texture coordinates (source landmarks) ---
        const sourceTexCoords = new Float32Array(
          source.landmarks.flatMap(p => [p.x, p.y])
        );
        const texBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sourceTexCoords, gl.STATIC_DRAW);

        const aSourceTex = gl.getAttribLocation(program, 'a_sourceTexCoord');
        gl.enableVertexAttribArray(aSourceTex);
        gl.vertexAttribPointer(aSourceTex, 2, gl.FLOAT, false, 0, 0);

        // --- Setup index buffer (triangulation) ---
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(model.triangles), gl.STATIC_DRAW);

        // --- Set uniforms ---
        const getLoc = (name: string) => gl.getUniformLocation(program, name);

        gl.uniform2f(getLoc('u_modelResolution'), model.width, model.height);
        gl.uniform2f(getLoc('u_sourceResolution'), 512, 512);
        gl.uniform3fv(getLoc('u_sourceMean'), new Float32Array(source.skinStats.mean));
        gl.uniform3fv(getLoc('u_targetMean'), new Float32Array(model.skinStats.mean));

        // Bind textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);
        gl.uniform1i(getLoc('u_sourceTexture'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, targetTex);
        gl.uniform1i(getLoc('u_targetTexture'), 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.uniform1i(getLoc('u_maskTexture'), 2);

        // Draw the face mesh
        gl.drawElements(gl.TRIANGLES, model.triangles.length, gl.UNSIGNED_SHORT, 0);

        // Cleanup
        gl.bindVertexArray(null);
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(posBuffer);
        gl.deleteBuffer(texBuffer);
        gl.deleteBuffer(indexBuffer);

        setRenderError(null);
        console.log(`Rendered face swap: ${model.triangles.length / 3} triangles, ${model.landmarks.length} landmarks`);

      } catch (e: any) {
        console.error('Render error:', e);
        setRenderError(e.message || 'Render failed');
      }
    };

    render();
  }, [model, source]);

  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      {/* Background: Original Image */}
      <img
        src={model.imageUrl}
        alt="base"
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
      />
      {/* Foreground: WebGL Face Swap */}
      <canvas
        ref={initializeCanvas}
        width={model.width}
        height={model.height}
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
      />
      {/* Error overlay */}
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-red-900/80 text-red-100 px-4 py-2 rounded text-sm">
            {renderError}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceSwapCanvas;
