# WebSocket Command Debugging Guide

## Issue
The realtime server logs show commands are being sent to the screen, but the display app isn't receiving them.

## Server Logs Analysis
```
[2025-12-27T00:36:28.622Z] [INFO] Admin registered: cmd2c3mn40003sb3jyjo5n5fc (socket: 1VUGb1pS3SOdsELWAAAJ)
[2025-12-27T00:36:28.623Z] [INFO] Admin cmd2c3mn40003sb3jyjo5n5fc joined masjid:test-masjid:admins
[2025-12-27T00:36:32.577Z] [INFO] Admin cmd2c3mn40003sb3jyjo5n5fc sending command to screen cmjnewp2m000zl02290uh45zl {"command":"FORCE_UPDATE"}
[2025-12-27T00:36:47.351Z] [INFO] Socket disconnected {"socketId":"f-PgRu-pyJqAFB78AAAH","connectionType":"display"}
[2025-12-27T00:36:47.351Z] [INFO] Screen unregistered: cmjnewp2m000zl02290uh45zl
```

## Key Observations

### 1. Admin Connection
- **Admin User ID**: `cmd2c3mn40003sb3jyjo5n5fc`
- **Admin Socket ID**: `1VUGb1pS3SOdsELWAAAJ`
- **Admin Room**: `masjid:test-masjid:admins` ✅

### 2. Screen Connection
- **Screen ID**: `cmjnewp2m000zl02290uh45zl`
- **Screen Socket ID**: `f-PgRu-pyJqAFB78AAAH`
- **Screen Room**: **UNKNOWN** ❓ ← This is the problem!

### 3. Command Sent
- **Command Type**: `FORCE_UPDATE`
- **Target Screen**: `cmjnewp2m000zl02290uh45zl`

## Root Cause Analysis

The issue is likely one of the following:

### Theory 1: Room Mismatch ⭐ (Most Likely)
The server is emitting to a room that the screen isn't joined to.

**Expected Socket.io rooms for screen:**
- Individual screen room: `screen:cmjnewp2m000zl02290uh45zl`
- Masjid screens room: `masjid:test-masjid:screens`

**What to check on the server:**
```javascript
// Server should emit to the specific screen's room
io.to(`screen:${screenId}`).emit('screen:command:FORCE_UPDATE', commandData);

// OR to all screens in a masjid
io.to(`masjid:${masjidId}:screens`).emit('screen:command:FORCE_UPDATE', commandData);
```

**What the screen is listening for:**
```typescript
socket.on('screen:command:FORCE_UPDATE', (data) => {
  console.log('Command received!', data);
});
```

### Theory 2: Event Name Mismatch
The server is using a different event name than expected.

**Expected event format:**
- Event name: `screen:command:FORCE_UPDATE`
- Event name: `screen:command:RESTART_APP`
- Event name: `screen:command:RELOAD_CONTENT`

**Server might be using:**
- Wrong format: `command:FORCE_UPDATE` ❌
- Wrong format: `FORCE_UPDATE` ❌
- Wrong format: `screen:FORCE_UPDATE` ❌

### Theory 3: Socket Targeting Issue
The server is trying to emit to a specific socket ID, but:
- The socket ID doesn't match
- The socket is disconnected at the time of emit
- The emit is being called before the socket joins the necessary rooms

## Diagnostic Steps

### Step 1: Check Server Room Join Logic
Look for where the screen joins rooms on connection:

```javascript
// In server display handler
socket.on('display:authenticate', (auth) => {
  const { screenId, masjidId } = auth;
  
  // Screen should join these rooms:
  socket.join(`screen:${screenId}`);           // Individual screen room
  socket.join(`masjid:${masjidId}:screens`);   // All screens in masjid
  
  console.log('Screen joined rooms:', socket.rooms);
});
```

### Step 2: Check Server Command Emit Logic
Look for how the admin sends commands:

```javascript
// In server admin handler
socket.on('admin:send:command', async (data) => {
  const { screenId, command } = data;
  
  // CORRECT ✅
  io.to(`screen:${screenId}`).emit(`screen:command:${command.type}`, command);
  
  // INCORRECT ❌
  io.emit(`screen:command:${command.type}`, command); // Broadcasts to everyone
  
  // INCORRECT ❌
  const screenSocket = getScreenSocket(screenId);
  screenSocket.emit(`screen:command:${command.type}`, command); // Might not exist
});
```

### Step 3: Enable Server-Side Debug Logging
Add this to the realtime server:

```javascript
// Log all socket rooms
io.on('connection', (socket) => {
  console.log('Socket rooms:', socket.rooms);
  
  socket.onAny((event, ...args) => {
    console.log('Event emitted:', { event, args });
  });
});

// Log room membership
socket.on('joinRoom', (room) => {
  socket.join(room);
  console.log(`Socket ${socket.id} joined room ${room}`);
  console.log('Current rooms:', socket.rooms);
});
```

