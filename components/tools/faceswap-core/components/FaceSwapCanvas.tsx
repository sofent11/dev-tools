import React, { useRef, useEffect } from 'react';
import { ModelFacePack, SourceFacePack } from '../types';
import { createProgram, loadTexture } from '../utils/webglUtils';

interface FaceSwapCanvasProps {
  model: ModelFacePack;
  source: SourceFacePack;
  width?: number;
  height?: number;
  className?: string;
}

const VS_SOURCE = `#version 300 es
in vec2 a_position; 
in vec2 a_texCoord; 

uniform vec2 u_resolution;
uniform vec2 u_sourceResolution;

out vec2 v_texCoord;
out vec2 v_modelUV;

void main() {
  // Convert screen pixels to clip space (-1 to 1)
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = (zeroToOne * 2.0) - 1.0;
  
  // Flip Y for WebGL coords
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  
  v_texCoord = a_texCoord / u_sourceResolution;
  v_modelUV = zeroToOne;
}
`;

const FS_SOURCE = `#version 300 es
precision mediump float;

uniform sampler2D u_sourceTexture;
uniform sampler2D u_targetTexture; // We bind the original model image here
uniform sampler2D u_maskTexture;

uniform vec3 u_sourceMean;
uniform vec3 u_targetMean;

in vec2 v_texCoord;
in vec2 v_modelUV;

out vec4 outColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 sourceVal = texture(u_sourceTexture, v_texCoord);
  vec4 targetVal = texture(u_targetTexture, v_modelUV);
  float mask = texture(u_maskTexture, v_modelUV).r; 

  vec3 S = sourceVal.rgb;
  vec3 T = targetVal.rgb;

  // --- STEP 1: RGB STATISTICAL MATCHING ---
  // Shift source color histogram to match target mean.
  // We offset each channel: Source + (TargetMean - SourceMean)
  vec3 diff = u_targetMean - u_sourceMean;
  vec3 colorCorrected = S + diff;
  
  // Clamp to avoid artifacts
  colorCorrected = clamp(colorCorrected, 0.0, 1.0);

  // --- STEP 2: LUMINANCE ANCHORING ---
  // The structure and lighting come from the target.
  // We want the Source's details but the Target's lighting.
  
  float lumaS = getLuma(colorCorrected);
  float lumaT = getLuma(T);
  
  // Simply multiplying by the ratio effectively "relights" the face.
  // Add epsilon to avoid divide by zero.
  vec3 relit = colorCorrected * (lumaT / (lumaS + 0.01));
  
  // Mix in a bit of the original target color to help blending if the ratio is extreme
  relit = mix(relit, T, 0.15);

  // --- STEP 3: FINAL BLEND ---
  // Soft edges using the gradient mask
  float edgeSoftness = smoothstep(0.0, 1.0, mask);
  
  outColor = vec4(relit, edgeSoftness); 
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Alpha enabled for transparency so we can composite over the <img> tag
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const program = createProgram(gl, VS_SOURCE, FS_SOURCE);
    if (!program) return;

    glRef.current = gl;
    programRef.current = program;
  }, []);

  useEffect(() => {
    const render = async () => {
      const gl = glRef.current;
      const program = programRef.current;
      if (!gl || !program) return;

      try {
        const [sourceTex, targetTex, maskTex] = await Promise.all([
          loadTexture(gl, source.textureUrl),
          loadTexture(gl, model.imageUrl), // Bind the model image as a texture for sampling
          loadTexture(gl, model.maskUrl)
        ]);
        
        gl.viewport(0, 0, model.width, model.height);
        gl.clearColor(0, 0, 0, 0); // Transparent clear
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        const loc = (name: string) => gl.getUniformLocation(program, name);
        
        gl.uniform2f(loc("u_resolution"), model.width, model.height);
        gl.uniform2f(loc("u_sourceResolution"), 512, 512);

        // Pass RGB Stats
        gl.uniform3fv(loc("u_sourceMean"), source.skinStats.mean);
        gl.uniform3fv(loc("u_targetMean"), model.skinStats.mean);

        // TEXTURE 0: Source Face
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);
        gl.uniform1i(loc("u_sourceTexture"), 0);

        // TEXTURE 1: Target Face (for lighting reference)
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, targetTex);
        gl.uniform1i(loc("u_targetTexture"), 1);

        // TEXTURE 2: Mask
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.uniform1i(loc("u_maskTexture"), 2);

        // MESH SETUP
        const posBuff = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuff);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.landmarks.flatMap(p => [p.x, p.y])), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const texBuff = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(source.landmarks.flatMap(p => [p.x, p.y])), gl.STATIC_DRAW);
        const aTex = gl.getAttribLocation(program, "a_texCoord");
        gl.enableVertexAttribArray(aTex);
        gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

        const idxBuff = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuff);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(model.triangles), gl.STATIC_DRAW);

        gl.drawElements(gl.TRIANGLES, model.triangles.length, gl.UNSIGNED_SHORT, 0);

      } catch (e) {
        console.error("Render error:", e);
      }
    };
    
    render();
  }, [model, source]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background: Original Image */}
      <img 
        src={model.imageUrl} 
        alt="base"
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
      />
      {/* Foreground: WebGL Swap */}
      <canvas
        ref={canvasRef}
        width={model.width}
        height={model.height}
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
      />
    </div>
  );
};

export default FaceSwapCanvas;