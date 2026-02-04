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

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB - CLEAN (no warnings)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ===== SCHEMAS =====
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
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
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  branch: { type: String, required: true },
  salary: { type: Number, required: true },
  subjects: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Teacher = mongoose.model('Teacher', teacherSchema);

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  branch: { type: String, required: true },
  semester: { type: String, required: true },
  subjects: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Student = mongoose.model('Student', studentSchema);

// Create default admin
async function createAdmin() {
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const hashed = await bcrypt.hash('admin123', 12);
    await User.create({ email: 'admin@collegeerp.com', password: hashed, role: 'admin' });
    console.log('✅ Default admin created: admin@collegeerp.com / admin123');
  }
}

// Auth middleware
const auth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'No token' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ===== AUTH ROUTES =====
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, role: user.role, redirect: `${user.role}.html` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/profile', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// ===== SUBJECTS ROUTES =====
app.get('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const subjects = await Subject.find().sort({ createdAt: -1 });
  res.json(subjects);
});

app.post('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { branch, semester, subjects } = req.body;
    const subjectData = new Subject({ branch, semester, subjects: subjects.split(',').map(s => s.trim()) });
    await subjectData.save();
    res.json({ success: true, subject: subjectData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/branches', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const branches = await Subject.distinct('branch');
  res.json(branches);
});

// ===== TEACHERS ROUTES =====
app.get('/api/teachers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const teachers = await Teacher.find().sort({ createdAt: -1 });
  res.json(teachers);
});

app.post('/api/teachers', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, branch, salary } = req.body;
    const hashed = await bcrypt.hash(password, 12);
    const subjects = await Subject.findOne({ branch, semester: '1st' })?.subjects || [];
    
    const teacher = new Teacher({ 
      name, email, password: hashed, branch, salary, 
      subjects, 
      createdAt: new Date()
    });
    await teacher.save();
    res.json({ success: true, teacher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== STUDENTS ROUTES =====
app.get('/api/students', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const students = await Student.find().sort({ createdAt: -1 });
  res.json(students);
});

app.post('/api/students', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { name, email, password, rollNo, branch, semester } = req.body;
    const hashed = await bcrypt.hash(password, 12);
    const subjects = await Subject.findOne({ branch, semester })?.subjects || [];
    
    const student = new Student({ 
      name, email, password: hashed, rollNo, branch, semester, 
      subjects,
      createdAt: new Date()
    });
    await student.save();
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Start server
const startServer = async () => {
  await createAdmin();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Admin: admin@collegeerp.com / admin123`);
    console.log(`✅ Frontend: ${process.env.FRONTEND_URL || 'localhost:3000'}`);
    console.log(`✅ APIs ready: /api/subjects, /api/teachers, /api/students`);
  });
};

startServer();
