//Login.jsx THIS IS THE HOME PAGE

import { useState } from "react"
import logo from "../assets/logo.svg";
import "./Login.css";

export function Login({ onSubmit }) {
  const [username, setUsername] = useState("")

  //make each button do a different ting
  const handleSubmit = (event) => {
    event.preventDefault();
    const clickedButtonId = event.nativeEvent.submitter.id;

    if (clickedButtonId === 'Join') {
      onSubmit({ type: 'join', username }); 
    } else if (clickedButtonId === 'Create') {
      onSubmit({ type: 'create', username }); 
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