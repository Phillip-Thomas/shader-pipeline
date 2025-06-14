interface Shader {
  id: string;
  name: string;
  fragmentShader: string;
  enabled: boolean;
  uniforms: Record<string, number>;
}

export const defaultShaders: Shader[] = [
  {
    id: 'grayscale',
    name: 'Grayscale',
    fragmentShader: `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_texCoord;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = mix(color, vec4(gray, gray, gray, color.a), u_intensity);
}`,
    enabled: true,
    uniforms: { u_intensity: 1.0 }
  },
  {
    id: 'brightness',
    name: 'Brightness & Contrast',
    fragmentShader: `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_brightness;
uniform float u_contrast;
varying vec2 v_texCoord;

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  
  // Apply brightness
  color.rgb += u_brightness;
  
  // Apply contrast
  color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
  
  gl_FragColor = color;
}`,
    enabled: false,
    uniforms: { u_brightness: 0.0, u_contrast: 1.0 }
  },
  {
    id: 'blur',
    name: 'Blur',
    fragmentShader: `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_strength;
varying vec2 v_texCoord;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = vec4(0.0);
  
  // Simple box blur
  for(int x = -2; x <= 2; x++) {
    for(int y = -2; y <= 2; y++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize * u_strength;
      color += texture2D(u_texture, v_texCoord + offset);
    }
  }
  
  gl_FragColor = color / 25.0; // 5x5 kernel
}`,
    enabled: false,
    uniforms: { u_strength: 1.0 }
  },
  {
    id: 'chromatic',
    name: 'Chromatic Aberration',
    fragmentShader: `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_strength;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  vec2 center = vec2(0.5, 0.5);
  vec2 offset = (uv - center) * u_strength;
  
  float r = texture2D(u_texture, uv + offset).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv - offset).b;
  
  gl_FragColor = vec4(r, g, b, 1.0);
}`,
    enabled: false,
    uniforms: { u_strength: 0.01 }
  }
];

export const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`; 