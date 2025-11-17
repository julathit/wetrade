document.addEventListener("DOMContentLoaded", () => {
  const noti = showNotification('Loading profile...', 0);
  fetch('/api/user/profile', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    return response.json();
  })
  .then(data => {
    document.getElementById('pusername').value = data.username;
    document.getElementById('pemail').value = data.email;
    hideNotification(noti);
  })
  .catch(err => {
    console.error("Error:", err);
    hideNotification(noti);
  });
});

document.getElementById('changePasswordBtn').addEventListener('click', () => {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    Swal.fire({ 
      icon: 'error', 
      title: 'Missing Fields', 
      text: 'Please fill in all password fields.' 
    });
    return;
  }

  if (newPassword !== confirmNewPassword) {
    Swal.fire({ 
      icon: 'error', 
      title: 'Password Mismatch', 
      text: 'New passwords do not match.' 
    });
    return;
  }

  fetch('/api/change-password', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: document.getElementById('pusername').value,
      oldPassword: currentPassword,
      newPassword: newPassword,
    })
  })
  .then(response => response.json().then(data => ({ status: response.status, data })))
  .then(({ status, data }) => {
    // if status start with 4
    if (status.toString().startsWith('4')) {
      if (data.message === 'Invalid old password') {
        Swal.fire({ 
          icon: 'error', 
          title: 'Invalid old password', 
          text: 'The current password you entered is incorrect.' 
        });
        throw new Error(data.message);
      } else if (data.message === 'New password too short') {
        Swal.fire({ 
          icon: 'error', 
          title: 'New password too short', 
          text: 'New password must be at least 8 characters long.' 
        });
        throw new Error(data.message);
      } else {
        Swal.fire({ 
          icon: 'error', 
          title: 'Unexpected Error', 
          text: 'An unexpected error occurred. Please try again.' 
        });
        throw new Error(data.message);
      }
    } else if (status === 404) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Unexpected Error', 
        text: 'Try refreshing the page and try again.' 
      });
      throw new Error(data.message || 'User not found');
    } else if (!status.toString().startsWith('2')) {
      Swal.fire({ 
          icon: 'error', 
          title: 'Unexpected Error', 
          text: 'An unexpected error occurred. Please try again.' 
        });
      throw new Error(data.message || 'Unknown error');
    }
    return data;
  })
  .then(data => {
    Swal.fire({ 
      icon: 'success', 
      title: 'Password Changed', 
      text: 'Your password has been successfully changed.' 
    })
    .then(() => {
      location.reload();
    });
  })
  .catch(err => console.error("Error:", err));
});