// Socket.io connection
const socket = io();

// Game state
let gameState = {
  title: 'Date Night Bingo',
  gridSize: 5,
  cards: [],
  selectedCards: []
};

// DOM elements
const titleInput = document.getElementById('game-title');
const gridSizeSelect = document.getElementById('grid-size');
const bingoBoard = document.getElementById('bingo-board');
const cardInputsContainer = document.getElementById('card-inputs');
const scrambleBtn = document.getElementById('scramble-btn');
const clearBtn = document.getElementById('clear-btn');
const settingsBtn = document.getElementById('settings-btn');
const toast = document.getElementById('toast');
const confettiContainer = document.getElementById('confetti-container');
const celebrationCanvas = document.getElementById('celebration-canvas');
const ctx = celebrationCanvas.getContext('2d');

// Celebration state
let celebrationActive = false;
let celebrationTimeout = null;
let fireworks = [];
let particles = [];

// Modal elements
const savesModal = document.getElementById('saves-modal');
const modalClose = document.getElementById('modal-close');
const saveNameInput = document.getElementById('save-name-input');
const saveAsBtn = document.getElementById('save-as-btn');
const savesList = document.getElementById('saves-list');

// Initialize the game
function init() {
  setupEventListeners();
}

// Set up event listeners
function setupEventListeners() {
  // Title input
  titleInput.addEventListener('input', (e) => {
    socket.emit('updateTitle', e.target.value);
  });

  // Grid size change
  gridSizeSelect.addEventListener('change', (e) => {
    const size = parseInt(e.target.value);
    if (confirm('Changing grid size will reset all cards. Continue?')) {
      socket.emit('changeGridSize', size);
    } else {
      gridSizeSelect.value = gameState.gridSize;
    }
  });

  // Control buttons
  scrambleBtn.addEventListener('click', () => {
    socket.emit('scramble');
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all card text and selections?')) {
      socket.emit('clearAll');
    }
  });

  // Settings/Saves modal
  settingsBtn.addEventListener('click', () => {
    openSavesModal();
  });

  modalClose.addEventListener('click', () => {
    closeSavesModal();
  });

  savesModal.addEventListener('click', (e) => {
    if (e.target === savesModal) {
      closeSavesModal();
    }
  });

  saveAsBtn.addEventListener('click', () => {
    const name = saveNameInput.value.trim();
    if (name) {
      socket.emit('saveAs', name);
      saveNameInput.value = '';
    } else {
      showToast('Please enter a save name', 'error');
    }
  });

  saveNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveAsBtn.click();
    }
  });
}

// Open saves modal
function openSavesModal() {
  savesModal.classList.add('show');
  socket.emit('listSaves');
}

// Close saves modal
function closeSavesModal() {
  savesModal.classList.remove('show');
}

