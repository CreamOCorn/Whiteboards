import React, { useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useNavigate } from "react-router-dom";

function JoinRoomies() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleJoinRoom = async () => {
    if (!username || !roomCode) {
      alert("Please enter both your name and a valid room code!");
      return;
    }

    try {
      // Mock API call to validate room
      const response = await fetch(`/api/validate-room/${roomCode}`);
      const data = await response.json();

      if (data.exists) {
        navigate(`/room/${roomCode}?role=player&name=${username}`);
      } else {
        alert("There are no existing rooms under that code :(");
      }
    } catch (error) {
      alert("Error validating room. Please try again later.");
      console.error(error);
    }
  };

  return (
    <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <input type="text" id="username" placeholder="Enter Room Code" required />
            <div className="button-container">
                <button type="submit" id="Join" onClick={handleJoinRoom}>
                Join
                </button>
            </div>
        </header>
        </div>
  );
}

export default JoinRoomies;