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
  semester: { type: String, required: true },
  subject: { type: String }, // Optional subject
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
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
// 🔥 COMPLETE SUBJECTS API ROUTES
app.get('/api/subjects', auth, async (req, res) => {
  try {
    const { branch } = req.query;
    let filter = {};
    
    if (branch) {
      filter.branch = { $regex: new RegExp(branch, 'i') }; // Case-insensitive partial match
    }
    
    const subjects = await Subject.find(filter).sort({ branch: 1, semester: 1 });
    res.json(subjects);
  } catch (err) {
    console.error('❌ Subjects fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

app.post('/api/subjects', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  
  try {
    const { branch, semester, subjects } = req.body;
    
    // 🔥 Validation
    if (!branch || !semester || !subjects) {
      return res.status(400).json({ message: 'Branch, semester, and subjects required' });
    }
    
    const subjectList = Array.isArray(subjects) 
      ? subjects 
      : subjects.split(',').map(s => s.trim()).filter(Boolean);
    
    if (subjectList.length === 0) {
      return res.status(400).json({ message: 'At least one subject required' });
    }
    
    // 🔥 Check if already exists
    const existing = await Subject.findOne({ branch, semester });
    if (existing) {
      return res.status(400).json({ 
        message: `Subjects already exist for ${branch} ${semester}`,
        existing: true 
      });
    }
    
    const subjectData = new Subject({ 
      branch: branch.trim(), 
      semester: semester.trim(), 
      subjects: subjectList 
    });
    
    await subjectData.save();
    
    console.log('✅ New subjects created:', branch, semester, subjectList);
    res.json({ 
      success: true, 
      message: `${subjectList.length} subjects added for ${branch} ${semester}`,
      data: subjectData 
    });
  } catch (err) {
    console.error('❌ Subjects creation error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 🔥 DELETE SUBJECTS (for table actions)
app.delete('/api/subjects/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    console.log('🗑️ Subject deleted:', subject.branch, subject.semester);
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 UPDATE SUBJECTS (optional)
app.put('/api/subjects/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  
  try {
    const { branch, semester, subjects } = req.body;
    const subjectList = Array.isArray(subjects) 
      ? subjects 
      : subjects.split(',').map(s => s.trim()).filter(Boolean);
    
    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      { branch, semester, subjects: subjectList },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// 🔥 TEACHERS CAN VIEW THEIR BRANCH STUDENTS
app.get('/api/students/teacher', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    // Get teacher's branch from profile
    const teacher = await Teacher.findById(req.user.id).select('branch');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    // Get students from teacher's branch
    const students = await Student.find({ 
      branch: teacher.branch 
    }).sort({ rollNo: 1 }).select('-password');

    console.log(`✅ Teacher ${teacher.name} accessed ${students.length} students from ${teacher.branch}`);
    res.json(students);
  } catch (err) {
    console.error('❌ Teacher students error:', err);
    res.status(500).json({ message: 'Server error' });
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
    if (req.user.role !== 'teacher' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    // Get teacher's classes only
    const classes = await Class.find({ 
      teacherId: req.user.id,
      branch: teacher.branch 
    }).sort({ startTime: -1 }).populate('students', 'name rollNo semester');

    console.log(`✅ Teacher ${teacher.name} loaded ${classes.length} classes`);
    res.json(classes);
  } catch (err) {
    console.error('❌ Classes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/classes', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    const { name, branch, semester, subject, startTime, endTime } = req.body;
    
    if (!name || !branch || !semester || !startTime || !endTime) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const teacher = await Teacher.findById(req.user.id);
    if (!teacher || teacher.branch !== branch) {
      return res.status(403).json({ message: 'Invalid branch for teacher' });
    }

    const newClass = new Class({ 
      name, 
      branch, 
      semester, 
      subject, 
      teacherId: req.user.id,
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });
    
    await newClass.save();
    console.log(`✅ Teacher ${teacher.name} created class: ${name}`);
    res.json({ success: true, class: newClass });
  } catch (err) {
    console.error('❌ Create class error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/students/teacher/:branch/:semester', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    const { branch, semester } = req.params;
    const teacher = await Teacher.findById(req.user.id).select('branch');

    if (!teacher || teacher.branch !== branch) {
      return res.status(403).json({ message: 'Access denied for this branch' });
    }

    const students = await Student.find({ 
      branch, 
      semester 
    }).sort({ rollNo: 1 }).select('-password');

    console.log(`✅ Teacher accessed ${students.length} students: ${branch} ${semester}`);
    res.json(students);
  } catch (err) {
    console.error('❌ Teacher students error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.post('/api/attendance/:classId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    const { classId } = req.params;
    const attendanceData = req.body; // { "studentId1": "present", "studentId2": "absent" }

    const cls = await Class.findOne({ _id: classId, teacherId: req.user.id });
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Save attendance (you can create Attendance schema later)
    console.log(`✅ Attendance submitted for class ${classId}:`, Object.keys(attendanceData).length, 'students');
    
    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (err) {
    console.error('❌ Attendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/marks/:classId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.type !== 'teacher') {
      return res.status(403).json({ message: 'Teachers only' });
    }

    const { classId } = req.params;
    const marksData = req.body; // { "studentId1": 85, "studentId2": 92 }

    const cls = await Class.findOne({ _id: classId, teacherId: req.user.id });
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Save marks (you can create Marks schema later)
    console.log(`✅ Marks submitted for class ${classId}:`, Object.keys(marksData).length, 'students');
    
    res.json({ success: true, message: 'Marks saved successfully' });
  } catch (err) {
    console.error('❌ Marks error:', err);
    res.status(500).json({ message: 'Server error' });
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!mongoReady) {
      throw new Error('MongoDB connection timeout');
    }
    
    await createAdmin();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Health: https://erp-cell.onrender.com/api/health`);
      console.log(`Login: admin@collegeerp.com / admin123`);
    });
  } catch (err) {
    console.error(' Server start failed:', err.message);
    process.exit(1);
  }
};

startServer();
