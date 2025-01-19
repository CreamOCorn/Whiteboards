import React from "react";
import logo from "./logo.svg";
import "./App.css";
import { useNavigate } from "react-router-dom";

function Homies() {
  const navigate = useNavigate();

  // randomly generating room code to make rooms with
  function generateRoomCode(){
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  // users click create room, making themselves the host
  function handleCreateRoom(){
    const roomCode = generateRoomCode();
    navigate(`/room/${roomCode}?role=judge`);
  };

  // users click join room, making them a player
  function handleJoinRoom(){
    let roomCode = document.getElementById("username").value.trim();
    roomCode = roomCode.toUpperCase();
    if (roomCode) {
      navigate(`/room/${roomCode}?role=player`);
    } else {
      alert("Please enter a valid room code to join!");
    }
  };  

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <input type="text" id="username" placeholder="Enter Name" required />
        <div className="button-container">
            <button type="submit" id="Join" onClick={handleJoinRoom}>
            Join
            </button>
            <button type="submit" id="Create" onClick={handleCreateRoom}>
            Create
            </button>
        </div>
    </header>
    </div>
  );
}

export default Homies;