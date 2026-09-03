const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// JSON डेटा लिमिट बढ़ाई गई है ताकि बड़ा डेटा आसानी से सेव हो सके
app.use(express.json({ limit: '10mb' })); 
app.use(express.static('public'));

// ✅ आपका फाइनल MongoDB Cloud Connection Link
const MONGO_URI = "mongodb+srv://varunniet_db_user:vXfNxkMzm9wsB6nt@smartplanner.vdbgfiv.mongodb.net/bmc_planner?retryWrites=true&w=majority&appName=SmartPlanner";

// क्लाउड डेटाबेस से कनेक्शन
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Cloud Database (MongoDB) Connected Successfully!"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// डेटाबेस का स्ट्रक्चर (Schema)
const taskSchema = new mongoose.Schema({
  id: Number,
  title: String,
  dept: String,
  officer: String,
  priority: String,
  frequency: String,
  finalDate: String,
  alert1: String,
  alert2: String,
  alert3: String,
  details: String,
  progress: Number,
  logs: [String],
  snoozedUntil: String,
  completed: Boolean,
  lastAlertStageTriggered: Number
}, { strict: false });

const Task = mongoose.model('Task', taskSchema);

// API: क्लाउड से डेटा लाने के लिए (Get Tasks)
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({}, { _id: 0, __v: 0 }); // सिर्फ काम का डेटा फ्रंटएंड पर भेजें
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: क्लाउड में डेटा सेव करने के लिए (Save Tasks)
app.post('/api/tasks', async (req, res) => {
  try {
    const tasks = req.body;
    await Task.deleteMany({}); // पुराने रिकॉर्ड साफ करें
    if (tasks.length > 0) {
      await Task.insertMany(tasks); // नए और अपडेटेड रिकॉर्ड सेव करें
    }
    res.json({ message: "Tasks successfully saved to Cloud Database!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});