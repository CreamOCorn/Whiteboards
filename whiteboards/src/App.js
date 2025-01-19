import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <input type="text" id="username" placeholder="Enter Name" required></input>
      </header>
      <button type="submit" id="Join">Join</button>
      <button type="submit" id="Create">Create</button>
    </div>
  );
}


export default App;
