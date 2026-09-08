const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB URI
const MONGO_URI = "mongodb+srv://varunniet_db_user:vXfNxkMzm9wsB6nt@smartplanner.vdbgfiv.mongodb.net/bmc_planner?retryWrites=true&w=majority&appName=SmartPlanner";

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Cloud Database (MongoDB) Connected Successfully!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema (Email & OTP added)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  resetOtp: { type: String, default: null }
});
const User = mongoose.model('User', userSchema);

// Data/Planner Schema
const itemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tasks: Array
});
const Item = mongoose.model('Item', itemSchema);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
  secret: 'city-planner-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// API: Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: 'Username, password and email are required.' });
    
    if (await User.findOne({ username })) return res.status(400).json({ error: 'Username already exists.' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, email });
    await newUser.save();
    res.status(201).json({ message: 'Signup successful! Please log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// API: Forgot Password (Send OTP) - ✅ FIXED CONNECTION TIMEOUT
app.post('/api/forgot-password', async (req, res) => {
  const { username } = req.body;
  try {
    console.log(`OTP Request received for: ${username}`);
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log("Error: User not found in database.");
      return res.status(404).json({ error: "User not found." });
    }
    
    // पुराने अकाउंट्स को क्रैश होने से बचाने के लिए चेक
    if (!user.email) {
      console.log(`Error: Account '${username}' has no email linked.`);
      return res.status(400).json({ error: "Old account (No email linked). Cannot reset password." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    await user.save();

    // ✅ Secure SMTP Connection for Render
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'varun.niet@gmail.com', pass: 'nvmywxibsszyotbw' }
    });

    await transporter.sendMail({
      from: 'varun.niet@gmail.com',
      to: user.email,
      subject: '🔑 BMC Planner - Password Reset OTP',
      html: `<h3>Your Password Reset OTP is: <b style="color:red;">${otp}</b></h3><p>Do not share this with anyone.</p>`
    });

    console.log(`Success: OTP sent to ${user.email}`);
    res.json({ message: "OTP sent to your registered email!" });
  } catch (error) {
    console.error("🚨 EMAIL ERROR:", error);
    res.status(500).json({ error: "Failed to send OTP. Check Render Logs." });
  }
});

// API: Reset Password (Verify OTP)
app.post('/api/reset-password', async (req, res) => {
  const { username, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || user.resetOtp !== otp) return res.status(400).json({ error: "Invalid OTP or Username." });
    
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = null;
    await user.save();
    res.json({ message: "Password reset successfully! Please Login." });
  } catch (error) {
    res.status(500).json({ error: "Server error during reset." });
  }
});

// API: Send Task Email Alert - ✅ FIXED CONNECTION TIMEOUT
app.post('/api/send-email', async (req, res) => {
  const { officerEmail, taskTitle, deadline, priority, details } = req.body;
  if (!officerEmail) return res.status(400).json({ error: "No email provided" });

  // ✅ Secure SMTP Connection for Render
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: 'varun.niet@gmail.com', pass: 'nvmywxibsszyotbw' }
  });

  const mailOptions = {
    from: 'varun.niet@gmail.com',
    to: officerEmail,
    subject: `🚨 BMC New Task Assigned: ${taskTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
        <h3 style="color: #1e3a8a; margin-top: 0;">Bhavnagar Municipal Corporation - Task Alert</h3>
        <p>Sir/Madam,</p>
        <p>A new task has been assigned to you. Please find the details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <tr><td style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Task Name</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${taskTitle}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Deadline</td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #dc2626;"><b>${new Date(deadline).toLocaleString('en-IN')}</b></td></tr>
          <tr><td style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Priority</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${priority}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Remarks</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${details || 'N/A'}</td></tr>
        </table>
        <p>Please complete this work on time.</p>
        <p style="font-size: 11px; color: #64748b;">This is an auto-generated alert from BMC Smart Executive Planner.</p>
      </div>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Email sent successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send email" });
  }
});

// API: Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Invalid username or password.' });
    req.session.userId = user._id;
    req.session.username = user.username;
    res.json({ message: 'Login successful', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.userId) res.json({ isAuthenticated: true, username: req.session.username });
  else res.json({ isAuthenticated: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/tasks', isAuthenticated, async (req, res) => {
  try {
    let userData = await Item.findOne({ userId: req.session.userId });
    if (!userData) {
      userData = new Item({ userId: req.session.userId, tasks: [] });
      await userData.save();
    }
    res.json(userData.tasks);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching tasks.' });
  }
});

app.post('/api/tasks', isAuthenticated, async (req, res) => {
  try {
    await Item.findOneAndUpdate({ userId: req.session.userId }, { tasks: req.body }, { upsert: true, new: true });
    res.json({ message: 'Tasks saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Error saving tasks.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
