//Login.jsx THIS IS THE HOME PAGE

import { useState } from "react"
import logo from "../assets/logo.svg";
import { v4 as uuidv4 } from "uuid";
import "./Login.css";


export function Login({ onSubmit }) {
  const [username, setUsername] = useState("") //username is the value the user types in, setUsername is the function that updates username



  //make each button do a different ting
  const handleSubmit = async (event) => {
    event.preventDefault(); //do not reload i beg!!
    const clickedButtonId = event.nativeEvent.submitter.id; //grabs whether they clicked "join" or "submit"
    if (!username.trim()) return; //require a username

    const uuid = uuidv4(); //unique uuid for every player

    if (clickedButtonId === "Join") {
      // For joining, just call onSubmit like before 
      onSubmit({ type: "join", username: username.trim(), uuid });
    } else if (clickedButtonId === "Create") {
      try {
        // Call your backend to create a room
        const response = await fetch(`${import.meta.env.VITE_JS_FILE}/create-room`, { //changed http://localhost:8000 to https://whiteboards-server.onrender.com
          method: "POST",
        });
        if (!response.ok) throw new Error("Failed to create room");

        const data = await response.json(); //it should return smth like { roomCode: "ABCDE" }
        const roomCode = data.roomCode;

        // Now send that roomCode back via onSubmit
        onSubmit({ type: "create", username: username.trim(), uuid, roomCode });
      } catch (error) {
        console.error(error);
        alert("Error creating room");
      }
    }

  };

  //the html for the home page aka the username and the join/create buttons
  return (
    <>
    <div className="App">
    <header className="App-header">
    <img src={logo} className="App-logo" alt="logo" />
        <form 
          onSubmit={handleSubmit}
        >
          <input //enter username and join/create room
            type="text"
            id="username"
            value={username}
            placeholder="Enter Name"
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <div className="button-container">
            <button type="submit" id="Join"> 
            Join
            </button>
            <button type="submit" id="Create">
            Create
            </button>
          </div>
        </form>
      </header>
      </div>
    </>
  )
}