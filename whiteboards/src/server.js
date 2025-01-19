// Imports 
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Room = require("./Roomies");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();


// Initialize Express App
const app = express();
const server = http.createServer(app);
const io = new Server(server); // WebSocket setup

// Start the Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB 
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
    console.log("Connected to MongoDB successfully!");
})
.catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});

//Ok now this is where we start doing actual things

/**For reference:
GET: Retrieve data (e.g., get a webpage or fetch user info).
POST: Send data to the server (e.g., create a new user or submit a form).
PUT: Update existing data (e.g., change user info).
DELETE: Delete data (e.g., remove a user). **/


// Define a Route
app.get("/", (req, res) => {
  res.send("Hello, Express!");
});


// Create a Room
app.post("/api/rooms", async (req, res) => {
    const { roomCode } = req.body;

    try {
      const newRoom = new Room({ roomCode, maxPlayers: 9, players: [] });
      await newRoom.save();
  
      res.status(201).json(newRoom);
    } catch (err) {
      res.status(400).json({ error: "Room creation failed" });
    }
  });
  
  // WebSocket Handling
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
  
    // Join a Room
    socket.on("joinRoom", async ({ roomCode, playerName }) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) {
          socket.emit("error", "Room not found");
          return;
        }
  
        if (room.players.length >= room.maxPlayers) {
          socket.emit("error", "Room is full");
          return;
        }
  
        // Add player to the room
        room.players.push({ name: playerName, id: socket.id });
        await room.save();
  
        // Join the WebSocket room
        socket.join(roomCode);
  
        // Notify others in the room
        io.to(roomCode).emit("playerJoined", { playerName, players: room.players });
        console.log(`${playerName} joined room ${roomCode}`);
      } catch (err) {
        console.error(err);
        socket.emit("error", "Failed to join room");
      }
    });
  
    // Handle Disconnect
    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);
  
      // Remove the player from any room they were part of
      const room = await Room.findOne({ "players.id": socket.id });
      if (room) {
        room.players = room.players.filter((p) => p.id !== socket.id);
        await room.save();
  
        // Notify others in the room
        io.to(room.roomCode).emit("playerLeft", { players: room.players });
      }
    });
  });
  
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });