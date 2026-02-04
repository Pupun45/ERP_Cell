const API_BASE = 'https://erp-cell.onrender.com/api';

// Show message - UNIVERSAL
function showMessage(text, type = 'error') {
  // Handle both dashboard-container and container layouts
  let msgEl = document.getElementById('message');
  if (!msgEl) {
    msgEl = document.querySelector('.message');
  }
  if (!msgEl) return;
  
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  msgEl.style.display = 'block';
  setTimeout(() => {
    msgEl.textContent = '';
    msgEl.style.display = 'none';
  }, 5000);
}

// CRITICAL: Global login flag + auth protection
window.recentlyLoggedIn = false;
window.authCheckDisabled = false;
let editingId = null;
let editingType = null;

// PERFECT auth check - NO auto-logout EVER
async function checkAuth() {
  if (window.recentlyLoggedIn) {
    console.log('⏳ Auth check SKIPPED - recent login');
    return true;
  }
  if (window.authCheckDisabled) return true;
  
  console.log('🔍 Running auth check...');
  try {
    const res = await fetch(`${API_BASE}/profile`, { 
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    console.log('Profile response:', res.status);
    if (res.ok) {
      const user = await res.json();
      console.log('✅ Auth OK:', user.email, 'Role:', user.role);
      return true;
    } else {
      console.log('❌ Auth failed:', res.status);
      return false;
    }
  } catch (err) {
    console.log('⚠️ Network error - staying logged in:', err.message);
    return true;
  }
}

// ===== DASHBOARD DETECTION =====
function detectDashboardType() {
  const path = window.location.pathname;
  if (path.includes('admin')) return 'admin';
  if (path.includes('teacher')) return 'teacher';
  if (path.includes('student')) return 'student';
  return 'unknown';
}

// ===== ADMIN EDIT FUNCTIONS =====
async function editTeacher(id, teacherData) {
  editingId = id;
  editingType = 'teacher';
  document.getElementById('teacherName').value = teacherData.name || '';
  document.getElementById('teacherEmail').value = teacherData.email || '';
  document.getElementById('teacherPassword').value = '';
  document.getElementById('teacherBranch').value = teacherData.branch || '';
  document.getElementById('teacherSalary').value = teacherData.salary || '';
  
  const btn = document.querySelector('#createTeacherForm button[type="submit"]');
  if (btn) btn.textContent = '✏️ Update Teacher';
  document.querySelector('.card:has(#createTeacherForm)')?.scrollIntoView({ behavior: 'smooth' });
  showMessage('Edit teacher details and click Update!', 'info');
}

async function editStudent(id, studentData) {
  editingId = id;
  editingType = 'student';
  document.getElementById('studentName').value = studentData.name || '';
  document.getElementById('studentEmail').value = studentData.email || '';
  document.getElementById('studentPassword').value = '';
  document.getElementById('studentRollNo').value = studentData.rollNo || '';
  document.getElementById('studentBranch').value = studentData.branch || '';
  document.getElementById('studentSemester').value = studentData.semester || '';
  
  const btn = document.querySelector('#createStudentForm button[type="submit"]');
  if (btn) btn.textContent = '✏️ Update Student';
  document.querySelector('.card:has(#createStudentForm)')?.scrollIntoView({ behavior: 'smooth' });
  showMessage('Edit student details and click Update!', 'info');
}

async function editSubject(id, subjectData) {
  editingId = id;
  editingType = 'subject';
  document.getElementById('subjectBranch').value = subjectData.branch || '';
  document.getElementById('subjectSemester').value = subjectData.semester || '';
  document.getElementById('subjectNames').value = Array.isArray(subjectData.subjects) 
    ? subjectData.subjects.join(', ') 
    : subjectData.subjects;
  
  const btn = document.querySelector('#createSubjectForm button[type="submit"]');
  if (btn) btn.textContent = '✏️ Update Subjects';
  document.querySelector('.card:has(#createSubjectForm)')?.scrollIntoView({ behavior: 'smooth' });
  showMessage('Edit subjects and click Update!', 'info');
}

function cancelEdit() {
  editingId = null;
  editingType = null;
  
  // Reset admin forms
  const forms = ['createTeacherForm', 'createStudentForm', 'createSubjectForm'];
  forms.forEach(formId => {
    const form = document.getElementById(formId);
    if (form) form.reset();
  });
  
  // Reset admin buttons
  const adminBtns = document.querySelectorAll('#createTeacherForm button[type="submit"], #createStudentForm button[type="submit"], #createSubjectForm button[type="submit"]');
  adminBtns.forEach(btn => {
    if (btn.textContent.includes('Update')) {
      if (btn.closest('#createTeacherForm')) btn.textContent = '➕ Create Teacher';
      if (btn.closest('#createStudentForm')) btn.textContent = '➕ Create Student';
      if (btn.closest('#createSubjectForm')) btn.textContent = '➕ Add Subjects';
    }
  });
  
  showMessage('Edit cancelled', 'info');
}

// ===== LOGIN =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🌐 Page loaded:', window.location.pathname);
  
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.textContent = 'Logging in...';

      try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        console.log('🔐 Logging in:', email);
        
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        console.log('Login response:', data);
        
        if (data.success) {
          window.recentlyLoggedIn = true;
          setTimeout(() => window.recentlyLoggedIn = false, 10000);
          
          // Redirect based on role
          if (data.user.role === 'teacher') {
            showMessage('Welcome Teacher! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/teacher.html', 1500);
          } else if (data.user.role === 'student') {
            showMessage('Welcome Student! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/student.html', 1500);
          } else {
            showMessage('Welcome Admin! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/admin.html', 1500);
          }
        } else {
          showMessage(data.message || 'Login failed');
        }
      } catch (err) {
        showMessage('Network error: ' + err.message);
        console.error('Login error:', err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
      }
    });
    return;
  }

  // DASHBOARD PAGES - Role-based auth
  console.log('Checking dashboard auth...');
  setTimeout(async () => {
    if (!window.recentlyLoggedIn) {
      const isAuth = await checkAuth();
      if (!isAuth) window.location.href = '/login.html';
    }
  }, 2000);

  // Initialize based on dashboard type
  const dashboardType = detectDashboardType();
  console.log('🎯 Detected dashboard:', dashboardType);
  
  setTimeout(() => {
    if (dashboardType === 'admin') initAdminDashboard();
    else if (dashboardType === 'teacher') initTeacherDashboard();
    else if (dashboardType === 'student') initStudentDashboard();
  }, 2500);
});

