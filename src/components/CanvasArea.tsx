import React from 'react';
import { Play, Pause } from 'lucide-react';

interface CanvasAreaProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  addObject: (x: number, y: number) => void;
}

export default function CanvasArea({
  canvasRef,
  overlayCanvasRef,
  isPlaying,
  setIsPlaying,
  addObject,
}: CanvasAreaProps) {
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addObject(x, y);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Controls Header */}
      <div className="bg-gray-800 p-4 flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="text-sm text-gray-300">
          Click canvas to add objects • Use left panel to control shaders
        </span>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 flex items-center justify-center bg-black p-8">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={450}
            className="border border-gray-600 cursor-crosshair"
            onClick={handleCanvasClick}
          />
          <canvas
            ref={overlayCanvasRef}
            width={800}
            height={450}
            className="absolute top-0 left-0 pointer-events-none"
          />
          {/* Video is now rendered directly to canvas via VideoCanvasRenderer */}
        </div>
      </div>
    </div>
  );
}
