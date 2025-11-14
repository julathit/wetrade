document.getElementById("saveaccount").addEventListener("click", () => {
  if (!document.getElementById("accountName").value || !document.getElementById("accountTaxYear").value) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Please fill in all required fields.'
    });
    return;
  }
  fetch('/api/user/account', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: document.getElementById("accountName").value,
      tax_year: document.getElementById("accountTaxYear").value
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to create account');
    }
    return response.json();
  })
  .then(data => {
    Swal.fire({
      icon: 'success',
      title: 'Account created successfully',
      html: 'Your account has been created successfully.<br>Redirecting to account overview in <b>2</b> seconds.',
      timer: 2000,
      didOpen: () => {
        const b = Swal.getHtmlContainer().querySelector('b');
        const countdown = setInterval(() => {
          b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
        }, 1000);
        Swal.showLoading();
      }
    }).then(() => {
      window.location.href = '/dashboard/account.html';
    });
  })
  .catch(err => {
    console.error("Error:", err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to save transaction. Please try again.'
    });
  });
});