// Render saves list
function renderSavesList(saves) {
  if (saves.length === 0) {
    savesList.innerHTML = '<p class="no-saves">No saved games yet</p>';
    return;
  }

  savesList.innerHTML = saves.map(save => {
    const date = new Date(save.savedAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="save-item" data-filename="${save.filename}">
        <div class="save-info">
          <div class="save-title">${escapeHtml(save.saveName || save.title)}</div>
          <div class="save-meta">${save.gridSize}x${save.gridSize} - ${dateStr}</div>
        </div>
        <div class="save-actions">
          <button class="btn-load" onclick="loadSave('${save.filename}')">Load</button>
          <button class="btn-delete" onclick="deleteSave('${save.filename}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load a save
function loadSave(filename) {
  if (confirm('Load this save? Current unsaved changes will be lost.')) {
    socket.emit('loadSave', filename);
  }
}

// Delete a save
function deleteSave(filename) {
  if (confirm('Delete this save? This cannot be undone.')) {
    socket.emit('deleteSave', filename);
  }
}

// Render the bingo board
function renderBoard() {
  bingoBoard.style.gridTemplateColumns = `repeat(${gameState.gridSize}, 1fr)`;
  bingoBoard.innerHTML = '';

  // Sort cards by order for display
  const sortedCards = [...gameState.cards].sort((a, b) => a.order - b.order);

  sortedCards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'bingo-card';
    cardEl.dataset.id = card.id;
    cardEl.textContent = card.text || `#${card.id + 1}`;

    if (gameState.selectedCards.includes(card.id)) {
      cardEl.classList.add('selected');
    }

    cardEl.addEventListener('click', () => toggleCard(card.id));
    bingoBoard.appendChild(cardEl);
  });
}

// Render card input fields
function renderInputs() {
  cardInputsContainer.innerHTML = '';

  gameState.cards.forEach((card) => {
    const row = document.createElement('div');
    row.className = 'card-input-row';

    const label = document.createElement('span');
    label.className = 'card-input-label';
    label.textContent = `#${card.id + 1}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'card-input';
    input.dataset.id = card.id;
    input.value = card.text;
    input.maxLength = 250;
    input.placeholder = 'Enter text for this card...';

    const charCount = document.createElement('span');
    charCount.className = 'char-count';
    updateCharCount(charCount, card.text.length);

    input.addEventListener('input', (e) => {
      const text = e.target.value;
      updateCharCount(charCount, text.length);
      socket.emit('updateCardText', { id: card.id, text });

      // Update local state and card display immediately
      card.text = text;
      updateCardDisplay(card.id, text);
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(charCount);
    cardInputsContainer.appendChild(row);
  });
}

// Update character count display
function updateCharCount(el, count) {
  el.textContent = `${count}/250`;
  el.classList.remove('warning', 'limit');
  if (count >= 250) {
    el.classList.add('limit');
  } else if (count >= 200) {
    el.classList.add('warning');
  }
}

// Update a single card's display
function updateCardDisplay(id, text) {
  const cardEl = bingoBoard.querySelector(`[data-id="${id}"]`);
  if (cardEl) {
    cardEl.textContent = text || `#${id + 1}`;
  }
}

// Toggle card selection
function toggleCard(id) {
  socket.emit('toggleCard', id);
}

// Create confetti effect
function createConfetti(x, y) {
  const colors = ['#ff6b9d', '#f8b500', '#4facfe', '#00f2fe', '#667eea', '#f093fb'];

  for (let i = 0; i < 20; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = x + 'px';
    confetti.style.top = y + 'px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

    // Random direction
    const angle = (Math.random() * Math.PI * 2);
    const velocity = 50 + Math.random() * 100;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;

    confetti.style.setProperty('--dx', dx + 'px');
    confetti.style.setProperty('--dy', dy + 'px');

    confetti.animate([
      {
        opacity: 1,
        transform: `translate(0, 0) rotate(0deg) scale(1)`
      },
      {
        opacity: 0,
        transform: `translate(${dx}px, ${dy}px) rotate(720deg) scale(0)`
      }
    ], {
      duration: 800 + Math.random() * 400,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });

    confettiContainer.appendChild(confetti);

    setTimeout(() => confetti.remove(), 1200);
  }
}

// Show toast message
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ==================== BINGO DETECTION ====================

// Check for bingo (row, column, or diagonal)
function checkForBingo() {
  const gridSize = gameState.gridSize;
  const selected = new Set(gameState.selectedCards);

  // Build a grid of selected positions based on card order
  const grid = [];
  for (let i = 0; i < gridSize; i++) {
    grid[i] = [];
    for (let j = 0; j < gridSize; j++) {
      grid[i][j] = false;
    }
  }

  // Map selected cards to their grid positions
  gameState.cards.forEach(card => {
    if (selected.has(card.id)) {
      const row = Math.floor(card.order / gridSize);
      const col = card.order % gridSize;
      grid[row][col] = true;
    }
  });

  // Check rows
  for (let row = 0; row < gridSize; row++) {
    if (grid[row].every(cell => cell)) {
      return true;
    }
  }

  // Check columns
  for (let col = 0; col < gridSize; col++) {
    let columnComplete = true;
    for (let row = 0; row < gridSize; row++) {
      if (!grid[row][col]) {
        columnComplete = false;
        break;
      }
    }
    if (columnComplete) return true;
  }

  // Check main diagonal (top-left to bottom-right)
  let mainDiagonal = true;
  for (let i = 0; i < gridSize; i++) {
    if (!grid[i][i]) {
      mainDiagonal = false;
      break;
    }
  }
  if (mainDiagonal) return true;

  // Check anti-diagonal (top-right to bottom-left)
  let antiDiagonal = true;
  for (let i = 0; i < gridSize; i++) {
    if (!grid[i][gridSize - 1 - i]) {
      antiDiagonal = false;
      break;
    }
  }
  if (antiDiagonal) return true;

  return false;
}

// ==================== CELEBRATION ANIMATION ====================

// Resize canvas to window
function resizeCanvas() {
  celebrationCanvas.width = window.innerWidth;
  celebrationCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Firework class
class Firework {
  constructor() {
    this.x = Math.random() * celebrationCanvas.width;
    this.y = celebrationCanvas.height;
    this.targetY = Math.random() * (celebrationCanvas.height * 0.5) + 50;
    this.speed = 8 + Math.random() * 4;
    this.angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.trail = [];
    this.hue = Math.random() * 360;
    this.exploded = false;
  }

  update() {
    if (!this.exploded) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 10) this.trail.shift();

      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.15; // gravity

      if (this.y <= this.targetY || this.vy >= 0) {
        this.explode();
      }
    }
  }

  explode() {
    this.exploded = true;
    const particleCount = 80 + Math.floor(Math.random() * 40);
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(this.x, this.y, this.hue));
    }
  }

  draw() {
    if (!this.exploded) {
      // Draw trail
      ctx.beginPath();
      ctx.moveTo(this.trail[0]?.x || this.x, this.trail[0]?.y || this.y);
      this.trail.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = `hsla(${this.hue}, 100%, 70%, 0.5)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw head
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${this.hue}, 100%, 70%)`;
      ctx.fill();
    }
  }
}

