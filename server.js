const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const login_auth= require("./models/user_login.js");
const user_tasks = require("./models/user_tasks.js");
const Habit = require("./models/habits.js");
const DashboardStats = require("./models/dashboard_stats.js");
const ChatHistory = require("./models/chat_history.js");
const Schedule = require("./models/schedule.js");
const app = express();
const session = require("express-session");
const MongoStore = require("connect-mongo");
require('dotenv').config();
const mongoose = require('mongoose');
const HABITS_FILE = path.join(__dirname, 'data', 'habits.json');
const TASKS_FILE = path.join(__dirname, 'data', 'tasks.json');
const SCHEDULE_FILE = path.join(__dirname, 'data', 'schedule.json');
const ENERGY_FILE = path.join(__dirname, 'data', 'energy.json');
const calendar_file = path.join(__dirname, 'data', 'calendar.json');
const dashboard_file = path.join(__dirname, 'data', 'dashboard.json');
const deepwork_file = path.join(__dirname , 'data', 'deepwork.json');

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MongoDB connection URI not found. Set MONGODB_URI in your .env or environment.');
  process.exit(1);
}

function auth(req, res, next) {
  if (req.session && req.session.userid) return next();
  return res.status(500).json({ error: 'incorrect userid or password' });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: { secure: false }
}));

app.get('/check-session', (req, res) => res.json(req.session));
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected '))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
app.use('/css', express.static(path.join(__dirname, 'css')));
app.set('views', path.join(__dirname, "views"));
app.set('view engine', 'ejs');
app.use('/js', express.static(path.join(__dirname, 'js')));

