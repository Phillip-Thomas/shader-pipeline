# Shader Studio

A minimal TypeScript React application inspired by unicorn.studio that allows users to apply custom shaders to video content and add interactive objects to the canvas.

## Features

### Core Functionality
- **Multi-pass Shader Pipeline**: Apply multiple shaders in sequence to create complex effects
- **Custom Shader Editor**: Write and test your own fragment shaders in real-time
- **Interactive Canvas Objects**: Add text, rectangles, and circles that can be manipulated
- **Object-Shader Integration**: Canvas object properties are available as uniforms in shaders

### Built-in Shaders
- **Grayscale**: Converts video to grayscale with adjustable intensity
- **Wave Distortion**: Creates wave-like distortions with customizable amplitude and frequency
- **Chromatic Aberration**: Simulates lens distortion with color separation effects

### Interactive Tools
- **Object Placement**: Click-to-add tools for text, rectangles, and circles
- **Property Editor**: Real-time editing of object position, size, color, and rotation
- **Shader Controls**: Enable/disable shaders and adjust their parameters with sliders

## Technical Features

- **WebGL Rendering**: Hardware-accelerated shader processing
- **Multi-pass Rendering**: Chain multiple shaders together seamlessly
- **Fallback Content**: Animated gradient background if video fails to load
- **Responsive UI**: Modern dark theme with intuitive controls

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Usage

1. **Play/Pause**: Control video playback with the play button
2. **Add Objects**: Select a tool (Text, Rectangle, Circle) and click on the canvas
3. **Edit Objects**: Click on objects in the sidebar to select and edit their properties
4. **Apply Shaders**: Toggle shaders on/off and adjust their parameters using sliders
5. **Custom Shaders**: Click the + button to add your own fragment shader code

### Writing Custom Shaders

Custom shaders have access to these uniforms:
- `u_texture`: The input texture (sampler2D)
- `u_resolution`: Canvas resolution (vec2)
- `u_time`: Current time in seconds (float)
- `u_object{N}_pos`: Position of object N (vec2)
- `u_object{N}_size`: Size of object N (vec2)
- `u_object{N}_color`: Color of object N (vec3)
- `u_object{N}_rotation`: Rotation of object N (float)

Example custom shader:
```glsl
precision mediump float;
uniform sampler2D u_texture;
uniform float u_time;
uniform vec2 u_object0_pos;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  float dist = distance(uv, u_object0_pos);
  vec4 color = texture2D(u_texture, uv);
  color.rgb *= sin(u_time + dist * 10.0) * 0.5 + 0.5;
  gl_FragColor = color;
}
```

## Architecture

- **React + TypeScript**: Type-safe component architecture
- **WebGL**: Direct GPU shader processing
- **Vite**: Fast development and optimized builds
- **Tailwind CSS**: Utility-first styling

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: WebGL support required

## License

MIT License - feel free to use this project as a starting point for your own shader experiments! 