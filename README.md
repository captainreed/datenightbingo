# Date Night Bingo

A real-time multiplayer bingo game where all connected users share the same game state. Built for fun date nights, parties, or any group activity.

**Live at:** https://datenightbingo.com

---

## Tech Stack

### Frontend
- **Vanilla HTML/CSS/JavaScript** - No framework, lightweight and fast
- **Socket.io Client** - Real-time WebSocket communication
- **CSS Animations** - Confetti, fireworks, waddle effects

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web server framework
- **Socket.io** - Real-time bidirectional event-based communication

### Infrastructure
- **Docker** - Containerization (Node.js Alpine image)
- **Cloudflare Tunnel (cloudflared)** - Secure tunnel from Cloudflare to local server
- **Cloudflare DNS** - Domain management and CDN
- **Ubuntu Server** - Host machine

---

## Features

- **Configurable Grid Sizes** - 3x3, 4x4, 5x5, or 6x6
- **Editable Title** - Customize the game name
- **Card Text Input** - 250 character limit per card
- **Real-time Sync** - All users see the same state instantly
- **Card Selection** - Click to toggle with confetti animation
- **Scramble** - Shuffle cards with fun waddle animation
- **Bingo Detection** - Automatic detection of rows, columns, and diagonals
- **Victory Celebration** - Fireworks, confetti, and "YOU WIN!" display
- **Save/Load System** - Persistent game saves via gear icon modal

---

## Project Structure

```
datenightbingo/
├── server.js           # Express + Socket.io server
├── package.json        # Dependencies (express, socket.io)
├── public/
│   ├── index.html      # Main HTML structure
│   ├── styles.css      # All styling and animations
│   └── script.js       # Game logic, Socket.io client, celebrations
├── Dockerfile          # Docker image configuration
├── .dockerignore       # Files excluded from Docker image
├── deploy.sh           # Full rebuild and deploy script
├── start.sh            # Start the Docker container
├── stop.sh             # Stop the Docker container
├── saves/              # Saved games directory (Docker volume)
└── current.json        # Current game state (auto-saved)
```

---

## Starting and Stopping the Service

### Start the Application
```bash
cd ~/datenightbingo
sudo ./start.sh
```
This will:
- Check if the container is already running
- Start an existing stopped container, or create a new one
- Build the Docker image if it doesn't exist

### Stop the Application
```bash
cd ~/datenightbingo
sudo ./stop.sh
```

### Full Rebuild (after code changes)
```bash
cd ~/datenightbingo
sudo ./deploy.sh
```
This rebuilds the Docker image and restarts the container.

### Check Status
```bash
sudo docker ps -f name=datenightbingo-site
sudo docker logs datenightbingo-site
```

---

## Infrastructure Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                   │
│                     User visits datenightbingo.com                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                                   │
│  • DNS: CNAME → b8c566a4-cf3c-4186-b397-7993c5872e7d.cfargotunnel   │
│  • SSL termination                                                   │
│  • DDoS protection                                                   │
│  • CDN caching                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE TUNNEL (cloudflared)                   │
│  • Runs as systemd user service                                      │
│  • Config: ~/.cloudflared/config.yml                                 │
│  • Routes based on hostname:                                         │
│      - datenightbingo.com → localhost:3000                          │
│      - noyoutipme.com → localhost:8080                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DOCKER CONTAINER                                │
│  • Image: datenightbingo (node:20-alpine)                           │
│  • Container: datenightbingo-site                                    │
│  • Port: 3000:3000                                                   │
│  • Volume: datenightbingo-saves:/app/saves                          │
│  • Restart policy: unless-stopped                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NODE.JS APPLICATION                             │
│  • Express serves static files from /public                          │
│  • Socket.io handles real-time game state sync                       │
│  • Game state stored in memory + JSON file persistence              │
└─────────────────────────────────────────────────────────────────────┘
```

### Cloudflare Tunnel Configuration

Located at `~/.cloudflared/config.yml`:
```yaml
tunnel: b8c566a4-cf3c-4186-b397-7993c5872e7d
credentials-file: /home/thickarus/.cloudflared/b8c566a4-cf3c-4186-b397-7993c5872e7d.json

ingress:
  - hostname: noyoutipme.com
    service: http://localhost:8080
  - hostname: www.noyoutipme.com
    service: http://localhost:8080
  - hostname: datenightbingo.com
    service: http://localhost:3000
  - hostname: www.datenightbingo.com
    service: http://localhost:3000
  - service: http_status:404