const readHabits = () => {
  try {
    return JSON.parse(fs.readFileSync(HABITS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
};
const readTasks = () => {
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
};
const readSchedule = () => {
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
};
const readEnergy = () => {
  try {
    return JSON.parse(fs.readFileSync(ENERGY_FILE, 'utf8'));
  } catch (error) {
    return { energy: 3 };
  }
};
const read_calendar = () => {
  try {
    return JSON.parse(fs.readFileSync(calendar_file, 'utf8'));
  } catch (error) {
    return [];
  }
};
const read_dashboard = () => {
  try {
    return JSON.parse(fs.readFileSync(dashboard_file, 'utf8'));
  } catch (error) {
    return [];
  }
};
const read_deepwork= () => {
  try {
    return JSON.parse(fs.readFileSync(deepwork_file, 'utf8'));
  } catch (error) {
    return [];
  }
};

const writeHabits = (habits) => {
  fs.writeFileSync(HABITS_FILE, JSON.stringify(habits, null, 2));
};
const writeTasks = (tasks) => {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
};
const writeSchedule = (schedule) => {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
};
const writeEnergy = (energy) => {
  fs.writeFileSync(ENERGY_FILE, JSON.stringify({ energy }, null, 2));
};
const writecalendar = (calendar) => {
  fs.writeFileSync(calendar_file, JSON.stringify(calendar, null, 2));
};
const writedeepwork = (deepwork) => {
  fs.writeFileSync(deepwork_file, JSON.stringify(deepwork, null, 2));
};
const writedashboard = (dashboard) => {
  fs.writeFileSync(dashboard_file, JSON.stringify(dashboard, null, 2));
};
const verifyUsernameSession = async (req, res, next) => {
  if (!req.session?.userid) {
    return res.redirect('/');
  }
  try {
    const user = await login_auth.findById(req.session.userid).select('email');
    if (!user) {
      return res.redirect('/');
    }
    const expectedUsername = user.email.split('@')[0];
    if (req.params.username !== expectedUsername) {
      // Correct the path to point to their own profile username
      const page = req.path.split('/').pop();
      return res.redirect(`/${expectedUsername}/${page}`);
    }
    req.userEmail = user.email;
    next();
  } catch (err) {
    console.error('Session validation error:', err);
    res.redirect('/');
  }
};

app.get('/:username/index', verifyUsernameSession, (req, res) => {
  res.render('index', { userEmail: req.userEmail });
});

app.get('/:username/calendar', verifyUsernameSession, (req, res) => {
  res.render('calendar', { userEmail: req.userEmail });
});

app.get('/:username/habits', verifyUsernameSession, (req, res) => {
  res.render('habits', { userEmail: req.userEmail });
});

app.get('/:username/deepwork', verifyUsernameSession, (req, res) => {
  res.render('deepwork', { userEmail: req.userEmail });
});

app.get('/', async (req, res) => {
  if (req.session?.userid) {
    try {
      const user = await login_auth.findById(req.session.userid).select('email');
      if (user) {
        const username = user.email.split('@')[0];
        return res.redirect(`/${username}/index`);
      }
    } catch (err) {
      console.error(err);
    }
  }
  res.render('login', { error: req.query.error || null, success: req.query.success || null });
});

app.get('/login', (req, res) => {
  res.redirect('/');
});

app.get('/signup', (req, res) => {
  res.render('signup', { error: req.query.error || null, success: req.query.success || null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.redirect('/?error=Please provide email and password');

  const user = await login_auth.findOne({ email });
  if (!user) return res.redirect('/?error=incorrect password or gmail');
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.redirect('/?error=incorrect password or gmail');

  req.session.userid = user._id;
  const username = user.email.split('@')[0];
  res.redirect(`/${username}/index`);
});
app.post('/signup', async(req, res)=>{
   const { fullname ,email, password } = req.body;
  const ifexist = await login_auth.findOne({ email });
  if (ifexist) return res.redirect('/signup?error=Email already registered');

  const hashed = await bcrypt.hash(password, 10);
  await new login_auth({ fullname, email, password: hashed }).save();
  res.redirect('/?success=Account created! Please login');
})

async function callGemini(prompt, history = [], tasks = [], localDate) {
  const apiKey = process.env.GEMNI_API;
  if (!apiKey) {
    console.error("GEMNI_API key not found in environment variables");
    return { reply: "Aegis AI key is missing. Please configure GEMNI_API in your .env file.", action: null };
  }

  const models = [
    "gemini-3.5-flash", 
    "gemini-3.1-flash-lite", 
    "gemini-2.5-flash-lite", 
    "gemini-2.0-flash", 
    "gemini-2.0-flash-lite"
  ];
  let lastError = null;

  const taskContext = tasks.map(t => ({
    title: t.title,
    category: t.category,
    duration: t.duration,
    energy: t.energy,
    deadline: t.deadline,
    completed: t.completed
  }));

  const systemPrompt = `You are Aegis, a proactive and intelligent AI productivity companion.
You are helping the user manage their daily schedule, tasks, habits, and focus loops.
You have access to their active tasks: ${JSON.stringify(taskContext)}.

Today's reference date is: ${localDate || new Date().toISOString().split('T')[0]}. Use this reference date to compute relative date targets (for example, "tomorrow" would be calculated relative to this date, and "1st july 2026" is "2026-07-01").

When the user asks you to:
1. Create, add, or register a task: include action {"type": "add_task", "data": {"title": "Task title", "category": "Work|Coding|Personal|Admin", "duration": 1.5, "energy": 3, "deadlineDays": 1}}
2. Optimize, schedule, or block time for their day/tasks: include action {"type": "optimize_schedule"}.
3. Start a focus session or deep work (e.g. "focus on slides", "start deep work"): include action {"type": "start_focus", "data": {"taskTitle": "Task title to focus on"}}.
4. View or check habits/streaks: include action {"type": "view_habits"}.
5. Schedule a meeting, call, block time, or appointment directly on their calendar for a specific time and date (e.g., "schedule a meeting at 10 am on 1st july 2026"): you MUST include action {"type": "add_schedule", "data": {"title": "Meeting / Event Title", "date": "YYYY-MM-DD", "startHour": 10.0, "duration": 1.0, "category": "Work"}}

You MUST return your response strictly as a JSON object matching the following schema. Return ONLY raw JSON text. Do NOT wrap it in markdown code blocks or backticks:
{
  "reply": "Conversational, direct, encouraging reply to the user...",
  "action": null | { "type": "add_task" | "optimize_schedule" | "start_focus" | "view_habits" | "add_schedule", "data": Object }
}`;

  const contents = [];

  contents.push({
    role: 'user',
    parts: [{ text: systemPrompt }]
  });

  contents.push({
    role: 'model',
    parts: [{ text: `{"reply": "Aegis online. Task configurations loaded.", "action": null}` }]
  });
  
  history.forEach(msg => {
    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  });

  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const payload = {
    contents: contents
  };

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${model} failed with status ${response.status}:`, errorText);
        lastError = { status: response.status, text: errorText };
        continue;
      }

      const data = await response.json();
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!replyText) {
        lastError = { status: 500, text: "Received empty reply from model." };
        continue;
      }

      let cleaned = replyText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      }

      try {
        return JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse Gemini JSON:", replyText, parseErr);
        return { reply: replyText, action: null };
      }
    } catch (err) {
      console.error(`Network fetch error calling model ${model}:`, err);
      lastError = err;
    }
  }

  // All models failed
  console.error("All models failed. Last error:", lastError);
  return { 
    reply: `I could not resolve an active model on your API key. (Last error: ${lastError ? (lastError.text || lastError.message || JSON.stringify(lastError)) : 'unknown'})`, 
    action: null 
  };
}

app.get('/api/chat', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const history = await ChatHistory.find({ userId: req.session.userid }).sort({ timestamp: 1 }).lean();
    if (history.length === 0) {
      return res.json([
        {
          sender: 'assistant',
          text: "Greetings. I am Aegis, your proactive productivity companion. You can talk to me, type commands, or ask for schedule optimizations. Try speaking: 'Add task Review financial metrics by tomorrow' or 'Start deep work'."
        }
      ]);
    }
    res.json(history);
  } catch (err) {
    console.error("Error reading chat history:", err);
    res.status(500).json({ error: "Failed to read chat history." });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { message, localDate } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const userId = req.session.userid;

    const userMsg = new ChatHistory({
      userId,
      sender: 'user',
      text: message.trim()
    });
    await userMsg.save();

    const historyDocs = await ChatHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(15)
      .lean();
    
    const contextHistory = historyDocs.reverse();
    contextHistory.pop(); // remove current message

    const activeTasks = await user_tasks.find({ userId, completed: false }).lean();

    const geminiResult = await callGemini(message.trim(), contextHistory, activeTasks, localDate);

    if (geminiResult.action && geminiResult.action.type === 'add_task') {
      const taskData = geminiResult.action.data;
      const days = taskData.deadlineDays || 1;
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + days);

      const newTask = new user_tasks({
        userId,
        title: taskData.title || 'New Task',
        priority: taskData.priority || 3,
        duration: taskData.duration || 1,
        energy: taskData.energy || 3,
        deadline: deadline,
        category: taskData.category || 'Work',
        completed: false,
        subtasks: []
      });
      await newTask.save();
      geminiResult.action.taskId = newTask._id.toString();
    }

    if (geminiResult.action && geminiResult.action.type === 'add_schedule') {
      const scheduleData = geminiResult.action.data;
      const newEvent = new Schedule({
        userId,
        id: `ai-s-${Date.now()}`,
        title: scheduleData.title || "AI Event",
        date: scheduleData.date || new Date().toISOString().split('T')[0],
        startHour: Number(scheduleData.startHour),
        duration: Number(scheduleData.duration) || 1.0,
        category: scheduleData.category || 'Work',
        locked: false
      });
      await newEvent.save();
      geminiResult.action.scheduleId = newEvent.id;
    }

    const assistantMsg = new ChatHistory({
      userId,
      sender: 'assistant',
      text: geminiResult.reply || ''
    });
    await assistantMsg.save();

    res.json({
      reply: geminiResult.reply,
      action: geminiResult.action
    });
  } catch (err) {
    console.error("Error processing chat message:", err);
    res.status(500).json({ error: "Failed to process message." });
  }
});

app.delete('/api/chat', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await ChatHistory.deleteMany({ userId: req.session.userid });
    res.json({ success: true });
  } catch (err) {
    console.error("Error clearing chat history:", err);
    res.status(500).json({ error: "Failed to clear chat history." });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await login_auth.findById(req.session.userid).select('fullname email').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    console.error("Error fetching profile details:", err);
    res.status(500).json({ error: 'Failed to retrieve profile details.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/api/habits', async (req, res) => {
  try {
    if (req.session?.userid) {
      const dbHabits = await Habit.find({ userId: req.session.userid }).lean();
      return res.json(dbHabits.map(habit => ({
        id: habit.id,
        name: habit.name,
        streak: habit.streak,
        lastChecked: habit.lastChecked ? habit.lastChecked.toISOString() : null,
        completedToday: habit.completedToday,
        microHabit: habit.microHabit
      })));
    }

    res.json(readHabits());
  } catch (error) {
    console.error('Error fetching habits:', error);
    res.status(500).json({ error: 'Failed to read habits data.' });
  }
});

app.post('/api/habits', async (req, res) => {
  try {
    const habits = Array.isArray(req.body) ? req.body : [req.body];
    writeHabits(habits);

    if (req.session?.userid) {
      await Habit.deleteMany({ userId: req.session.userid });
      if (habits.length > 0) {
        const habitDocs = habits.map(habit => ({
          userId: req.session.userid,
          id: habit.id,
          name: habit.name,
          streak: habit.streak,
          lastChecked: habit.lastChecked ? new Date(habit.lastChecked) : null,
          completedToday: habit.completedToday,
          microHabit: habit.microHabit
        }));
        await Habit.insertMany(habitDocs);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save habits data:', error);
    res.status(500).json({ error: 'Failed to save habits data.' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    if (req.session?.userid) {
      const dbTasks = await user_tasks.find({ userId: req.session.userid }).lean();
      return res.json(dbTasks.map(task => ({
        id: task._id.toString(),
        title: task.title,
        priority: task.priority,
        duration: task.duration,
        energy: task.energy,
        deadline: task.deadline ? task.deadline.toISOString() : null,
        category: task.category,
        completed: task.completed,
        subtasks: task.subtasks || []
      })));
    }

    res.json(readTasks());
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to read tasks data.' });
  }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.json({ pending: 0, rate: 0, finished: 0 });
    }

    const stats = await DashboardStats.findOne({ userId: req.session.userid }).lean();
    if (!stats) {
      return res.json({ pending: 0, rate: 0, finished: 0 });
    }

    res.json({ pending: stats.pending, rate: stats.rate, finished: stats.finished });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to read dashboard stats.' });
  }
});

app.post('/api/dashboard-stats', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { pending, rate, finished } = req.body || {};
    await DashboardStats.findOneAndUpdate(
      { userId: req.session.userid },
      { userId: req.session.userid, pending, rate, finished, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save dashboard stats:', error);
    res.status(500).json({ error: 'Failed to save dashboard stats.' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const payload = req.body;
    const tasks = Array.isArray(payload) ? payload : [payload];
    writeTasks(tasks);

    if (req.session?.userid) {
      await user_tasks.deleteMany({ userId: req.session.userid });
      if (tasks.length > 0) {
        const taskDocs = tasks.map(task => ({
          userId: req.session.userid,
          title: task.title,
          priority: task.priority,
          duration: task.duration,
          energy: task.energy,
          deadline: task.deadline ? new Date(task.deadline) : undefined,
          category: task.category,
          completed: task.completed,
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
        }));
        await user_tasks.insertMany(taskDocs);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save tasks data:', error);
    res.status(500).json({ error: 'Failed to save tasks data.' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const currentTasks = Array.isArray(readTasks()) ? readTasks() : [];
    const remainingTasks = currentTasks.filter(task => task.id !== taskId && task._id?.toString() !== taskId);
    writeTasks(remainingTasks);

    if (req.session?.userid) {
      await user_tasks.deleteOne({ _id: taskId, userId: req.session.userid });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

app.get('/api/schedule', async (req, res) => {
  try {
    if (req.session?.userid) {
      const dbSchedules = await Schedule.find({ userId: req.session.userid }).lean();
      return res.json(dbSchedules.map(item => ({
        id: item.id,
        taskId: item.taskId,
        title: item.title,
        date: item.date,
        startHour: item.startHour,
        duration: item.duration,
        category: item.category,
        locked: item.locked
      })));
    }
    res.json([]);
  } catch (error) {
    console.error('Failed to read schedule data:', error);
    res.status(500).json({ error: 'Failed to read schedule data.' });
  }
});

app.post('/api/schedule', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.session.userid;
    const payload = req.body;
    const newSchedules = Array.isArray(payload) ? payload : [payload];

    await Schedule.deleteMany({ userId });
    
    if (newSchedules.length > 0) {
      const scheduleDocs = newSchedules.map(item => ({
        userId,
        id: item.id || `s-${Date.now()}-${Math.random()}`,
        taskId: item.taskId || null,
        title: item.title,
        date: item.date || new Date().toISOString().split('T')[0],
        startHour: Number(item.startHour),
        duration: Number(item.duration),
        category: item.category || 'Work',
        locked: !!item.locked
      }));
      await Schedule.insertMany(scheduleDocs);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save schedule data:', error);
    res.status(500).json({ error: 'Failed to save schedule data.' });
  }
});

app.get('/api/energy', async (req, res) => {
  try {
    if (req.session?.userid) {
      const stats = await DashboardStats.findOne({ userId: req.session.userid }).lean();
      return res.json({ energy: stats ? (stats.energy ?? 3) : 3 });
    }
    res.json({ energy: 3 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read energy data.' });
  }
});

app.post('/api/energy', async (req, res) => {
  try {
    if (!req.session?.userid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const energy = Number(req.body.energy) || 3;
    await DashboardStats.findOneAndUpdate(
      { userId: req.session.userid },
      { userId: req.session.userid, energy, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save energy data.' });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    if (req.session?.userid) {
      const userId = req.session.userid;
      await user_tasks.deleteMany({ userId });
      await Habit.deleteMany({ userId });
      await ChatHistory.deleteMany({ userId });
      await DashboardStats.findOneAndUpdate(
        { userId },
        { pending: 0, rate: 0, finished: 0, energy: 3, updatedAt: new Date() },
        { upsert: true }
      );
      
      const allSchedules = readSchedule();
      const otherSchedules = allSchedules.filter(item => item.userId !== userId.toString());
      writeSchedule(otherSchedules);
      
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Not authenticated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset app data.' });
  }
});

app.listen(5005,()=>{
  console.log("server running at port http://localhost:5005");
});