// PERFECT LOGOUT - Universal
document.addEventListener('click', (e) => {
  if (e.target.id === 'logoutBtn' || e.target.matches('.btn-logout, .logout-btn')) {
    e.preventDefault();
    logout();
  }
});

async function logout() {
  console.log('🔐 Manual logout');
  try {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
  } catch (e) {}
  
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'token=; path=/; domain=.onrender.com; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  window.recentlyLoggedIn = false;
  window.authCheckDisabled = false;
  showMessage('Logged out successfully!');
  setTimeout(() => window.location.href = '/login.html', 1000);
}

// ===== ADMIN DASHBOARD =====
async function initAdminDashboard() {
  console.log('🚀 Initializing admin dashboard');
  try {
    await loadProfile();
    await loadBranches();
    
    // Form event listeners
    document.getElementById('createSubjectForm')?.addEventListener('submit', createSubject);
    document.getElementById('createTeacherForm')?.addEventListener('submit', createTeacher);
    document.getElementById('createStudentForm')?.addEventListener('submit', createStudent);
    
    // Refresh buttons
    document.getElementById('refreshSubjectsBtn')?.addEventListener('click', loadSubjects);
    document.getElementById('refreshTeachersBtn')?.addEventListener('click', loadTeachers);
    document.getElementById('refreshStudentsBtn')?.addEventListener('click', loadStudents);
    
    // Preview updates
    document.getElementById('teacherBranch')?.addEventListener('change', updateTeacherSubjectsPreview);
    document.getElementById('studentBranch')?.addEventListener('change', updateStudentSubjectsPreview);
    document.getElementById('studentSemester')?.addEventListener('change', updateStudentSubjectsPreview);
    
    loadSubjects();
    loadTeachers();
    loadStudents();
  } catch (err) {
    console.error('Admin dashboard init error:', err);
  }
}

