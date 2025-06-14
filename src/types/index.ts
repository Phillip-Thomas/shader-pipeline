export interface CanvasObject {
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

export interface Shader {
  id: string;
  name: string;
  fragmentShader: string;
  enabled: boolean;
  uniforms: Record<string, number>;
} 