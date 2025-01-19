import React from "react";
import { useParams, useLocation } from "react-router-dom";


function Roomies() {
    const { roomCode } = useParams();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const role = queryParams.get("role"); // "judge" or null (player)
  
    return (
      <div>
        <h1>Room Code: {roomCode}</h1> 
        {role === "judge" ? (
          <button>Start</button> // Judge sees "Start"
        ) : (
          <button disabled>Waiting for host to start</button> // Players see this
        )}
      </div>
    );
  }
  
  //connecting to backend
  const mongoose = require("mongoose");

  const RoomSchema = new mongoose.Schema({
    roomCode: { type: String, required: true, unique: true }, // Unique code for the room
    players: [{ name: String, id: String }], // Players in the room
    maxPlayers: { type: Number, default: 9, immutable: true } // I am not allowing more than 9 ppl fuk dat
  });

  module.exports = mongoose.model("Room", RoomSchema);
  export default Roomies;