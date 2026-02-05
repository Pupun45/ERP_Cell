const API_BASE = 'https://erp-cell.onrender.com/api';

// 🔥 SEMESTER MAPPING - Frontend → Backend
const SEMESTER_MAP = {
  '1st': '1st Semester',
  '2nd': '2nd Semester', 
  '3rd': '3rd Semester',
  '4th': '4th Semester'
};

// Show message - UNIVERSAL
function showMessage(text, type = 'error') {
  let msgEl = document.getElementById('message');
  if (!msgEl) msgEl = document.querySelector('.message');
  if (!msgEl) return;
  
  msgEl.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
  msgEl.style.display = 'block';
  setTimeout(() => {
    msgEl.innerHTML = '';
    msgEl.style.display = 'none';
  }, 5000);
}

// CRITICAL: Global login flag + auth protection
window.recentlyLoggedIn = false;
window.authCheckDisabled = false;
let editingId = null;
let editingType = null;

// DASHBOARD DETECTION
function detectDashboardType() {
  const path = window.location.pathname;
  if (path.includes('admin')) return 'admin';
  if (path.includes('teacher')) return 'teacher';
  if (path.includes('student')) return 'student';
  return 'unknown';
}

// 🔥 NEW: Load branches FROM SUBJECTS API (CSE, MBA detected automatically)
async function loadBranches() {
  try {
    const res = await fetch(`${API_BASE}/subjects`, { credentials: 'include' });
    
    if (!res.ok) {
      if (res.status !== 403) console.warn('Subjects API failed:', res.status);
      return [];
    }
    
    const subjects = await res.json();
    
    // 🔥 SAFETY CHECK: Ensure subjects is array
    if (!Array.isArray(subjects)) {
      console.error('Subjects is not array:', subjects);
      return [];
    }
    
    const branches = [...new Set(subjects.map(s => s.branch))].sort();
    
    // Rest of your existing code...
    const teacherBranch = document.getElementById('teacherBranch');
    const studentBranch = document.getElementById('studentBranch');
    const classBranch = document.getElementById('classBranch');
    const subjectBranch = document.getElementById('subjectBranch');
    
    [teacherBranch, studentBranch, classBranch, subjectBranch].forEach(dropdown => {
      if (dropdown && !dropdown.hasAttribute('data-loaded')) {
        if (dropdown.tagName === 'SELECT') {
          dropdown.innerHTML = '<option value="">Select Branch</option>' + 
            branches.map(branch => `<option value="${branch}">${branch}</option>`).join('');
        }
        dropdown.setAttribute('data-loaded', 'true');
      }
    });
    
    // Datalist for subject input
    const datalist = document.getElementById('branchSuggestions');
    if (datalist) datalist.innerHTML = branches.map(b => `<option value="${b}">`).join('');
    
    console.log('✅ Dynamic branches loaded:', branches);
    return branches;
  } catch (err) {
    console.error('❌ Branches load failed:', err);
    return [];
  }
}
// 🔥 NEW: Teacher Branch → Semesters → Subjects (3-level cascade)
async function updateTeacherSemesters(branch) {
  const semesterSelect = document.getElementById('teacherSemester');
  const previewEl = document.getElementById('teacherSubjectsPreview');
  
  if (!semesterSelect || !branch) {
    if (semesterSelect) semesterSelect.style.display = 'none';
    return;
  }
  
  semesterSelect.style.display = 'block';
  semesterSelect.disabled = true;
  semesterSelect.innerHTML = '<option value="">⏳ Loading semesters...</option>';
  
  if (previewEl) {
    previewEl.className = 'subjects-preview loading';
    previewEl.innerHTML = '<strong>📚 Subjects:</strong> <span>Loading semesters...</span>';
  }
  
  try {
    const res = await fetch(`${API_BASE}/subjects?branch=${encodeURIComponent(branch)}`, { credentials: 'include' });
    const subjects = await res.json();
    
    const semesters = [...new Set(subjects.map(item => item.semester))].sort();
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    
    semesters.forEach(semester => {
      const frontendValue = semester.replace(' Semester', '');
      const option = document.createElement('option');
      option.value = frontendValue;
      option.textContent = semester;
      semesterSelect.appendChild(option);
    });
    
    semesterSelect.disabled = false;
    
    if (previewEl && semesters.length > 0) {
      previewEl.className = 'subjects-preview success';
      previewEl.innerHTML = `<strong>📚 ${branch}:</strong> <span>${semesters.length} semesters available: ${semesters.slice(0,2).join(', ')}${semesters.length > 2 ? '...' : ''}</span>`;
    }
    
  } catch (err) {
    semesterSelect.innerHTML = '<option value="">No semesters found</option>';
    semesterSelect.disabled = false;
    if (previewEl) {
      previewEl.className = 'subjects-preview empty';
      previewEl.innerHTML = `<strong>📚 ${branch}:</strong> <span>No semesters available</span>`;
    }
  }
}

