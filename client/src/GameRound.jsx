// GameRound.jsx
import { useLocation, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { useWebSocketContext } from './components/WebSocketContext';
import DrawingCanvas from './components/DrawingCanvas.jsx';
import logo from "./assets/logo.svg";
import "./components/Login.css";
import "./Roomies.css";


export default function GameRound() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { sendJsonMessage, lastJsonMessage, isConnected } = useWebSocketContext();

  // Use state data, not WebSocket data for user info
  const { username, uuid, room, users } = state || {};
  
  // prompt sending
  const [gameData, setGameData] = useState(null); //why is this unused
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
  //awards
  const [selectedPlayers, setSelectedPlayers] = useState({}); // Track which players are selected for scoring
  const [playerPoints, setPlayerPoints] = useState({}); // Track points to award

  useEffect(() => {
    console.log("currentCanvasData updated:", currentCanvasData ? `Length: ${currentCanvasData.length}` : "null");
  }, [currentCanvasData]);

  const judgeUUID = users ? Object.keys(users)[0] : null;
  const isJudge = uuid === judgeUUID;

  // Check if all players have submitted
  const allPlayersSubmitted = Object.keys(playerStatuses).length > 0 && Object.values(playerStatuses).every(status => status.ready);

    
    // Handle disconnection for all users
    let alertShown = false; //avoid double alerts
    useEffect(() => {
      if (!isConnected && !alertShown) {
        alertShown = true;
        alert("You have disconnected from this game");
        navigate("/");
      }
    }, [isConnected, navigate]);

    //kick everyone if judge left
  useEffect(() => {
    if (lastJsonMessage?.type === "judge_disconnected") {
      // Show alert immediately, then navigate
      alert("The judge has left the game. Returning home.");
      navigate("/");
    }
  }, [lastJsonMessage]);

  // Handle when all players leave
  useEffect(() => {
    if (lastJsonMessage?.type === "all_players_left") {
      alert("All players have left the room. Returning home.");
      navigate("/");
    }
  }, [lastJsonMessage]);

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
        setGameData(lastJsonMessage);
        setGamePhase("finished");  
        setTimerStarted(false);
        setTimeRemaining(null);

        // Update users with new point values
        if (lastJsonMessage.updatedUsers) {
          Object.entries(lastJsonMessage.updatedUsers).forEach(([id, userData]) => {
            if (users[id]) {
              users[id].totalPoints = userData.totalPoints;
            }
          });
        }
        return;
      case "player_disconnected":
        // Remove disconnected player from status list
        setPlayerStatuses(prev => {
          const newStatuses = { ...prev };
          delete newStatuses[lastJsonMessage.playerId];
          return newStatuses;
        });
        break;
      case "reset_round":
        setPrompt("");
        setPromptSubmitted(false);
        setDrawingSubmitted(false);
        setSubmittedDrawingData(null);
        setPlayerStatuses({});
        setPlayerPoints({});
        setSelectedPlayers({});
        setReceivedPrompt(null);
        setReviewDrawings(null);
        setGamePhase("waiting");
        return;
      case "game_ended":
        setGamePhase("podium");
        return;
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



  // Initialize player statuses when prompt is sent
  useEffect(() => {
    if (receivedPrompt && users) {
      const initialStatuses = {};
      Object.entries(users).forEach(([userId, userData]) => {
        if (userId !== judgeUUID) { // Don't include the judge
          initialStatuses[userId] = {
            username: userData.username,
            ready: false,
            submittedAt: null
          };
        }
      });
      setPlayerStatuses(initialStatuses);
    }
  }, [receivedPrompt, users, judgeUUID]);

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
        {playerStatuses && Object.entries(playerStatuses).filter(([userId]) => userId !== judgeUUID).map(([playerId, status]) => {
          const drawingEntry = reviewDrawings?.drawings?.[playerId];
          const totalPoints = users?.[playerId]?.totalPoints || 0; // Show current total points

          return (
            <div key={playerId} style={{
              border: '2px solid #ccc',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
              backgroundColor: 'white'
            }}>
              <h4>{drawingEntry?.username || status.username || 'Unknown'} - {totalPoints}pts</h4>
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
                //if null canvas submitted, we make our own!
                <div style={{
                  aspectRatio: '4 / 3',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff'
                }}/>
              )}
              
              {/* Judge scoring controls */}
              {isJudge && (
                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <input
                      type="checkbox"
                      checked={selectedPlayers[playerId] || false}
                      onChange={(e) => {
                        setSelectedPlayers(prev => ({
                          ...prev,
                          [playerId]: e.target.checked
                        }));
                        if (!e.target.checked) {
                          setPlayerPoints(prev => {
                            const newPoints = { ...prev };
                            delete newPoints[playerId];
                            return newPoints;
                          });
                        }
                      }}
                      style={{
                        width: '1em',
                        height: '1em',
                        accentColor: '#000000'
                      }}
                    />
                    Award Points
                  </label>
                  
                  {selectedPlayers[playerId] && (
                    <input
                      type="number"
                      min="0"
                      max="10"
                      placeholder="# of Points"
                      value={playerPoints[playerId] || ''}
                      onChange={(e) => {
                        setPlayerPoints(prev => ({
                          ...prev,
                          [playerId]: parseInt(e.target.value) || 0
                        }));
                      }}
                      style={{
                        marginTop: '5px',
                        padding: '5px',
                        width: '8em',
                        textAlign: 'center'
                      }}
                    />
                  )}
                </div>
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
              sendJsonMessage({
                type: "end_round",
                pointsToAward: playerPoints, // Send the points to award
                results: Object.entries(reviewDrawings.drawings).map(([playerId, data]) => ({
                  playerId,
                  username: data.username,
                  drawing: data.drawingData
                }))
              });
            }}
            style={{
              padding: '1vh 2vw',
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

  //scoreboard screen
  if (gamePhase === 'finished') {
    return (
      <>
      <div className="Top">
        <img src={logo} className="Logo"/>
        <p className="Code">Code: {room || "N/A"}</p>
      </div>
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h3>Scoreboard</h3>

      <div style={{ maxWidth: '75vw', margin: '0 auto', textAlign: 'left' }}>
        {Object.entries(users).filter(([id]) => id !== judgeUUID)
          .sort(([, a], [, b]) => (b.totalPoints || 0) - (a.totalPoints || 0))
          .map(([id, user], index) => (
            <div key={id} style={{
              padding: '10px',
              backgroundColor: '#dedede',
              marginBottom: '8px',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: uuid === id ? 'bold' : 'normal'
            }}>
              <span>{index + 1}. {user.username || '[Empty Player]'}</span>
              <span>{user.totalPoints || 0} pts</span>
            </div>
          ))}
      </div>

      {isJudge && (
        <>
        <div className="Spacer"/>
        <div style={{ maxWidth: '40vw', display: "flex", justifyContent:"center", marginInline:"auto", gap: '2vw' }}>
          <button
           onClick={() => {
            sendJsonMessage({ type: "reset_round" });
          }}
          >
            Next Round
          </button>

          <button
            onClick={() => {
              sendJsonMessage({ type: "end_game" });
            }}
            style={{ backgroundColor: 'black', color: 'white' }}
          >
              End Game
          </button>
        </div>
        </>
      )}

      <p className = "loading" style={{ fontSize: '18px', color: '#666' }}>Waiting for judge</p>
    </div>
    </>
    );
  }

  //ending screen
  if (gamePhase === 'podium') {
  return (
    <>
      <div className="Top">
        <img src={logo} className="Logo"/>
        <p className="Code">Code: {room || "N/A"}</p>
      </div>
{/* /////////////////////////////// */}
        <div style={{ marginTop: "3rem", textAlign: "center" }}>
      <h2> Final Results</h2>

      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: "30px",
        marginTop: "2rem"
      }}>
        {[1, 0, 2].map((rankIndex, i) => {
          const sorted = Object.entries(users)
            .filter(([id]) => id !== judgeUUID)
            .sort(([, a], [, b]) => (b.totalPoints || 0) - (a.totalPoints || 0));

          const entry = sorted[rankIndex];
          if (!entry) return <div key={i} style={{ width: "60vw" }} />;

          const heights = [160, 240, 100]; // 2nd, 1st, 3rd
          const height = heights[rankIndex];

          return (
            <div key={entry[0]} style={{ width: "60vw", textAlign: "center" }}>
              {/* Score + Name box above */}
              <div style={{
                backgroundColor: "white",
                borderRadius: "6px 6px 0 0",
                padding: "6px 4px",
                fontSize: "0.9rem",
                marginBottom: "4px"
              }}>
                <div className="RoleLabel">
                  {entry[1].totalPoints} pts
                </div>
                {/* i want it to have a black outline and perfeclty fit*/}
                <div className="NameBoxPlayer">
                  {entry[1].username}
                </div>
              </div>

              {/* Podium block */}
              <div style={{
                backgroundColor: "black",
                height: `${height}px`,
                color: "white",
                fontSize: "2rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                paddingBottom: "0.5rem",
              }}>
                {rankIndex + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    {/* /////////////////////////////// */}
      <div className="Spacer"/>
      <button onClick={() => navigate('/')}
          style={{ 
            padding: '1vh 2vw',
          }}>
        Leave
      </button>
    </>
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
              ) : null}
              <div style={{ 
                    display:"flex",
                    marginInline:"auto",
                    justifyContent: "center",
                    alignContent:"center", }}>
                {Object.entries(playerStatuses).map(([playerId, status]) => (
                  <div key={playerId} style={{ 
                    width: "80vw",
                    padding: '0.5rem',
                    margin: '0.5rem 0',
                    border: "1px solid #7e7e7e",
                  }}>
                    <strong>{status.username}</strong>: {status.ready ? `Drawing Submitted` : 'Still Drawing...'}
                  </div>
                ))}
              </div>
              
              {/* Review button - only enabled when all players submitted */}
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={handleReviewDrawings}
                  disabled={!allPlayersSubmitted}
                  style={{
                    padding: '1vh 2vw',
                    backgroundColor: allPlayersSubmitted ? "#000000" : "#7e7e7e",
                    cursor: allPlayersSubmitted ? 'pointer' : 'not-allowed',
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
            <p>Draw: {receivedPrompt?.prompt}</p>
            
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
                <h3>Drawing Submitted!</h3>
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
        ) : (
          <p className="loading">Waiting for the judge to send the drawing prompt</p>
        )}
      </div>
    );
  } 