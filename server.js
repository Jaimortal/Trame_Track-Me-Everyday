const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'trame_db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory and initial JSON database file exist
function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const templatePath = path.join(DATA_DIR, 'trame_db.template.json');
    let initialData;

    if (fs.existsSync(templatePath)) {
      try {
        initialData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        if (Array.isArray(initialData.tasks)) {
          initialData.tasks.forEach((t) => {
            t.date = todayStr;
            t.createdAt = new Date().toISOString();
          });
        }
      } catch (err) {
        console.warn('[trame] Could not read template, using default initial data.');
      }
    }

    if (!initialData) {
      initialData = {
        meta: {
          appName: 'trame',
          description: 'Track and Me - Activity & Task Calendar Tracker',
          version: '1.0.0',
          city: 'Malaybalay City, Bukidnon',
          darkMode: false
        },
        tasks: [
          {
            id: 'welcome-1',
            title: 'Welcome to tra•me!',
            description: 'This is your private, local activity calendar. Your data is stored purely in data/trame_db.json and is never shared or committed to Git.',
            date: todayStr,
            time: '09:00',
            linkUrl: 'https://github.com',
            linkLabel: 'Documentation',
            category: 'Personal',
            priority: 'medium',
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    console.log(`[trame] 🚀 Fresh installation detected! Created your private local database at: ${DB_PATH}`);
  }
}

// Thread-safe read & write helper
function readDb() {
  initDb();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDb(data) {
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_PATH);
}

// REST Endpoints for CRUD operations on JSON

// GET all tasks (with optional query filter)
app.get('/api/tasks', (req, res) => {
  try {
    const db = readDb();
    let tasks = db.tasks || [];
    
    const { year, month, date, completed } = req.query;
    
    if (year) {
      tasks = tasks.filter(t => t.date && t.date.startsWith(year));
    }
    if (month) {
      // month format "01".."12" or "YYYY-MM"
      tasks = tasks.filter(t => t.date && t.date.includes(`-${month}-`));
    }
    if (date) {
      tasks = tasks.filter(t => t.date === date);
    }
    if (completed !== undefined) {
      const isComp = completed === 'true';
      tasks = tasks.filter(t => t.completed === isComp);
    }

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (err) {
    console.error('Error reading tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to read tasks database' });
  }
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
  try {
    const db = readDb();
    const task = (db.tasks || []).find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create new task
app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, date, time, linkUrl, linkLabel, category, priority } = req.body;
    if (!title || !date) {
      return res.status(400).json({ success: false, error: 'Title and Date are required' });
    }

    const db = readDb();
    const newTask = {
      id: 'trk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: title.trim(),
      description: (description || '').trim(),
      date, // YYYY-MM-DD
      time: time || '', // HH:mm
      linkUrl: (linkUrl || '').trim(),
      linkLabel: (linkLabel || '').trim(),
      category: category || 'General',
      priority: priority || 'medium',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };

    db.tasks.push(newTask);
    writeDb(db);

    res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ success: false, error: 'Failed to save task to JSON database' });
  }
});

