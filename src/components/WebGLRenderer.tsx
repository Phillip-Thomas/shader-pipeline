import { useCallback, useRef } from 'react';
import { vertexShaderSource } from '../shaders/defaultShaders';
import { CanvasObject, Shader } from '../types';

interface WebGLRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  shaders: Shader[];
  objects: CanvasObject[];
  isPlaying: boolean;
  isVideoLoaded: boolean;
  animationFrameRef: React.MutableRefObject<number | undefined>;
}

export function useWebGLRenderer({
  canvasRef,
  videoRef,
  shaders,
  objects,
  isPlaying,
  isVideoLoaded,
  animationFrameRef,
}: WebGLRendererProps) {
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programsRef = useRef<WebGLProgram[]>([]);
  const texturesRef = useRef<WebGLTexture[]>([]);
  const framebuffersRef = useRef<WebGLFramebuffer[]>([]);

  const createShader = useCallback((gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }, []);

  const createProgram = useCallback((gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
    const program = gl.createProgram();
    if (!program) return null;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    
    return program;
  }, []);

  const setupWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glRef.current = gl;
    
    // Clean up previous programs
    programsRef.current.forEach(program => {
      if (program) gl.deleteProgram(program);
    });
    
    // Create vertex shader
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    if (!vertexShader) return;

    // Setup geometry
    const positions = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Create programs for each shader
    programsRef.current = [];
    shaders.forEach(shader => {
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, shader.fragmentShader);
      if (!fragmentShader) return;
      
      const program = createProgram(gl, vertexShader, fragmentShader);
      if (program) {
        programsRef.current.push(program);
      }
    });

    // Create textures and framebuffers for multi-pass rendering
    const canvas_width = canvas.width;
    const canvas_height = canvas.height;

    // Clean up previous textures and framebuffers
    texturesRef.current.forEach(texture => {
      if (texture) gl.deleteTexture(texture);
    });
    framebuffersRef.current.forEach(framebuffer => {
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
    });

    texturesRef.current = [];
    framebuffersRef.current = [];

    for (let i = 0; i < 3; i++) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas_width, canvas_height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      texturesRef.current.push(texture!);

      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      framebuffersRef.current.push(framebuffer!);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }, [shaders, createShader, createProgram]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!gl || !canvas || !video) {
      // Keep trying to render even if video isn't loaded yet
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
      return;
    }
    
    // Continue with render even if video isn't fully loaded - VideoManager handles fallback content

    // Create video texture
    const videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    
    // Flip the video texture to correct orientation
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch (e) {
      console.error('Error updating video texture:', e);
      // Continue animation loop even if texture update fails
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
      return;
    }
    
    // Reset the flip setting for other textures
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.viewport(0, 0, canvas.width, canvas.height);

    let currentTexture = videoTexture;
    let textureIndex = 0;

    // Apply enabled shaders in sequence
    const enabledShaders = shaders.filter(shader => shader.enabled);
    
    // If no shaders are enabled, just render the video directly
    if (enabledShaders.length === 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      // Create a simple pass-through shader if needed
      const simpleFragmentShader = `
        precision mediump float;
        uniform sampler2D u_texture;
        varying vec2 v_texCoord;
        void main() {
          gl_FragColor = texture2D(u_texture, v_texCoord);
        }
      `;
      
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, simpleFragmentShader);
      
      if (vertexShader && fragmentShader) {
        const program = createProgram(gl, vertexShader, fragmentShader);
        if (program) {
          gl.useProgram(program);
          
          const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
          const texCoordAttributeLocation = gl.getAttribLocation(program, 'a_texCoord');

          gl.enableVertexAttribArray(positionAttributeLocation);
          gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 16, 0);

          gl.enableVertexAttribArray(texCoordAttributeLocation);
          gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 16, 8);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, currentTexture);
          gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          
          gl.deleteProgram(program);
        }
        
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
      }
    } else {
      enabledShaders.forEach((shader, index) => {
        const programIndex = shaders.findIndex(s => s.id === shader.id);
        const program = programsRef.current[programIndex];
        if (!program) {
          console.warn(`Program not found for shader: ${shader.name}`);
          return;
        }
        
        // Validate program
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error(`Invalid program for shader: ${shader.name}`);
          return;
        }

        // Render to framebuffer (except for last pass)
        if (index < enabledShaders.length - 1) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffersRef.current[textureIndex % 2]);
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        gl.useProgram(program);

        // Set up attributes
        const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
        const texCoordAttributeLocation = gl.getAttribLocation(program, 'a_texCoord');

        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 16, 0);

        gl.enableVertexAttribArray(texCoordAttributeLocation);
        gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 16, 8);

        // Set uniforms
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform1f(gl.getUniformLocation(program, 'u_time'), Date.now() / 1000);

        // Set shader-specific uniforms
        Object.entries(shader.uniforms).forEach(([name, value]) => {
          const location = gl.getUniformLocation(program, name);
          if (location !== null) {
            gl.uniform1f(location, value);
          }
        });

        // Set object-based uniforms
        objects.forEach((obj, objIndex) => {
          const posLocation = gl.getUniformLocation(program, `u_object${objIndex}_pos`);
          const sizeLocation = gl.getUniformLocation(program, `u_object${objIndex}_size`);
          const rotationLocation = gl.getUniformLocation(program, `u_object${objIndex}_rotation`);
          const colorLocation = gl.getUniformLocation(program, `u_object${objIndex}_color`);
          
          if (posLocation !== null) {
            // Calculate center position of the object's bounding box
            const centerX = obj.x + obj.width / 2;
            const centerY = obj.y + obj.height / 2;
            
            // Fix coordinate system: Canvas uses top-left origin, WebGL uses bottom-left
            // So we need to flip the Y coordinate
            gl.uniform2f(posLocation, centerX / canvas.width, 1.0 - (centerY / canvas.height));
          }
          if (sizeLocation !== null) {
            gl.uniform2f(sizeLocation, obj.width / canvas.width, obj.height / canvas.height);
          }
          if (rotationLocation !== null) {
            gl.uniform1f(rotationLocation, obj.rotation);
          }
          if (colorLocation !== null) {
            // Parse color
            const color = obj.color.replace('#', '');
            const r = parseInt(color.substr(0, 2), 16) / 255;
            const g = parseInt(color.substr(2, 2), 16) / 255;
            const b = parseInt(color.substr(4, 2), 16) / 255;
            gl.uniform3f(colorLocation, r, g, b);
          }
        });

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Update texture for next pass
        if (index < enabledShaders.length - 1) {
          currentTexture = texturesRef.current[textureIndex % 2];
          textureIndex++;
        }
      });
    }

    // Clean up video texture
    gl.deleteTexture(videoTexture);

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(render);
    }
  }, [shaders, objects, isPlaying, isVideoLoaded, createShader, createProgram]);

  return {
    setupWebGL,
    render,
  };
} 