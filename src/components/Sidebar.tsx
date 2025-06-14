import React, { useState } from 'react';
import { Plus, Trash2, Move, Type, Square, Circle, Eye, EyeOff, GripVertical } from 'lucide-react';
import { CanvasObject, Shader } from '../types';

interface SidebarProps {
  // Tool state
  tool: 'select' | 'text' | 'rect' | 'circle';
  setTool: (tool: 'select' | 'text' | 'rect' | 'circle') => void;
  
  // Objects state
  objects: CanvasObject[];
  setObjects: React.Dispatch<React.SetStateAction<CanvasObject[]>>;
  selectedObject: string | null;
  setSelectedObject: (id: string | null) => void;
  objectsVisible: boolean;
  setObjectsVisible: (visible: boolean) => void;
  
  // Shaders state
  shaders: Shader[];
  setShaders: React.Dispatch<React.SetStateAction<Shader[]>>;
  
  // Custom shader editor state
  customShader: string;
  setCustomShader: (shader: string) => void;
  customShaderName: string;
  setCustomShaderName: (name: string) => void;
  showShaderEditor: boolean;
  setShowShaderEditor: (show: boolean) => void;
  editingShader: string | null;
  
  // Functions
  addCustomShader: () => void;
  startEditingShader: (shader: Shader) => void;
  cancelShaderEditor: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const {
    tool,
    setTool,
    objects,
    setObjects,
    selectedObject,
    setSelectedObject,
    objectsVisible,
    setObjectsVisible,
    shaders,
    setShaders,
    customShader,
    setCustomShader,
    customShaderName,
    setCustomShaderName,
    showShaderEditor,
    setShowShaderEditor,
    editingShader,
    addCustomShader,
    startEditingShader,
    cancelShaderEditor,
  } = props;

