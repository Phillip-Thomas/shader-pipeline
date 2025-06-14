import { useCallback } from 'react';
import { CanvasObject } from '../types';

interface ObjectRendererProps {
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  objects: CanvasObject[];
  selectedObject: string | null;
  objectsVisible: boolean;
}

export function useObjectRenderer({
  overlayCanvasRef,
  objects,
  selectedObject,
  objectsVisible,
}: ObjectRendererProps) {
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

  return {
    drawObjects,
  };
} 