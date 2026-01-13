const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SAVES_DIR = path.join(__dirname, 'saves');
const CURRENT_SAVE_FILE = path.join(__dirname, 'current.json');

// Ensure saves directory exists
if (!fs.existsSync(SAVES_DIR)) {
  fs.mkdirSync(SAVES_DIR);
}

// Default game state
let gameState = {
  title: 'Date Night Bingo',
  gridSize: 5,
  cards: [],
  selectedCards: []
};

// Initialize cards for a given grid size
function initializeCards(size) {
  const count = size * size;
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push({ id: i, text: '', order: i });
  }
  return cards;
}

// Load current game state if exists
function loadGameState() {
  try {
    if (fs.existsSync(CURRENT_SAVE_FILE)) {
      const data = fs.readFileSync(CURRENT_SAVE_FILE, 'utf8');
      gameState = JSON.parse(data);
      console.log('Game state loaded from file');
    } else {
      gameState.cards = initializeCards(gameState.gridSize);
      console.log('Initialized new game state');
    }
  } catch (err) {
    console.error('Error loading game state:', err);
    gameState.cards = initializeCards(gameState.gridSize);
  }
}

// Save current game state (auto-save)
function saveCurrentState() {
  try {
    fs.writeFileSync(CURRENT_SAVE_FILE, JSON.stringify(gameState, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving current state:', err);
    return false;
  }
}

// Save game to named slot
function saveGame(name) {
  try {
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_').substring(0, 50);
    const filename = `${safeName}.json`;
    const filepath = path.join(SAVES_DIR, filename);
    const saveData = {
      ...gameState,
      savedAt: new Date().toISOString(),
      saveName: name
    };
    fs.writeFileSync(filepath, JSON.stringify(saveData, null, 2));
    console.log(`Game saved as: ${name}`);
    return { success: true, name: safeName };
  } catch (err) {
    console.error('Error saving game:', err);
    return { success: false, error: err.message };
  }
}

// List all saved games
function listSaves() {
  try {
    const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
    const saves = files.map(file => {
      const filepath = path.join(SAVES_DIR, file);
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      const stats = fs.statSync(filepath);
      return {
        filename: file.replace('.json', ''),
        title: data.title || 'Untitled',
        saveName: data.saveName || file.replace('.json', ''),
        gridSize: data.gridSize || 5,
        savedAt: data.savedAt || stats.mtime.toISOString()
      };
    });
    return saves.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  } catch (err) {
    console.error('Error listing saves:', err);
    return [];
  }
}

// Load a saved game
function loadSave(filename) {
  try {
    const safeName = filename.replace(/[^a-z0-9_-]/gi, '_');
    const filepath = path.join(SAVES_DIR, `${safeName}.json`);
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf8');
      gameState = JSON.parse(data);
      delete gameState.savedAt;
      delete gameState.saveName;
      saveCurrentState();
      console.log(`Loaded save: ${filename}`);
      return { success: true, state: gameState };
    }
    return { success: false, error: 'Save not found' };
  } catch (err) {
    console.error('Error loading save:', err);
    return { success: false, error: err.message };
  }
}

// Delete a saved game
function deleteSave(filename) {
  try {
    const safeName = filename.replace(/[^a-z0-9_-]/gi, '_');
    const filepath = path.join(SAVES_DIR, `${safeName}.json`);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`Deleted save: ${filename}`);
      return { success: true };
    }
    return { success: false, error: 'Save not found' };
  } catch (err) {
    console.error('Error deleting save:', err);
    return { success: false, error: err.message };
  }
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current game state to newly connected client
  socket.emit('gameState', gameState);

  // Handle title update
  socket.on('updateTitle', (title) => {
    gameState.title = title.substring(0, 100);
    socket.broadcast.emit('titleUpdated', gameState.title);
  });

  // Handle grid size change
  socket.on('changeGridSize', (size) => {
    if ([3, 4, 5, 6].includes(size)) {
      gameState.gridSize = size;
      gameState.cards = initializeCards(size);
      gameState.selectedCards = [];
      io.emit('gameState', gameState);
    }
  });

  // Handle card text update
  socket.on('updateCardText', ({ id, text }) => {
    const card = gameState.cards.find(c => c.id === id);
    if (card) {
      card.text = text.substring(0, 250);
      socket.broadcast.emit('cardTextUpdated', { id, text: card.text });
    }
  });

  // Handle card selection toggle
  socket.on('toggleCard', (id) => {
    const index = gameState.selectedCards.indexOf(id);
    if (index === -1) {
      gameState.selectedCards.push(id);
    } else {
      gameState.selectedCards.splice(index, 1);
    }
    io.emit('cardToggled', { id, selected: index === -1 });
  });

  // Handle scramble
  socket.on('scramble', () => {
    const orders = gameState.cards.map(c => c.order);
    // Fisher-Yates shuffle
    for (let i = orders.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orders[i], orders[j]] = [orders[j], orders[i]];
    }
    gameState.cards.forEach((card, index) => {
      card.order = orders[index];
    });
    io.emit('scrambled', gameState.cards.map(c => ({ id: c.id, order: c.order })));
  });

  // Handle clear all
  socket.on('clearAll', () => {
    gameState.cards.forEach(card => {
      card.text = '';
    });
    gameState.selectedCards = [];
    io.emit('cleared', gameState);
  });

  // Handle save (quick save to current)
  socket.on('save', () => {
    const success = saveCurrentState();
    socket.emit('saved', success);
  });

  // Handle save to named slot
  socket.on('saveAs', (name) => {
    const result = saveGame(name);
    socket.emit('saveAsResult', result);
  });

  // Handle list saves request
  socket.on('listSaves', () => {
    const saves = listSaves();
    socket.emit('savesList', saves);
  });

  // Handle load save
  socket.on('loadSave', (filename) => {
    const result = loadSave(filename);
    if (result.success) {
      io.emit('gameState', gameState);
      socket.emit('loadResult', { success: true });
    } else {
      socket.emit('loadResult', result);
    }
  });

  // Handle delete save
  socket.on('deleteSave', (filename) => {
    const result = deleteSave(filename);
    socket.emit('deleteResult', result);
    if (result.success) {
      socket.emit('savesList', listSaves());
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Load initial game state
loadGameState();

// Get local IP address for display
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n🎯 Date Night Bingo Server Running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}\n`);
});