```

### Managing Cloudflared

```bash
# Check status
systemctl --user status cloudflared

# Restart (after config changes)
systemctl --user restart cloudflared

# View logs
journalctl --user -u cloudflared -f
```

---

## Application Architecture

### Server (server.js)

The server handles:
1. **Static file serving** - Express serves the `public/` directory
2. **WebSocket connections** - Socket.io manages real-time communication
3. **Game state management** - In-memory state with JSON file persistence
4. **Save/Load system** - Named saves stored in `saves/` directory

Key Socket.io events:
- `gameState` - Full state sync to new clients
- `updateTitle` / `titleUpdated` - Title changes
- `updateCardText` / `cardTextUpdated` - Card text changes
- `toggleCard` / `cardToggled` - Card selection
- `scramble` / `scrambled` - Shuffle card positions
- `clearAll` / `cleared` - Reset all cards
- `saveAs` / `listSaves` / `loadSave` / `deleteSave` - Save management

### Client (public/script.js)

Key components:
1. **Socket.io client** - Connects to server, handles events
2. **Board rendering** - Dynamic grid based on size selection
3. **Input management** - Text inputs for each card
4. **Animations**:
   - Card selection confetti
   - Scramble waddle animation
   - Bingo detection and celebration
5. **Save management modal** - Gear icon opens save/load interface

### Bingo Detection

The `checkForBingo()` function:
1. Builds a grid based on card positions (respects scrambled order)
2. Checks all rows for completion
3. Checks all columns for completion
4. Checks both diagonals for completion
5. Returns true if any line is complete

### Celebration Animation

When bingo is detected:
1. Canvas overlay activates
2. Fireworks launch from bottom, explode into particles
3. Confetti falls from top
4. "YOU WIN!" text displays with rainbow gradient animation
5. Title glows and pulses
6. Celebration lasts 10 seconds after triggering

---

## Development Notes

### Created With
This application was built using **Claude Code** (Anthropic's CLI tool) in a single session.

### Key Design Decisions

1. **No Frontend Framework** - Vanilla JS keeps it lightweight and simple
2. **Socket.io over raw WebSockets** - Better reconnection handling and room support
3. **Docker with Alpine** - Minimal image size (~150MB)
4. **Cloudflare Tunnel** - No port forwarding needed, automatic SSL
5. **File-based persistence** - Simple JSON storage, no database needed

### Future Improvements

Potential enhancements for future development:
- [ ] Multiple game rooms (separate URLs or room codes)
- [ ] Player names/avatars
- [ ] Chat functionality
- [ ] Custom card colors/themes
- [ ] Sound effects
- [ ] Mobile app (PWA)
- [ ] Game history/statistics
- [ ] QR code for easy joining

### For Future Claude Code Sessions

When continuing development:

1. **Read this README** for architecture overview
2. **Key files to understand**:
   - `server.js` - All backend logic
   - `public/script.js` - All frontend logic
   - `public/styles.css` - All styling
3. **Testing changes**:
   - For frontend: Just refresh browser
   - For backend: Run `sudo ./deploy.sh` to rebuild container
4. **The Docker container** must be rebuilt after any code changes
5. **Cloudflared** only needs restart if tunnel config changes

---

## Troubleshooting

### Site returns 404
1. Check if container is running: `sudo docker ps`
2. Check if cloudflared is running: `systemctl --user status cloudflared`
3. Verify cloudflared config has datenightbingo entries
4. Restart cloudflared: `systemctl --user restart cloudflared`

### Container won't start
1. Check logs: `sudo docker logs datenightbingo-site`
2. Verify port 3000 is free: `sudo lsof -i :3000`
3. Rebuild: `sudo ./deploy.sh`

### Real-time sync not working
1. Check browser console for WebSocket errors
2. Verify Socket.io is connecting (network tab)
3. Check server logs: `sudo docker logs -f datenightbingo-site`

### Saves not persisting
1. Check Docker volume: `sudo docker volume inspect datenightbingo-saves`
2. Verify volume is mounted: `sudo docker inspect datenightbingo-site`

---

## License

Private project for personal use.

---

*Last updated: January 2026*
*Built with Claude Code by Anthropic*
