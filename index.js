const WebSocket = require('ws');
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const GameController = require('./controllers/gameController');
const UserController = require('./controllers/userController');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use('/api/users', require('./routes/userRoutes'));

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected.');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'CREATE_USER':
          await UserController.handleCreateUser(ws, data);
          break;

        case 'PLACE_BET':
          await GameController.handleBet(ws, data, wss);
          break;

        case 'FINISH_BET':
          await GameController.handleCashout(ws, data, wss);
          break;

        default:
          ws.send(JSON.stringify({ action: 'ERROR', message: 'Unsupported action.' }));
          break;
      }
    } catch (error) {
      console.error('WS message error:', error);
      ws.send(JSON.stringify({ action: 'ERROR', message: 'Error processing message.' }));
    }
  });

  ws.on('close', () => console.log('Client disconnected.'));
});

// Start game loop
GameController.startGame(wss);