// ===== TEACHER DASHBOARD =====
async function initTeacherDashboard() {
  console.log('👨‍🏫 Initializing teacher dashboard');
  try {
    await loadTeacherProfile();
    await loadTeacherBranches();
    
    // Event listeners
    document.getElementById('createClassBtn')?.addEventListener('click', createTeacherClass);
    document.getElementById('classBranch')?.addEventListener('change', updateClassSubjectsPreview);
    document.getElementById('refreshAllBtn')?.addEventListener('click', loadTeacherProfile);
    
    loadTeacherClasses();
  } catch (err) {
    console.error('Teacher dashboard init error:', err);
  }
}

async function loadTeacherProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const teacher = await res.json();
    
    document.getElementById('teacherName').textContent = teacher.name || 'Teacher';
    document.getElementById('profileName').textContent = teacher.name || 'N/A';
    document.getElementById('profileEmail').textContent = teacher.email || 'N/A';
    document.getElementById('profileBranch').textContent = teacher.branch || 'N/A';
    document.getElementById('profileSalary').textContent = teacher.salary ? `₹${teacher.salary}` : '₹0';
    
    document.getElementById('currentUserId').textContent = teacher.name || 'Teacher';
  } catch (err) {
    console.error('Teacher profile load error:', err);
  }
}

async function loadTeacherBranches() {
  try {
    const res = await fetch(`${API_BASE}/branches`, { credentials: 'include' });
    const branches = await res.json();
    
    const branchSelect = document.getElementById('classBranch');
    if (branchSelect) {
      branchSelect.innerHTML = '<option value="">Select Branch</option>';
      branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Teacher branches load error:', err);
  }
}

async function createTeacherClass() {
  const className = document.getElementById('className').value;
  const branch = document.getElementById('classBranch').value;
  
  if (!className || !branch) {
    showMessage('Please fill class name and branch', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: className, branch })
    });
    
    const data = await res.json();
    if (data.success || res.ok) {
      showMessage('Class created successfully!', 'success');
      document.getElementById('className').value = '';
      document.getElementById('classBranch').value = '';
      loadTeacherClasses();
    } else {
      showMessage(data.message || 'Failed to create class', 'error');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message, 'error');
  }
}