### Step 4: Check Display App Connection
With the new diagnostic logging, check the browser console for:

```
🔌 [WebSocketService] Socket connected { socketId: '...', ... }
✅ [WebSocketService] Server confirmed display connection { ... }
🔔 [WebSocketService] RAW EVENT RECEIVED: { event: '...', ... }
```

## Expected Flow

### 1. Screen Connects
```
Display App → Realtime Server: CONNECT
  auth: { type: 'display', screenId, masjidId, token }
  
Realtime Server → Display App: 'connect' event
  
Realtime Server: Join rooms
  - screen:cmjnewp2m000zl02290uh45zl
  - masjid:test-masjid:screens
  
Realtime Server → Display App: 'display:connected' event
  data: { screenId, masjidId, rooms: [...] }
```

### 2. Admin Sends Command
```
Admin Portal → Realtime Server: 'admin:send:command'
  { screenId: 'cmjnewp2m000zl02290uh45zl', command: { type: 'FORCE_UPDATE' } }
  
Realtime Server → Display App (via room): 'screen:command:FORCE_UPDATE'
  to: `screen:cmjnewp2m000zl02290uh45zl`
  data: { commandId, type: 'FORCE_UPDATE', ... }
  
Display App → Realtime Server: 'display:command:ack'
  { commandId, success: true }
```

## Questions for Server Team

1. **What rooms does the display socket join on connection?**
   - Expected: `screen:${screenId}` and `masjid:${masjidId}:screens`

2. **What is the exact emit call when sending commands?**
   - Expected: `io.to('screen:${screenId}').emit('screen:command:${commandType}', data)`

3. **Can you add logging to show:**
   - When screen joins rooms: `console.log('Screen joined:', socket.rooms)`
   - When command is emitted: `console.log('Emitting to room:', room, 'event:', event)`
   - How many sockets receive the event: `console.log('Sockets in room:', io.sockets.adapter.rooms.get(room)?.size)`

4. **Is there any middleware blocking the emit?**
   - Check for authentication/authorization middleware that might prevent emit

## Testing Commands

### Browser Console (Display App)
```javascript
// Check WebSocket connection
window.__WEBSOCKET_DEBUG = true;

// Manually test event listener
const socket = // get socket instance
socket.on('screen:command:FORCE_UPDATE', (data) => {
  console.log('✅ Manual listener received:', data);
});

// Emit a test event from server to verify connectivity
// (Server should emit): io.to('screen:xyz').emit('test:ping', { message: 'hello' });
socket.on('test:ping', (data) => {
  console.log('✅ Test ping received:', data);
});
```

### Server-Side Test
```javascript
// Test emit to specific screen
const testCommand = {
  commandId: 'test-123',
  type: 'FORCE_UPDATE',
  timestamp: new Date().toISOString()
};

// Direct to room
io.to(`screen:cmjnewp2m000zl02290uh45zl`).emit('screen:command:FORCE_UPDATE', testCommand);

// Check if anyone received it
const roomSize = io.sockets.adapter.rooms.get(`screen:cmjnewp2m000zl02290uh45zl`)?.size || 0;
console.log(`Emitted to ${roomSize} sockets in room`);
```

## Next Steps

1. **Rebuild and run the display app** with new diagnostic logging
2. **Check server logs** for room join events
3. **Send a command** from admin and watch both server and display logs
4. **Compare the event names and rooms** between what server sends and what display expects

## Expected Console Output

With the new logging, you should see:

```
🔌 [WebSocketService] Socket connected { 
  socketId: 'f-PgRu-pyJqAFB78AAAH',
  connected: true 
}

✅ [WebSocketService] Server confirmed display connection {
  data: { screenId: 'cmjnewp2m000zl02290uh45zl', masjidId: 'test-masjid' },
  socketId: 'f-PgRu-pyJqAFB78AAAH',
  credentials: { screenId: '...', masjidId: 'test-masjid' }
}

🔔 [WebSocketService] RAW EVENT RECEIVED: {
  event: 'screen:command:FORCE_UPDATE',
  data: { commandId: '...', type: 'FORCE_UPDATE' },
  timestamp: '2025-12-27T...'
}

📨 [WebSocketService] Received WS event: screen:command:FORCE_UPDATE { ... }
🔄 [WebSocketService] Emitting 'command' event with type: FORCE_UPDATE
✅ [WebSocketService] 'command' event emitted
```

If you DON'T see the "RAW EVENT RECEIVED" log, the event is not reaching the display app at all!



