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