// 🔥 NEW: Teacher semester change → Show subjects
async function updateTeacherSubjectsAfterSemester() {
  const branch = document.getElementById('teacherBranch')?.value;
  const semester = document.getElementById('teacherSemester')?.value;
  const previewEl = document.getElementById('teacherSubjectsPreview');
  
  if (!branch || !semester || !previewEl) return;
  
  previewEl.className = 'subjects-preview loading';
  previewEl.innerHTML = '<strong>📚 Subjects:</strong> <span>Loading...</span>';
  
  try {
    const backendSemester = SEMESTER_MAP[semester] || `${semester} Semester`;
    const res = await fetch(`${API_BASE}/subjects?branch=${encodeURIComponent(branch)}&semester=${encodeURIComponent(backendSemester)}`, { credentials: 'include' });
    const data = await res.json();
    
    if (data.length > 0 && data[0]?.subjects?.length > 0) {
      const subjects = data[0].subjects;
      previewEl.className = 'subjects-preview success';
      previewEl.innerHTML = `
        <strong>📚 ${subjects.length} subjects:</strong> 
        ${subjects.slice(0, 3).join(', ')}${subjects.length > 3 ? ` +${subjects.length-3} more` : ''}
      `;
    } else {
      previewEl.className = 'subjects-preview empty';
      previewEl.innerHTML = `<strong>📚 No subjects</strong> for ${semester}`;
    }
  } catch (err) {
    previewEl.className = 'subjects-preview empty';
    previewEl.innerHTML = '<strong>📚 Error:</strong> Cannot load subjects';
  }
}


// 🔥 FIXED: Teacher shows ALL subjects for branch (not just 1st sem)
async function updateTeacherSubjectsPreview() {
  const branch = document.getElementById('teacherBranch')?.value;
  const previewEl = document.getElementById('teacherSubjectsPreview');
  
  if (!branch || !previewEl) return;
  
  previewEl.className = 'subjects-preview loading';
  previewEl.innerHTML = '<strong>📚 Subjects:</strong> <span>Loading all semesters...</span>';
  
  try {
    const res = await fetch(`${API_BASE}/subjects?branch=${encodeURIComponent(branch)}`, { credentials: 'include' });
    const subjectsData = await res.json();
    
    const allSubjects = subjectsData.flatMap(s => s.subjects || []);
    if (allSubjects.length > 0) {
      previewEl.className = 'subjects-preview success';
      previewEl.innerHTML = `
        <strong>📚 ${allSubjects.length} subjects:</strong> 
        ${allSubjects.slice(0, 3).join(', ')}${allSubjects.length > 3 ? ` +${allSubjects.length-3} more` : ''}
      `;
    } else {
      previewEl.className = 'subjects-preview empty';
      previewEl.innerHTML = `<strong>📚 No subjects</strong> for ${branch}`;
    }
  } catch (err) {
    previewEl.className = 'subjects-preview empty';
    previewEl.innerHTML = '<strong>📚 Error:</strong> Cannot load subjects';
  }
}


// 🔥 FIXED: Student Branch → Semesters (CSE shows 1st+3rd)
async function updateStudentSemesters(branch) {
  const semesterSelect = document.getElementById('studentSemester');
  if (!semesterSelect || !branch) return;
  
  semesterSelect.disabled = true;
  semesterSelect.innerHTML = '<option value="">⏳ Loading semesters...</option>';
  
  try {
    const res = await fetch(`${API_BASE}/subjects?branch=${encodeURIComponent(branch)}`, { credentials: 'include' });
    const subjects = await res.json();
    
    const semesters = [...new Set(subjects.map(item => item.semester))].sort();
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    
    semesters.forEach(semester => {
      const frontendValue = semester.replace(' Semester', '');
      const option = document.createElement('option');
      option.value = frontendValue;
      option.textContent = semester;
      semesterSelect.appendChild(option);
    });
    
    semesterSelect.disabled = false;
    console.log(`✅ ${branch} semesters:`, semesters);
  } catch (err) {
    semesterSelect.innerHTML = '<option value="">No semesters found</option>';
    semesterSelect.disabled = false;
  }
}


async function updateStudentSubjectsPreview() {
  const branch = document.getElementById('studentBranch')?.value;
  const semester = document.getElementById('studentSemester')?.value;
  const previewEl = document.getElementById('subjectsList');
  
  if (!branch || !semester || !previewEl) return;
  
  previewEl.className = 'subjects-preview loading';
  previewEl.innerHTML = '<strong>📚 Subjects:</strong> <span>Loading...</span>';
  
  try {
    const backendSemester = SEMESTER_MAP[semester];
    const res = await fetch(`${API_BASE}/subjects/${branch}/${backendSemester}`, { credentials: 'include' });
    const data = await res.json();
    
    if (data.subjects?.length > 0) {
      previewEl.className = 'subjects-preview success';
      previewEl.innerHTML = `
        <strong>📚 ${data.count || data.subjects.length} subjects:</strong> 
        ${data.subjects.slice(0, 3).join(', ')}${data.subjects.length > 3 ? ` +${data.subjects.length-3} more` : ''}
      `;
    } else {
      previewEl.className = 'subjects-preview empty';
      previewEl.innerHTML = '<strong>📚 No subjects</strong> found';
    }
  } catch (err) {
    previewEl.className = 'subjects-preview empty';
    previewEl.innerHTML = '<strong>📚 Error:</strong> Cannot load subjects';
  }
}
// 🔥 GLOBAL CACHE (Add after SEMESTER_MAP)
const branchSemestersCache = {};
const branchSubjectsCache = {};

