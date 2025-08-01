import React, { useRef, useEffect, useState } from 'react';

const DrawingCanvas = ({ onDrawingSubmit, onCanvasChange, disabled, timeRemaining }) => {
  const canvasRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [tool, setTool] = useState('brush');

  const [strokes, setStrokes] = useState([]);      // Full drawing history
  const [redoStack, setRedoStack] = useState([]);  // Redo buffer
  const [currentStroke, setCurrentStroke] = useState(null); // Current stroke in progress
  const [lastPoint, setLastPoint] = useState(null); // Track last drawn point

  // Helper function to update parent with current canvas
  const updateParentCanvas = () => {
    if (onCanvasChange && canvasRef.current) {
      try {
        const dataURL = canvasRef.current.toDataURL('image/png');
        console.log("UpdateParentCanvas called, data length:", dataURL.length);
        onCanvasChange(dataURL);
      } catch (error) {
        console.error("Error updating parent canvas:", error);
        // Fallback - create a blank canvas data URL
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 800;
        tempCanvas.height = 600;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        onCanvasChange(tempCanvas.toDataURL('image/png'));
      }
    }
  };

  // Setup canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 600;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Send initial blank canvas to parent - use setTimeout to ensure it's called
    setTimeout(() => {
      updateParentCanvas();
    }, 100);
  }, []);

  // Also update parent whenever the component re-renders (backup safety)
  useEffect(() => {
    if (canvasRef.current) {
      updateParentCanvas();
    }
  });

  // Get mouse/touch coordinates relative to canvas
  const getCursor = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Start new stroke
  const startDrawing = (e) => {
    if (disabled) return;
    setIsDrawing(true);
    const pos = getCursor(e);
    setLastPoint(pos);
    
    const newStroke = {
      tool,
      color: brushColor,
      size: brushSize,
      path: [pos],
    };
    setCurrentStroke(newStroke);
    
    // Draw the initial point
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
    }
    
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  // Continue stroke - draw incrementally
  const draw = (e) => {
    if (!isDrawing || disabled) return;
    const pos = getCursor(e);
    
    if (!lastPoint || !currentStroke) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Draw line from last point to current point
    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    if (currentStroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = currentStroke.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.size;
    }
    
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
    
    // Update current stroke and last point
    setCurrentStroke((prev) => {
      if (!prev) return null;
      return { ...prev, path: [...prev.path, pos] };
    });
    setLastPoint(pos);
  };

  // End stroke
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPoint(null);
    
    if (currentStroke) {
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);
      setRedoStack([]); // Clear redo on new action
      setCurrentStroke(null);
      
      // Update parent with final canvas state
      setTimeout(updateParentCanvas, 50);
    }
  };

  // Redraw everything (for undo/redo/clear operations)
  const redrawCanvas = (allStrokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke);
    }
    
    // Update parent with current canvas data
    setTimeout(updateParentCanvas, 10);
  };

  // Draw a single stroke
  const drawStroke = (ctx, stroke) => {
    if (!stroke.path || stroke.path.length < 1) return;

    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }

    if (stroke.path.length === 1) {
      // Single point - draw a circle
      ctx.arc(stroke.path[0].x, stroke.path[0].y, stroke.size / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // Multiple points - draw lines
      ctx.moveTo(stroke.path[0].x, stroke.path[0].y);
      for (let i = 1; i < stroke.path.length; i++) {
        ctx.lineTo(stroke.path[i].x, stroke.path[i].y);
      }
      ctx.stroke();
    }
    
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over'; // Reset after stroke
  };

  // Undo last stroke
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const newStrokes = [...strokes];
    const last = newStrokes.pop();
    setStrokes(newStrokes);
    setRedoStack((prev) => [last, ...prev]);
    redrawCanvas(newStrokes);
  };

  // Redo last undone stroke
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const [restored, ...rest] = redoStack;
    const newStrokes = [...strokes, restored];
    setStrokes(newStrokes);
    setRedoStack(rest);
    redrawCanvas(newStrokes);
  };

  // Clear entire canvas
  const clearCanvas = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setStrokes([]);
    setRedoStack([]);
    
    // Update parent with cleared canvas
    setTimeout(updateParentCanvas, 10);
  };

  // Submit final image to parent
  const submitDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const data = canvas.toDataURL('image/png');
      onDrawingSubmit(data);
    } catch (error) {
      console.error("Error submitting drawing:", error);
      // Create fallback blank canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 800;
      tempCanvas.height = 600;
      const ctx = tempCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      onDrawingSubmit(tempCanvas.toDataURL('image/png'));
    }
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    stopDrawing();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const keyHandler = (e) => {
      if (disabled) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [strokes, redoStack, disabled]);

  return (
    <div className="drawing-canvas-container" style={{ textAlign: 'center' }}>
      {/* Toolbar */}
      <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
        <div>
          <label style={{ marginRight: '5px' }}>Tool:</label>
          <select value={tool} onChange={(e) => setTool(e.target.value)} disabled={disabled}>
            <option value="brush">Brush</option>
            <option value="eraser">Eraser</option>
          </select>
        </div>

        {tool === 'brush' && (
          <div>
            <label style={{ marginRight: '5px' }}>Color:</label>
            <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} disabled={disabled} />
          </div>
        )}

        <div>
          <label style={{ marginRight: '5px' }}>Size: {brushSize}px</label>
          <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} disabled={disabled} />
        </div>

        <button onClick={clearCanvas} disabled={disabled}>Clear</button>
        <button onClick={handleUndo} disabled={disabled || strokes.length === 0}>Undo</button>
        <button onClick={handleRedo} disabled={disabled || redoStack.length === 0}>Redo</button>
      </div>

      {/* Canvas */}
      <div style={{ border: '2px solid #ccc', borderRadius: '5px', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair', display: 'block' }}
        />
      </div>

      {/* Submit + Timer */}
      <div style={{ marginTop: '15px' }}>
        <button onClick={submitDrawing} disabled={disabled}>
          Submit
        </button>

        {timeRemaining !== null && (
          <div style={{ marginTop: '10px', color: timeRemaining <= 10 ? 'red' : 'black' }}>
            Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;