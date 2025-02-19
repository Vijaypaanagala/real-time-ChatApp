import express from "express";
import { port, mongoUrl } from './config.js';
import mongoose from "mongoose";
import userroute from './routes/userroutes.js';
import chatroutes from './routes/chatroutes.js';
import messageroutes from './routes/messageroutes.js';
import cors from 'cors';
import http from 'http'; // Import http module to work with Socket.io
import { Server } from "socket.io"; // Socket.io import

const app = express();

// Create HTTP server to work with Socket.io
const server = http.createServer(app);

// Integrate Socket.io with the server and configure ping timeout
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',  // Frontend URL
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,  
  pingTimeout: 60000,  
  maxHttpBufferSize: 1e6 
});

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log('A user connected with id: ', socket.id);  // Log connected user ID

  // Setup event for when a user connects
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    if(!userData) return
    socket.emit("connected");
  });
  
  // Listen for a 'join room' event and join the appropriate room
  socket.on('join room', (room) => {
    console.log('User attempting to join room:', room);
    socket.join(room);
    console.log(`A user joined room: ${room}`);
  });

  // Handle the 'new message' event and emit the message to other users
  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat.users) return console.log("chat.users not defined");

    // Emit the new message to all users in the chat (except the sender)
    chat.users.forEach((user) => {
      if (user._id == newMessageReceived.sender._id) return;

      socket.in(user._id).emit("message received", newMessageReceived);
      console.log('Message sent to user: ', user._id);
    });
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log('A user disconnected');
  });
});

// Middleware to parse JSON data
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173' // Frontend URL for CORS
}));

// Use route handlers for user, chat, and message
app.use('/api/user', userroute);
app.use('/api/chat', chatroutes);
app.use('/api/message', messageroutes);

// Error Handling middlewares


// Connect to MongoDB and start the server with Socket.io
mongoose.connect(mongoUrl)
  .then(() => {
    console.log("Connected successfully to MongoDB");
    // Start the server with Socket.io
    server.listen(port, () => {
      console.log(`App running on server port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error);
  });
