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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 