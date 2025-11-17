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
    fetchSummary(accounts[0].id);
  })
  .catch(err => console.error("Error:", err));
  hideNotification(noti);
});

document.getElementById("account_option").addEventListener("change", (event) => {
  const accountId = event.target.value;
  if (accountId) {
    fetchTransactions(accountId);
    fetchSummary(accountId);
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
  // display recent transactions
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
          <td>${dayjs(t.transaction_date).format("DD MMM YYYY @ HH:mm")}</td>
          <td>${t.transaction_type}</td>
          <td>${t.ticker_symbol}</td>
          <td>${t.unit}</td>
          <td>${t.unit_price}</td>
          <td>${t.gross_amount_usd}</td>
          <td>${parseFloat(t.fee) + parseFloat(t.vat)}</td>
          <td>${parseFloat(t.gross_amount_usd) + parseFloat(t.fee) + parseFloat(t.vat)}</td>
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

function fetchSummary(accountId) {
  let notiCards = showNotification("Loading account summary...", 0);
  fetch('/api/user/account/' + accountId + '/summary', {
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
    // totalAssetTHB, totalAssetUSD, totalDeposit, totalWithdrawal, totalTax, totalDeductionTHB, totalDeductionUSD
    // total_asset_thb, total_asset_usd, total_deposit_thb, total_withdrawal_thb, total_taxable_usd, total_deduction_thb, total_deduction_usd
    document.getElementById("totalAssetTHB").textContent = `${formatNumber(data.total_asset_thb)} THB`;
    document.getElementById("totalAssetUSD").textContent = `${formatNumber(data.total_asset_usd)} USD`;
    document.getElementById("totalDeposit").textContent = `${formatNumber(data.total_deposit_thb)} THB`;
    document.getElementById("totalWithdrawal").textContent = `${formatNumber(data.total_withdrawal_thb)} THB`;
    document.getElementById("totalTax").textContent = `${formatNumber(data.total_taxable_usd)} USD`;
    document.getElementById("totalDeductionTHB").textContent = `${formatNumber(data.total_deduction_thb)} THB`;
    document.getElementById("totalDeductionUSD").textContent = `${formatNumber(data.total_deduction_usd)} USD`;
    hideNotification(notiCards);
  })
  .catch(err => {
    console.error("Error:", err);
    hideNotification(notiCards);
  });
}