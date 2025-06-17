import { useState, useMemo, useRef, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Sidebar from './Sidebar';
import CanvasArea from './CanvasArea';
import { useWebGLRenderer } from './WebGLRenderer';
import { useObjectRenderer } from './ObjectRenderer';
import { useVideoCanvasRenderer } from './VideoCanvasRenderer';
import { defaultShaders } from '../shaders/defaultShaders';
import { CanvasObject, Shader } from '../types';

export default function ShaderStudio() {
  const [currentTool, setCurrentTool] = useState<'select' | 'text' | 'rect' | 'circle'>('select');
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [shaders, setShaders] = useState<Shader[]>(defaultShaders);
  const [isPlaying, setIsPlaying] = useState(true); // Start playing automatically
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [objectsVisible, setObjectsVisible] = useState(true);

  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>();

  // Initialize custom hooks
  const { updateShaderCommands, render } = useWebGLRenderer({
    canvasRef,
    videoCanvasRef,
    shaders,
    objects,
    isPlaying,
    isVideoLoaded,
    animationFrameRef,
  });

  const { drawObjects } = useObjectRenderer({
    overlayCanvasRef,
    objects,
    selectedObject,
    objectsVisible,
  });

  // Initialize video canvas renderer
  const { getVideoCanvas } = useVideoCanvasRenderer({
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    isPlaying,
    setIsVideoLoaded,
  });

  // Update videoCanvasRef when the video canvas is available
  useEffect(() => {
    const updateVideoCanvas = () => {
      videoCanvasRef.current = getVideoCanvas();
      if (!videoCanvasRef.current) {
        console.log("Video canvas not available yet, retrying...");
        setTimeout(updateVideoCanvas, 100);
      } else {
        console.log("Video canvas is now available");
        // Force a render to ensure the video appears
        render();
      }
    };

    updateVideoCanvas();
  }, [getVideoCanvas, render]);

  // Update shader commands when shaders change
  useEffect(() => {
    updateShaderCommands();
  }, [shaders, objects, updateShaderCommands]);

  // Redraw objects when they change
  useEffect(() => {
    drawObjects();
  }, [objects, selectedObject, objectsVisible, drawObjects]);

  // Start/stop rendering
  useEffect(() => {
    if (isPlaying) {
      // Start render loop as soon as playing starts
      render();
    } else {
      // Stop render loop when paused
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    }
  }, [isPlaying, render]);

  const addObject = (x: number, y: number) => {
    if (currentTool === 'select') return;

    const newObject: CanvasObject = {
      id: Date.now().toString(),
      type: currentTool,
      x: x - 50,
      y: y - 25,
      width: 100,
      height: 50,
      rotation: 0,
      color: '#ff0000',
      text: currentTool === 'text' ? 'Sample Text' : undefined,
      visible: true,
    };

    setObjects(prev => [...prev, newObject]);
    setSelectedObject(newObject.id);
    setCurrentTool('select');
  };

  const updateObject = (id: string, updates: Partial<CanvasObject>) => {
    setObjects(prev => prev.map(obj =>
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  };

  const deleteObject = (id: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedObject === id) {
      setSelectedObject(null);
    }
  };

  const selectedObjectData = useMemo(() =>
    objects.find(obj => obj.id === selectedObject) || null,
    [objects, selectedObject]
  );

  const updateShader = (id: string, updates: Partial<Shader>) => {
    setShaders(prev => prev.map(shader =>
      shader.id === id ? { ...shader, ...updates } : shader
    ));
  };

  const deleteShader = (id: string) => {
    setShaders(prev => prev.filter(shader => shader.id !== id));
  };

  const addCustomShader = (name: string, fragmentShader: string) => {
    const newShader: Shader = {
      id: Date.now().toString(),
      name,
      fragmentShader,
      uniforms: {},
      enabled: true,
    };
    setShaders(prev => [...prev, newShader]);
  };

  const reorderShaders = (dragIndex: number, hoverIndex: number) => {
    setShaders(prev => {
      const newShaders = [...prev];
      const draggedShader = newShaders[dragIndex];
      newShaders.splice(dragIndex, 1);
      newShaders.splice(hoverIndex, 0, draggedShader);
      return newShaders;
    });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex bg-gray-900 text-white">
        <Sidebar
          currentTool={currentTool}
          setCurrentTool={setCurrentTool}
          objects={objects}
          selectedObject={selectedObject}
          setSelectedObject={setSelectedObject}
          selectedObjectData={selectedObjectData}
          updateObject={updateObject}
          deleteObject={deleteObject}
          objectsVisible={objectsVisible}
          setObjectsVisible={setObjectsVisible}
          shaders={shaders}
          updateShader={updateShader}
          deleteShader={deleteShader}
          addCustomShader={addCustomShader}
          reorderShaders={reorderShaders}
        />

        <div className="flex-1 flex flex-col">
          <CanvasArea
            canvasRef={canvasRef}
            overlayCanvasRef={overlayCanvasRef}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            addObject={addObject}
          />
        </div>
      </div>
    </DndProvider>
  );
}
