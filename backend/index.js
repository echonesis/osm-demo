const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'dev_secret_key'; // For prototype only

app.use(cors());
app.use(bodyParser.json());

// Placeholder user store (in-memory)
const users = [];

// In-memory layer store: { [email]: layers }
const userLayers = {};

// In-memory friend link requests: { [email]: [requestingEmail, ...] }
const friendRequests = {};
// In-memory notifications: { [email]: [message, ...] }
const notifications = {};
// In-memory sharing status: { [email]: { sharing: boolean, position: [lat, lng], sharedWith: Set<email> } }
const sharingStatus = {};

// Middleware to authenticate JWT and set req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Register route
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ email, password: hashedPassword });
  // Initialize default layers for new user
  userLayers[email] = {
    food: [
      { id: 1, name: 'Pizza Place', position: [25.034, 121.564] },
      { id: 2, name: 'Sushi Bar', position: [25.035, 121.565] },
    ],
    playground: [
      { id: 1, name: 'Central Playground', position: [25.033, 121.563] },
      { id: 2, name: 'Riverside Park', position: [25.032, 121.566] },
    ],
  };
  res.json({ message: 'Registration successful' });
});

// Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Get layers for logged-in user
app.get('/api/layers', authenticateToken, (req, res) => {
  const email = req.user.email;
  if (!userLayers[email]) {
    // Default layers if none exist
    userLayers[email] = {
      food: [
        { id: 1, name: 'Pizza Place', position: [25.034, 121.564] },
        { id: 2, name: 'Sushi Bar', position: [25.035, 121.565] },
      ],
      playground: [
        { id: 1, name: 'Central Playground', position: [25.033, 121.563] },
        { id: 2, name: 'Riverside Park', position: [25.032, 121.566] },
      ],
    };
  }
  res.json(userLayers[email]);
});

// Replace all layers for logged-in user
app.post('/api/layers', authenticateToken, (req, res) => {
  const email = req.user.email;
  const layers = req.body;
  if (!layers || typeof layers !== 'object') {
    return res.status(400).json({ message: 'Invalid layers data' });
  }
  userLayers[email] = layers;
  res.json({ message: 'Layers updated' });
});

// Send a link request to another user
app.post('/api/link-request', authenticateToken, (req, res) => {
  const fromEmail = req.user.email;
  const { toEmail } = req.body;
  if (!toEmail || !users.find(u => u.email === toEmail)) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (!friendRequests[toEmail]) friendRequests[toEmail] = [];
  friendRequests[toEmail].push(fromEmail);
  if (!notifications[toEmail]) notifications[toEmail] = [];
  notifications[toEmail].push(`${fromEmail} wants to link and see your position.`);
  res.json({ message: 'Link request sent' });
});

// Get notifications for the logged-in user
app.get('/api/notifications', authenticateToken, (req, res) => {
  const email = req.user.email;
  const notes = notifications[email] || [];
  notifications[email] = [];
  res.json(notes);
});

// User accepts link and starts sharing position
app.post('/api/share-position', authenticateToken, (req, res) => {
  const email = req.user.email;
  const { toEmail, position, sharing } = req.body;
  if (!toEmail || !users.find(u => u.email === toEmail)) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (!sharingStatus[email]) sharingStatus[email] = { sharing: false, position: null, sharedWith: new Set() };
  sharingStatus[email].sharing = !!sharing;
  sharingStatus[email].position = position || sharingStatus[email].position;
  if (sharing) {
    sharingStatus[email].sharedWith.add(toEmail);
    // Notify the requester that sharing was approved
    if (!notifications[toEmail]) notifications[toEmail] = [];
    notifications[toEmail].push(`${email} approved your request`);
  } else {
    sharingStatus[email].sharedWith.delete(toEmail);
  }
  res.json({ message: sharing ? 'Started sharing' : 'Stopped sharing' });
});

// Get friend's position if sharing
app.get('/api/friend-position', authenticateToken, (req, res) => {
  const email = req.user.email;
  const { friendEmail } = req.query;
  if (!friendEmail || !users.find(u => u.email === friendEmail)) {
    return res.status(404).json({ message: 'User not found' });
  }
  const status = sharingStatus[friendEmail];
  if (status && status.sharing && status.sharedWith.has(email) && status.position) {
    res.json({ position: status.position });
  } else {
    res.status(403).json({ message: 'Not sharing position' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 