// PUT update existing task
app.put('/api/tasks/:id', (req, res) => {
  try {
    const { title, description, date, time, linkUrl, linkLabel, category, priority, completed } = req.body;
    const db = readDb();
    const index = db.tasks.findIndex(t => t.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const current = db.tasks[index];
    const isNowCompleted = completed !== undefined ? Boolean(completed) : current.completed;

    db.tasks[index] = {
      ...current,
      title: title !== undefined ? title.trim() : current.title,
      description: description !== undefined ? description.trim() : current.description,
      date: date || current.date,
      time: time !== undefined ? time : current.time,
      linkUrl: linkUrl !== undefined ? linkUrl.trim() : current.linkUrl,
      linkLabel: linkLabel !== undefined ? linkLabel.trim() : current.linkLabel,
      category: category || current.category,
      priority: priority || current.priority,
      completed: isNowCompleted,
      completedAt: isNowCompleted && !current.completed ? new Date().toISOString() : (!isNowCompleted ? null : current.completedAt),
      updatedAt: new Date().toISOString()
    };

    writeDb(db);
    res.json({ success: true, task: db.tasks[index] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update task in JSON' });
  }
});

// PATCH toggle completion
app.patch('/api/tasks/:id/toggle', (req, res) => {
  try {
    const db = readDb();
    const task = db.tasks.find(t => t.id === req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();

    writeDb(db);
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to toggle task' });
  }
});

// DELETE permanently delete task from JSON
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const db = readDb();
    const initialLen = db.tasks.length;
    db.tasks = db.tasks.filter(t => t.id !== req.params.id);

    if (db.tasks.length === initialLen) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    writeDb(db);
    res.json({ success: true, message: 'Task permanently removed from JSON database' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete task from JSON' });
  }
});

// POST clean up completed tasks to free up space
app.post('/api/tasks/cleanup-completed', (req, res) => {
  try {
    const { year } = req.body || {};
    const db = readDb();
    const beforeCount = db.tasks.length;

    if (year) {
      db.tasks = db.tasks.filter(t => !(t.completed && t.date && t.date.startsWith(year.toString())));
    } else {
      db.tasks = db.tasks.filter(t => !t.completed);
    }

    const removedCount = beforeCount - db.tasks.length;
    writeDb(db);

    res.json({
      success: true,
      removedCount,
      remainingCount: db.tasks.length,
      message: `Cleaned up ${removedCount} completed task(s) to free up JSON database space.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to clean up completed tasks' });
  }
});

// GET database summary stats
app.get('/api/stats', (req, res) => {
  try {
    const db = readDb();
    const tasks = db.tasks || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Group by month for current year
    const currentYear = new Date().getFullYear().toString();
    const monthlyStats = {};
    for (let m = 1; m <= 12; m++) {
      const monthStr = m.toString().padStart(2, '0');
      monthlyStats[monthStr] = {
        total: 0,
        completed: 0
      };
    }

    tasks.forEach(t => {
      if (t.date && t.date.startsWith(currentYear)) {
        const parts = t.date.split('-');
        const m = parts[1];
        if (monthlyStats[m]) {
          monthlyStats[m].total++;
          if (t.completed) monthlyStats[m].completed++;
        }
      }
    });

    res.json({
      success: true,
      total,
      completed,
      pending,
      completionRate,
      monthlyStats,
      dbFileSize: fs.statSync(DB_PATH).size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET application preferences/settings (e.g. darkMode) from JSON database
app.get('/api/settings', (req, res) => {
  try {
    const db = readDb();
    const darkMode = db.meta && db.meta.darkMode !== undefined ? db.meta.darkMode : false;
    res.json({
      success: true,
      settings: {
        darkMode,
        appName: db.meta?.appName || 'trame',
        city: db.meta?.city || 'Malaybalay City, Bukidnon'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST update application settings (saves dark mode directly into JSON database)
app.post('/api/settings', (req, res) => {
  try {
    const db = readDb();
    if (!db.meta) db.meta = {};
    if (req.body.darkMode !== undefined) {
      db.meta.darkMode = Boolean(req.body.darkMode);
    }
    writeDb(db);
    res.json({ success: true, settings: db.meta });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save settings to JSON database' });
  }
});

// Weather proxy endpoint for Malaybalay City
// Latitude: 8.1575, Longitude: 125.1278 (Malaybalay City, Bukidnon)
let weatherCache = { data: null, timestamp: 0 };
app.get('/api/weather', async (req, res) => {
  try {
    const now = Date.now();
    // Cache for 10 minutes to avoid hitting rate limits
    if (weatherCache.data && (now - weatherCache.timestamp < 10 * 60 * 1000)) {
      return res.json({ success: true, source: 'cache', data: weatherCache.data });
    }

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=8.1575&longitude=125.1278&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FManila';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo returned status ${response.status}`);
    }
    const rawData = await response.json();
    weatherCache = { data: rawData.current, timestamp: now };

    res.json({ success: true, source: 'live', data: rawData.current });
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    if (weatherCache.data) {
      return res.json({ success: true, source: 'stale-cache', data: weatherCache.data });
    }
    // Return sensible default for Malaybalay City if offline
    res.json({
      success: true,
      source: 'fallback',
      data: {
        temperature_2m: 25.0,
        relative_humidity_2m: 80,
        apparent_temperature: 28.0,
        is_day: 1,
        precipitation: 0.0,
        weather_code: 1,
        wind_speed_10m: 4.5
      }
    });
  }
});

// Start server
initDb();
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` ✨ Trame Webapp running at http://localhost:${PORT}`);
  console.log(` 📅 Track and Me - Scrollable Yearly Calendar`);
  console.log(` 🌦️ Weather Base: Malaybalay City (Bukidnon)`);
  console.log(` 🗄️ Primary Storage: JSON file (${DB_PATH})`);
  console.log(`=================================================`);
});

