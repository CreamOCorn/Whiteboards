//Roomies.jsx
import { useWebSocketContext } from './components/WebSocketContext';
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import logo from "./assets/logo.svg";
import "./Roomies.css"

//AM I THE JUDGE IF YES THEN START IF NOT THEN READY
const isJudge = (users, myUUID, sendJsonMessage) => {
  if (!users || !myUUID) return null;

  const allUUIDs = Object.keys(users);
  const judgeUUID = allUUIDs[0]; //judge is the first person on the list
  const iAmJudge = myUUID === judgeUUID;

  if (iAmJudge) {
    // Check if all other players are ready
    const playerUUIDs = allUUIDs.slice(1); // everyone except judge
    const allPlayersReady = playerUUIDs.every(uuid => users[uuid]?.isReady) && playerUUIDs.length > 0;

    //clicking start sends everyone to the game screen by telling the backend
    const handleStartRound = () => {
      sendJsonMessage({
        type: "start_round"
      });
    };

    return (
      <button
        type="submit"
        className="leaveButton"
        disabled={!allPlayersReady}
        onClick={handleStartRound}
        style={{
          backgroundColor: allPlayersReady ? "#000000" : "#7e7e7e", // black or grey
          cursor: allPlayersReady ? "pointer" : "default",
        }}
         
      >
        Start
      </button>
    );
  }

  //if you're not the judge you see a ready up button
  const myUser = users[myUUID];
  const isReady = myUser?.isReady;

  const handleClick = () => {
    sendJsonMessage({ type: isReady ? "unready" : "ready" }); //toggles if ready or not when ur a player
  };

  return (
    <button type="submit" className="leaveButton" onClick={handleClick}>
      {isReady ? "Unready" : "Ready"}
    </button>
  );
};

//Creating a div for the judge to be at the top
const renderJudge = users => {
  // Get the UUID of the first user. whoever is the first user is the judge
  const firstUUID = Object.keys(users)[0];
  // Get the user object corresponding to that first UUID
  const firstUser = users[firstUUID];

  return (
    <div key={firstUUID} className="JudgeBox">
      <div className="NameBox">
        {firstUser.username}
      </div>
    </div>
  );
};

const renderPlayers = users => {
  const maxPlayers = 8; 
  //Apparently doing this prevents errors if the json doesn't initialize before the site starts
  const safeUsers = users || {};

  //All players
  const allUUIDs = Object.keys(safeUsers);

  //The first 8 players not including the judge
  const playerUUIDs= allUUIDs.slice(1, maxPlayers + 1); 

  // Turning the map into an array of users which is easier for some reason
  const displaySlots = Array(maxPlayers).fill(null);
  playerUUIDs.forEach((uuid, index) => {
    displaySlots[index] = safeUsers[uuid];
  });

  return (
    <div className="PlayerGrid">
      {displaySlots.map((user, index) => (
        <div key={index} className="PlayerSlot">
          <div 
            className="NameBoxPlayer"
            style={{
              backgroundColor: user ? '#ffffff' : '#dedede', //grey until someone joins
              color: user ? '#333' : '#999'
            }}
          >
            {user ? user.username : '[Empty]'} 
          </div>
          {user && (
            <div className="RoleLabel">
              {user.isReady ? "Ready" : "Unready"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

  
export function Roomies ({ username, uuid, room }) {
  const navigate = useNavigate();
  const { sendJsonMessage, lastJsonMessage, connect, isConnected } = useWebSocketContext();
  const [hasNavigated, setHasNavigated] = useState(false);
  const hasConnected = useRef(false); // Track if we've already connected

  const myUUID = uuid; // For local comparison

  // Connect to WebSocket when component mounts (only once)
  useEffect(() => {
    if (username && uuid && room && !hasNavigated && !hasConnected.current) {
      console.log('Connecting to WebSocket...');
      connect(username, uuid, room);
      hasConnected.current = true;
    }
  }, [username, uuid, room, hasNavigated]); // Remove 'connect' from dependencies

  //Sends to the json that user connected and loads the page
  useEffect(() => {
    if (isConnected && !hasNavigated) {
      sendJsonMessage({
        message: "has connected"
      });
    }
  }, [isConnected, sendJsonMessage, hasNavigated]);

  //kick them out if they don't have a username or uuid or room
  useEffect(() => {
    if (!username || !uuid || !room) {
      console.log("No username or room found, redirecting to home.");
      navigate('/');
    }
  }, [username, uuid, room, navigate]);

  // Listen for start_round signal and navigate all players to gameroom on start
  useEffect(() => {
    if (!lastJsonMessage || hasNavigated) return;

    if (lastJsonMessage.type === "round_started") {
      setHasNavigated(true);
      navigate("/game", {
        state: {
          username,
          uuid,
          room,
          users: lastJsonMessage.users
        }
      });
    }
  }, [lastJsonMessage, navigate, username, uuid, room, hasNavigated]);

  // Only render if we haven't navigated away and have room data
  if (lastJsonMessage && !hasNavigated && !lastJsonMessage.type) {
    return <>
      <div className="Room">
        <div className="Top">
          <img src={logo} className="Logo"/>
          <p className="Code">Code: {room || "N/A"}</p>
        </div>
        <div className="Row-Of-Shit"> 
          {/* the top row of buttons */}
          <button type="submit" className="leaveButton" onClick={() => navigate('/')}>
            Leave
          </button>
          {/* Creator of the room goes up top */}
          {renderJudge(lastJsonMessage)}
          {/* Different Buttons for judge vs Player */}
          {isJudge(lastJsonMessage, myUUID, sendJsonMessage)}
        </div>
        <p className="RoleLabel">Judge</p>
        <div className="Spacer"/>
        <p>Players</p>
        {renderPlayers(lastJsonMessage)}
      </div>
    </>
  }

  return null;
}

export default Roomies;