//index.js the backend

const http = require('http')
const {WebSocketServer} = require('ws')

const url = require('url')
const uuidv4 = require("uuid").v4 //method that generates random id's

const server = http.createServer()
const wsServer = new WebSocketServer({server})
const port = 8000 //just a port to pass info

const connections = {} //the connections dictionary of every online user
const users = {} //user dictionary of user's information 


//event handlers
const broadcast = () => {//handles what everyone receives
    Object.keys(connections).forEach(uuid => {
        const connection = connections[uuid]
        const message = JSON.stringify(users)
        connection.send(message)
    })
}
const handleMessage = (bytes, uuid) => { //message = state
    // message = {"x": 0, "y": 100}

    const message = JSON.parse(bytes.toString())
    const user = users[uuid]
    user.state = message

    broadcast()
    
    console.log(
        `${user.role} ${user.username} updated their updated state: ${JSON.stringify(
          user.state,
        )}`,
      )
}
const handleClose = uuid => {

    console.log(`${users[uuid].role} ${users[uuid].username} disconnected`)
    delete connections[uuid]
    delete users[uuid]

    broadcast()

}

wsServer.on("connection", (connection, request) => {
    //we will send a url with like ws://localhost:3000?username=Annie
    //and this will take the username Annie and send it to server

    const parsedUrl = url.parse(request.url, true);
    const queryParams = parsedUrl.query;

    const username = queryParams.username; // Access directly
    const role = queryParams.role;     // Access directly

   //uuid means "universally unique identifier"
   //generate id for each user (& help differentiate between ppl with same username)
   const uuid = uuidv4() 
   

   console.log(`Joining as ${role} with username: ${username}`) //writes the username in terminal for debugging purposes
   console.log(uuid)

   //this is a connections dictionary, which will store all of our current users
   //useful when we need to "broadcast" a message to everyone at once
   //because to send to all users, we can just loop over the dictionary
   connections[uuid] = connection

   users[uuid] = { //adds the user into the dictionary and lets us store their info
        username: username,
        role: role,
        state: { }//put anything in here for what they are doing
   }

   //"listening events" aka what the server should do when it gets information from the user
   connection.on("message", message => handleMessage(message, uuid))
   connection.on("close", () => handleClose(uuid))
})

server.listen(port, () => { //tell us if the server is running
    console.log(`Websocket server is running on port ${port}`)
})