// Particle class for explosions
class Particle {
  constructor(x, y, hue) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.decay = 0.015 + Math.random() * 0.015;
    this.hue = hue + (Math.random() - 0.5) * 30;
    this.size = Math.random() * 3 + 1;
    this.gravity = 0.08;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.hue}, 100%, 60%)`;
    ctx.fill();
    ctx.restore();
  }
}

// Confetti particle for title area
class TitleConfetti {
  constructor() {
    this.x = Math.random() * celebrationCanvas.width;
    this.y = -10;
    this.size = Math.random() * 10 + 5;
    this.speedY = Math.random() * 3 + 2;
    this.speedX = (Math.random() - 0.5) * 2;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 10;
    this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
    this.shape = Math.random() > 0.5 ? 'rect' : 'circle';
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;
    this.speedX += (Math.random() - 0.5) * 0.2;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.fillStyle = this.color;
    if (this.shape === 'rect') {
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

let titleConfetti = [];
let youWinHue = 0;
let youWinScale = 1;
let youWinScaleDir = 1;

// Animation loop
function animateCelebration() {
  if (!celebrationActive) {
    ctx.clearRect(0, 0, celebrationCanvas.width, celebrationCanvas.height);
    return;
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, celebrationCanvas.width, celebrationCanvas.height);

  // Randomly spawn new fireworks
  if (Math.random() < 0.08) {
    fireworks.push(new Firework());
  }

  // Randomly spawn title confetti
  if (Math.random() < 0.3) {
    titleConfetti.push(new TitleConfetti());
  }

  // Update and draw fireworks
  fireworks = fireworks.filter(fw => !fw.exploded);
  fireworks.forEach(fw => {
    fw.update();
    fw.draw();
  });

  // Update and draw particles
  particles = particles.filter(p => p.alpha > 0);
  particles.forEach(p => {
    p.update();
    p.draw();
  });

  // Update and draw title confetti
  titleConfetti = titleConfetti.filter(c => c.y < celebrationCanvas.height);
  titleConfetti.forEach(c => {
    c.update();
    c.draw();
  });

  // Draw "YOU WIN!" text
  drawYouWinText();

  requestAnimationFrame(animateCelebration);
}

// Draw triumphant "YOU WIN!" text
function drawYouWinText() {
  const centerX = celebrationCanvas.width / 2;
  const centerY = celebrationCanvas.height / 2;

  // Animate hue for rainbow effect
  youWinHue = (youWinHue + 2) % 360;

  // Animate scale for pulsing effect
  youWinScale += 0.008 * youWinScaleDir;
  if (youWinScale > 1.1) youWinScaleDir = -1;
  if (youWinScale < 0.95) youWinScaleDir = 1;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(youWinScale, youWinScale);

  // Calculate responsive font size
  const fontSize = Math.min(celebrationCanvas.width / 5, 150);

  // Draw outer glow layers
  for (let i = 5; i > 0; i--) {
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = `hsla(${(youWinHue + i * 20) % 360}, 100%, 50%, ${0.15 - i * 0.02})`;
    ctx.lineWidth = fontSize / 8 + i * 8;
    ctx.strokeText('YOU WIN!', 0, 0);
  }

  // Draw main text with gradient
  const gradient = ctx.createLinearGradient(-fontSize * 2, 0, fontSize * 2, 0);
  gradient.addColorStop(0, `hsl(${youWinHue}, 100%, 60%)`);
  gradient.addColorStop(0.25, `hsl(${(youWinHue + 60) % 360}, 100%, 60%)`);
  gradient.addColorStop(0.5, `hsl(${(youWinHue + 120) % 360}, 100%, 60%)`);
  gradient.addColorStop(0.75, `hsl(${(youWinHue + 180) % 360}, 100%, 60%)`);
  gradient.addColorStop(1, `hsl(${(youWinHue + 240) % 360}, 100%, 60%)`);

  // Text shadow/outline
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = fontSize / 15;
  ctx.strokeText('YOU WIN!', 0, 0);

  // Main gradient fill
  ctx.fillStyle = gradient;
  ctx.fillText('YOU WIN!', 0, 0);

  // Inner highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillText('YOU WIN!', 0, -fontSize / 20);

  ctx.restore();
}

// Start celebration
function startCelebration() {
  // Clear any existing timeout
  if (celebrationTimeout) {
    clearTimeout(celebrationTimeout);
  }

  // Start if not already active
  if (!celebrationActive) {
    celebrationActive = true;
    celebrationCanvas.style.display = 'block';
    document.body.classList.add('celebrating');
    showToast('BINGO! 🎉', 'success');
    animateCelebration();
  }

  // Reset the 10 second timer
  celebrationTimeout = setTimeout(() => {
    stopCelebration();
  }, 10000);
}

// Stop celebration
function stopCelebration() {
  celebrationActive = false;
  celebrationCanvas.style.display = 'none';
  document.body.classList.remove('celebrating');
  fireworks = [];
  particles = [];
  titleConfetti = [];
  youWinHue = 0;
  youWinScale = 1;
  youWinScaleDir = 1;
  ctx.clearRect(0, 0, celebrationCanvas.width, celebrationCanvas.height);
}

// Animate scramble with waddle effect
function animateScramble(newOrders) {
  const cards = bingoBoard.querySelectorAll('.bingo-card');
  const boardRect = bingoBoard.getBoundingClientRect();
  const cardData = [];

  // Store current positions and card info
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    cardData.push({
      id: parseInt(card.dataset.id),
      el: card,
      startLeft: rect.left - boardRect.left,
      startTop: rect.top - boardRect.top,
      width: rect.width,
      height: rect.height,
      text: card.textContent,
      isSelected: card.classList.contains('selected')
    });
  });

  // Calculate new positions based on new orders
  const gridSize = gameState.gridSize;
  const gap = 10;
  const cardWidth = cardData[0]?.width || 100;
  const cardHeight = cardData[0]?.height || 100;

  // Update game state orders
  newOrders.forEach(({ id, order }) => {
    const card = gameState.cards.find(c => c.id === id);
    if (card) card.order = order;
  });

  // Calculate target positions for each card
  cardData.forEach(data => {
    const card = gameState.cards.find(c => c.id === data.id);
    const newOrder = card ? card.order : data.id;
    const row = Math.floor(newOrder / gridSize);
    const col = newOrder % gridSize;
    data.endLeft = col * (cardWidth + gap);
    data.endTop = row * (cardHeight + gap);
  });

  // Set up the board for absolute positioning animation
  bingoBoard.style.position = 'relative';
  bingoBoard.style.height = `${gridSize * (cardHeight + gap) - gap}px`;

  // Convert all cards to absolute positioning at their current positions
  cardData.forEach(data => {
    data.el.style.position = 'absolute';
    data.el.style.left = `${data.startLeft}px`;
    data.el.style.top = `${data.startTop}px`;
    data.el.style.width = `${data.width}px`;
    data.el.style.height = `${data.height}px`;
    data.el.style.margin = '0';

    // Set initial transform for waddle animation
    const dx = data.endLeft - data.startLeft;
    const dy = data.endTop - data.startTop;
    data.el.style.setProperty('--scramble-transform', `translate(0px, 0px)`);

    // Start waddling
    data.el.classList.add('scrambling');
  });

  // Small delay then start moving
  setTimeout(() => {
    cardData.forEach(data => {
      // Add movement transition
      data.el.classList.add('waddle-move');

      // Update waddle transform as card moves
      data.el.style.left = `${data.endLeft}px`;
      data.el.style.top = `${data.endTop}px`;
    });
  }, 100);

  // After movement completes, settle and re-render properly
  setTimeout(() => {
    cardData.forEach(data => {
      data.el.classList.remove('scrambling', 'waddle-move');
      data.el.classList.add('waddle-settle');
    });

    // Final cleanup and proper re-render
    setTimeout(() => {
      renderBoard();
    }, 400);
  }, 900);
}

// Socket.io event handlers
socket.on('gameState', (state) => {
  gameState = state;
  titleInput.value = state.title;
  gridSizeSelect.value = state.gridSize;
  renderBoard();
  renderInputs();
});

socket.on('titleUpdated', (title) => {
  gameState.title = title;
  titleInput.value = title;
});

socket.on('cardTextUpdated', ({ id, text }) => {
  const card = gameState.cards.find(c => c.id === id);
  if (card) {
    card.text = text;
    updateCardDisplay(id, text);

    // Update input field if it exists
    const input = cardInputsContainer.querySelector(`[data-id="${id}"]`);
    if (input && input !== document.activeElement) {
      input.value = text;
      const charCount = input.parentElement.querySelector('.char-count');
      if (charCount) updateCharCount(charCount, text.length);
    }
  }
});

socket.on('cardToggled', ({ id, selected }) => {
  const cardEl = bingoBoard.querySelector(`[data-id="${id}"]`);

  if (selected) {
    gameState.selectedCards.push(id);
    if (cardEl) {
      cardEl.classList.add('selected', 'celebrating');

      // Trigger confetti
      const rect = cardEl.getBoundingClientRect();
      createConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);

      setTimeout(() => cardEl.classList.remove('celebrating'), 600);
    }

    // Check for bingo after selecting a card
    if (checkForBingo()) {
      startCelebration();
    }
  } else {
    const index = gameState.selectedCards.indexOf(id);
    if (index !== -1) gameState.selectedCards.splice(index, 1);
    if (cardEl) {
      cardEl.classList.remove('selected');
    }
    // Stop celebration if bingo is broken
    if (celebrationActive && !checkForBingo()) {
      stopCelebration();
    }
  }
});

socket.on('scrambled', (newOrders) => {
  animateScramble(newOrders);
  showToast('Cards scrambled!');
});

socket.on('cleared', (state) => {
  gameState = state;
  renderBoard();
  renderInputs();
  showToast('All cards cleared!');
});

socket.on('saved', (success) => {
  if (success) {
    showToast('Game saved successfully!');
  } else {
    showToast('Failed to save game', 'error');
  }
});

// Save management socket handlers
socket.on('savesList', (saves) => {
  renderSavesList(saves);
});

socket.on('saveAsResult', (result) => {
  if (result.success) {
    showToast('Game saved!');
    socket.emit('listSaves');
  } else {
    showToast('Failed to save: ' + result.error, 'error');
  }
});

socket.on('loadResult', (result) => {
  if (result.success) {
    showToast('Game loaded!');
    closeSavesModal();
  } else {
    showToast('Failed to load: ' + result.error, 'error');
  }
});

socket.on('deleteResult', (result) => {
  if (result.success) {
    showToast('Save deleted');
  } else {
    showToast('Failed to delete: ' + result.error, 'error');
  }
});

// Initialize on load
init();
