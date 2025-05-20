//Roomies.jsx

import useWebSocket from 'react-use-websocket'
import {useEffect, useRef} from 'react'
import throttle from 'lodash.throttle'
import logo from "./assets/logo.svg";
import "./Roomies.css"

//Creating a list of all the active users in the room
const renderUsersList = users => {
    return (
      <ul>
        {Object.keys(users).map(uuid => {
          return <li key={uuid}>{JSON.stringify(users[uuid])}</li>
        })}
      </ul>
    )
  }

export function Roomies ({username, role}) {

    // Append name, role to the end of the URL and send it to the backend
  const WS_URL = `ws://127.0.0.1:8000`;
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    queryParams: {
      username: username,
      role: role,
    }
  }); //deal with room code later


      //the move cursor function, to be removed later just a test to see if the server updates real time
      const THROTTLE = 50
      const sendJsonMessageThrottled = useRef(throttle(sendJsonMessage, THROTTLE))
  
      useEffect (() => {
          window.addEventListener("mousemove", e => {
              sendJsonMessageThrottled.current({
                  x: e.clientX,
                  y: e.clientY
              })
          })
      }, [])
  
      if (lastJsonMessage) {
        return <>
        <div className="Room">
          <div class="Top">
            <img src={logo} className="Logo"/>
            <p className="Code">Code: ABCDE</p>
          </div>
          <div>
            <button type="submit" id="Join">
            Leave
            </button>
          </div>
          <h1>Hello {role} {username}</h1>
          {renderUsersList(lastJsonMessage)}
        </div>
        </>
      }
    
}

export default Roomies;

//the html stuff from the original Roomies file

// import React from "react";
// import { useParams, useLocation } from "react-router-dom";


// function Roomies() {
//     const { roomCode } = useParams();
//     const location = useLocation();
//     const queryParams = new URLSearchParams(location.search);
//     const role = queryParams.get("role"); // "judge" or null (player)
  
//     return (
//       <div>
//         <h1>Room Code: {roomCode}</h1> 
//         {role === "judge" ? (
//           <button>Start</button> // Judge sees "Start"
//         ) : (
//           <button disabled>Waiting for host to start</button> // Players see this
//         )}
//       </div>
//     );
//   }
//   export default Roomies;