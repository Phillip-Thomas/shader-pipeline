import React, { useRef, useEffect, useState, useCallback } from 'react';
import { defaultShaders as importedDefaultShaders, vertexShaderSource } from '../shaders/defaultShaders';
import Sidebar from './Sidebar';
import CanvasArea from './CanvasArea';
import { CanvasObject, Shader } from '../types';



export default function ShaderStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programsRef = useRef<WebGLProgram[]>([]);
  const texturesRef = useRef<WebGLTexture[]>([]);
  const framebuffersRef = useRef<WebGLFramebuffer[]>([]);
  const animationFrameRef = useRef<number>();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [shaders, setShaders] = useState<Shader[]>(importedDefaultShaders);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'text' | 'rect' | 'circle'>('select');
  const [customShader, setCustomShader] = useState('');
  const [customShaderName, setCustomShaderName] = useState('');
  const [showShaderEditor, setShowShaderEditor] = useState(false);
  const [editingShader, setEditingShader] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [objectsVisible, setObjectsVisible] = useState(true);

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
    
    if (!gl || !canvas || !video || !isVideoLoaded) return;

    // Create video texture
    const videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    
    // Flip the video texture to correct orientation
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch (e) {
      console.error('Error updating video texture:', e);
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
  }, [shaders, objects, isPlaying, isVideoLoaded]);

  useEffect(() => {
    setupWebGL();
  }, [setupWebGL]);

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (isPlaying && isVideoLoaded) {
      const startRender = () => {
        animationFrameRef.current = requestAnimationFrame(render);
      };
      // Small delay to ensure WebGL setup is complete
      setTimeout(startRender, 16);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, render, isVideoLoaded]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const addObject = (e: React.MouseEvent) => {
    if (tool === 'select') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newObject: CanvasObject = {
      id: Date.now().toString(),
      type: tool as 'text' | 'rect' | 'circle',
      x,
      y,
      width: 100,
      height: 50,
      text: tool === 'text' ? 'Sample Text' : undefined,
      color: '#ff6b6b',
      rotation: 0,
      visible: true
    };

    setObjects(prev => [...prev, newObject]);
    setSelectedObject(newObject.id);
  };

  const addCustomShader = () => {
    if (!customShader.trim() || !customShaderName.trim()) return;

    if (editingShader) {
      // Update existing shader
      setShaders(prev => prev.map(shader => 
        shader.id === editingShader 
          ? { ...shader, name: customShaderName, fragmentShader: customShader }
          : shader
      ));
    } else {
      // Add new shader
      const newShader: Shader = {
        id: Date.now().toString(),
        name: customShaderName,
        fragmentShader: customShader,
        enabled: true,
        uniforms: {}
      };
      setShaders(prev => [...prev, newShader]);
    }

    setCustomShader('');
    setCustomShaderName('');
    setShowShaderEditor(false);
    setEditingShader(null);
  };

  const startEditingShader = (shader: Shader) => {
    setCustomShader(shader.fragmentShader);
    setCustomShaderName(shader.name);
    setEditingShader(shader.id);
    setShowShaderEditor(true);
  };

  const cancelShaderEditor = () => {
    setCustomShader('');
    setCustomShaderName('');
    setShowShaderEditor(false);
    setEditingShader(null);
  };

  const drawObjects = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    // Clear the overlay
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Only draw objects if globally visible
    if (!objectsVisible) return;

    // Draw each object (check individual visibility)
    objects.forEach(obj => {
      // Skip if this individual object is hidden
      if (!obj.visible) return;
      ctx.save();
      
      // Apply rotation if any
      if (obj.rotation !== 0) {
        ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.translate(-obj.width / 2, -obj.height / 2);
      } else {
        ctx.translate(obj.x, obj.y);
      }

      // Set color and style
      ctx.fillStyle = obj.color;
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = 2;

      // Add selection highlight
      if (selectedObject === obj.id) {
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
      }

      switch (obj.type) {
        case 'text':
          ctx.font = `${Math.max(16, obj.height / 2)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (selectedObject === obj.id) {
            ctx.strokeText(obj.text || 'Text', obj.width / 2, obj.height / 2);
          }
          ctx.fillText(obj.text || 'Text', obj.width / 2, obj.height / 2);
          break;
        
        case 'rect':
          if (selectedObject === obj.id) {
            ctx.strokeRect(0, 0, obj.width, obj.height);
          }
          ctx.globalAlpha = 0.7;
          ctx.fillRect(0, 0, obj.width, obj.height);
          break;
        
        case 'circle':
          const radius = Math.min(obj.width, obj.height) / 2;
          const centerX = obj.width / 2;
          const centerY = obj.height / 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          if (selectedObject === obj.id) {
            ctx.stroke();
          }
          ctx.globalAlpha = 0.7;
          ctx.fill();
          break;
      }
      
      ctx.restore();
    });
  }, [objects, selectedObject, objectsVisible]);

  // Draw objects when they change
  useEffect(() => {
    drawObjects();
  }, [drawObjects]);

  // Initialize fallback video content
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      console.log('Video loaded successfully');
      setIsVideoLoaded(true);
    };

    const handleError = () => {
      console.log('Video failed to load, creating fallback content');
      // Create fallback animated content
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      const ctx = canvas.getContext('2d')!;
      
      let animationId: number;
      const animate = () => {
        const time = Date.now() / 1000;
        const gradient = ctx.createLinearGradient(
          Math.sin(time) * 400 + 400, 
          Math.cos(time * 0.7) * 225 + 225, 
          Math.cos(time) * 400 + 400, 
          Math.sin(time * 0.7) * 225 + 225
        );
        gradient.addColorStop(0, `hsl(${(time * 50) % 360}, 70%, 60%)`);
        gradient.addColorStop(0.5, `hsl(${(time * 30 + 120) % 360}, 70%, 60%)`);
        gradient.addColorStop(1, `hsl(${(time * 40 + 240) % 360}, 70%, 60%)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 450);
        
        // Add some moving shapes
        for (let i = 0; i < 5; i++) {
          const x = Math.sin(time + i) * 200 + 400;
          const y = Math.cos(time * 0.8 + i) * 150 + 225;
          const radius = Math.sin(time * 2 + i) * 20 + 40;
          
          ctx.fillStyle = `hsla(${(time * 100 + i * 72) % 360}, 80%, 70%, 0.3)`;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        animationId = requestAnimationFrame(animate);
      };
      animate();
      
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      setIsVideoLoaded(true);
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, []);

    return (
    <div className="h-screen bg-gray-900 text-white flex">
      <Sidebar
        tool={tool}
        setTool={setTool}
        objects={objects}
        setObjects={setObjects}
        selectedObject={selectedObject}
        setSelectedObject={setSelectedObject}
        objectsVisible={objectsVisible}
        setObjectsVisible={setObjectsVisible}
        shaders={shaders}
        setShaders={setShaders}
        customShader={customShader}
        setCustomShader={setCustomShader}
        customShaderName={customShaderName}
        setCustomShaderName={setCustomShaderName}
        showShaderEditor={showShaderEditor}
        setShowShaderEditor={setShowShaderEditor}
        editingShader={editingShader}
        addCustomShader={addCustomShader}
        startEditingShader={startEditingShader}
        cancelShaderEditor={cancelShaderEditor}
      />
      <CanvasArea
        canvasRef={canvasRef}
        overlayCanvasRef={overlayCanvasRef}
        videoRef={videoRef}
        isPlaying={isPlaying}
        isVideoLoaded={isVideoLoaded}
        togglePlay={togglePlay}
        addObject={addObject}
      />
    </div>
  );
} 