async function loadTeacherClasses() {
  try {
    const res = await fetch(`${API_BASE}/classes`, { credentials: 'include' });
    const classes = await res.json();
    
    const tbody = document.getElementById('classesTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      classes.forEach(cls => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${cls.name}</td>
          <td>${cls._id.slice(-6)}</td>
          <td>${cls.students?.length || 0}</td>
          <td>${cls.branch}</td>
          <td>${new Date(cls.createdAt).toLocaleDateString()}</td>
          <td>
            <button class="action-btn btn-primary" onclick="loadAttendance('${cls._id}')">📋 Attendance</button>
            <button class="action-btn btn-success" onclick="loadMarks('${cls._id}')">✏️ Marks</button>
          </td>
        `;
      });
    }
  } catch (err) {
    console.error('Classes load error:', err);
  }
}

// ===== STUDENT DASHBOARD =====
async function initStudentDashboard() {
  console.log('👨‍🎓 Initializing student dashboard');
  try {
    await loadStudentProfile();
    
    document.getElementById('refreshAllBtn')?.addEventListener('click', loadStudentData);
    document.getElementById('loadAttendanceBtn')?.addEventListener('click', () => loadStudentAttendance());
    document.getElementById('loadMarksBtn')?.addEventListener('click', loadStudentMarks);
    
    loadStudentData();
  } catch (err) {
    console.error('Student dashboard init error:', err);
  }
}

async function loadStudentProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const student = await res.json();
    
    document.getElementById('profileName').textContent = student.name || 'Student';
    document.getElementById('profileRollNo').textContent = student.rollNo || 'N/A';
    document.getElementById('profileBranch').textContent = student.branch || 'N/A';
    document.getElementById('profileEmail').textContent = student.email || 'N/A';
    document.getElementById('profileSemester').textContent = student.semester || 'N/A';
    
    document.getElementById('currentUserId').textContent = student.rollNo || 'Student';
  } catch (err) {
    console.error('Student profile load error:', err);
  }
}

async function loadStudentData() {
  loadStudentAttendance();
  loadStudentMarks();
  loadStudentSubjects();
  loadStudentTeachers();
}


async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const user = await res.json();
    const profileEl = document.getElementById('profileName');
    if (profileEl) profileEl.textContent = user.email || 'Admin';
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

async function loadBranches() {
  try {
    const res = await fetch(`${API_BASE}/branches`, { credentials: 'include' });
    const branches = await res.json();
    
    const teacherBranch = document.getElementById('teacherBranch');
    if (teacherBranch) {
      teacherBranch.innerHTML = '<option value="">Select Branch</option>';
      branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        teacherBranch.appendChild(option);
      });
    }
    
    const studentBranch = document.getElementById('studentBranch');
    if (studentBranch) {
      studentBranch.innerHTML = '<option value="">Select Branch</option>';
      branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        studentBranch.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Branches load error:', err);
  }
}

// ===== UPDATED SUBJECTS WITH EDIT =====
async function createSubject(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  
  try {
    const branch = document.getElementById('subjectBranch').value;
    const semester = document.getElementById('subjectSemester').value;
    const subjectsInput = document.getElementById('subjectNames').value;
    
    let url = `${API_BASE}/subjects`;
    let method = 'POST';
    
    if (editingType === 'subject' && editingId) {
      url = `${API_BASE}/subjects/${editingId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ branch, semester, subjects: subjectsInput })
    });

    const data = await res.json();
    if (data.success || res.ok) {
      showMessage(editingId ? 'Subjects updated!' : 'Subjects created!', 'success');
      e.target.reset();
      document.getElementById('subjectPreview').textContent = '✅ Ready!';
      editingId = null;
      editingType = null;
      btn.textContent = '➕ Add Subjects';
      loadSubjects();
      loadBranches(); // Refresh branches dropdown
    } else {
      showMessage(data.message || 'Failed to save subjects');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadSubjects() {
  try {
    const res = await fetch(`${API_BASE}/subjects`, { credentials: 'include' });
    const subjects = await res.json();
    
    const tbody = document.getElementById('subjectsTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      subjects.forEach(subject => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${subject.branch}</td>
          <td>${subject.semester}</td>
          <td>${subject.subjects.join(', ')}</td>
          <td>${new Date(subject.createdAt).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-warning btn-sm me-1" onclick="editSubject('${subject._id}', ${JSON.stringify(subject).replace(/"/g, '&quot;')})">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser('subject', '${subject._id}')">🗑️ Delete</button>
          </td>
        `;
      });
    }
  } catch (err) {
    console.error('Subjects load error:', err);
  }
}

// ===== UPDATED TEACHERS WITH EDIT =====
async function createTeacher(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  
  try {
    const formData = {
      name: document.getElementById('teacherName').value,
      email: document.getElementById('teacherEmail').value,
      password: document.getElementById('teacherPassword').value || 'teacher123',
      branch: document.getElementById('teacherBranch').value,
      salary: parseInt(document.getElementById('teacherSalary').value)
    };
    
    let url = `${API_BASE}/teachers`;
    let method = 'POST';
    
    if (editingType === 'teacher' && editingId) {
      url = `${API_BASE}/teachers/${editingId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    if (data.success || res.ok) {
      showMessage(editingId ? 'Teacher updated!' : 'Teacher created!', 'success');
      e.target.reset();
      document.getElementById('teacherSubjectsPreview').textContent = '✅ Ready!';
      editingId = null;
      editingType = null;
      btn.textContent = '➕ Create Teacher';
      loadTeachers();
    } else {
      showMessage(data.message || 'Failed to save teacher');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadTeachers() {
  try {
    const res = await fetch(`${API_BASE}/teachers`, { credentials: 'include' });
    const teachers = await res.json();
    
    const tbody = document.getElementById('teachersTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      teachers.forEach(teacher => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${teacher.name}</td>
          <td>${teacher.email}</td>
          <td>${teacher.branch}</td>
          <td>${teacher.subjects?.join(', ') || 'N/A'}</td>
          <td>₹${teacher.salary}</td>
          <td>
            <button class="btn btn-warning btn-sm me-1" onclick="editTeacher('${teacher._id}', ${JSON.stringify(teacher).replace(/"/g, '&quot;')})">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser('teacher', '${teacher._id}')">🗑️ Delete</button>
          </td>
        `;
      });
    }
  } catch (err) {
    console.error('Teachers load error:', err);
  }
}

// ===== UPDATED STUDENTS WITH EDIT =====
async function createStudent(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  
  try {
    const formData = {
      name: document.getElementById('studentName').value,
      email: document.getElementById('studentEmail').value,
      password: document.getElementById('studentPassword').value || 'student123',
      rollNo: document.getElementById('studentRollNo').value,
      branch: document.getElementById('studentBranch').value,
      semester: document.getElementById('studentSemester').value
    };
    
    let url = `${API_BASE}/students`;
    let method = 'POST';
    
    if (editingType === 'student' && editingId) {
      url = `${API_BASE}/students/${editingId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    if (data.success || res.ok) {
      showMessage(editingId ? 'Student updated!' : 'Student created!', 'success');
      e.target.reset();
      document.getElementById('subjectsList').textContent = '-- Select Branch + Semester --';
      editingId = null;
      editingType = null;
      btn.textContent = '➕ Create Student';
      loadStudents();
    } else {
      showMessage(data.message || 'Failed to save student');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadStudents() {
  try {
    const res = await fetch(`${API_BASE}/students`, { credentials: 'include' });
    const students = await res.json();
    
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      students.forEach(student => {
        const row = tbody.insertRow();
        row.innerHTML = `
          <td>${student.name}</td>
          <td>${student.rollNo}</td>
          <td>${student.branch}</td>
          <td>${student.semester}</td>
          <td>${student.subjects?.join(', ') || 'N/A'}</td>
          <td>
            <button class="btn btn-warning btn-sm me-1" onclick="editStudent('${student._id}', ${JSON.stringify(student).replace(/"/g, '&quot;')})">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser('student', '${student._id}')">🗑️ Delete</button>
          </td>
        `;
      });
    }
  } catch (err) {
    console.error('Students load error:', err);
  }
}

function updateTeacherSubjectsPreview() {
  const branch = document.getElementById('teacherBranch').value;
  if (!branch) return;
  const previewEl = document.getElementById('teacherSubjectsPreview');
  if (previewEl) previewEl.textContent = `Subjects for ${branch}: Loading...`;
}

function updateStudentSubjectsPreview() {
  const branch = document.getElementById('studentBranch').value;
  const semester = document.getElementById('studentSemester').value;
  const subjectsList = document.getElementById('subjectsList');
  if (branch && semester && subjectsList) {
    subjectsList.textContent = `${branch} ${semester}: Loading subjects...`;
  } else if (subjectsList) {
    subjectsList.textContent = '-- Select Branch + Semester --';
  }
}

async function deleteUser(type, id) {
  if (!confirm(`Delete this ${type}?`)) return;
  
  try {
    await fetch(`${API_BASE}/${type}s/${id}`, { 
      method: 'DELETE',
      credentials: 'include' 
    });
    showMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted!`, 'success');
  } catch (err) {
    showMessage('Delete failed', 'error');
  }
  
  if (type === 'teacher') loadTeachers();
  if (type === 'student') loadStudents();
  if (type === 'subject') loadSubjects();
}
