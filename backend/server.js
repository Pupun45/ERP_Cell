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

// FIXED MIDDLEWARE ORDER
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// PERFECT CORS - Manual headers (fixes wildcard issue)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://erp-cell.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Vary', 'Origin');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

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

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  branch: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  createdAt: { type: Date, default: Date.now }
});
const Class = mongoose.model('Class', classSchema);

// FIXED createAdmin FUNCTION
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
      console.log('Default admin created: admin@collegeerp.com / admin123');
    } else {
      console.log('Admin already exists');
    }
  } catch (err) {
    console.error('Admin creation error:', err.message);
  }
}

// FIXED Auth middleware
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
    console.error('Auth error:', err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// FIXED MongoDB
let mongoReady = false;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    mongoReady = true;
  })
  .catch(err => {
    console.error('MongoDB connection FAILED:', err.message);
    process.exit(1);
  });

// ===== ROUTES =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// 🔥 FIXED LOGIN - Check ALL user types
app.post('/api/login', async (req, res) => {
  try {
    console.log('LOGIN attempt:', req.body.email);
    
    if (!mongoReady) {
      return res.status(503).json({ message: 'Database not ready' });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let userType = 'admin';
    
    if (!user) {
      user = await Teacher.findOne({ email: email.toLowerCase() });
      userType = 'teacher';
    }
    
    if (!user) {
      user = await Student.findOne({ email: email.toLowerCase() });
      userType = 'student';
    }
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      console.log('Invalid credentials for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: userType, type: userType }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log('LOGIN SUCCESS:', userType, email);
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        email: user.email,
        role: userType,
        name: user.name || 'User'
      }
    });
    
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

// 🔥 FIXED PROFILE
app.get('/api/profile', auth, async (req, res) => {
  try {
    let user;
    
    if (req.user.type === 'teacher' || req.user.role === 'teacher') {
      user = await Teacher.findById(req.user.id).select('-password');
    } else if (req.user.type === 'student' || req.user.role === 'student') {
      user = await Student.findById(req.user.id).select('-password');
    } else {
      user = await User.findById(req.user.id).select('-password');
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.role = req.user.role || req.user.type;
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Profile error' });
  }
});

// 🔥 NEW: Subjects by branch/semester API
app.get('/api/subjects/:branch/:semester?', auth, async (req, res) => {
  try {
    const { branch, semester } = req.params;
    
    let query = { branch };
    if (semester) query.semester = semester;
    
    const subjectsData = await Subject.find(query);
    const allSubjects = subjectsData.flatMap(s => s.subjects || []);
    
    res.json({
      branch,
      semester: semester || 'All',
      subjects: [...new Set(allSubjects)],
      count: allSubjects.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 BRANCHES - Allow teachers + admin
app.get('/api/branches', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const branches = await Subject.distinct('branch');
    res.json(Array.isArray(branches) ? branches : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 CLASSES - Teacher + admin access
app.get('/api/classes', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const classes = await Class.find({}).sort({ createdAt: -1 });
    res.json(Array.isArray(classes) ? classes : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/classes', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { name, branch } = req.body;
    const newClass = new Class({ name, branch });
    await newClass.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== ADMIN ROUTES =====
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

// 🔥 FIXED TEACHERS - Accept subjects from frontend
app.post('/api/teachers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, setDefaultPassword, password, branch, salary, subjects } = req.body;
    
    let finalPassword;
    if (setDefaultPassword) {
      finalPassword = await bcrypt.hash('teacher123', 12);
    } else if (password) {
      finalPassword = await bcrypt.hash(password, 12);
    } else {
      return res.status(400).json({ message: 'Password required' });
    }
    
    const teacher = new Teacher({ 
      name, 
      email: email.toLowerCase(), 
      password: finalPassword, 
      branch, 
      salary, 
      subjects: subjects || []
    });
    await teacher.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/teachers/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, branch, salary, subjects } = req.body;
    
    const updateData = { name, branch, salary, subjects };
    if (email) updateData.email = email.toLowerCase();
    if (password) updateData.password = await bcrypt.hash(password, 12);
    
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    
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

app.delete('/api/teachers/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 FIXED STUDENTS - Accept subjects from frontend
app.post('/api/students', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, setDefaultPassword, password, rollNo, branch, semester, subjects } = req.body;
    
    let finalPassword;
    if (setDefaultPassword) {
      finalPassword = await bcrypt.hash('student123', 12);
    } else if (password) {
      finalPassword = await bcrypt.hash(password, 12);
    } else {
      return res.status(400).json({ message: 'Password required' });
    }
    
    const student = new Student({ 
      name, 
      email: email.toLowerCase(), 
      password: finalPassword, 
      rollNo, 
      branch, 
      semester, 
      subjects: subjects || []
    });
    await student.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/students/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, rollNo, branch, semester, subjects } = req.body;
    
    const updateData = { name, rollNo, branch, semester, subjects };
    if (email) updateData.email = email.toLowerCase();
    if (password) updateData.password = await bcrypt.hash(password, 12);
    
    const student = await Student.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    
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

app.delete('/api/students/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/subjects/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Server start
const startServer = async () => {
  try {
    let attempts = 0;
    while (!mongoReady && attempts < 30) {
      console.log(`Waiting for MongoDB... (${attempts + 1}/30)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!mongoReady) {
      throw new Error('MongoDB connection timeout');
    }
    
    await createAdmin();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\nServer running on port ${PORT}`);
      console.log(`Health: https://erp-cell.onrender.com/api/health`);
      console.log(`Login: admin@collegeerp.com / admin123`);
      console.log(`All APIs ready!`);
    });
  } catch (err) {
    console.error('Server start failed:', err.message);
    process.exit(1);
  }
};

startServer();
