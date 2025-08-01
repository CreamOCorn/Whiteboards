//index.js the backend
const http = require('http')
const { WebSocketServer } = require('ws')
const url = require('url')
const uuidv4 = require("uuid").v4 // method that generates random id's
require('dotenv').config()

const port = 8000 // just a port to pass info

const rooms = {}; // hold all rooms and their users/connections

// Generate 5-letter uppercase room code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createUniqueRoomCode() {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms[code]); // If room already exists, generate again
  return code;
}

// Create HTTP server first
const server = http.createServer((req, res) => {
  // Allow CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/create-room") {
    const roomCode = createUniqueRoomCode();

    // Initialize room with empty users and connections
     rooms[roomCode] = {
      users: {},
      connections: {},
      gameStarted: false,
      judgeUUID: null,
      currentPrompt: null, // Store current prompt
      drawings: {} // Store drawings temporarily
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ roomCode }));

   } else if (req.method === "GET" && req.url.startsWith("/check-room")) {
    const parsedUrl = url.parse(req.url, true);
    const roomCode = parsedUrl.query.code?.toUpperCase();

    if (roomCode && rooms[roomCode]) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        exists: true,
        gameStarted: rooms[roomCode].gameStarted, 
        userCount: Object.keys(rooms[roomCode].users).length
      }));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ exists: false, gameStarted: false }));
    }
    return;
  } else {
    // For any other requests, respond 404
    res.writeHead(404);
    res.end();
  }
});

// Then create WebSocketServer with the HTTP server
const wsServer = new WebSocketServer({ server });

