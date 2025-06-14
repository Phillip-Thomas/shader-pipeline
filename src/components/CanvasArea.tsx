import React from 'react';
import { Play, Pause } from 'lucide-react';

interface CanvasAreaProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  isVideoLoaded: boolean;
  togglePlay: () => void;
  addObject: (e: React.MouseEvent) => void;
}

export default function CanvasArea({
  canvasRef,
  overlayCanvasRef,
  videoRef,
  isPlaying,
  isVideoLoaded,
  togglePlay,
  addObject,
}: CanvasAreaProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Controls Header */}
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
      
      {/* Canvas Container */}
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
  );
} 