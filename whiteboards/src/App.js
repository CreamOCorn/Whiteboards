import React from "react";
import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homies from "./Homies";
import Roomies from "./Roomies";

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route (home screen) */}
        <Route path="/" element={<Homies />} />

        {/* Route for room screen */}
        <Route path="/room/:roomCode" element={<Roomies />} />
      </Routes>
    </Router>
  );
}


export default App;