// 🔥 SUBJECT CREATE PREVIEW
async function updateSubjectPreview() {
  const branch = document.getElementById('subjectBranch')?.value;
  const semester = document.getElementById('subjectSemester')?.value;
  const previewEl = document.getElementById('subjectPreview');
  
  if (!branch || !semester || !previewEl) return;
  
  const subjectsInput = document.getElementById('subjectNames')?.value;
  previewEl.style.display = 'block';
  
  if (subjectsInput) {
    const subjects = subjectsInput.split(',').map(s => s.trim()).filter(Boolean);
    previewEl.className = 'subjects-preview success';
    previewEl.innerHTML = `<strong>✅ Preview:</strong> ${subjects.join(', ')} (${subjects.length} subjects)`;
  }
}


async function editSubject(id, subjectData) {
  editingId = id;
  editingType = 'subject';
  document.getElementById('subjectBranch').value = subjectData.branch || '';
  document.getElementById('subjectSemester').value = subjectData.semester?.replace(' Semester', '') || '';
  document.getElementById('subjectNames').value = Array.isArray(subjectData.subjects) 
    ? subjectData.subjects.join(', ') 
    : subjectData.subjects;
  
  const btn = document.querySelector('#createSubjectForm button[type="submit"]');
  if (btn) btn.textContent = 'Update Subjects';
  document.querySelector('.card:has(#createSubjectForm)')?.scrollIntoView({ behavior: 'smooth' });
  showMessage('Edit subjects and click Update!', 'info');
}

function cancelEdit() {
  editingId = null;
  editingType = null;
  
  const forms = ['createTeacherForm', 'createStudentForm', 'createSubjectForm'];
  forms.forEach(formId => {
    const form = document.getElementById(formId);
    if (form) form.reset();
  });
  
  const adminBtns = document.querySelectorAll('#createTeacherForm button[type="submit"], #createStudentForm button[type="submit"], #createSubjectForm button[type="submit"]');
  adminBtns.forEach(btn => {
    if (btn.textContent.includes('Update')) {
      if (btn.closest('#createTeacherForm')) btn.textContent = 'Create Teacher';
      if (btn.closest('#createStudentForm')) btn.textContent = 'Create Student';
      if (btn.closest('#createSubjectForm')) btn.textContent = 'Add Subjects';
    }
  });
  
  showMessage('Edit cancelled', 'info');
}

