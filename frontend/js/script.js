const API_BASE = 'https://erp-cell.onrender.com/api'; // Replace with your Render URL

// Show message
function showMessage(text, type = 'error') {
  const msgEl = document.getElementById('message');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  setTimeout(() => msgEl.textContent = '', 5000);
}

// Login
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
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
          if (data.role === 'admin') {
            window.location.href = 'admin.html';
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
  }

  // Check auth on dashboard pages
  if (document.querySelector('.dashboard')) {
    checkAuth();
  }
});

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/profile`, { credentials: 'include' });
    if (!res.ok) {
      window.location.href = 'login.html';
      return;
    }
  } catch {
    window.location.href = 'login.html';
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/logout`, { credentials: 'include', method: 'POST' });
  } catch {}
  window.location.href = 'login.html';
}
