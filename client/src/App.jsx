//App.jsx

import {useState} from 'react';
import {Routes, Route, useNavigate } from 'react-router-dom';
import {Login} from './components/Login'
import JoinRoomies from './components/JoinRoomies';
import Roomies from './Roomies'
import GameRound from './GameRound';
import { WebSocketProvider } from './components/WebSocketContext';

//THIS IS WHERE ALL THE DIRECTORIES AND SHIT ARE
function App() {
  const [username, setUsername] = useState("")
   const [uuid, setUUID] = useState("");
  const [room, setRoom] = useState("");
  const navigate = useNavigate();

  //when we submit our data on the login page, then it will append either "player or judge"
const handleLoginSubmit = async (submissionData) => {
  setUsername(submissionData.username);
  setUUID(submissionData.uuid);

  if (submissionData.type === 'join') {
      navigate('/join');
  } else if (submissionData.type === 'create') {
    try {               
      const response = await fetch(`${import.meta.env.VITE_JS_FILE}/create-room`, { method: 'POST' }); //Next time i will remember not to hardcode this port
      //changed http://localhost:8000 to https://whiteboards-server.onrender.com
      if (!response.ok) throw new Error('Failed to create room');

      const data = await response.json();
      const roomCode = data.roomCode;

      setRoom(roomCode);       // Save room code to state
      navigate('/room');       // Clean URL
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room, please try again.');
    }
  }
};

  //when the user clicks "play" on joinroomies, redirect to the correct room
  const handleRoomJoin = (roomCodeFromJoinPage) => {
    setRoom(roomCodeFromJoinPage); // Set room code for joined room
    navigate('/room'); // Navigate after setting state
  };

  return (
    <div className="App">
      <WebSocketProvider>
        <Routes>
          {/* our home actual path */}
          <Route path="/" element={<Login onSubmit={handleLoginSubmit} />} /> 
          
          {/* the paths we can leads down to after submitting our username */}
          <Route path="/join" element={<JoinRoomies username={username} uuid={uuid} onJoin={handleRoomJoin} />} />
          <Route path="/room" element={<Roomies username={username} uuid={uuid} room={room} />} />
          <Route path="/game" element={<GameRound username={username} uuid={uuid} room={room} />} />
        </Routes>
      </WebSocketProvider>
    </div>
  )
}

export default App
