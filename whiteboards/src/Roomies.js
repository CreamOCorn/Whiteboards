import React from "react";
import { useParams, useLocation } from "react-router-dom";

function Roomies() {
    const { roomCode } = useParams();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const role = queryParams.get("role"); // "judge" or null (player)
  
    return ( // obviously we wouldnt have the 
        <h1>Room Code: {roomCode}</h1> 
        {role === "judge" ? (
          <button>Start</button> // Judge sees "Start"
        ) : (
          <button disabled>Waiting for host to start</button> // Players see this
        )}
      </div>
    );
  }
  
  export default Roomies;