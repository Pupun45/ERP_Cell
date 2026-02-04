require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 5000;

// 🔧 FIXED MIDDLEWARE ORDER
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// 🔥 FIXED CORS - Multiple origins
app.use(cors({
  origin: [
    'https://erp-cell.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// ===== SCHEMAS =====
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true }
});
const User = mongoose.model('User', userSchema);

const subjectSchema = new mongoose.Schema({
  branch: { type: String, required: true },
  semester: { type: String, required: true },
  subjects: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Subject = mongoose.model('Subject', subjectSchema);

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  branch: { type: String, required: true },
  salary: { type: Number, required: true },
  subjects: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Teacher = mongoose.model('Teacher', teacherSchema);

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  branch: { type: String, required: true },
  semester: { type: String, required: true },
  subjects: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Student = mongoose.model('Student', studentSchema);

// 🛡️ FIXED createAdmin FUNCTION - MOVED UP
async function createAdmin() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashed = await bcrypt.hash('admin123', 12);
      await User.create({ 
        email: 'admin@collegeerp.com', 
        password: hashed, 
        role: 'admin' 
      });
      console.log('✅ Default admin created: admin@collegeerp.com / admin123');
    } else {
      console.log('✅ Admin already exists');
    }
  } catch (err) {
    console.error('❌ Admin creation error:', err.message);
  }
}

// 🔐 FIXED Auth middleware - ASYNC
const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('🔐 Auth error:', err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// 🔥 FIXED MongoDB - NO DEPRECATED OPTIONS
let mongoReady = false;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    mongoReady = true;
  })
  .catch(err => {
    console.error('❌ MongoDB connection FAILED:', err.message);
    process.exit(1);
  });

// ===== ROUTES =====
// Health check FIRST
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// LOGIN - Most critical
app.post('/api/login', async (req, res) => {
  try {
    console.log('🔐 LOGIN attempt:', req.body.email);
    
    if (!mongoReady) {
      return res.status(503).json({ message: 'Database not ready' });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !await bcrypt.compare(password, user.password)) {
      console.log('❌ Invalid credentials for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // 🔥 FIXED COOKIES - Cross-domain Vercel→Render
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log('✅ LOGIN SUCCESS:', user.role);
    res.json({ 
      success: true, 
      role: user.role, 
      redirect: `${user.role}.html`
    });
    
  } catch (err) {
    console.error('💥 LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

app.get('/api/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Profile error' });
  }
});

// ===== ADMIN ROUTES =====
app.get('/api/branches', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const branches = await Subject.distinct('branch');
    res.json(branches || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { branch, semester, subjects } = req.body;
    const subjectList = Array.isArray(subjects) 
      ? subjects 
      : subjects.split(',').map(s => s.trim()).filter(Boolean);
    
    const subjectData = new Subject({ branch, semester, subjects: subjectList });
    await subjectData.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/teachers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, branch, salary } = req.body;
    const hashed = await bcrypt.hash(password, 12);
    const subjects = await Subject.findOne({ branch, semester: '1st' })?.subjects || [];
    
    const teacher = new Teacher({ 
      name, email: email.toLowerCase(), password: hashed, branch, salary, subjects 
    });
    await teacher.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/teachers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/students', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, rollNo, branch, semester } = req.body;
    const hashed = await bcrypt.hash(password, 12);
    const subjects = await Subject.findOne({ branch, semester })?.subjects || [];
    
    const student = new Student({ 
      name, email: email.toLowerCase(), password: hashed, rollNo, branch, semester, subjects 
    });
    await student.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/students', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// 🚀 FIXED Server Start - NO ERRORS
const startServer = async () => {
  try {
    // Wait max 30 seconds for MongoDB
    let attempts = 0;
    while (!mongoReady && attempts < 30) {
      console.log(`⏳ Waiting for MongoDB... (${attempts + 1}/30)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!mongoReady) {
      throw new Error('MongoDB connection timeout');
    }
    
    // ✅ CREATE ADMIN - NOW DEFINED
    await createAdmin();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`✅ Health: https://erp-cell.onrender.com/api/health`);
      console.log(`✅ Login: admin@collegeerp.com / admin123`);
      console.log(`✅ All APIs ready! 🎉`);
    });
  } catch (err) {
    console.error('💥 Server start failed:', err.message);
    process.exit(1);
  }
};

// Start when file loaded
startServer();