// WebSocket connection handler
wsServer.on("connection", (connection, request) => {
  // We will send a url like ws://localhost:8000?username=Annie&room=ABCDE
  // and this will take the username Annie and room code and process them

  const parsedUrl = url.parse(request.url, true);
  const queryParams = parsedUrl.query;

  const username = queryParams.username; // Access username directly
  let uuid = queryParams.uuid;           // get uuid from frontend if any
  const roomCode = queryParams.room;     // get room code from frontend

  // fallback: if frontend didn't send uuid, generate one anyway
  if (!uuid) {
    uuid = uuidv4();
    console.log("Warning: no UUID passed from client, generated new one:", uuid);
  }

  // Require username and room to accept connection
  if (!username || !roomCode) {
    console.log(`Connection rejected: missing username or room`);
    connection.close();
    return;
  }

  const room = roomCode.toUpperCase();

  // Check if room exists
  if (!rooms[room]) {
    console.log(`Connection rejected: room ${room} does not exist`);
    connection.close();
    return;
  }

  // Check if game has already started and this is a new connection
  if (rooms[room].gameStarted) {
    console.log(`Connection rejected: game already started in room ${room}`);
    connection.close();
    return;
  }

  //check if the room is full
  if (Object.keys(rooms[room].users).length >= 9) {
    console.log(`Connection rejected: room ${room} is full`);
    connection.close();
    return;
  }

  console.log(`Joining username: ${username} with uuid ${uuid} to room ${room}`);

  // Store connection and user info in the room
  rooms[room].connections[uuid] = connection;
  
  // If user doesn't exist, create them (new user)
  if (!rooms[room].users[uuid]) {
    rooms[room].users[uuid] = {
      username: username,
      isReady: false,
      totalPoints: 0
    };
  }

  // Set judge if this is the first user
  if (!rooms[room].judgeUUID) {
    rooms[room].judgeUUID = uuid;
  }

  // Function to broadcast room users state
  function broadcastRoom() {
    const message = JSON.stringify(rooms[room].users);
    Object.values(rooms[room].connections).forEach(conn => {
      conn.send(message);
    });
  }

  // Broadcast initial state to room (only if game hasn't started)
  if (!rooms[room].gameStarted) {
    broadcastRoom();
  }

  // Listen to messages from client
  connection.on("message", async message => {
    const parsedMsg = JSON.parse(message);
    console.log("Received WebSocket message:", parsedMsg);
    const user = rooms[room].users[uuid];
    if (!user) return;

    let shouldBroadcast = false; // Flag to control broadcasting

    switch (parsedMsg.type) {
      case "ready":
        user.isReady = true;
        shouldBroadcast = true;
        console.log(`${user.username} is now READY in room ${room}`);
        break;
      case "unready":
        user.isReady = false;
        shouldBroadcast = true;
        console.log(`${user.username} is now UNREADY in room ${room}`);
        break;
      case "countdown_finished": {
        // Only let the judge trigger this
        if (rooms[room]?.countdownStarted) {
          //do nothing if it was already sent
          return;
        }

        const countdownStartTime = Date.now();
        const roomTimeLimit = rooms[room].timeLimit || 60;

        // Mark as sent so we don't rebroadcast again
        rooms[room].countdownStarted = true;

        const countdownFinishedPayload = {
          type: "countdown_finished",
          timeLimit: roomTimeLimit,
          startTime: countdownStartTime
        };

        console.log("✅ Sending countdown_finished with:", countdownFinishedPayload);

        const msg = JSON.stringify(countdownFinishedPayload);
        Object.values(rooms[room].connections).forEach(conn => {
          if (conn.readyState === 1) {
            conn.send(msg);
          }
        });

        return;
      }
      case "start_round":
        const judgeUUID = rooms[room].judgeUUID;
        if (uuid !== judgeUUID) return;

        // Mark game as started
        rooms[room].gameStarted = true;

        const payload = JSON.stringify({
          type: "round_started",
          users: rooms[room].users //list of everyone int he room
        });

        Object.values(rooms[room].connections).forEach(conn => conn.send(payload));
        console.log(`Game started in room ${room}`);
        return; // Exit early, no need to broadcast
      /////// stuff for the game round
      case "send_prompt": {
        const { prompt, timeLimit } = parsedMsg;

        rooms[room].prompt = prompt;
        rooms[room].timeLimit = timeLimit;
        rooms[room].countdownStarted = false; // reset

        const message = JSON.stringify({
          type: "prompt_sent",
          prompt,
          timeLimit
        });

        Object.values(rooms[room].connections).forEach(conn => {
          if (conn.readyState === 1) {
            conn.send(message);
          }
        });

        return;
      }
      case "submit_drawing":
        // Handle when players submit their drawings
        user.drawingData = parsedMsg.drawingData;
        user.submittedAt = Date.now();
        user.isDrawingSubmitted = true;
        
        // Store in room temporarily for judge review
        rooms[room].drawings[uuid] = {
          username: user.username,
          drawingData: parsedMsg.drawingData,
          submittedAt: new Date().toLocaleTimeString(),
          drawingId: null // No longer using MongoDB ID
        };

        // Broadcast to all clients (especially judge) that this player submitted
        const drawingSubmittedPayload = JSON.stringify({
          type: "player_drawing_submitted",
          playerId: uuid,
          username: user.username,
          submittedAt: new Date().toLocaleTimeString(),
          isAutoSubmit: parsedMsg.isAutoSubmit || false
        });

        Object.values(rooms[room].connections).forEach(conn => {
          if (conn.readyState === 1) {
            conn.send(drawingSubmittedPayload);
          }
        });
        
        console.log(`${user.username} submitted drawing in room ${room}`);
        return;

      case "get_drawings":
        // everyone see all drawings in review stage
        const drawingsPayload = JSON.stringify({
          type: "drawings_for_review",
          drawings: rooms[room].drawings,
          prompt: rooms[room].prompt
        });
        Object.values(rooms[room].connections).forEach(conn => {
          if (conn.readyState === 1) {
            conn.send(drawingsPayload);
          }
        });
        return;
      case "end_round":
        // Only judge can end rounds
          const endJudgeUUID = rooms[room].judgeUUID;
          if (uuid !== endJudgeUUID) return;

          // Award points if provided
          if (parsedMsg.pointsToAward) {
            Object.entries(parsedMsg.pointsToAward).forEach(([playerId, points]) => {
              if (rooms[room].users[playerId]) {
                rooms[room].users[playerId].totalPoints += points;
                console.log(`Awarded ${points} points to ${rooms[room].users[playerId].username}`);
              }
            });
          }

          const endPayload = JSON.stringify({
            type: "round_ended",
            results: parsedMsg.results || [],
            updatedUsers: rooms[room].users // Send updated user data with points
          });

          Object.values(rooms[room].connections).forEach(conn => conn.send(endPayload));
          return;
      case "end_game":
          const endGamePayload = JSON.stringify({ type: "game_ended" });
          Object.values(rooms[room].connections).forEach(conn => {
            if (conn.readyState === 1) conn.send(endGamePayload);
          });
          return;
      case "reset_round":
          // Reset prompt, drawings, countdown, etc.
          rooms[room].prompt = null;
          rooms[room].drawings = {};
          rooms[room].countdownStarted = false;

          // Tell everyone to reset their round state
          const resetPayload = JSON.stringify({ type: "reset_round" });
          Object.values(rooms[room].connections).forEach(conn => {
            if (conn.readyState === 1) conn.send(resetPayload);
          });
          return;
    }

    // Only broadcast if the flag is set
    if (shouldBroadcast) {
      broadcastRoom();
    }
  });


  // Cleanup on disconnect
connection.on("close", () => {
    console.log(`${username} disconnected from room ${room}`);

    // Exit early if the room no longer exists for some reason
    if (!rooms[room]) {
        return;
    }

    const isJudge = uuid === rooms[room].judgeUUID;

    // --- Step 1: Remove the disconnected user immediately ---
    // This is the most crucial change. We must update the room's state
    // before we start checking for conditions.
    delete rooms[room].users[uuid];
    delete rooms[room].connections[uuid];
    delete rooms[room].drawings[uuid];

    // --- Step 2: Handle the judge's disconnection first ---
    // If the judge was the one who just left, the game is over for everyone.
    if (isJudge) {
        console.log(`Judge disconnected from room ${room}. Kicking all remaining players.`);
        const kickMessage = JSON.stringify({
            type: "judge_disconnected",
            message: "The judge has left the game. Returning to home."
        });
        
        // Loop through the remaining connections and send the kick message
        Object.values(rooms[room].connections).forEach(conn => {
            if (conn.readyState === conn.OPEN) {
                conn.send(kickMessage);
                conn.close(); // Close their connection too
            }
        });
        
        delete rooms[room];
        return; // Stop execution here
    }

    // --- Step 3: Handle player disconnection scenarios ---
    const nonJudgeUsers = Object.keys(rooms[room].users).filter(id => id !== rooms[room].judgeUUID);
    const nonJudgeConnections = Object.values(rooms[room].connections).filter(conn => conn.uuid !== rooms[room].judgeUUID);

    // If all players (non-judge) have left, tell the judge to disconnect.
    if (nonJudgeUsers.length === 0 && rooms[room].gameStarted) {
        console.log(`All players have left room ${room}. Notifying judge to disconnect.`);
        
        const allPlayersLeftMessage = JSON.stringify({ type: "all_players_left" });
        
        // Send a message to the judge's connection, if it exists
        const judgeConnection = rooms[room].connections[rooms[room].judgeUUID];
        if (judgeConnection && judgeConnection.readyState === judgeConnection.OPEN) {
            judgeConnection.send(allPlayersLeftMessage);
            judgeConnection.close(); // Disconnect the judge too
        }
        
        // Clean up the room since it's empty
        delete rooms[room];
        return; // Stop execution here
    }

    // Otherwise, just notify the remaining players about the disconnection
    if (rooms[room].gameStarted) {
        const disconnectMessage = JSON.stringify({
            type: "player_disconnected",
            playerId: uuid
        });
        
        // Send the message to all remaining non-judge players
        nonJudgeConnections.forEach(conn => {
            if (conn.readyState === conn.OPEN) {
                conn.send(disconnectMessage);
            }
        });
    }
});
  });

// Start the server listening 
server.listen(port, () => {
  console.log(`Websocket server is running on port ${port}`)
});