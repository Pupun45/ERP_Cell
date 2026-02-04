const API_BASE = 'https://erp-cell.onrender.com/api';

// Show message
function showMessage(text, type = 'error') {
  const msgEl = document.getElementById('message');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  setTimeout(() => msgEl.textContent = '', 5000);
}

// FIXED: Prevent auto-logout flag
let isAuthenticated = false;
let authCheckPending = false;

// DELAYED auth check with protection
async function checkAuth() {
  if (authCheckPending || isAuthenticated) return;
  authCheckPending = true;
  
  // Wait 2 seconds for cookie to fully set
  setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/profile`, { 
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (res.ok) {
        isAuthenticated = true;
        console.log('✅ Auth confirmed');
      } else {
        if (!window.location.pathname.includes('login')) {
          window.location.href = '/login.html';
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      if (!window.location.pathname.includes('login')) {
        window.location.href = '/login.html';
      }
    } finally {
      authCheckPending = false;
    }
  }, 2000);
}

// ===== LOGIN FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded:', window.location.pathname);
  
  // Login page - NO auth check
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
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        console.log('Login response:', data);
        
        if (data.success) {
          showMessage('Login successful! Redirecting...', 'success');
          // Reset auth flags for clean redirect
          isAuthenticated = false;
          authCheckPending = false;
          
          setTimeout(() => {
            window.location.href = '/admin.html';
          }, 1200); // Give cookie time to set
        } else {
          showMessage(data.message || 'Login failed');
        }
      } catch (err) {
        showMessage('Network error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
      }
    });
    return; // Skip all other checks on login page
  }

  // Dashboard pages - DELAYED auth check
  checkAuth();

  // Admin dashboard
  if (document.querySelector('.container')) {
    setTimeout(initAdminDashboard, 2500); // Wait for auth
  }
});

// FIXED LOGOUT BUTTON - Global event listener
document.addEventListener('click', (e) => {
  if (e.target.id === 'logoutBtn' || e.target.classList.contains('btn-logout')) {
    e.preventDefault();
    logout();
  }
});

async function logout() {
  console.log('🔐 Logging out...');
  
  try {
    await fetch(`${API_BASE}/logout`, { 
      method: 'POST', 
      credentials: 'include' 
    });
  } catch (err) {
    console.log('Logout API failed (normal):', err);
  }
  
  // Clear everything
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.onrender.com';
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  
  // Reset auth state
  isAuthenticated = false;
  authCheckPending = false;
  
  showMessage('Logged out successfully', 'success');
  
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 800);
}

// ===== ADMIN DASHBOARD FUNCTIONS =====
async function initAdminDashboard() {
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
    
    // Dynamic previews
    document.getElementById('teacherBranch')?.addEventListener('change', updateTeacherSubjectsPreview);
    document.getElementById('studentBranch')?.addEventListener('change', updateStudentSubjectsPreview);
    document.getElementById('studentSemester')?.addEventListener('change', updateStudentSubjectsPreview);
    
    // Load data
    loadSubjects();
    loadTeachers();
    loadStudents();
  } catch (err) {
    console.error('Dashboard init error:', err);
  }
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const user = await res.json();
    const profileEl = document.getElementById('profileName');
    if (profileEl) {
      profileEl.textContent = user.email || 'Admin';
    }
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

// ===== SUBJECTS (unchanged) =====
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

async function createSubject(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const branch = document.getElementById('subjectBranch').value;
    const semester = document.getElementById('subjectSemester').value;
    const subjectsInput = document.getElementById('subjectNames').value;
    
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ branch, semester, subjects: subjectsInput })
    });

    const data = await res.json();
    if (data.success) {
      showMessage('Subjects created successfully!', 'success');
      e.target.reset();
      document.getElementById('subjectPreview').textContent = '✅ Subjects added!';
      loadSubjects();
    } else {
      showMessage(data.message || 'Failed to create subjects');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '➕ Add Subjects';
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
        `;
      });
    }
  } catch (err) {
    console.error('Subjects load error:', err);
  }
}

// ===== TEACHERS & STUDENTS (keep existing functions unchanged) =====
async function createTeacher(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const formData = {
      name: document.getElementById('teacherName').value,
      email: document.getElementById('teacherEmail').value,
      password: document.getElementById('teacherPassword').value,
      branch: document.getElementById('teacherBranch').value,
      salary: document.getElementById('teacherSalary').value
    };

    const res = await fetch(`${API_BASE}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    if (data.success) {
      showMessage('Teacher created successfully!', 'success');
      e.target.reset();
      document.getElementById('teacherSubjectsPreview').textContent = '✅ Teacher added!';
      loadTeachers();
    } else {
      showMessage(data.message || 'Failed to create teacher');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '➕ Create Teacher';
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
          <td><button class="btn btn-danger btn-sm" onclick="deleteUser('teacher', '${teacher._id}')">Delete</button></td>
        `;
      });
    }
  } catch (err) {
    console.error('Teachers load error:', err);
  }
}

async function createStudent(e) {
  // Same as your existing createStudent function
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const formData = {
      name: document.getElementById('studentName').value,
      email: document.getElementById('studentEmail').value,
      password: document.getElementById('studentPassword').value,
      rollNo: document.getElementById('studentRollNo').value,
      branch: document.getElementById('studentBranch').value,
      semester: document.getElementById('studentSemester').value
    };

    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    if (data.success) {
      showMessage('Student created successfully!', 'success');
      e.target.reset();
      document.getElementById('subjectsList').textContent = '-- Select Branch + Semester --';
      loadStudents();
    } else {
      showMessage(data.message || 'Failed to create student');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '➕ Create Student';
  }
}

async function loadStudents() {
  // Same as your existing loadStudents function
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
          <td><button class="btn btn-danger btn-sm" onclick="deleteUser('student', '${student._id}')">Delete</button></td>
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
  if (previewEl) {
    previewEl.textContent = `Subjects for ${branch}: Loading...`;
  }
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
  showMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted!`, 'success');
  if (type === 'teacher') loadTeachers();
  if (type === 'student') loadStudents();
}
