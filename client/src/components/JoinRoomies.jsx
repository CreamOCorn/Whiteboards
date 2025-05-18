//JoinRoomies.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.svg";
import "./Login.css";

function JoinRoomies({username, onJoin}) {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleJoinRoom = (event) => {
    event.preventDefault(); // Prevent default form submission
    if (roomCode) {
        onJoin(roomCode); // Pass the entered room code back to App
        // App's handleJoinRoomSubmit will now handle the navigation to /room/:roomCode
    } 
  };

  return (
    <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <form onSubmit={handleJoinRoom}>
                <input
                    type="text"
                    id="username"
                    placeholder="Enter Room Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    required
                />
                <div className="button-container">
                    <button type="submit" id="Join">
                    Join
                    </button>
                    <button type="button" onClick={() => navigate('/')}>
                    Back
                    </button>
                </div>
            </form>
            <p>Joining as: {username}</p>
        </header>
        </div>
  );
}

export default JoinRoomies;