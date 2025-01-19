import React from "react";
import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homies from "./Homies";
import Roomies from "./Roomies";
import JoinRoomies from "./JoinRoomies";

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route (home screen) */}
        <Route path="/" element={<Homies />} />
        {/* Route for room screen */}
        <Route path="/room/:roomCode" element={<Roomies />} />
        <Route path="/join-room" element={<JoinRoomies />} /> {/* New route */}
      </Routes>
    </Router>
  );
}


export default App;
