document.getElementById("addTransactionBtn").addEventListener("click", () => {
  const selectedAccountId = document.getElementById("account_option").value;
  window.location.href = '/dashboard/add-transaction.html?account_id=' + selectedAccountId;
});

document.addEventListener("DOMContentLoaded", () => {
  let noti = showNotification('Loading accounts...', 0);
  fetch('/api/user/account', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (response.status === 404) {
      hideSection();
      return;
    } else if (!response.ok) {
      hideSection();
    }

    return response.json();
  })
  .then(data => {
    hideNotification(noti);
    accounts = data

    accounts.forEach(account => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} (${account.tax_year})`;
      document.getElementById("account_option").appendChild(option);
    });

    if (accounts.length == 0) {
      document.getElementById("account_option").style.display = "none";
      hideSection();
      return;
    }

    selected_account = accounts[0].id;

    fetchTransactions(accounts[0].id, 'trade_us');
  })
  .catch(err => console.error("Error:", err));
});

document.getElementById("transaction_option").addEventListener("change", (event) => {
  const secType = event.target.value;
  const accountId = document.getElementById("account_option").value;
  if (accountId) {
    fetchTransactions(accountId, secType);
  }
});

document.getElementById("account_option").addEventListener("change", (event) => {
  const secType = document.getElementById("transaction_option").value;
  const accountId = event.target.value;
  if (accountId) {
    fetchTransactions(accountId, secType);
  }
});

function hideSection() {
  document.getElementById('no-account-message').classList.add('show');
  document.getElementById('no-account-message').classList.remove('hidden');
  document.getElementById('transactions-overview').classList.remove('show');
  document.getElementById('transactions-overview').classList.add('hidden');
  document.getElementById("account_option").classList.add("hidden");
  document.getElementById("account_option").classList.remove("show");
  document.getElementById("transaction_option").classList.add("hidden");
  document.getElementById("transaction_option").classList.remove("show");
}

function showSection() {
  document.getElementById('no-account-message').classList.remove('show');
  document.getElementById('no-account-message').classList.add('hidden');
  document.getElementById('transactions-overview').classList.add('show');
  document.getElementById('transactions-overview').classList.remove('hidden');
  document.getElementById("account_option").classList.remove("hidden");
  document.getElementById("account_option").classList.add("show");
  document.getElementById("transaction_option").classList.remove("hidden");
  document.getElementById("transaction_option").classList.add("show");
}

function fetchTransactions(accountId, sec_type) {
  let noti = showNotification('Loading transactions...', 0);
  fetch('/api/user/account/' + accountId + "/transaction?security_type=" + sec_type, {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
  if (response.status === 404) {
    return;
  } else if (!response.ok) {
    return;
  }

  return response.json();
  })

  .then(data => {
    transactions = data;

    console.log(data);

    const tbody = document.querySelector("#transactionTable tbody");
    const thead = document.querySelector("#transactionTable thead");

    if (transactions == null || transactions.length == 0){
      tbody.innerHTML = `
        <tr>
          <td colspan="4">No transactions found. Click Add Transaction from above.</td>
        </tr>
      `;
    } else {
      if (sec_type === 'trade_us' || sec_type === 'trade_th') {
        thead.innerHTML = `
          <tr>
            <th>Date</th><th>Type</th><th>Symbol</th><th>Unit</th><th>Unit Price</th><th>Gross Amount</th><th>Fee+Vat</th><th>Total</th><th>Delete</th>
          </tr>
        `;
        tbody.innerHTML = transactions.map(t => `
          <tr>
            <td>${dayjs(t.transaction_date).format("DD MMM YYYY @ HH:mm")}</td>
            <td>${t.transaction_type}</td>
            <td>${t.ticker_symbol}</td>
            <td>${t.unit}</td>
            <td>${t.unit_price}</td>
            <td>${sec_type === 'trade_us' ? t.gross_amount_usd : t.gross_amount_thb}</td>
            <td>${(parseFloat(t.fee) + parseFloat(t.vat)).toFixed(2)}</td>
            <td>${(parseFloat(sec_type === 'trade_us' ? t.gross_amount_usd : t.gross_amount_thb) + parseFloat(t.fee) + parseFloat(t.vat)).toFixed(2)}</td>
            <td><button class="deletebutton" onClick="deleteTransaction('${sec_type}', ${t.transaction_id})">Delete</button></td>
          </tr>
        `).join("");
      } else if (sec_type === 'exchange') {
        thead.innerHTML = `
          <tr>
            <th>Date</th><th>USD Exchange type</th><th>Amount (THB)</th><th>Amount (USD)</th><th>Exchange Rate</th><th>Delete</th>
          </tr>
        `;
        tbody.innerHTML = transactions.map(t => {
          if (t.amount_usd != 0) {
            return `
            <tr>
              <td>${dayjs(t.transaction_date).format("DD MMM YYYY @ HH:mm")}</td>
              <td>${t.transaction_type}</td>
              <td>${t.amount_thb}</td>
              <td>${t.amount_usd}</td>
              <td>${t.exchange_rate}</td>
              <td><button class="deletebutton" onClick="deleteTransaction('${sec_type}', ${t.transaction_id})">Delete</button></td>
            </tr>
            `
          } else {
            return `
            <tr>
              <td>${dayjs(t.transaction_date).format("DD MMM YYYY @ HH:mm")}</td>
              <td>${t.transaction_type === 'sell' ? "deposit" : "withdraw"}</td>
              <td>${t.amount_thb}</td>
              <td>-</td>
              <td>-</td>
              <td><button class="deletebutton" onClick="deleteTransaction('${sec_type}', ${t.transaction_id})">Delete</button></td>
            </tr>
            `
          }
        }).join("");
      }
    }

    showSection();
    hideNotification(noti);
  }).catch(err => console.error("Error:", err));
}

function deleteTransaction(sec_type, transactionId) {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  }).then((result) => {
    if (result.isConfirmed) {
      let noti = showNotification('Deleting transaction...', 0);
      fetch('/api/user/account/transaction/' + sec_type + '/' + transactionId, {
        method: 'DELETE',
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to delete transaction');
        }
        return response.json();
      })
      .then(data => {
        hideNotification(noti);
        Swal.fire(
          'Deleted!',
          'Transaction has been deleted.',
          'success'
        ).then(() => {
          location.reload();
        });
      })
      .catch(err => console.error("Error:", err));
    }
  });
}