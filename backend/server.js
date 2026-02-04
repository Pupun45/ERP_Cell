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

// FIXED CORS - Multiple origins
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

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  branch: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  createdAt: { type: Date, default: Date.now }
});
const Class = mongoose.model('Class', classSchema);

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
    console.error('❌ Auth error:', err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

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

// ===== ROUTES - CRITICAL ORDER =====
// 1. Health check FIRST
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// 2. LOGIN
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
      console.log('❌ Invalid credentials for:', email);
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

    console.log('✅ LOGIN SUCCESS:', userType, email);
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        email: user.email,
        role: userType,
        name: user.name || 'User',
        [userType === 'teacher' ? 'salary' : 'rollNo']: user.salary || user.rollNo
      }
    });
    
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. PROFILE
app.get('/api/profile', auth, async (req, res) => {
  try {
    let user;
    
    if (req.user.type === 'teacher' || req.user.role === 'teacher') {
      user = await Teacher.findById(req.user.id).select('-password');
    } 
    else if (req.user.type === 'student' || req.user.role === 'student') {
      user = await Student.findById(req.user.id).select('-password');
    } 
    else {
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

// 🔥 4. CRITICAL: SUBJECTS BY BRANCH/SEMESTER - FIXED POSITION
app.get('/api/subjects/:branch/:semester?', auth, async (req, res) => {
  try {
    console.log('🔍 Subjects API called:', req.params);
    
    const { branch, semester } = req.params;
    let query = { branch };
    
    if (semester) query.semester = semester;
    
    console.log('🔍 Querying subjects:', query);
    
    const subjectsData = await Subject.find(query);
    const allSubjects = subjectsData.flatMap(s => s.subjects || []);
    
    console.log('✅ Found subjects:', allSubjects.length, 'for', branch);
    
    res.json({
      branch,
      semester: semester || 'All',
      subjects: [...new Set(allSubjects)], 
      count: allSubjects.length
    });
  } catch (err) {
    console.error('❌ Subjects API ERROR:', err);
    res.status(500).json({ message: err.message });
  }
});

// 5. All subjects list (admin)
app.get('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Create subjects
app.post('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { branch, semester, subjects } = req.body;
    const subjectList = Array.isArray(subjects) 
      ? subjects 
      : subjects.split(',').map(s => s.trim()).filter(Boolean);
    
    const subjectData = new Subject({ branch, semester, subjects: subjectList });
    await subjectData.save();
    console.log('✅ New subjects created:', branch, semester);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. Branches list
app.get('/api/branches', auth, async (req, res) => {
  try {
    const branches = await Subject.distinct('branch');
    res.json(branches || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 8. Classes
app.get('/api/classes', auth, async (req, res) => {
  try {
    const classes = await Class.find({}).sort({ createdAt: -1 });
    res.json(classes || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/classes', auth, async (req, res) => {
  try {
    const { name, branch } = req.body;
    const newClass = new Class({ name, branch });
    await newClass.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// TEACHERS
app.post('/api/teachers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, setDefaultPassword, password, branch, salary } = req.body;
    
    let finalPassword;
    if (setDefaultPassword) {
      finalPassword = await bcrypt.hash('teacher123', 12);
    } else if (password) {
      finalPassword = await bcrypt.hash(password, 12);
    } else {
      return res.status(400).json({ message: 'Password or setDefaultPassword required' });
    }
    
    const subjects = await Subject.findOne({ branch, semester: '1st' })?.subjects || [];
    
    const teacher = new Teacher({ 
      name, 
      email: email.toLowerCase(), 
      password: finalPassword, 
      branch, 
      salary, 
      subjects 
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

// STUDENTS
app.post('/api/students', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, setDefaultPassword, password, rollNo, branch, semester } = req.body;
    
    let finalPassword;
    if (setDefaultPassword) {
      finalPassword = await bcrypt.hash('student123', 12);
    } else if (password) {
      finalPassword = await bcrypt.hash(password, 12);
    } else {
      return res.status(400).json({ message: 'Password or setDefaultPassword required' });
    }
    
    const subjects = await Subject.findOne({ branch, semester })?.subjects || [];
    
    const student = new Student({ 
      name, 
      email: email.toLowerCase(), 
      password: finalPassword, 
      rollNo, 
      branch, 
      semester, 
      subjects 
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
// 🔥 DELETE TEACHERS (add after students GET)
app.delete('/api/teachers/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    console.log('✅ Teacher deleted:', teacher.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 DELETE STUDENTS (add after teachers DELETE)
app.delete('/api/students/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    console.log('✅ Student deleted:', student.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 UPDATE TEACHERS (add after teachers POST)
app.put('/api/teachers/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, branch, salary } = req.body;
    const updateData = { name, email: email.toLowerCase(), branch, salary };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 UPDATE STUDENTS (add after students POST)
app.put('/api/students/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, rollNo, branch, semester } = req.body;
    const updateData = { name, email: email.toLowerCase(), rollNo, branch, semester };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    
    const student = await Student.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

// Delete routes (admin only)
app.delete('/api/subjects/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 404 handler - LAST
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const startServer = async () => {
  try {
    let attempts = 0;
    while (!mongoReady && attempts < 30) {
      console.log(`⏳ Waiting for MongoDB... (${attempts + 1}/30)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!mongoReady) {
      throw new Error('MongoDB connection timeout');
    }
    
    await createAdmin();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`✅ Health: https://erp-cell.onrender.com/api/health`);
      console.log(`🔐 Login: admin@collegeerp.com / admin123`);
      console.log(`📚 Subjects API: /api/subjects/CSE/1st ✅`);
      console.log(`🎉 All APIs ready!`);
    });
  } catch (err) {
    console.error('❌ Server start failed:', err.message);
    process.exit(1);
  }
};

startServer();
