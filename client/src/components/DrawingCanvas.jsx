import React, { useRef, useEffect, useState } from 'react';
import "./Login.css";
const DrawingCanvas = ({ onDrawingSubmit, onCanvasChange, disabled, timeRemaining }) => {
  // onDrawingSubmit: prompted when user clicks submit button
  //onCanvasChange: prompted with each brushstroke
  // disabled: boolean to disable all drawing interactions
  //timeRemaining: # of seconds remaining (for timer display)
  const canvasRef = useRef(null); //this object holds the canvas!
  const containerRef = useRef(null); // for responsive sizing

  //all the "settings"
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(20);
  const [brushColor, setBrushColor] = useState('#000000');
  const [tool, setTool] = useState('brush');

  // canvas dimensions for 4:3 ratio
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });

  //all the canvas "brushstrokes"
  const [strokes, setStrokes] = useState([]);      // every stroke made
  const [redoStack, setRedoStack] = useState([]);  // every stroke undone
  const [currentStroke, setCurrentStroke] = useState(null); // current stroke
  const [lastPoint, setLastPoint] = useState(null); // last mouse position tracking

  // calculate responsive canvas size maintaining 4:3 ratio
  const calculateCanvasSize = () => {
    const isMobileView = window.innerWidth <= 768;
    
    if (!isMobileView) {
      // Desktop: always use 800x600 (perfect 4:3 ratio)
      return { width: 800, height: 600 };
    } else {
      // Mobile: responsive sizing but maintain 4:3 ratio
      const availableWidth = window.innerWidth * 0.9; // 90% of screen width
      const availableHeight = window.innerHeight * 0.5; // 50% of screen height
      
      // maintain 4:3 ratio
      let width = availableWidth;
      let height = (availableWidth * 3) / 4;
      
      if (height > availableHeight) {
        height = availableHeight;
        width = (availableHeight * 4) / 3;
      }
      
      // ensure minimum size for usability
      width = Math.max(320, width);
      height = Math.max(240, height);
      
      return { width: Math.floor(width), height: Math.floor(height) };
    }
  };

  // handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newDimensions = calculateCanvasSize();
      setCanvasDimensions(newDimensions);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // calculate initial size
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // helper function to update parent with current canvas
  const updateParentCanvas = () => {
    if (onCanvasChange && canvasRef.current) {
      try {
        //updates the png as the user draws so autosubmit can take the most recent one
        const dataURL = canvasRef.current.toDataURL('image/png'); 
        console.log("UpdateParentCanvas called, data length:", dataURL.length); //debugging dw
        onCanvasChange(dataURL);
      } catch (error) {
        console.error("Error updating parent canvas:", error);
        // blank canvas if all else fails
        const tempCanvas = document.createElement('canvas'); //isnt it amazing there is literally a canvas element
        tempCanvas.width = canvasDimensions.width;
        tempCanvas.height = canvasDimensions.height;
        const ctx = tempCanvas.getContext('2d'); 
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        onCanvasChange(tempCanvas.toDataURL('image/png'));
      }
    }
  };

  // setup canvas on mount and when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    //blank canvas
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // redraw existing strokes on resize
    if (strokes.length > 0) {
      redrawCanvas(strokes);
    }
    
    // send initial blank canvas to parent (using setTimeout to give some buffer time)
    setTimeout(() => {
      updateParentCanvas();
    }, 100);
  }, [canvasDimensions]);

  // always update parent whenever the component re-renders (aka at every modification)
  useEffect(() => {
    if (canvasRef.current) {
      updateParentCanvas();
    }
  });

  // get mouse/touch coordinates relative to canvas
  const getCursor = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left, //screen X minus canvas left edge
      y: e.clientY - rect.top, //screen Y minus canvas top edge
    };
  };

  // initial stroke - HANDLES THE INITIAL TAP OF THE BEGINNING STROKE aka shows us the "dot" if we tap
  const startDrawing = (e) => {
    if (disabled) return; //can't draw if time's up

    setIsDrawing(true);

    //grabbing positions
    const pos = getCursor(e); 
    setLastPoint(pos);
    
    const newStroke = {
      tool,
      color: brushColor,
      size: (tool === 'brush' ? brushSize : eraserSize),
      path: [pos], //adding our "beginning dot" to the path
    };
    setCurrentStroke(newStroke);
    
    // draw it on the canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.lineJoin = 'round'; //connect the points
    ctx.lineCap = 'round';
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'; //so apparently this is how you erase
      ctx.lineWidth = (tool === 'brush' ? brushSize : eraserSize) * 2; //slightly bigger than brush
    } else {
      //if not eraser then you are drawing
      ctx.globalCompositeOperation = 'source-over'; //lets you draw "over" anything on the current canvas
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = (tool === 'brush' ? brushSize : eraserSize);
    }
    
    //lets us see the "brush" as a circle for the first point 
    //(position being middle of the circle, brush size/2 being radius, 0 being staring angle, 2*pi being ending angle (360 degrees))
    //this makes a full circle
    ctx.arc(pos.x, pos.y, (tool === 'brush' ? brushSize : eraserSize) / 2, 0, 2 * Math.PI); 
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  // continue stroke - HANDLES FOR IF YOU DO MORE THAN JUST TAP AKA "stroke"
  const draw = (e) => {
    if (!isDrawing || disabled) return;
    const pos = getCursor(e);
    
    if (!lastPoint || !currentStroke) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // draw line from last point to current point
    ctx.beginPath(); //resets the drawing context so each stroke is different
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
    
    //"map out the stroke"
    ctx.moveTo(lastPoint.x, lastPoint.y); //move the "pen" to the last point
    ctx.lineTo(pos.x, pos.y); //define a line to our current mouse

    ctx.stroke(); //actually draws it. basically the line follows your mouse and here it updates the line
    ctx.closePath(); //close when you lift up mouse
    ctx.globalCompositeOperation = 'source-over'; //reset so you can "draw over" with your next stroke
    
    // update current stroke and last point
    setCurrentStroke((prev) => {
      if (!prev) return null;
      return { ...prev, path: [...prev.path, pos] }; //path now added our most recent point alongside old ones to update stroke
    });
    setLastPoint(pos); //update last point for next line segment
  };

  // end of stroke - on mouseup!
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPoint(null);
    
    if (currentStroke) {
      const newStrokes = [...strokes, currentStroke]; //add completed stroke to history
      setStrokes(newStrokes);
      setRedoStack([]); // clear redo stack since you have begun drawing again
      setCurrentStroke(null);
      
      // update parent with final canvas state
      setTimeout(updateParentCanvas, 50);
    }
  };

  // redrawing mechanism for undo/redo/clear 
  const redrawCanvas = (allStrokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');

    //clear everything and remake a blank canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    //redraw all the strokes in order
    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke);
    }
    
    // update parent with current canvas data
    setTimeout(updateParentCanvas, 10);
  };

  // redrawCanvas helper method to draw a single stroke
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
      // Ssngle point draws a circle
      ctx.arc(stroke.path[0].x, stroke.path[0].y, stroke.size / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // multiple points draws lines
      ctx.moveTo(stroke.path[0].x, stroke.path[0].y);
      for (let i = 1; i < stroke.path.length; i++) {
        ctx.lineTo(stroke.path[i].x, stroke.path[i].y);
      }
      ctx.stroke();
    }
    
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over'; //reset after stroke
  };

  // undo last stroke
  const handleUndo = () => {
    if (strokes.length === 0) return; //no previous strokes
    const newStrokes = [...strokes];
    const last = newStrokes.pop(); //delete the last stroke that was made
    setStrokes(newStrokes);
    setRedoStack((prev) => [last, ...prev]); //put that stroke in the redo stack
    redrawCanvas(newStrokes); //and then redraw the whole canvas
  };

  // redo last undone stroke
  const handleRedo = () => {
    if (redoStack.length === 0) return; //no previous undos
    //takes the first stroke from redoStack and assigns it to restoredStroke
    //then puts the restored stroke into our list of current strokes
    const [restored, ...rest] = redoStack; 
    const newStrokes = [...strokes, restored];
    setStrokes(newStrokes);
    setRedoStack(rest);
    redrawCanvas(newStrokes);
  };

  // clear entire canvas
  const clearCanvas = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    //once again the white canvas strikes
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setStrokes([]);
    setRedoStack([]);
    
    // update parent with cleared canvas
    setTimeout(updateParentCanvas, 10);
  };

  //submit final image to parent
  const submitDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const data = canvas.toDataURL('image/png'); //final png
      onDrawingSubmit(data);
    } catch (error) {
      console.error("Error submitting drawing:", error);
      // create fallback blank canvas there's so many of these
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasDimensions.width;
      tempCanvas.height = canvasDimensions.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      onDrawingSubmit(tempCanvas.toDataURL('image/png'));
    }
  };

  // touch handlers with scroll prevention ONLY for canvas
  //upon mousedown start stroke
  const handleTouchStart = (e) => {
    e.preventDefault(); // prevent scrolling ONLY on canvas
    const touch = e.touches[0]; //first touch point in case.. mobile users 
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  };
  //upon mouse drag continue stroke
  const handleTouchMove = (e) => {
    e.preventDefault(); // prevent scrolling ONLY on canvas
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  };
  //upon mouseup stop stroke
  const handleTouchEnd = (e) => {
    e.preventDefault(); // prevent scrolling ONLY on canvas
    stopDrawing();
  };

  // keyboard shortcuts
  useEffect(() => {
    const keyHandler = (e) => {
      if (disabled) return;
      //ctrlz is undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      //ctrly is redo
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [strokes, redoStack, disabled]);

  // determine if we should use mobile layout
  const isMobile = window.innerWidth <= 1000;

  return (
<div className="drawing-canvas-container" style={{ textAlign: 'center' }} ref={containerRef}>
  {/* Main container with canvas and side toolbars */}
  <div style={{ 
    display: 'flex', 
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'center', 
    alignItems: isMobile ? 'center' : 'stretch', 
    gap: isMobile ? '10px' : '20px', 
    marginTop: '-1vh'
  }}>
    
    {/* Left toolbar - Drawing tools */}
    <div style={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'row' : 'column', 
      gap: isMobile ? '10px' : '3vh', 
      padding: isMobile ? '10px' : '1vw', 
      paddingTop: isMobile ? '10px' : '6vh',
      backgroundColor: '#f5f5f5', 
      width: isMobile ? 'auto' : '10vw',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      justifyContent: isMobile ? 'center' : 'flex-start'
    }}>
      <div style={{ minWidth: isMobile ? '100px' : 'auto' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Tool:</label>
        <select value={tool} onChange={(e) => setTool(e.target.value)} disabled={disabled} style={{ width: '100%' }}>
          <option value="brush">Marker</option>
          <option value="eraser">Eraser</option>
        </select>
      </div>

        {tool === 'brush' && (
        <div style={{ minWidth: isMobile ? '90px' : '80px' }}>
          <label style={{ display: 'block', fontWeight: 'bold' }}>Color:</label>

          <input
            type="color"
            value={brushColor}
            onChange={(e) => {
              const color = e.target.value;
              clearTimeout(window.colorTimeout);
              window.colorTimeout = setTimeout(() => {
                setBrushColor(color);
              }, 16);
            }}
            disabled={disabled}
            style={{ width: '100%', height: '40px' }}
          />

          {/* color palette */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '4px'
          }}>
            {['#000000', '#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#800080', '#ffc0cb', '#8b4513'].map((color, index) => (
              <button
                key={index}
                onClick={() => setBrushColor(color)}
                disabled={disabled}
                style={{
                  width: '100%',
                  height: '25px', 
                  minHeight: '25px', 
                  padding: '0', 
                  margin: '0', 
                  backgroundColor: color,
                  border: brushColor === color ? '3px solid #333' : '3px solid #d6d6d6', 
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderRadius: '0' // Remove border radius for seamless connection
                }}
                title={['Black', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Brown'][index]}
              />
            ))}
          </div>
        </div>
      )}
      <div style={{ minWidth: isMobile ? '120px' : 'auto' }}>
        <label style={{ display: 'block', fontWeight: 'bold' }}>
          Size: {tool === 'brush' ? brushSize : eraserSize}px
        </label>
        <input 
          type="range"
          className="fuckinslider" 
          min="1" 
          max="100" 
          value={tool === 'brush' ? brushSize : eraserSize} 
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (tool === 'brush') setBrushSize(val);
            else setEraserSize(val);
          }} 
          disabled={disabled}
          style={{ width: '100%' }}
        />
      </div>
    </div>

    {/* Canvas in the center - THIS is where touchAction is disabled */}
    <div style={{ 
      border: '2px solid #ccc', 
      display: 'inline-block',
      touchAction: 'none' // Only prevent touch actions on the canvas container
    }}>
      <canvas
        ref={canvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          cursor: disabled ? 'not-allowed' : 'crosshair', 
          display: 'block',
          touchAction: 'none' // Prevent scrolling on the actual canvas element
        }}
      />
    </div>

    {/* Right toolbar - Action buttons */}
    <div style={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'row' : 'column', 
      gap: isMobile ? '10px' : '8vh', 
      padding: '15px', 
      paddingTop: isMobile ? '15px' : '10vh',
      paddingBottom: isMobile ? '15px' : '10vh',
      backgroundColor: '#f5f5f5', 
      width: isMobile ? 'auto' : '10vw',
      justifyContent: isMobile ? 'center' : 'flex-start'
    }}>
      <button 
        onClick={clearCanvas} 
        disabled={disabled}
        style={{ minWidth: isMobile ? '60px' : 'auto' }}
      >
        Clear
      </button>
      
      <button 
        onClick={handleUndo} 
        disabled={disabled || strokes.length === 0}
        style={{ minWidth: isMobile ? '60px' : 'auto' }}
      >
        Undo
      </button>
      
      <button 
        onClick={handleRedo} 
        disabled={disabled || redoStack.length === 0}
        style={{ minWidth: isMobile ? '60px' : 'auto' }}
      >
        Redo
      </button>
    </div>
  </div>


      {/* submit / timer */}
      <div style={{ marginTop: '0.5vh'  }}>
        <button onClick={submitDrawing} disabled={disabled}>
          Submit
        </button>

        {timeRemaining !== null && (
          <div style={{ marginTop: '1vh', color: timeRemaining <= 10 ? 'red' : 'black', fontSize: isMobile ? 'large' : 'xx-large' }}>
            Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;