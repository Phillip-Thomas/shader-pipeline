import { useEffect } from 'react';

interface VideoManagerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  setIsVideoLoaded: (loaded: boolean) => void;
}

export function useVideoManager({
  videoRef,
  setIsVideoLoaded,
}: VideoManagerProps) {
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
  }, [videoRef, setIsVideoLoaded]);

  return {};
} 