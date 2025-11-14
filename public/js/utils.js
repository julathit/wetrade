function showNotification(message, duration = 3000) {
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  container.appendChild(toast);

  // Auto hide after duration
  if (duration > 0) {
    setTimeout(() => hideNotification(toast), duration);
  }

  return toast; // Return reference if you want to hide manually
}

function hideNotification(toast) {
  toast.style.animation = 'toast-out 0.5s forwards';
  toast.addEventListener('animationend', () => toast.remove());
}