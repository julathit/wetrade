document.getElementById('logoutBtn').addEventListener('click', function(event) {
  event.preventDefault();
  fetch('/api/logout', {
    method: 'POST',
    credentials: 'include'
  })
  .then(response => {
    if (response.status.toString().startsWith('2')) {
        window.location.href = '/login';
    } else {
        throw new Error('Logout failed');
    }
  })
  .catch(err => console.error("Error:", err));
});

document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/admin/admin-check', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch admin check');
    }
    return response.json();
  })
  .then(data => {
    if (data.isAdmin) {
      document.getElementById('adminLink').classList.remove('hidden');
    }

    if (data.isSuperAdmin) {
      document.getElementById('superadminLink').classList.remove('hidden');
    }
  })
  .catch(err => console.error("Error:", err));
});

document.getElementById('adminLink').addEventListener('click', function(event) {
  event.preventDefault();
  window.location.href = '/dashboard/admin.html';
});

document.getElementById('superadminLink').addEventListener('click', function(event) {
  event.preventDefault();
  window.location.href = '/dashboard/superadmin.html';
});