import { useEffect, useRef, useState } from 'react';

// Declare the global window property for our custom property
declare global {
  interface Window {
    hasLoggedVideoFrame?: boolean;
  }
}

interface VideoCanvasRendererProps {
  videoUrl: string;
  isPlaying: boolean;
  setIsVideoLoaded: (loaded: boolean) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>; // Make canvasRef optional since we're not using it
}

export function useVideoCanvasRenderer({
  videoUrl,
  isPlaying,
  setIsVideoLoaded,
}: VideoCanvasRendererProps) {
  // These refs are kept for potential future MSE implementation
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Track if we're using the fallback animation
  const [usingFallback, setUsingFallback] = useState(false);
  // Track if video is actually ready to play
  const [videoReady, setVideoReady] = useState(false);

  // Initialize video rendering
  useEffect(() => {
    let isMounted = true;

    // Create an offscreen video element (not added to DOM)
    const videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.crossOrigin = 'anonymous';
    videoElement.preload = 'auto'; // Ensure video preloads
    videoElementRef.current = videoElement;

    // Create an offscreen canvas for video processing
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 800;
    offscreenCanvas.height = 450;
    offscreenCanvasRef.current = offscreenCanvas;
    offscreenCtxRef.current = offscreenCanvas.getContext('2d');

    // Initialize the offscreen canvas with a black frame
    if (offscreenCtxRef.current) {
      offscreenCtxRef.current.fillStyle = 'black';
      offscreenCtxRef.current.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    // Set up event listeners before setting src
    videoElement.onloadeddata = () => {
      if (!isMounted) return;

      console.log('Video loaded successfully');
      setVideoReady(true);

      // Draw the first frame immediately
      if (offscreenCtxRef.current) {
        offscreenCtxRef.current.drawImage(videoElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
        console.log('First video frame drawn to offscreen canvas');
      }

      setIsVideoLoaded(true);

      // Start playing and rendering if needed
      if (isPlaying && !usingFallback) {
        console.log('Auto-playing video after load');
        videoElement.play()
          .then(() => {
            if (isMounted) startRendering();
          })
          .catch(err => {
            console.error('Error auto-playing video after load:', err);
          });
      }
    };

    videoElement.onerror = (e) => {
      if (!isMounted) return;

      console.error('Video failed to load:', e);
      console.log('Creating fallback content');
      setUsingFallback(true);
      createFallbackAnimation();
    };

    // Set the source last, after all event handlers are in place
    videoElement.src = videoUrl;

    return () => {
      isMounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (videoElementRef.current) {
        videoElementRef.current.onloadeddata = null;
        videoElementRef.current.onerror = null;
        videoElementRef.current.pause();
        videoElementRef.current.src = '';
        videoElementRef.current.load();
        videoElementRef.current = null;
      }
    };
  }, [videoUrl, setIsVideoLoaded]);

  // Handle play/pause separately from initialization
  useEffect(() => {
    // Skip if we're using fallback animation or video isn't ready
    if (usingFallback || !videoReady) return;

    const videoElement = videoElementRef.current;
    if (!videoElement) return;

    console.log(`Play state changed to: ${isPlaying ? 'playing' : 'paused'}`);

    if (isPlaying) {
      console.log('Attempting to play video');
      videoElement.play()
        .then(() => {
          console.log('Video playing successfully');
          startRendering();
        })
        .catch(err => {
          console.error('Error playing video:', err);
        });
    } else {
      console.log('Pausing video');
      videoElement.pause();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [isPlaying, usingFallback, videoReady]);

  const startRendering = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const renderFrame = () => {
      const videoElement = videoElementRef.current;
      const offscreenCanvas = offscreenCanvasRef.current;
      const offscreenCtx = offscreenCtxRef.current;

      if (videoElement && offscreenCanvas && offscreenCtx) {
        // Draw the current video frame to the offscreen canvas
        offscreenCtx.drawImage(videoElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

        // Log once to confirm video is being rendered to offscreen canvas
        if (!window.hasLoggedVideoFrame) {
          console.log('Video frame rendered to offscreen canvas');
          window.hasLoggedVideoFrame = true;
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  };

  const createFallbackAnimation = () => {
    const canvas = offscreenCanvasRef.current;
    const ctx = offscreenCtxRef.current;

    if (!canvas || !ctx) return;

    console.log('Starting fallback animation');
    setUsingFallback(true);

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

    setIsVideoLoaded(true);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  };

  // Method to get the current video frame as ImageData
  const getCurrentFrame = (): ImageData | null => {
    const offscreenCanvas = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCtxRef.current;

    if (!offscreenCanvas || !offscreenCtx) return null;

    return offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
  };

  // Method to get the offscreen canvas element (for WebGL to use as a texture source)
  const getVideoCanvas = (): HTMLCanvasElement | null => {
    return offscreenCanvasRef.current;
  };

  return {
    getCurrentFrame,
    getVideoCanvas
  };
}
