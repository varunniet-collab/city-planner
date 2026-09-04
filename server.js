const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGO_URI = 'mongodb+srv://varunnietcollab_db_user:Uq7g0qB6yQfQ112h@cluster0.z19tq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Data/Planner Schema (Linked with userId)
const itemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  description: String,
  date: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', itemSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
  secret: 'city-planner-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day session
}));

// Authentication Middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// Routes: Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: 'Signup successful! Please log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// Routes: Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    req.session.userId = user._id;
    req.session.username = user.username;
    res.json({ message: 'Login successful', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Routes: Check Auth Status
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ isAuthenticated: true, username: req.session.username });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Routes: Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Could not log out.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

// Routes: Get Items (Only for logged-in user)
app.get('/api/items', isAuthenticated, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.session.userId });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching items.' });
  }
});

// Routes: Add Item (Saved with current user's ID)
app.post('/api/items', isAuthenticated, async (req, res) => {
  try {
    const { title, description, date, status } = req.body;
    const newItem = new Item({
      userId: req.session.userId,
      title,
      description,
      date,
      status
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Error saving item.' });
  }
});

// Routes: Delete Item
app.delete('/api/items/:id', isAuthenticated, async (req, res) => {
  try {
    const deleted = await Item.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!deleted) return res.status(404).json({ error: 'Item not found or unauthorized.' });
    res.json({ message: 'Item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting item.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
