//JoinRoomies.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.svg";
import "./Login.css";

function JoinRoomies({ username, uuid, onJoin }) {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  //redirect if refresh
   useEffect(() => {
    if (!username) {
      console.log("No username found, redirecting to home.");
      navigate('/'); // Redirect to login page if no username
    }
  }, [username, navigate]); 

  const handleJoinRoom = async (event) => {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();

    if (!code) return;

    try {
      // Call backend to check if room exists
      const response = await fetch(`${import.meta.env.VITE_JS_FILE}/check-room?code=${code}`);
      if (response.ok) {
        const data = await response.json();
        console.log(data);
        if (data.exists) {
          //did it already start
            if (data.gameStarted) {
                alert('The game has already started in this room. You cannot join at this time.');
            } else if (data.userCount >= 9) {
              alert('The room is already occupied by the max number of users. You cannot join at this time.');
            } else {
              // if not, navigate to room page
              onJoin(code);
            }
        } else {
          alert("Invalid room code");
        }
      } else {
        alert("Invalid room code");
      }
    } catch (error) {
      alert("Error checking room code. Please try again.");
      console.error(error);
    }
  };


  //it looks exactly like the home page but now allows you to enter room code
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
                    Play
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