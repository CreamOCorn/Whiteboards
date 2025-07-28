// GameRound.jsx
import { useLocation, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { useWebSocketContext } from './components/WebSocketContext';
import DrawingCanvas from './components/DrawingCanvas.jsx';
import logo from "./assets/logo.svg";

//TODO syncing the times, ADDING TIME TO CURRENT TIMER

export default function GameRound() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { sendJsonMessage, lastJsonMessage, isConnected } = useWebSocketContext();

  // Use state data, not WebSocket data for user info
  const { username, uuid, room, users } = state || {};
  
  // prompt sending
  const [gameData, setGameData] = useState(null);
  const [receivedPrompt, setReceivedPrompt] = useState(null); //for the users
  const [promptSubmitted, setPromptSubmitted] = useState(false); //for the judge
  const [timeRemaining, setTimeRemaining] = useState(null); // Timer for players
  const [timerStarted, setTimerStarted] = useState(false); // Track if timer has started
  //drawing
  const [gamePhase, setGamePhase] = useState('waiting'); // 'waiting', 'countdown', 'playing', 'finished'
  const [countdownTime, setCountdownTime] = useState(3); // 3 second countdown to drawing
  const [drawingSubmitted, setDrawingSubmitted] = useState(false); 
  const [submittedDrawingData, setSubmittedDrawingData] = useState(null); 
  const [reviewDrawings, setReviewDrawings] = useState(null); 
  const [playerStatuses, setPlayerStatuses] = useState({}); // Track player ready status
  const [prompt, setPrompt] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);
  const [currentCanvasData, setCurrentCanvasData] = useState(null); //current canvas

  // ADD THIS RIGHT HERE:
  useEffect(() => {
    console.log("currentCanvasData updated:", currentCanvasData ? `Length: ${currentCanvasData.length}` : "null");
  }, [currentCanvasData]);

  const judgeUUID = users ? Object.keys(users)[0] : null;
  const isJudge = uuid === judgeUUID;

  // Check if all players have submitted
  const allPlayersSubmitted = Object.keys(playerStatuses).length > 0 && Object.values(playerStatuses).every(status => status.ready);

  // Handle disconnection for all users
  useEffect(() => {
    if (!isConnected) {
      alert("You have disconnected from this game");
      navigate("/");
    }
  }, [isConnected, navigate]);

  // Listen for game-related messages from the WebSocket
  useEffect(() => {
    if (!lastJsonMessage || !lastJsonMessage.type) return;

    // Only handle game-specific message types
    switch (lastJsonMessage.type) {
      case "prompt_sent":
        // Set the received prompt data first
        const promptData = {
          prompt: lastJsonMessage.prompt,
          timeLimit: lastJsonMessage.timeLimit
        };
        setReceivedPrompt(promptData);
        
        // Then set game phase to countdown
        setGamePhase('countdown');
        setCountdownTime(3); // Reset countdown to 3
        console.log("Prompt received:", lastJsonMessage.prompt, "Time limit:", lastJsonMessage.timeLimit);
        break;
      case "countdown_finished":
        // Start the actual game timer using shared start time
        setGamePhase('playing');
        
        setReceivedPrompt(prev => ({
          ...prev,
          startTime: lastJsonMessage.startTime, 
          timeLimit: lastJsonMessage.timeLimit,
        }));

        setTimerStarted(true);
        break;
      case "player_drawing_submitted":
        // Update player status for judge
        console.log("Player drawing submmitted:", lastJsonMessage);
        setPlayerStatuses(prev => {
          const newStatuses = { ...prev };
          // Make sure we're updating the correct player
          newStatuses[lastJsonMessage.playerId] = {
            ...(newStatuses[lastJsonMessage.playerId] || {}),
            username: lastJsonMessage.username,
            ready: true,
            submittedAt: lastJsonMessage.submittedAt
          };
          console.log("Updated player statuses:", newStatuses);
          return newStatuses;
        });
        break;
      case "drawings_for_review":
        // choose which drawings win
        setReviewDrawings(lastJsonMessage);
        setGamePhase('review');
        setTimerStarted(false);
        break;
      case "round_ended":
        //close everything when your'e done
        console.log("Round ended");
        setGameData(lastJsonMessage);
        setGamePhase('finished');  
        setTimerStarted(false);
        setTimeRemaining(null);
        break;
        
      default:
        // Ignore if it's anythign else
        break;
    }
  }, [lastJsonMessage]);

  //PROMPT SUBMITTING FOR THE JUDGE
  const handleSubmitPrompt = () => {
    if (!prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (timeLimit < 5 || timeLimit > 3600) {
    alert("Time limit must be between 5 and 3600 seconds");
    return;
    }

    // Send the prompt to all players via WebSocket
    sendJsonMessage({
      type: "send_prompt",
      prompt: prompt.trim(),
      timeLimit: timeLimit
    });

    setPromptSubmitted(true); 
    
    // For the judge, also set the received prompt data so countdown shows correctly
    setReceivedPrompt({
      prompt: prompt.trim(),
      timeLimit: timeLimit
    });
    
    setGamePhase('countdown');
    setCountdownTime(3); //3, 2, 1
    console.log("Prompt Submitted:", { prompt, timeLimit });
  };

  //kick everyone if judge left
  useEffect(() => {
    if (lastJsonMessage?.type === "judge_disconnected") {
      // Show alert immediately, then navigate
      alert("The judge left the game. Returning to home.");
      navigate("/");
    }
  }, [lastJsonMessage]);

  // Initialize player statuses when prompt is sent
  useEffect(() => {
    if (isJudge && promptSubmitted && users) {
      const initialStatuses = {};
      Object.entries(users).forEach(([userId, userData]) => {
        if (userId !== uuid) { // Don't include the judge
          initialStatuses[userId] = {
            username: userData.username,
            ready: false,
            submittedAt: null
          };
        }
      });
      setPlayerStatuses(initialStatuses);
    }
  }, [isJudge, promptSubmitted, users, uuid]);

  // Countdown timer effect (3-2-1)
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdownTime <= 0) return;

    const timer = setTimeout(() => {
      setCountdownTime(prev => {
        if (prev <= 1) {
          // Countdown finished, start the game
          setGamePhase('playing');
          setTimeRemaining(receivedPrompt?.timeLimit || 60);
          setTimerStarted(true);
          
          // Send message to all clients that countdown is finished
          sendJsonMessage({
            type: "countdown_finished"
          });
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [gamePhase, countdownTime, receivedPrompt, sendJsonMessage]);

 // Timer countdown during drawing
  useEffect(() => {
    if (!timerStarted || !receivedPrompt?.startTime || !receivedPrompt?.timeLimit) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - receivedPrompt.startTime) / 1000);
      const remaining = receivedPrompt.timeLimit - elapsed;

      if (remaining <= 0) {
        setTimeRemaining(0);
        setTimerStarted(false);

        // Auto-submit drawing if player hasn't submitted yet
        if (!drawingSubmitted && !isJudge) {
          console.log("Auto-submitting player:", username);

          setTimeout(() => {
            let canvas = document.querySelector('canvas') 
              || document.querySelector('.drawing-canvas-container canvas') 
              || document.querySelector('[style*="cursor"]');

            console.log("Canvas found:", !!canvas);

            if (canvas) {
              canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              setTimeout(() => {
                const directCanvasData = canvas.toDataURL('image/png');
                console.log("Auto-submitting player:", username, "Canvas data length:", directCanvasData.length);
                handleSubmitDrawing(directCanvasData, true);
              }, 50);
            } else {
              console.log("Still no canvas found, falling back to currentCanvasData");

              const fallbackData = currentCanvasData || (() => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 800;
                tempCanvas.height = 600;
                const ctx = tempCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                return tempCanvas.toDataURL('image/png');
              })();

              handleSubmitDrawing(fallbackData, true);
            }
          }, 50);
        } else {
          console.log("Skipping auto-submit for:", username, "- already submitted or is judge");
        }

        // Judge auto-requests review
        if (isJudge) {
          setTimeout(() => {
            handleReviewDrawings();
          }, 1000);
        }

        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerStarted, receivedPrompt?.startTime, receivedPrompt?.timeLimit, drawingSubmitted, isJudge]);


  // Handle drawing submission
  const handleSubmitDrawing = (drawingData, isAutoSubmit = false) => {
    let finalDrawingData = drawingData;

    // If auto-submitting and no data, use fallback
    if (isAutoSubmit && !finalDrawingData) {
      console.log("Auto-submit - currentCanvasData:", currentCanvasData ? "exists" : "null");
      finalDrawingData = currentCanvasData;
    }

    // Final fallback: blank canvas
    if (!finalDrawingData) {
      console.log("No drawing data available, creating blank canvas");
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      finalDrawingData = canvas.toDataURL('image/png');
    }

    sendJsonMessage({
      type: "submit_drawing",
      drawingData: finalDrawingData,
      playerId: uuid,
      username: username,
      isAutoSubmit: isAutoSubmit
    });

    setDrawingSubmitted(true);
    setSubmittedDrawingData(finalDrawingData);
    console.log("Drawing submitted", isAutoSubmit ? "(auto)" : "(manual)", "Data length:", finalDrawingData?.length);
  };


  // Format time display (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Judge requests to review all drawings
  const handleReviewDrawings = () => {
    sendJsonMessage({
      type: "get_drawings"
    });
  };

  // Countdown screen (shown to everyone)
  if (gamePhase === 'countdown') {
    return (
      <div className="GameRound Countdown">
        <div className="Top">
          <img src={logo} className="Logo"/>
          <p className="Code">Code: {room || "N/A"}</p>
        </div>
        
        <div style={{ textAlign: 'center', fontSize: '2rem', marginTop: '2rem' }}>
          <h2>Prompt: {receivedPrompt?.prompt}</h2>
          <p>Players have {receivedPrompt?.timeLimit} seconds</p>
          <div style={{ fontSize: '4rem', margin: '2rem 0' }}>
            {countdownTime > 0 ? countdownTime : 'GO!'}
          </div>
        </div>
      </div>
    );
  }

  // Review screen (shown to everyone - both judge and players)
  if (gamePhase === 'review') {
    return (
      <div className="GameRound Review">
        <div className="Top">
          <img src={logo} className="Logo"/>
          <p className="Code">Code: {room || "N/A"}</p>
        </div>

        <h2>Review Drawings</h2>
        <p><strong>Prompt:</strong> {reviewDrawings?.prompt}</p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px',
          margin: '20px 0'
        }}>
          {playerStatuses && Object.entries(playerStatuses).map(([playerId, status]) => {
            const drawingEntry = reviewDrawings?.drawings?.[playerId];

            return (
              <div key={playerId} style={{
                border: '2px solid #ccc',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center',
                backgroundColor: 'white'
              }}>
                <h4>{drawingEntry?.username || status.username || 'Unknown'}</h4>
                {drawingEntry?.drawingData ? (
                  <>
                    <img 
                      src={drawingEntry.drawingData} 
                      alt={`${drawingEntry.username}'s drawing`}
                      style={{ 
                        maxWidth: '100%', 
                        height: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                  </>
                ) : (
                  //MY STROKE OF GEINUS WHICH IS IS ALL ELSE FAILS, FEIGN A BLANK CANVAS
                  <div style={{
                    aspectRatio: '4 / 3',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff'
                  }}/>
                )}
              </div>
            );
          })}
        </div>

        {/* Only judge can end the round */}
        {isJudge && (
          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button
              onClick={() => {
                // You can add scoring/voting logic here
                sendJsonMessage({
                  type: "end_round",
                  results: Object.entries(reviewDrawings.drawings).map(([playerId, data]) => ({
                    playerId,
                    username: data.username,
                    drawing: data.drawingData
                  }))
                });
              }}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              End Round
            </button>
          </div>
        )}

        {/* Players see a message that they're waiting for judge */}
        {!isJudge && (
          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <p style={{ fontSize: '18px', color: '#666' }}>
              Waiting for the judge to end the round...
            </p>
          </div>
        )}
      </div>
    );
  }

  if (isJudge) {
      return (
        <div className="GameRound Judge">
          <div className="Top">
            <img src={logo} className="Logo"/>
            <p className="Code">Code: {room || "N/A"}</p>
          </div>

          {/* Judge's initial prompt setup */}
          {!promptSubmitted ? (
            <>
              <label>Prompt: </label>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Type a prompt"
                disabled={!isConnected}
              />
              <div className="Spacer"></div>
              <label>Time (seconds): </label>
              <input
                type="number"
                value={timeLimit}
                min="5"
                max="3600"
                step="1"
                pattern="[0-9]"
                onKeyDown={(e) =>(e.key === "." || e.key === ",") && e.preventDefault()}
                onInput={(e) => {e.target.value = Math.abs(e.target.value);}}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                disabled={!isConnected}
              />

              <div className="Spacer"></div>

              <button
                onClick={handleSubmitPrompt}
                disabled={!isConnected || !prompt.trim()}
              >
                Submit
              </button>
            </>
          ) : gamePhase === 'playing' ? (
            /* Judge's view during drawing - showing player statuses */
            <>
              <h2>Prompt: {prompt}</h2>
              {timerStarted && timeRemaining !== null ? (
                <div style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
                  Time Remaining: {formatTime(timeRemaining)}
                </div>
              ) : timeRemaining === 0 ? (
                <div style={{ fontSize: '1.5rem', color: 'red' }}>
                  Time's Up!
                </div>
              ) : null}
              
              <h3>Player Drawing Status:</h3>
              <div style={{ margin: '1rem 0' }}>
                {Object.entries(playerStatuses).map(([playerId, status]) => (
                  <div key={playerId} style={{ 
                    padding: '0.5rem',
                    margin: '0.5rem 0',
                    backgroundColor: status.ready ? '#d4edda' : '#f8d7da',
                    borderRadius: '4px'
                  }}>
                    <strong>{status.username}</strong>: {status.ready ? `🎨 Drawing Submitted at ${status.submittedAt}` : '✏️ Still Drawing...'}
                  </div>
                ))}
              </div>
              
              {/* Review button - only enabled when all players submitted */}
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={handleReviewDrawings}
                  disabled={!allPlayersSubmitted}
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: allPlayersSubmitted ? '#007bff' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: allPlayersSubmitted ? 'pointer' : 'not-allowed',
                    opacity: allPlayersSubmitted ? 1 : 0.6
                  }}
                >
                  Review All Drawings
                </button>
                {!allPlayersSubmitted && (
                  <p style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    Waiting for all players to submit their drawings...
                  </p>
                )}
              </div>
            </>
          ) : gamePhase === 'finished' ? (
            <>
              <h2>Round Finished!</h2>
              <p>You can start a new round or end the game.</p>
              {/* Add logic here to start next round */}
            </>
          ) : (
            <>
              <h2>Drawing Prompt Sent!</h2>
              <p><strong>Prompt:</strong> {prompt}</p>
              <p className="loading">Starting countdown...</p>
            </>
          )}
        </div>
      );
    }

    // Player view
    return (
      <div className="GameRound Player">
        <div className="Top">
          <img src={logo} className="Logo"/>
          <p className="Code">Code: {room || "N/A"}</p>
        </div>

        {!isConnected ? (
          <p className="loading">Game Not Found</p>
        ) : gamePhase === 'playing' ? (
          /* Player's drawing interface */
          <div>
            <h2>Draw: {receivedPrompt?.prompt}</h2>
            
            {!drawingSubmitted ? (
              <>
                <DrawingCanvas 
                  onDrawingSubmit={handleSubmitDrawing}
                  onCanvasChange={setCurrentCanvasData}
                  disabled={timeRemaining === 0}
                  timeRemaining={timeRemaining}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <h3>🎨 Drawing Submitted!</h3>
                {submittedDrawingData && (
                  <div style={{ margin: '20px 0' }}>
                    <p>Your drawing:</p>
                    <img 
                      src={submittedDrawingData} 
                      alt="Your submitted drawing"
                      style={{ 
                        maxWidth: '400px',
                        height: 'auto',
                        border: '2px solid #ccc',
                        borderRadius: '8px'
                      }}
                    />
                  </div>
                )}
                <p>Waiting for other players to finish drawing...</p>
              </div>
            )}
          </div>
        ) : gamePhase === 'finished' ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <h2>Round Finished!</h2>
            <p>Waiting for the judge to review drawings...</p>
          </div>
        ) : (
          <p className="loading">Waiting for the judge to send the drawing prompt</p>
        )}
      </div>
    );
  } 