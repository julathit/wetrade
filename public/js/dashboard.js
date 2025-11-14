var accounts = [];
var transactions = [];

document.addEventListener("DOMContentLoaded", () => {
  let noti = showNotification("Loading accounts...", 0);
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

    hideNotification(noti);
    fetchTransactions(accounts[0].id)
  })
  .catch(err => console.error("Error:", err));
});

document.getElementById("account_option").addEventListener("change", (event) => {
  const accountId = event.target.value;
  if (accountId) {
    fetchTransactions(accountId);
  }
});

function hideSection() {
  document.getElementById('transactions-overview').classList.remove('show');
  document.getElementById('transactions-overview').classList.add('hidden');
  document.getElementById('no-account-message').classList.add('show');
  document.getElementById('no-account-message').classList.remove('hidden');
}

function showSection() {
  document.getElementById('transactions-overview').classList.add('show');
  document.getElementById('transactions-overview').classList.remove('hidden');
  document.getElementById('no-account-message').classList.remove('show');
  document.getElementById('no-account-message').classList.add('hidden');
}

function fetchTransactions(accountId) {
  let noti = showNotification("Loading transactions...", 0);
  fetch('/api/user/account/' + accountId + "/transaction?security_type=trade_us", {
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

    const tbody = document.querySelector("#recentTransactions tbody");
    if (transactions.length == 0){
      tbody.innerHTML = `
        <tr>
          <td colspan="4">No transactions found. <a href="/dashboard/transaction.html">Create a new transaction</a>.</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = transactions.slice(-5).reverse().map(t => `
        <tr>
          <td>${t.transaction_date}</td>
          <td>${t.transaction_type}</td>
          <td>${t.ticker_symbol}</td>
          <td>${t.unit}</td>
          <td>${t.unit_price}</td>
          <td>${t.gross_amount_usd}</td>
          <td>${t.fee}</td>
        </tr>
      `).join("");
    }

    showSection();

    // document.getElementById("totalIncome").textContent = `$${income.toFixed(2)}`;
    // document.getElementById("totalExpenses").textContent = `$${expenses.toFixed(2)}`;
    // document.getElementById("totalTax").textContent = `$${tax.toFixed(2)}`;

    hideNotification(noti);
  }).catch(err => console.error("Error:", err));
}