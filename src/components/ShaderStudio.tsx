import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Plus, Trash2, Move, Type, Square, Circle, Eye, EyeOff } from 'lucide-react';
import { defaultShaders as importedDefaultShaders, vertexShaderSource } from '../shaders/defaultShaders';

interface CanvasObject {
  id: string;
  type: 'text' | 'rect' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color: string;
  rotation: number;
  visible: boolean;
}

interface Shader {
  id: string;
  name: string;
  fragmentShader: string;
  enabled: boolean;
  uniforms: Record<string, number>;
}



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
    if (!customShader.trim()) return;

    if (editingShader) {
      // Update existing shader
      setShaders(prev => prev.map(shader => 
        shader.id === editingShader 
          ? { ...shader, fragmentShader: customShader }
          : shader
      ));
    } else {
      // Add new shader
      const newShader: Shader = {
        id: Date.now().toString(),
        name: 'Custom Shader',
        fragmentShader: customShader,
        enabled: true,
        uniforms: {}
      };
      setShaders(prev => [...prev, newShader]);
    }

    setCustomShader('');
    setShowShaderEditor(false);
    setEditingShader(null);
  };

  const startEditingShader = (shader: Shader) => {
    setCustomShader(shader.fragmentShader);
    setEditingShader(shader.id);
    setShowShaderEditor(true);
  };

  const cancelShaderEditor = () => {
    setCustomShader('');
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

  const selectedObj = objects.find(obj => obj.id === selectedObject);

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
      {/* Left Panel - Objects & Shaders */}
      <div className="w-96 bg-gray-800 p-6 overflow-y-auto">
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Tools</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'select', icon: Move, label: 'Select' },
              { id: 'text', icon: Type, label: 'Text' },
              { id: 'rect', icon: Square, label: 'Rectangle' },
              { id: 'circle', icon: Circle, label: 'Circle' }
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTool(id as any)}
                className={`p-3 rounded-lg flex items-center gap-2 ${
                  tool === id ? 'bg-blue-600' : 'bg-gray-700'
                } hover:bg-blue-500 transition-colors`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Objects</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setObjectsVisible(!objectsVisible)}
                className={`p-2 rounded-lg transition-colors ${
                  objectsVisible 
                    ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                }`}
                title={objectsVisible ? "Hide all objects" : "Show all objects"}
              >
                {objectsVisible ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button
                onClick={() => {
                  setObjects([]);
                  setSelectedObject(null);
                }}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete all objects"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {objects.map(obj => (
              <div
                key={obj.id}
                className={`p-3 rounded-lg transition-colors ${
                  selectedObject === obj.id ? 'bg-blue-600' : 'bg-gray-700'
                } ${!obj.visible ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => setSelectedObject(obj.id)}
                  >
                    <div className="font-medium capitalize flex items-center gap-2">
                      {obj.type === 'text' && <Type size={16} />}
                      {obj.type === 'rect' && <Square size={16} />}
                      {obj.type === 'circle' && <Circle size={16} />}
                      {obj.type}
                      {!obj.visible && <span className="text-xs text-gray-400">(hidden)</span>}
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      {obj.type === 'text' ? obj.text : `${Math.round(obj.x)}, ${Math.round(obj.y)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setObjects(prev => prev.map(o => 
                          o.id === obj.id ? { ...o, visible: !o.visible } : o
                        ));
                      }}
                      className={`p-1 rounded transition-colors ${
                        obj.visible 
                          ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                      }`}
                      title={obj.visible ? "Hide object" : "Show object"}
                    >
                      {obj.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setObjects(prev => prev.filter(o => o.id !== obj.id));
                        if (selectedObject === obj.id) {
                          setSelectedObject(null);
                        }
                      }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      title="Delete object"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {objects.length === 0 && (
              <div className="text-gray-400 text-sm italic p-3 text-center">
                No objects added yet
              </div>
            )}
          </div>

          {selectedObj && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg">
              <h4 className="text-lg font-semibold mb-3 text-blue-300">Object Properties</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">X Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedObj.x)}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, x: parseInt(e.target.value) || 0 } : obj
                      ));
                    }}
                    className="w-full p-2 bg-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Y Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedObj.y)}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, y: parseInt(e.target.value) || 0 } : obj
                      ));
                    }}
                    className="w-full p-2 bg-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Width</label>
                  <input
                    type="number"
                    value={Math.round(selectedObj.width)}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, width: parseInt(e.target.value) || 1 } : obj
                      ));
                    }}
                    className="w-full p-2 bg-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Height</label>
                  <input
                    type="number"
                    value={Math.round(selectedObj.height)}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, height: parseInt(e.target.value) || 1 } : obj
                      ));
                    }}
                    className="w-full p-2 bg-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Rotation (degrees)</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={selectedObj.rotation}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, rotation: parseInt(e.target.value) } : obj
                      ));
                    }}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-400 mt-1 text-center">
                    {selectedObj.rotation}°
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Color</label>
                  <input
                    type="color"
                    value={selectedObj.color}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, color: e.target.value } : obj
                      ));
                    }}
                    className="w-full p-2 bg-gray-600 rounded"
                  />
                </div>
                {selectedObj.type === 'text' && (
                  <div>
                    <label className="block text-sm mb-1">Text</label>
                    <input
                      type="text"
                      value={selectedObj.text || ''}
                      onChange={(e) => {
                        setObjects(prev => prev.map(obj => 
                          obj.id === selectedObject ? { ...obj, text: e.target.value } : obj
                        ));
                      }}
                      className="w-full p-2 bg-gray-600 rounded text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Shaders</h3>
            <button
              onClick={() => setShowShaderEditor(!showShaderEditor)}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
              title="Add custom shader"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-4">
            {shaders.map(shader => (
              <div key={shader.id} className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-lg">{shader.name}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shader.enabled}
                      onChange={(e) => {
                        setShaders(prev => prev.map(s => 
                          s.id === shader.id ? { ...s, enabled: e.target.checked } : s
                        ));
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">Enabled</span>
                  </label>
                </div>
                {Object.entries(shader.uniforms).map(([name, value]) => {
                  // Define different ranges for different uniform types
                  let min = 0, max = 2, step = 0.01;
                  
                  if (name === 'u_brightness') {
                    min = -0.5;
                    max = 0.5;
                    step = 0.01;
                  } else if (name === 'u_contrast') {
                    min = 0.5;
                    max = 3.0;
                    step = 0.01;
                  } else if (name === 'u_strength') {
                    min = 0;
                    max = shader.id === 'blur' ? 5.0 : 0.1;
                    step = shader.id === 'blur' ? 0.1 : 0.001;
                  }
                  
                  return (
                    <div key={name} className="mb-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {name.replace('u_', '').replace('_', ' ').toUpperCase()}
                      </label>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => {
                          setShaders(prev => prev.map(s => 
                            s.id === shader.id 
                              ? { ...s, uniforms: { ...s.uniforms, [name]: parseFloat(e.target.value) }}
                              : s
                          ));
                        }}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{min.toFixed(step < 0.01 ? 3 : 2)}</span>
                        <span className="font-medium">{value.toFixed(step < 0.01 ? 3 : 2)}</span>
                        <span>{max.toFixed(step < 0.01 ? 3 : 2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {showShaderEditor && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Custom Shader</h3>
            <textarea
              value={customShader}
              onChange={(e) => setCustomShader(e.target.value)}
              placeholder="Enter fragment shader code...&#10;&#10;Example:&#10;precision mediump float;&#10;uniform sampler2D u_texture;&#10;uniform float u_time;&#10;varying vec2 v_texCoord;&#10;&#10;void main() {&#10;  vec4 color = texture2D(u_texture, v_texCoord);&#10;  color.rgb *= sin(u_time) * 0.5 + 0.5;&#10;  gl_FragColor = color;&#10;}"
              className="w-full h-48 p-4 bg-gray-700 rounded-lg font-mono text-sm resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={addCustomShader}
                className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-500 font-medium transition-colors"
              >
                Add Shader
              </button>
              <button
                onClick={() => setShowShaderEditor(false)}
                className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-800 p-4 flex items-center gap-4">
          <button
            onClick={togglePlay}
            disabled={!isVideoLoaded}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              isVideoLoaded 
                ? 'bg-blue-600 hover:bg-blue-500' 
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <span className="text-sm text-gray-300">
            {isVideoLoaded 
              ? 'Click canvas to add objects • Use left panel to control shaders'
              : 'Loading video content...'
            }
          </span>
        </div>
        
        <div className="flex-1 flex items-center justify-center bg-black p-8">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              className="border border-gray-600 cursor-crosshair"
              onClick={addObject}
            />
            <canvas
              ref={overlayCanvasRef}
              width={800}
              height={450}
              className="absolute top-0 left-0 pointer-events-none"
            />
            <video
              ref={videoRef}
              width={800}
              height={450}
              className="hidden"
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              loop
              muted
              crossOrigin="anonymous"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 