const API_BASE = 'https://erp-cell.onrender.com/api'; // Your Render backend

// Show message
function showMessage(text, type = 'error') {
  const msgEl = document.getElementById('message');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  setTimeout(() => msgEl.textContent = '', 5000);
}

// ===== LOGIN FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', () => {
  // Login page
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
        if (data.success) {
          showMessage('Login successful!', 'success');
          window.location.href = data.redirect || `${data.role}.html`;
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
  }

  // Check auth on dashboard pages
  if (document.querySelector('.dashboard, .container')) {
    checkAuth();
  }

  // Admin dashboard
  if (document.getElementById('adminDashboard')) {
    initAdminDashboard();
  }
});

// ===== AUTH FUNCTIONS =====
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
  } catch {
    window.location.href = '/login.html';
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/logout`, { credentials: 'include', method: 'POST' });
  } catch {}
  window.location.href = '/login.html';
}

// ===== ADMIN DASHBOARD FUNCTIONS =====
async function initAdminDashboard() {
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
  
  // Logout button
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Load all data
  loadSubjects();
  loadTeachers();
  loadStudents();
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const user = await res.json();
    document.getElementById('profileName').textContent = user.email;
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

// ===== SUBJECTS =====
async function loadBranches() {
  try {
    const res = await fetch(`${API_BASE}/branches`, { credentials: 'include' });
    const branches = await res.json();
    
    // Update teacher dropdown
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
    
    // Update student dropdown
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
  } catch (err) {
    console.error('Subjects load error:', err);
  }
}

// ===== TEACHERS =====
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
    tbody.innerHTML = '';
    
    teachers.forEach(teacher => {
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>${teacher.name}</td>
        <td>${teacher.email}</td>
        <td>${teacher.branch}</td>
        <td>${teacher.subjects.join(', ') || 'N/A'}</td>
        <td>₹${teacher.salary}</td>
        <td><button class="btn btn-danger" onclick="deleteUser('teacher', '${teacher._id}')">Delete</button></td>
      `;
    });
  } catch (err) {
    console.error('Teachers load error:', err);
  }
}

// ===== STUDENTS =====
async function createStudent(e) {
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
  try {
    const res = await fetch(`${API_BASE}/students`, { credentials: 'include' });
    const students = await res.json();
    
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';
    
    students.forEach(student => {
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>${student.name}</td>
        <td>${student.rollNo}</td>
        <td>${student.branch}</td>
        <td>${student.semester}</td>
        <td>${student.subjects.join(', ') || 'N/A'}</td>
        <td><button class="btn btn-danger" onclick="deleteUser('student', '${student._id}')">Delete</button></td>
      `;
    });
  } catch (err) {
    console.error('Students load error:', err);
  }
}

function updateTeacherSubjectsPreview() {
  const branch = document.getElementById('teacherBranch').value;
  if (!branch) return;
  
  // Preview subjects for selected branch
  document.getElementById('teacherSubjectsPreview').textContent = 
    `Subjects for ${branch}: Loading...`;
}

function updateStudentSubjectsPreview() {
  const branch = document.getElementById('studentBranch').value;
  const semester = document.getElementById('studentSemester').value;
  
  if (branch && semester) {
    document.getElementById('subjectsList').textContent = 
      `${branch} ${semester}: Loading subjects...`;
  } else {
    document.getElementById('subjectsList').textContent = '-- Select Branch + Semester --';
  }
}

// Delete function (placeholder)
async function deleteUser(type, id) {
  if (!confirm(`Delete this ${type}?`)) return;
  
  try {
    // Add delete API to backend later
    showMessage(`${type} deleted successfully!`, 'success');
    if (type === 'teacher') loadTeachers();
    if (type === 'student') loadStudents();
  } catch (err) {
    showMessage('Delete failed');
  }
}