// 🔥 ADMIN TABLE FUNCTIONS
async function loadSubjectsTable() {
  try {
    const res = await fetch(`${API_BASE}/subjects`, { credentials: 'include' });
    const subjects = await res.json();
    const tbody = document.getElementById('subjectsTableBody');
    if (!tbody) return;
    
    if (subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #718096; padding: 2rem;">No subjects found</td></tr>';
      return;
    }
    
    tbody.innerHTML = subjects.map(subject => `
      <tr>
        <td><strong>${subject.branch}</strong></td>
        <td>${subject.semester}</td>
        <td>${subject.subjects.slice(0, 3).join(', ')}${subject.subjects.length > 3 ? '...' : ''}</td>
        <td>${new Date(subject.createdAt).toLocaleDateString()}</td>
        <td>
          <button class="btn-warning btn-secondary me-1" onclick="editSubject('${subject._id}', ${JSON.stringify(subject).replace(/"/g, '&quot;')})">Edit</button>
          <button class="btn-danger btn-secondary" onclick="deleteSubject('${subject._id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Subjects table error:', err);
  }
}



// 🔥 FIXED DELETE FUNCTIONS - 404-PROOF
async function deleteStudent(id) {
  if (!confirm('Delete this student?')) return;
  
  try {
    const res = await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE', credentials: 'include' });
    
    if (res.ok) {
      loadStudentsTable();
      showMessage('✅ Student deleted!', 'success');
    } else if (res.status === 404) {
      showMessage('⚠️ Student already deleted', 'info');
      loadStudentsTable();
    } else {
      showMessage(`❌ Delete failed: ${res.status}`, 'error');
    }
  } catch (err) {
    showMessage('❌ Network error', 'error');
  }
}

async function deleteTeacher(id) {
  if (!confirm('Delete this teacher?')) return;
  
  try {
    const res = await fetch(`${API_BASE}/teachers/${id}`, { method: 'DELETE', credentials: 'include' });
    
    if (res.ok) {
      loadTeachersTable();
      showMessage('✅ Teacher deleted!', 'success');
    } else if (res.status === 404) {
      showMessage('⚠️ Teacher already deleted', 'info');
      loadTeachersTable();
    } else {
      showMessage(`❌ Delete failed: ${res.status}`, 'error');
    }
  } catch (err) {
    showMessage('❌ Network error', 'error');
  }
}

async function deleteSubject(id) {
  if (!confirm('Delete this subject entry?')) return;
  
  try {
    const res = await fetch(`${API_BASE}/subjects/${id}`, { method: 'DELETE', credentials: 'include' });
    
    if (res.ok) {
      loadSubjectsTable();
      showMessage('✅ Subject deleted!', 'success');
    } else if (res.status === 404) {
      showMessage('⚠️ Subject already deleted', 'info');
      loadSubjectsTable();
    } else {
      showMessage(`❌ Delete failed: ${res.status}`, 'error');
    }
  } catch (err) {
    showMessage('❌ Network error', 'error');
  }
}

// 🔥 FIXED FORM SUBMISSIONS - 404-PROOF UPDATE
async function createTeacher(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  
  // 🔥 VALIDATE PASSWORD
  const password = document.getElementById('teacherPassword').value;
  if (!password || password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    btn.disabled = false;
    return;
  }
  
  try {
    const formData = {
      name: document.getElementById('teacherName').value,
      email: document.getElementById('teacherEmail').value,
      password: password,  // 🔥 REQUIRED - No auto-generate
      branch: document.getElementById('teacherBranch').value,
      semester: document.getElementById('teacherSemester').value,
      salary: parseInt(document.getElementById('teacherSalary').value) || 0
    };
    
    let url = `${API_BASE}/teachers`;
    let method = 'POST';
    
    if (editingType === 'teacher' && editingId) {
      const checkRes = await fetch(`${API_BASE}/teachers/${editingId}`, { credentials: 'include' });
      if (!checkRes.ok) {
        showMessage('⚠️ Teacher was deleted. Create new one.', 'info');
        cancelEdit();
        btn.disabled = false;
        return;
      }
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
      showMessage(editingId ? '✅ Teacher updated!' : '✅ Teacher created!', 'success');
      e.target.reset();
      editingId = null;
      editingType = null;
      btn.textContent = 'Create Teacher';
      loadTeachersTable();
    } else {
      showMessage(data.message || 'Failed to save teacher', 'error');
    }
  } catch (err) {
    showMessage('❌ Network error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}


async function createStudent(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  
  // 🔥 VALIDATE PASSWORD
  const password = document.getElementById('studentPassword').value;
  if (!password || password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    btn.disabled = false;
    return;
  }
  
  try {
    const formData = {
      name: document.getElementById('studentName').value,
      email: document.getElementById('studentEmail').value,
      password: password,  // 🔥 REQUIRED - No auto-generate
      rollNo: document.getElementById('studentRollNo').value,
      branch: document.getElementById('studentBranch').value,
      semester: document.getElementById('studentSemester').value
    };
    
    let url = `${API_BASE}/students`;
    let method = 'POST';
    
    if (editingType === 'student' && editingId) {
      const checkRes = await fetch(`${API_BASE}/students/${editingId}`, { credentials: 'include' });
      if (!checkRes.ok) {
        showMessage('⚠️ Student was deleted. Create new one.', 'info');
        cancelEdit();
        btn.disabled = false;
        return;
      }
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
      showMessage(editingId ? '✅ Student updated!' : '✅ Student created!', 'success');
      e.target.reset();
      editingId = null;
      editingType = null;
      btn.textContent = 'Create Student';
      loadStudentsTable();
    } else {
      showMessage(data.message || 'Failed to save student', 'error');
    }
  } catch (err) {
    showMessage('❌ Network error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}


async function createSubject(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  
  try {
    const branch = document.getElementById('subjectBranch').value;
    const semester = document.getElementById('subjectSemester').value;
    const subjectsInput = document.getElementById('subjectNames').value;
    
    let url = `${API_BASE}/subjects`;
    let method = 'POST';
    
    if (editingType === 'subject' && editingId) {
      const checkRes = await fetch(`${API_BASE}/subjects/${editingId}`, { credentials: 'include' });
      if (!checkRes.ok) {
        showMessage('⚠️ Subjects were deleted. Create new ones.', 'info');
        cancelEdit();
        btn.disabled = false;
        return;
      }
      url = `${API_BASE}/subjects/${editingId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        branch, 
        semester: SEMESTER_MAP[semester] || semester, 
        subjects: subjectsInput.split(',').map(s => s.trim()).filter(Boolean) 
      })
    });

    const data = await res.json();
    if (data.success || res.ok) {
      showMessage(editingId ? '✅ Subjects updated!' : '✅ Subjects created!', 'success');
      e.target.reset();
      const previewEl = document.getElementById('subjectPreview');
      if (previewEl) previewEl.style.display = 'none';
      editingId = null;
      editingType = null;
      btn.textContent = 'Add Subjects';
      loadSubjectsTable();
    } else {
      showMessage(data.message || 'Failed to save subjects', 'error');
    }
  } catch (err) {
    showMessage('❌ Network error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// 🔥 1. FIXED loadTeachersTable() - Pass FULL data
async function loadTeachersTable() {
  try {
    const res = await fetch(`${API_BASE}/teachers`, { credentials: 'include' });
    const teachers = await res.json();
    const tbody = document.getElementById('teachersTableBody');
    
    tbody.innerHTML = teachers.map(t => `
      <tr>
        <td>${t.name}</td>
        <td>${t.email}</td>
        <td>${t.branch}</td>
        <td>${t.subjects?.slice(0,2).join(', ') || 'N/A'}</td>
        <td>₹${t.salary || 0}</td>
        <td>
          <button onclick="editTeacher('${t._id}', '${t.name}', '${t.email}', '${t.branch}', '${t.salary}')" 
                  class="btn btn-warning btn-sm me-1">Edit</button>
          <button onclick="deleteTeacher('${t._id}')" 
                  class="btn btn-danger btn-sm">Delete</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center py-4">No teachers</td></tr>';
  } catch (err) {
    console.error('Teachers error:', err);
  }
}

// 🔥 FIXED loadStudentsTable() - DYNAMIC SUBJECTS FROM API
async function loadStudentsTable() {
  try {
    const res = await fetch(`${API_BASE}/students`, { credentials: 'include' });
    const students = await res.json();
    const tbody = document.getElementById('studentsTableBody');
    
    if (!tbody) return;
    
    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No students</td></tr>';
      return;
    }
    
    // Process each student to get their subjects
    const studentsWithSubjects = await Promise.all(students.map(async (student) => {
      let subjectsDisplay = 'N/A';
      
      // 🔥 DYNAMIC: Fetch subjects for this student's branch + semester
      if (student.branch && student.semester) {
        try {
          const backendSemester = `${student.semester} Semester`;
          const subjectRes = await fetch(
            `${API_BASE}/subjects?branch=${encodeURIComponent(student.branch)}&semester=${encodeURIComponent(backendSemester)}`, 
            { credentials: 'include' }
          );
          const subjectsData = await subjectRes.json();
          
          if (subjectsData.length > 0 && subjectsData[0]?.subjects) {
            const subjects = subjectsData[0].subjects;
            subjectsDisplay = subjects.slice(0,2).join(', ') + (subjects.length > 2 ? '...' : '');
          }
        } catch (err) {
          console.error(`Subjects fetch failed for ${student.branch} ${student.semester}:`, err);
          subjectsDisplay = 'Loading...';
        }
      }
      
      return {
        ...student,
        subjectsDisplay
      };
    }));
    
    tbody.innerHTML = studentsWithSubjects.map(s => `
      <tr>
        <td>${s.name}</td>
         <td>${s.email}</td> 
        <td>${s.rollNo}</td>
        <td>${s.branch}</td>
        <td>${s.semester}</td>
        <td>${s.subjectsDisplay}</td>
        <td>
          <button onclick="editStudent('${s._id}')" 
                  class="btn btn-warning btn-sm me-1">Edit</button>
          <button onclick="deleteStudent('${s._id}')" 
                  class="btn btn-danger btn-sm">Delete</button>
        </td>
      </tr>
    `).join('');
    
  } catch (err) {
    console.error('Students table error:', err);
    document.getElementById('studentsTableBody').innerHTML = 
      '<tr><td colspan="6" class="text-center text-danger">Failed to load students</td></tr>';
  }
}


// 🔥 3. FIXED editStudent() - Single ID + API fetch
async function editStudent(id) {
  editingId = id;
  editingType = 'student';
  
  try {
    const res = await fetch(`${API_BASE}/students/${id}`, { credentials: 'include' });
    const student = await res.json();
    
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentPassword').value = ''; // Don't prefill password
    document.getElementById('studentRollNo').value = student.rollNo || '';
    document.getElementById('studentBranch').value = student.branch || '';
    document.getElementById('studentSemester').value = student.semester || '';
    
    const btn = document.querySelector('#createStudentForm button[type="submit"]');
    if (btn) btn.textContent = 'Update Student';
    
    document.querySelector('.card:has(#createStudentForm)')?.scrollIntoView({ behavior: 'smooth' });
    showMessage('✏️ Edit student details and click Update!', 'info');
  } catch (err) {
    console.error('Edit student error:', err);
    showMessage('❌ Failed to load student data', 'error');
  }
}

// 🔥 4. FIXED editTeacher() - Single ID + API fetch
async function editTeacher(id) {
  editingId = id;
  editingType = 'teacher';
  
  try {
    const res = await fetch(`${API_BASE}/teachers/${id}`, { credentials: 'include' });
    const teacher = await res.json();
    
    document.getElementById('teacherName').value = teacher.name || '';
    document.getElementById('teacherEmail').value = teacher.email || '';
    document.getElementById('teacherPassword').value = ''; // Don't prefill password
    document.getElementById('teacherBranch').value = teacher.branch || '';
    document.getElementById('teacherSemester').value = teacher.semester || '';
    document.getElementById('teacherSalary').value = teacher.salary || '';
    
    const btn = document.querySelector('#createTeacherForm button[type="submit"]');
    if (btn) btn.textContent = 'Update Teacher';
    
    document.querySelector('.card:has(#createTeacherForm)')?.scrollIntoView({ behavior: 'smooth' });
    showMessage('✏️ Edit teacher details and click Update!', 'info');
  } catch (err) {
    console.error('Edit teacher error:', err);
    showMessage('❌ Failed to load teacher data', 'error');
  }
}

async function updateClassSemesters(branch) {
  const semesterSelect = document.getElementById('classSemester');
  const previewEl = document.getElementById('classSubjectsPreview');
  
  if (!semesterSelect || !branch) {
    if (semesterSelect) semesterSelect.style.display = 'none';
    return;
  }
  
  semesterSelect.style.display = 'block';
  semesterSelect.innerHTML = '<option value="">⏳ Loading...</option>';
  semesterSelect.disabled = true;
  
  // Use cached data (FAST, NO API CALL)
  if (subjectsCache && Array.isArray(subjectsCache)) {
    const branchSubjects = subjectsCache.filter(s => s.branch === branch);
    const semesters = [...new Set(branchSubjects.map(s => s.semester))].sort();
    
    semesterSelect.innerHTML = '<option value="">Select Semester</option>';
    semesters.forEach(semester => {
      const option = document.createElement('option');
      option.value = semester;
      option.textContent = semester;
      semesterSelect.appendChild(option);
    });
    
    semesterSelect.disabled = false;
    previewEl.innerHTML = `<strong>✅ ${semesters.length} semesters:</strong> ${semesters.slice(0,2).join(', ')}${semesters.length > 2 ? '...' : ''}`;
    return;
  }
  
  // Fallback
  semesterSelect.innerHTML = '<option value="">No data available</option>';
  semesterSelect.disabled = true;
}


async function updateClassSubjectsPreview() {
  const branch = document.getElementById('classBranch')?.value;
  const semester = document.getElementById('classSemester')?.value;
  const previewEl = document.getElementById('classSubjectsPreview');
  
  if (!branch || !semester || !previewEl) return;
  
  // Use cached data ONLY (NO API CALLS)
  if (subjectsCache && Array.isArray(subjectsCache)) {
    const subjectData = subjectsCache.find(s => s.branch === branch && s.semester === semester);
    
    if (subjectData?.subjects && subjectData.subjects.length > 0) {
      const subjects = subjectData.subjects;
      previewEl.innerHTML = `
        <strong>✅ ${subjects.length} subjects:</strong><br>
        <small>${subjects.join(', ')}</small>
      `;
      document.getElementById('createClassBtn').disabled = false;
      return;
    }
  }
  
  previewEl.innerHTML = '<strong>❌ No subjects found</strong>';
  document.getElementById('createClassBtn').disabled = true;
}



// 🔥 GLOBAL SUBJECTS CACHE
let subjectsCache = null;
async function loadTeacherBranches() {
  try {
    // Try API first
    const res = await fetch(`${API_BASE}/subjects`, { credentials: 'include' });
    if (res.ok) {
      subjectsCache = await res.json();
      console.log('✅ Subjects cached:', subjectsCache.length);
    }
    
    // Populate branches from cache/API
    const branches = subjectsCache ? 
      [...new Set(subjectsCache.map(s => s.branch))].sort() : 
      ['CSE', 'MBA'];
    
    const select = document.getElementById('classBranch');
    if (select) {
      select.innerHTML = '<option value="">Select Branch</option>' + 
        branches.map(b => `<option value="${b}">${b}</option>`).join('');
      console.log('✅ Branches:', branches);
    }
  } catch (err) {
    console.warn('API failed, using fallback branches');
    const fallback = ['CSE', 'MBA'];
    const select = document.getElementById('classBranch');
    if (select) {
      select.innerHTML = '<option value="">Select Branch</option>' + 
        fallback.map(b => `<option value="${b}">${b}</option>`).join('');
    }
  }
}

// 🔥 TEACHER FUNCTIONS
async function loadTeacherProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const teacher = await res.json();
    
    document.getElementById('teacherName') && (document.getElementById('teacherName').textContent = teacher.name || 'Teacher');
    document.getElementById('profileName') && (document.getElementById('profileName').textContent = teacher.name || 'N/A');
    document.getElementById('profileEmail') && (document.getElementById('profileEmail').textContent = teacher.email || 'N/A');
    document.getElementById('profileBranch') && (document.getElementById('profileBranch').textContent = teacher.branch || 'N/A');
    document.getElementById('profileSalary') && (document.getElementById('profileSalary').textContent = teacher.salary ? `₹${teacher.salary}` : '₹0');
  } catch (err) {
    console.error('Teacher profile load error:', err);
  }
}

async function loadTeacherClasses() {
  try {
    const profileRes = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const teacher = await profileRes.json();
    const teacherBranch = teacher.branch;
    
    const res = await fetch(`${API_BASE}/classes`, { credentials: 'include' });
    const classes = await res.json();
    
    if (!Array.isArray(classes)) {
      document.getElementById('classesTableBody').innerHTML = 
        '<tr><td colspan="6" style="text-align:center;padding:40px;">No classes found</td></tr>';
      return;
    }
    
    const tbody = document.getElementById('classesTableBody');
    tbody.innerHTML = '';
    
    for (const cls of classes) {
      // 🔥 FILTER: Only show students from teacher's branch
      let studentCount = 0;
      if (cls.students && cls.students.length > 0) {
        // Fetch students and count matching branch
        try {
          const studentsRes = await fetch(`${API_BASE}/students?branch=${encodeURIComponent(teacherBranch)}`, { credentials: 'include' });
          const allStudents = await studentsRes.json();
          studentCount = allStudents.filter(s => cls.students.includes(s._id)).length;
        } catch (err) {
          studentCount = cls.students.length; // Fallback
        }
      }
      
      const row = tbody.insertRow();
      row.innerHTML = `
        <td><strong>${cls.name}</strong></td>
        <td>${cls._id.slice(-6)}</td>
        <td>${studentCount}</td>
        <td>${cls.branch}</td>
        <td>${new Date(cls.createdAt).toLocaleDateString()}</td>
        <td>
          <button class="action-btn-r btn-primary" onclick="loadAttendance('${cls._id}')">📋 Attendance</button>
          <button class="action-btn-r btn-success" onclick="loadMarks('${cls._id}')">✏️ Marks</button>
        </td>
      `;
    }
  } catch (err) {
    console.error('Classes load error:', err);
  }
}


async function createTeacherClass() {
  const className = document.getElementById('className')?.value.trim();
  const branch = document.getElementById('classBranch')?.value;
  const semester = document.getElementById('classSemester')?.value;
  
  if (!className || !branch || !semester) {
    showMessage('Please fill class name, branch & semester', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        name: className, 
        branch, 
        semester  // 🔥 Include semester
      })
    });
    
    const data = await res.json();
    if (data.success || res.ok) {
      showMessage(`✅ Class "${className}" created! ID: ${data.classId?.slice(-6)}`, 'success');
      document.getElementById('className').value = '';
      document.getElementById('classBranch').value = '';
      document.getElementById('classSemester').value = '';
      document.getElementById('classSubjectsPreview').innerHTML = 'Class created successfully!';
      document.getElementById('createClassBtn').disabled = true;
      loadTeacherClasses();
    } else {
      showMessage(data.message || 'Failed to create class', 'error');
    }
  } catch (err) {
    showMessage('Network error: ' + err.message, 'error');
  }
}


// 🔥 STUDENT FUNCTIONS (unchanged)
async function loadStudentProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const student = await res.json();
    
    document.getElementById('profileName') && (document.getElementById('profileName').textContent = student.name || 'Student');
    document.getElementById('profileRollNo') && (document.getElementById('profileRollNo').textContent = student.rollNo || 'N/A');
    document.getElementById('profileBranch') && (document.getElementById('profileBranch').textContent = student.branch || 'N/A');
    document.getElementById('profileEmail') && (document.getElementById('profileEmail').textContent = student.email || 'N/A');
    document.getElementById('profileSemester') && (document.getElementById('profileSemester').textContent = student.semester || 'N/A');
    document.getElementById('currentUserId') && (document.getElementById('currentUserId').textContent = student.rollNo || 'Student');
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

// 🔥 PLACEHOLDER FUNCTIONS
function loadAttendance(classId) {
  showMessage('Attendance feature coming soon!', 'info');
  console.log('Load attendance for class:', classId);
}

function loadMarks(classId) {
  showMessage('Marks feature coming soon!', 'info');
  console.log('Load marks for class:', classId);
}

function loadStudentAttendance() {
  const tbody = document.getElementById('attendanceBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #718096;">No attendance data available</td></tr>';
  }
}

function loadStudentMarks() {
  const tbody = document.getElementById('marksBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #718096;">No marks data available</td></tr>';
  }
}

function loadStudentSubjects() {
  const tbody = document.getElementById('subjectsBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #718096;">No subjects data available</td></tr>';
  }
}

function loadStudentTeachers() {
  const tbody = document.getElementById('teachersBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #718096;">No teachers data available</td></tr>';
  }
}

// 🔥 MAIN INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 ERP Cell - Page loaded:', window.location.pathname);
  
  // LOGIN PAGE
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
          window.recentlyLoggedIn = true;
          setTimeout(() => window.recentlyLoggedIn = false, 10000);
          
          const role = data.user.role;
          
          if (role === 'teacher') {
            showMessage(`Welcome ${data.user.name || 'Teacher'}!`, 'success');
            setTimeout(() => window.location.href = '/teacher.html', 1500);
          } else if (role === 'student') {
            showMessage(`Welcome ${data.user.name || 'Student'}!`, 'success');
            setTimeout(() => window.location.href = '/student.html', 1500);
          } else {
            showMessage(`Welcome Admin!`, 'success');
            setTimeout(() => window.location.href = '/admin.html', 1500);
          }
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
    return;
  }

  // 🔥 AUTO-LOAD EVERYTHING
 if (detectDashboardType() !== 'teacher') {
  await loadBranches(); // Admin/Student only
} // Branches first
  
  // DASHBOARD AUTH + INIT
  const dashboardType = detectDashboardType();
  console.log('Detected dashboard:', dashboardType);
  
  if (dashboardType === 'admin') {
    await initAdminDashboard();
  } else if (dashboardType === 'teacher') {
    await initTeacherDashboard();
  } else if (dashboardType === 'student') {
    await initStudentDashboard();
  }
  
  // Global event listeners
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
});

// 🔥 DASHBOARD INITIALIZERS
async function initAdminDashboard() {
  console.log('🔥 Initializing FULLY AUTO Admin Dashboard');
  
  // Load profile
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    const profile = await res.json();
    const profileEl = document.getElementById('profileName');
    if (profileEl) profileEl.textContent = profile.name || profile.email || 'Admin';
  } catch (err) {
    console.error('Profile load error:', err);
  }
  
  // Auto-load ALL tables
  loadSubjectsTable();
  loadTeachersTable();
  loadStudentsTable();
  
  // 🔥 AUTO-BIND FORM EVENTS
  document.getElementById('createSubjectForm')?.addEventListener('submit', createSubject);
  document.getElementById('createTeacherForm')?.addEventListener('submit', createTeacher);
  document.getElementById('createStudentForm')?.addEventListener('submit', createStudent);
  
  // Preview events
// 🔥 Teacher: Branch → Semesters → Subjects
document.getElementById('teacherBranch')?.addEventListener('change', (e) => {
  updateTeacherSemesters(e.target.value);
});
document.getElementById('teacherSemester')?.addEventListener('change', updateTeacherSubjectsAfterSemester);


document.getElementById('studentBranch')?.addEventListener('change', (e) => {
  updateStudentSemesters(e.target.value);
  document.getElementById('studentSemester').value = '';
});

document.getElementById('studentSemester')?.addEventListener('change', updateStudentSubjectsPreview);

// ADD Subject form dynamic semester:
document.getElementById('subjectBranch')?.addEventListener('input', (e) => {
  updateStudentSemesters(e.target.value); // Reuse for subject form too
});

  
  // Refresh buttons
  document.getElementById('refreshSubjectsBtn')?.addEventListener('click', loadSubjectsTable);
  document.getElementById('refreshTeachersBtn')?.addEventListener('click', loadTeachersTable);
  document.getElementById('refreshStudentsBtn')?.addEventListener('click', loadStudentsTable);
}

async function initTeacherDashboard() {
  console.log('🔥 Initializing Teacher Dashboard');
  await loadTeacherProfile();
  await loadTeacherBranches(); 
  await loadTeacherClasses();
  
  // 🔥 EVENT LISTENERS for cascade
   document.getElementById('classBranch')?.addEventListener('change', (e) => {
    updateClassSemesters(e.target.value);
  });
  document.getElementById('classSemester')?.addEventListener('change', updateClassSubjectsPreview);
  document.getElementById('createClassBtn')?.addEventListener('click', createTeacherClass);
}


async function initStudentDashboard() {
  console.log('🔥 Initializing Student Dashboard');
  await loadStudentProfile();
  loadStudentData();
  
  document.getElementById('refreshAllBtn')?.addEventListener('click', loadStudentData);
  document.getElementById('loadAttendanceBtn')?.addEventListener('click', loadStudentAttendance);
  document.getElementById('loadMarksBtn')?.addEventListener('click', loadStudentMarks);
}

// LOGOUT - Universal
async function logout() {
  console.log('Manual logout');
  try {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
  } catch (e) {}

  window.recentlyLoggedIn = false;
  window.authCheckDisabled = false;
  showMessage('Logged out successfully!');
  setTimeout(() => window.location.href = '/login.html', 1000);
}

// Legacy functions (for compatibility)
function updateClassSubjectsPreview() {
  const branch = document.getElementById('classBranch')?.value;
  const previewEl = document.getElementById('classSubjectsPreview');
  if (previewEl) {
    previewEl.textContent = branch ? `Subjects for ${branch}: Auto-assigned` : 'Select branch to preview subjects';
  }
}
