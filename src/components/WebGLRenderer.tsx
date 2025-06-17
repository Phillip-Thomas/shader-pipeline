import { useCallback, useRef, useEffect, MutableRefObject, useState } from 'react';
import { vertexShaderSource } from '../shaders/defaultShaders';
import { CanvasObject, Shader } from '../types';
// Import regl directly since it's installed in the project
import REGL from 'regl';

interface WebGLRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  shaders: Shader[];
  objects: CanvasObject[];
  isPlaying: boolean;
  isVideoLoaded: boolean;
  animationFrameRef: React.MutableRefObject<number | undefined>;
}

export function useWebGLRenderer({
  canvasRef,
  videoCanvasRef,
  shaders,
  objects,
  isPlaying,
  isVideoLoaded,
  animationFrameRef,
}: WebGLRendererProps) {
  // Using more generic types to avoid TypeScript errors
  const reglRef = useRef<any>(null);
  const commandsRef = useRef<any[]>([]);
  const fbosRef = useRef<any[]>([]);
  const videoTextureRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Set up video texture
  const setupVideoTexture = useCallback(() => {
    const regl = reglRef.current;
    const videoCanvas = videoCanvasRef.current;

    if (!regl || !videoCanvas) return;

    // Create new video texture if it doesn't exist
    if (!videoTextureRef.current) {
      videoTextureRef.current = regl.texture({
        data: videoCanvas,
        min: 'linear',
        mag: 'linear',
        wrap: 'clamp'
      });
    }
  }, [videoCanvasRef]);

  // Initialize WebGL once
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || reglRef.current) return; // Only initialize once

    console.log('Initializing WebGL...');

    // Create new regl instance
    try {
      reglRef.current = REGL({
        canvas,
        attributes: { preserveDrawingBuffer: true }
      });
    } catch (e) {
      console.error('Failed to initialize regl:', e);
      return;
    }

    const regl = reglRef.current;

    // Create framebuffers for multi-pass rendering
    fbosRef.current = [
      regl.framebuffer({
        color: regl.texture({
          width: canvas.width,
          height: canvas.height,
          min: 'linear',
          mag: 'linear',
          wrap: 'clamp'
        }),
        depth: false
      }),
      regl.framebuffer({
        color: regl.texture({
          width: canvas.width,
          height: canvas.height,
          min: 'linear',
          mag: 'linear',
          wrap: 'clamp'
        }),
        depth: false
      })
    ];

    // Initialize commands array
    commandsRef.current = [];

    // Set up the video texture
    setupVideoTexture();

    setIsInitialized(true);
  }, [canvasRef, setupVideoTexture]);

  // Update shader commands when shaders or objects change
  const updateShaderCommands = useCallback(() => {
    if (!reglRef.current || !isInitialized) return;

    console.log('Updating shader commands...');
    const regl = reglRef.current;

    // Create commands for each shader
    commandsRef.current = shaders.map(shader => {
      return regl({
        frag: shader.fragmentShader,
        vert: vertexShaderSource,
        attributes: {
          a_position: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
          ],
          a_texCoord: [
            [0, 1],  // Flip Y coordinate: (0,0) -> (0,1)
            [1, 1],  // Flip Y coordinate: (1,0) -> (1,1)
            [0, 0],  // Flip Y coordinate: (0,1) -> (0,0)
            [1, 0]   // Flip Y coordinate: (1,1) -> (1,0)
          ]
        },
        uniforms: {
          u_texture: regl.prop('texture'),
          u_resolution: regl.prop('resolution'),
          u_time: regl.prop('time'),
          // Dynamic uniforms will be added during render
          ...Object.fromEntries(
            Object.keys(shader.uniforms).map(name => [
              name,
              regl.prop(name)
            ])
          ),
          // Object uniforms will be added during render
          ...objects.reduce<Record<string, any>>((acc, _, i) => {
            acc[`u_object${i}_pos`] = regl.prop(`object${i}_pos`);
            acc[`u_object${i}_size`] = regl.prop(`object${i}_size`);
            acc[`u_object${i}_rotation`] = regl.prop(`object${i}_rotation`);
            acc[`u_object${i}_color`] = regl.prop(`object${i}_color`);
            return acc;
          }, {})
        },
        count: 4,
        primitive: 'triangle strip'
      });
    });
  }, [shaders, objects, isInitialized]);

  const render = useCallback(() => {
    const regl = reglRef.current;
    const canvas = canvasRef.current;
    const videoCanvas = videoCanvasRef.current;

    if (!regl || !canvas || !videoCanvas) {
      // Keep trying to render even if video isn't loaded yet
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
      return;
    }

    // Update video texture with current video frame
    if (videoTextureRef.current) {
      try {
        videoTextureRef.current.subimage(videoCanvas);
      } catch (e) {
        console.error('Error updating video texture:', e);
        // Continue animation loop even if texture update fails
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(render);
        }
        return;
      }
    } else {
      // If video texture doesn't exist yet, create it
      setupVideoTexture();

      // Skip this frame if we just created the texture
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
      return;
    }

    let currentTexture = videoTextureRef.current;
    let textureIndex = 0;

    // Apply enabled shaders in sequence
    const enabledShaders = shaders.filter(shader => shader.enabled);

    // Always clear the canvas
    regl.clear({
      color: [0, 0, 0, 0],
      depth: 1
    });

    // If no shaders are enabled, just render the video directly
    if (enabledShaders.length === 0) {
      // Create a simple pass-through shader
      const simplePassthrough = regl({
        frag: `
          precision mediump float;
          uniform sampler2D u_texture;
          varying vec2 v_texCoord;
          void main() {
            gl_FragColor = texture2D(u_texture, v_texCoord);
          }
        `,
        vert: vertexShaderSource,
        attributes: {
          a_position: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
          ],
          a_texCoord: [
            [0, 1],  // Flip Y coordinate: (0,0) -> (0,1)
            [1, 1],  // Flip Y coordinate: (1,0) -> (1,1)
            [0, 0],  // Flip Y coordinate: (0,1) -> (0,0)
            [1, 0]   // Flip Y coordinate: (1,1) -> (1,0)
          ]
        },
        uniforms: {
          u_texture: regl.prop('texture')
        },
        count: 4,
        primitive: 'triangle strip'
      });

      simplePassthrough({
        texture: currentTexture
      });
    } else {
      enabledShaders.forEach((shader, index) => {
        const programIndex = shaders.findIndex(s => s.id === shader.id);
        const command = commandsRef.current[programIndex];

        if (!command) {
          console.warn(`Command not found for shader: ${shader.name}`);
          return;
        }

        // Prepare uniforms for this shader
        const uniforms: Record<string, any> = {
          texture: currentTexture,
          resolution: [canvas.width, canvas.height],
          time: Date.now() / 1000
        };

        // Add shader-specific uniforms
        Object.entries(shader.uniforms).forEach(([name, value]) => {
          uniforms[name] = value;
        });

        // Add object-based uniforms
        objects.forEach((obj, objIndex) => {
          // Calculate center position of the object's bounding box
          const centerX = obj.x + obj.width / 2;
          const centerY = obj.y + obj.height / 2;

          // Fix coordinate system: Canvas uses top-left origin, WebGL uses bottom-left
          uniforms[`object${objIndex}_pos`] = [
            centerX / canvas.width,
            1.0 - (centerY / canvas.height)
          ];
          uniforms[`object${objIndex}_size`] = [
            obj.width / canvas.width,
            obj.height / canvas.height
          ];
          uniforms[`object${objIndex}_rotation`] = obj.rotation;

          // Parse color
          const color = obj.color.replace('#', '');
          const r = parseInt(color.substring(0, 2), 16) / 255;
          const g = parseInt(color.substring(2, 4), 16) / 255;
          const b = parseInt(color.substring(4, 6), 16) / 255;
          uniforms[`object${objIndex}_color`] = [r, g, b];
        });

        // Render to framebuffer (except for last pass)
        if (index < enabledShaders.length - 1) {
          fbosRef.current[textureIndex % 2].use(() => {
            command(uniforms);
          });
          // Access the color attachment from the framebuffer
          currentTexture = fbosRef.current[textureIndex % 2].color[0];
          textureIndex++;
        } else {
          // Final pass renders to canvas
          regl.clear({
            color: [0, 0, 0, 0],
            depth: 1
          });
          command(uniforms);
        }
      });
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(render);
    }
  }, [shaders, objects, isPlaying, isVideoLoaded, setupVideoTexture]);

  // Initialize WebGL once when component mounts
  useEffect(() => {
    initWebGL();

    // Clean up resources when component unmounts
    return () => {
      if (videoTextureRef.current) {
        try {
          videoTextureRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying video texture:', e);
        }
        videoTextureRef.current = null;
      }

      // Only attempt to destroy framebuffers if they exist
      if (fbosRef.current && fbosRef.current.length > 0) {
        try {
          fbosRef.current.forEach(fbo => {
            if (fbo) fbo.destroy();
          });
        } catch (e) {
          console.warn('Error destroying framebuffers:', e);
        }
        fbosRef.current = [];
      }

      if (reglRef.current) {
        try {
          reglRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying regl instance:', e);
        }
        reglRef.current = null;
      }
    };
  }, [initWebGL]);

  // Update shader commands when shaders or objects change
  useEffect(() => {
    if (isInitialized) {
      updateShaderCommands();
    }
  }, [shaders, objects, updateShaderCommands, isInitialized]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !reglRef.current || !isInitialized) return;

      // Update framebuffer sizes
      fbosRef.current.forEach(fbo => {
        try {
          fbo.resize(canvas.width, canvas.height);
        } catch (e) {
          console.warn('Error resizing framebuffer:', e);
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef, isInitialized]);

  return {
    initWebGL,
    updateShaderCommands,
    render,
  };
}