  const selectedObj = objects.find(obj => obj.id === selectedObject);
  const [draggedShader, setDraggedShader] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, shaderId: string) => {
    setDraggedShader(shaderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', shaderId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedShader) return;

    const draggedIndex = shaders.findIndex(s => s.id === draggedShader);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    // Create new array with reordered shaders
    const newShaders = [...shaders];
    const [draggedItem] = newShaders.splice(draggedIndex, 1);
    newShaders.splice(dropIndex, 0, draggedItem);

    setShaders(newShaders);
    setDraggedShader(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedShader(null);
    setDragOverIndex(null);
  };

  return (
    <div className="w-96 bg-gray-800 p-6 overflow-y-auto">
      {/* Tools Section */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Tools</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'select', icon: Move, label: 'Select' },
            { id: 'text', icon: Type, label: 'Text' },
            { id: 'rect', icon: Square, label: 'Rectangle' },
            { id: 'circle', icon: Circle, label: 'Circle' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id as any)}
              className={`p-3 rounded-lg flex items-center gap-2 ${
                tool === id ? 'bg-blue-600' : 'bg-gray-700'
              } hover:bg-blue-500 transition-colors`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Objects Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Objects</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setObjectsVisible(!objectsVisible)}
              className={`p-2 rounded-lg transition-colors ${
                objectsVisible 
                  ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
              }`}
              title={objectsVisible ? "Hide all objects" : "Show all objects"}
            >
              {objectsVisible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button
              onClick={() => {
                setObjects([]);
                setSelectedObject(null);
              }}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete all objects"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {objects.map(obj => (
            <div
              key={obj.id}
              className={`p-3 rounded-lg transition-colors ${
                selectedObject === obj.id ? 'bg-blue-600' : 'bg-gray-700'
              } ${!obj.visible ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => setSelectedObject(obj.id)}
                >
                  <div className="font-medium capitalize flex items-center gap-2">
                    {obj.type === 'text' && <Type size={16} />}
                    {obj.type === 'rect' && <Square size={16} />}
                    {obj.type === 'circle' && <Circle size={16} />}
                    {obj.type}
                    {!obj.visible && <span className="text-xs text-gray-400">(hidden)</span>}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {obj.type === 'text' ? obj.text : `${Math.round(obj.x)}, ${Math.round(obj.y)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setObjects(prev => prev.map(o => 
                        o.id === obj.id ? { ...o, visible: !o.visible } : o
                      ));
                    }}
                    className={`p-1 rounded transition-colors ${
                      obj.visible 
                        ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                    }`}
                    title={obj.visible ? "Hide object" : "Show object"}
                  >
                    {obj.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setObjects(prev => prev.filter(o => o.id !== obj.id));
                      if (selectedObject === obj.id) {
                        setSelectedObject(null);
                      }
                    }}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                    title="Delete object"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {objects.length === 0 && (
            <div className="text-gray-400 text-sm italic p-3 text-center">
              No objects added yet
            </div>
          )}
        </div>

        {/* Object Properties */}
        {selectedObj && (
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h4 className="text-lg font-semibold mb-3 text-blue-300">Object Properties</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">X Position</label>
                <input
                  type="number"
                  value={Math.round(selectedObj.x)}
                  onChange={(e) => {
                    setObjects(prev => prev.map(obj => 
                      obj.id === selectedObject ? { ...obj, x: parseInt(e.target.value) || 0 } : obj
                    ));
                  }}
                  className="w-full p-2 bg-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Y Position</label>
                <input
                  type="number"
                  value={Math.round(selectedObj.y)}
                  onChange={(e) => {
                    setObjects(prev => prev.map(obj => 
                      obj.id === selectedObject ? { ...obj, y: parseInt(e.target.value) || 0 } : obj
                    ));
                  }}
                  className="w-full p-2 bg-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Width</label>
                <input
                  type="number"
                  value={Math.round(selectedObj.width)}
                  onChange={(e) => {
                    setObjects(prev => prev.map(obj => 
                      obj.id === selectedObject ? { ...obj, width: parseInt(e.target.value) || 1 } : obj
                    ));
                  }}
                  className="w-full p-2 bg-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Height</label>
                <input
                  type="number"
                  value={Math.round(selectedObj.height)}
                  onChange={(e) => {
                    setObjects(prev => prev.map(obj => 
                      obj.id === selectedObject ? { ...obj, height: parseInt(e.target.value) || 1 } : obj
                    ));
                  }}
                  className="w-full p-2 bg-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Rotation (degrees)</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedObj.rotation}
                  onChange={(e) => {
                    setObjects(prev => prev.map(obj => 
                      obj.id === selectedObject ? { ...obj, rotation: parseInt(e.target.value) } : obj
                    ));
                  }}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {selectedObj.rotation}°
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Color</label>
                <input
                  type="color"
                  value={selectedObj.color}
                  onChange={(e) => {
                    setObjects(prev => prev.map(obj => 
                      obj.id === selectedObject ? { ...obj, color: e.target.value } : obj
                    ));
                  }}
                  className="w-full p-2 bg-gray-600 rounded"
                />
              </div>
              {selectedObj.type === 'text' && (
                <div>
                  <label className="block text-sm mb-1">Text</label>
                  <input
                    type="text"
                    value={selectedObj.text || ''}
                    onChange={(e) => {
                      setObjects(prev => prev.map(obj => 
                        obj.id === selectedObject ? { ...obj, text: e.target.value } : obj
                      ));
                    }}
                    className="w-full p-2 bg-gray-600 rounded text-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shaders Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Shaders</h3>
          <button
            onClick={() => setShowShaderEditor(!showShaderEditor)}
            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
            title="Add custom shader"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="text-xs text-gray-400 mb-4 italic">
          Drag shaders to reorder • Order affects the final result
        </div>
        <div className="space-y-4">
          {shaders.map((shader, index) => {
            const isCustomShader = !['grayscale', 'brightness', 'blur', 'chromatic'].includes(shader.id);
            const isDragging = draggedShader === shader.id;
            const isDropTarget = dragOverIndex === index;
            
            return (
              <div 
                key={shader.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, shader.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-4 rounded-lg transition-all duration-200 ${
                  isDragging 
                    ? 'bg-gray-600 opacity-50 scale-105 shadow-lg' 
                    : isDropTarget
                    ? 'bg-blue-900/30 border-2 border-blue-400 border-dashed'
                    : 'bg-gray-700'
                } ${isDragging ? '' : 'hover:bg-gray-600'} cursor-move`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GripVertical 
                      size={16} 
                      className="text-gray-400 hover:text-gray-300 cursor-grab active:cursor-grabbing" 
                    />
                    <span 
                      className={`font-medium text-lg ${isCustomShader ? 'cursor-pointer hover:text-blue-300 transition-colors' : ''}`}
                      onClick={() => isCustomShader && startEditingShader(shader)}
                      title={isCustomShader ? 'Click to edit shader' : ''}
                    >
                      {shader.name}
                    </span>
                    {isCustomShader && <span className="text-xs text-green-400">(custom)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCustomShader && (
                      <button
                        onClick={() => {
                          setShaders(prev => prev.filter(s => s.id !== shader.id));
                        }}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                        title="Delete custom shader"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shader.enabled}
                        onChange={(e) => {
                          setShaders(prev => prev.map(s => 
                            s.id === shader.id ? { ...s, enabled: e.target.checked } : s
                          ));
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">Enabled</span>
                    </label>
                  </div>
                </div>
                {Object.entries(shader.uniforms).map(([name, value]) => {
                  // Define different ranges for different uniform types
                  let min = 0, max = 2, step = 0.01;
                  
                  if (name === 'u_brightness') {
                    min = -0.5;
                    max = 0.5;
                    step = 0.01;
                  } else if (name === 'u_contrast') {
                    min = 0.5;
                    max = 3.0;
                    step = 0.01;
                  } else if (name === 'u_strength') {
                    min = 0;
                    max = shader.id === 'blur' ? 5.0 : 0.1;
                    step = shader.id === 'blur' ? 0.1 : 0.001;
                  }
                  
                  return (
                    <div key={name} className="mb-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {name.replace('u_', '').replace('_', ' ').toUpperCase()}
                      </label>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => {
                          setShaders(prev => prev.map(s => 
                            s.id === shader.id 
                              ? { ...s, uniforms: { ...s.uniforms, [name]: parseFloat(e.target.value) }}
                              : s
                          ));
                        }}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{min.toFixed(step < 0.01 ? 3 : 2)}</span>
                        <span className="font-medium">{value.toFixed(step < 0.01 ? 3 : 2)}</span>
                        <span>{max.toFixed(step < 0.01 ? 3 : 2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Shader Editor */}
      {showShaderEditor && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">
            {editingShader ? 'Edit Custom Shader' : 'Add Custom Shader'}
          </h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Shader Name
            </label>
            <input
              type="text"
              value={customShaderName}
              onChange={(e) => setCustomShaderName(e.target.value)}
              placeholder="Enter shader name (e.g., 'Ripple Effect', 'Color Distortion')"
              className="w-full p-3 bg-gray-700 rounded-lg text-white placeholder-gray-400"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fragment Shader Code
            </label>
            <textarea
              value={customShader}
              onChange={(e) => setCustomShader(e.target.value)}
              placeholder="Enter fragment shader code..."
              className="w-full h-48 p-4 bg-gray-700 rounded-lg font-mono text-sm resize-none text-white placeholder-gray-400"
            />
          </div>
          
          <div className="mb-4 p-4 bg-gray-800 border border-gray-600 rounded-lg">
            <h4 className="font-semibold text-blue-300 mb-3">Available Uniforms:</h4>
            <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
              <div>
                <span className="text-green-400 font-mono">uniform sampler2D u_texture;</span>
                <div className="text-gray-300 text-xs ml-2">Input video texture</div>
              </div>
              <div>
                <span className="text-green-400 font-mono">uniform vec2 u_resolution;</span>
                <div className="text-gray-300 text-xs ml-2">Canvas width and height</div>
              </div>
              <div>
                <span className="text-green-400 font-mono">uniform float u_time;</span>
                <div className="text-gray-300 text-xs ml-2">Time in seconds (for animation)</div>
              </div>
              {objects.length > 0 && (
                <>
                  <hr className="border-gray-600 my-2" />
                  <div className="text-yellow-300 font-medium">Object Uniforms:</div>
                  {objects.map((obj, index) => (
                    <div key={obj.id} className="ml-2">
                      <div className="text-yellow-400 text-xs font-medium">Object {index} ({obj.type}):</div>
                      <div className="ml-2 space-y-1">
                        <div>
                          <span className="text-green-400 font-mono text-xs">vec2 u_object{index}_pos</span>
                          <span className="text-gray-300 text-xs ml-1">(center position 0.0-1.0)</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-mono text-xs">vec2 u_object{index}_size</span>
                          <span className="text-gray-300 text-xs ml-1">(width, height 0.0-1.0)</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-mono text-xs">vec3 u_object{index}_color</span>
                          <span className="text-gray-300 text-xs ml-1">(RGB 0.0-1.0)</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-mono text-xs">float u_object{index}_rotation</span>
                          <span className="text-gray-300 text-xs ml-1">(degrees)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <hr className="border-gray-600 my-2" />
              <div>
                <span className="text-purple-400 font-mono">varying vec2 v_texCoord;</span>
                <div className="text-gray-300 text-xs ml-2">Current pixel coordinates (0.0-1.0)</div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={addCustomShader}
              disabled={!customShader.trim() || !customShaderName.trim()}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                customShader.trim() && customShaderName.trim()
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              {editingShader ? 'Save Changes' : 'Add Shader'}
            </button>
            <button
              onClick={cancelShaderEditor}
              className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 