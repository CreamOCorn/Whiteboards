//App.jsx

import {useState} from 'react';
import {Routes, Route, useNavigate } from 'react-router-dom';
import {Login} from './components/Login'
import JoinRoomies from './components/JoinRoomies';
import Roomies from './Roomies'

//THIS IS WHERE ALL THE DIRECTORIES AND SHIT ARE
function App() {
  const [username, setUsername] = useState("")
  const [role, setRole] = useState('');
  const navigate = useNavigate();

  //when we submit our data on the login page, then it will append either "player or judge"
  const handleLoginSubmit = (submissionData) => {
    setUsername(submissionData.username);
    setRole(submissionData.type === 'join' ? 'player' : 'judge');

    if (submissionData.type === 'join') {
      navigate('/join'); // Redirect to join room page for players
    } else if (submissionData.type === 'create') {
      navigate(`/room`); //deal with room code stuff later, for now there is only 1 room lol
    }

  };

  //when the user clicks "play" on joinroomies, redirect to the correct room
  const handleRoomJoin = () => {
    navigate(`/room`); //deal with room code stuff later
  };

  return (
    <div className="App">
      <Routes>
        {/* our home actual path */}
        <Route path="/" element={<Login onSubmit={handleLoginSubmit} />} /> 
        
        {/* the paths we can leads down to after submitting our username */}
        <Route path="/join" element={<JoinRoomies username={username} onJoin={handleRoomJoin} />} />
        <Route path="/room" element={<Roomies username={username} role={role} />} />
      </Routes>
    </div>
  )
}

export default App
