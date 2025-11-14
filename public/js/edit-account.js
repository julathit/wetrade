const id = new URLSearchParams(window.location.search).get('account_id');

document.addEventListener("DOMContentLoaded", () => {
  if (!id) {
    alert('No account ID provided');
    return;
  }

  let noti = showNotification("Loading account details...", 0);
  fetch(`/api/user/account/${id}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      account = data[0];
      // Populate the form fields with the account data
      document.getElementById('accountName').value = account.name;
      document.getElementById('accountTaxYear').value = account.tax_year;
      document.getElementById('cashAmountTHB').value = account.amount_thb;
      document.getElementById('cashAmountUSD').value = account.amount_usd;
      
      hideNotification(noti);
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation:', error);
    });
});

document.getElementById("saveaccount").addEventListener("click", () => {
  if (!document.getElementById("accountName").value || !document.getElementById("accountTaxYear").value) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Please fill in all required fields.'
    });
    return;
  }
  fetch(`/api/user/account/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: document.getElementById("accountName").value,
      tax_year: document.getElementById("accountTaxYear").value,
      amount_thb: parseFloat(document.getElementById("cashAmountTHB").value) || 0,
      amout_usd: parseFloat(document.getElementById("cashAmountUSD").value) || 0
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to update account');
    }
    return response.json();
  })
  .then(data => {
    Swal.fire({
      icon: 'success',
      title: 'Account updated successfully',
      html: 'Your account has been updated successfully.<br>Redirecting to account overview in <b>2</b> seconds.',
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
      text: 'Failed to save account. Please try again.'
    });
  });
});

document.getElementById("deleteaccount").addEventListener("click", () => {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!'
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`/api/user/account/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to delete account');
        }
        return response.json();
      })
      .then(data => {
        Swal.fire({
          icon: 'success',
          title: 'Account deleted successfully',
          html: 'Your account has been deleted successfully.<br>Redirecting to account overview in <b>2</b> seconds.',
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
          title: 'Failed to delete account.',
          html: 'You must delete all the transactions<br>before deleting the account. <br>If you have deleted all transactions, please try again later.'
        });
      });
    }
  });
});