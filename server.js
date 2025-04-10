const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const sessions = new Map(); // connectionId -> { sender, receiver }

wss.on('connection', (socket) => {
  socket.on('message', (message) => {
    try {
      // If it's binary, forward from sender to receiver
      // if (Buffer.isBuffer(message)) {
      //   console.log('Binary message received:', message);
        
      //   const session = sessions.get(socket.sessionId);
      //   if (session?.receiver && session.sender === socket) {
      //     session.receiver.send(message);
      //   }
      //   return;
      // }

      // If it's JSON
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case 'register': {
          socket.sessionId = msg.connectionId;
          sessions.set(msg.connectionId, { sender: socket, receiver: null });
          break;
        }

        case 'receiver_ready': {
          const session = sessions.get(msg.target_id);
          if (session && session.sender) {
            session.receiver = socket;
            socket.sessionId = msg.target_id;

            session.sender.send(JSON.stringify({
              type: 'receiver_ready',
              senderId: msg.target_id
            }));

            session.receiver.send(JSON.stringify({
              type: 'connected'
            }));
          }
          break;
        }

        case 'file_info':
        case 'file_end':
        case 'file_chunk': {
          const session = sessions.get(socket.sessionId);
          if (session?.receiver) {
            session.receiver.send(JSON.stringify(msg));
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      // console.error('Error handling message:', err);
         const session = sessions.get(socket.sessionId);
        if (session?.receiver && session.sender === socket) {
          session.receiver.send(message);
        }
    }
  });

  socket.on('close', () => {
    const sessionId = socket.sessionId;
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    if (session.sender === socket && session.receiver) {
      session.receiver.send(JSON.stringify({
        type: 'error',
        message: 'Sender disconnected'
      }));
    }

    if (session.receiver === socket && session.sender) {
      session.sender.send(JSON.stringify({
        type: 'error',
        message: 'Receiver disconnected'
      }));
    }

    sessions.delete(sessionId);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running at http://localhost:${PORT}`);
});
