const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('User connected');

  // Handle incoming messages
  socket.on('newMessage', (message) => {
    // Broadcast the message to all connected clients
    io.emit('newMessage', message); 

    // Optionally, save the message to Supabase
    saveMessageToSupabase(message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Function to save messages to Supabase (example)
const saveMessageToSupabase = async (message) => {
  // ... (Your Supabase logic to insert the message)
};

server.listen(3001, () => {
  console.log('Server listening on port 3001');
});
