const params = new URLSearchParams(window.location.search);
const account_id = params.get('account_id');

const tOption = document.getElementById("tOption");
const dynamicFields = document.getElementById("dynamicFields");

// Function to generate the Exchange fields HTML
function generateExchangeFields() {
  return `
    <label for="tType">Transaction Type:</label>
    <select id="tType" name="transaction_type" required>
      <option value="buy">Buy (USD from THB)</option>
      <option value="sell">Sell (THB from USD)</option>
    </select>

    <div id="thbInputGroup">
      <label for="tAmountTHB">Amount (THB) - Input:</label>
      <input type="number" id="tAmountTHB" name="amount_thb_input" placeholder="e.g. 30015.00" step="0.01" required>
    </div>

    <div id="usdInputGroup" style="display:none;">
      <label for="tAmountUSD">Amount (USD) - Input:</label>
      <input type="number" id="tAmountUSD" name="amount_usd_input" placeholder="e.g. 900.00" step="0.01" required>
    </div>

    <label for="tRate">Exchange Rate (THB/USD):</label>
    <input type="number" id="tRate" name="exchange_rate" placeholder="e.g. 33.35" step="0.01" required>

    <label for="tCalculatedAmount">Calculated Amount (read-only):</label>
    <input type="text" id="tCalculatedAmount" name="calculated_amount" readonly>

    <label for="tDate">Transaction Date:</label>
    <input type="date" id="tDate" name="transaction_date" required>
  `;
}

// Function to handle the exchange calculation and UI update
function handleExchangeLogic() {
  const tType = document.getElementById("tType");
  const thbGroup = document.getElementById("thbInputGroup");
  const usdGroup = document.getElementById("usdInputGroup");
  const tAmountTHB = document.getElementById("tAmountTHB");
  const tAmountUSD = document.getElementById("tAmountUSD");
  const tRate = document.getElementById("tRate");
  const tCalculatedAmount = document.getElementById("tCalculatedAmount");

  function updateInputVisibility(type) {
    if (type === "buy") { // Input THB, Calculate USD
      thbGroup.style.display = "block";
      usdGroup.style.display = "none";
      tAmountTHB.setAttribute("required", true);
      tAmountUSD.removeAttribute("required");
      tCalculatedAmount.placeholder = "USD Result";
    } else { // Input USD, Calculate THB
      thbGroup.style.display = "none";
      usdGroup.style.display = "block";
      tAmountUSD.setAttribute("required", true);
      tAmountTHB.removeAttribute("required");
      tCalculatedAmount.placeholder = "THB Result";
    }
    tCalculatedAmount.value = "";
  }

  function calculateExchange() {
    const type = tType.value;
    const rate = parseFloat(tRate.value);
    let inputAmount, calculatedAmount;

    if (isNaN(rate) || rate <= 0) {
      tCalculatedAmount.value = "Invalid Rate";
      return;
    }

    if (type === "buy") {
      inputAmount = parseFloat(tAmountTHB.value);
      if (!isNaN(inputAmount) && inputAmount >= 0) {
        calculatedAmount = inputAmount / rate;
        tCalculatedAmount.value = calculatedAmount.toFixed(2) + " USD";
      } else {
        tCalculatedAmount.value = "";
      }
    } else if (type === "sell") {
      inputAmount = parseFloat(tAmountUSD.value);
      if (!isNaN(inputAmount) && inputAmount >= 0) {
        calculatedAmount = inputAmount * rate;
        tCalculatedAmount.value = calculatedAmount.toFixed(2) + " THB";
      } else {
        tCalculatedAmount.value = "";
      }
    }
  }

  updateInputVisibility(tType.value);

  tType.addEventListener("change", function() {
    updateInputVisibility(this.value);
    calculateExchange();
  });

  tAmountTHB.addEventListener("input", calculateExchange);
  tAmountUSD.addEventListener("input", calculateExchange);
  tRate.addEventListener("input", calculateExchange);
}

tOption.addEventListener("change", function () {
  const option = this.value;
  dynamicFields.innerHTML = "";

  // ---------------- EXCHANGE ----------------
  if (option === "exchange") {
    dynamicFields.innerHTML = generateExchangeFields();
    handleExchangeLogic();
  } 

  // ---------------- TRADE US ----------------
  else if (option === "trade_us") {
  dynamicFields.innerHTML = `
    <label for="tType">Transaction Type:</label>
    <select id="tType" name="transaction_type" required>
      <option value="buy">Buy</option>
      <option value="sell">Sell</option>
    </select>

    <label for="tStockSymbol">Stock Symbol:</label>
    <input type="text" id="tStockSymbol" name="stock_symbol" placeholder="e.g. AAPL" required>

    <label for="tUnit">Unit:</label>
    <input type="number" id="tUnit" name="unit" placeholder="e.g. 0.4363553" step="0.0000001" required>

    <label for="tUnitPrice">Unit Price (USD):</label>
    <input type="number" id="tUnitPrice" name="unit_price" placeholder="e.g. 458.34" step="0.01" required>

    <label for="tGross">Gross Amount (USD):</label>
    <input type="number" id="tGross" name="gross_amount_usd" placeholder="e.g. 200.00" step="0.01" required>

    <label for="tFee">Fee (USD):</label>
    <input type="number" id="tFee" name="fee" placeholder="e.g. 0.00" step="0.01" required>

    <label for="tVat">VAT (USD):</label>
    <input type="number" id="tVat" name="vat" placeholder="e.g. 0.00" step="0.01" required>

    <label for="tDate">Transaction Date:</label>
    <input type="date" id="tDate" name="transaction_date" required>
    `;
  }

  // ---------------- TRADE TH ----------------
  else if (option === "trade_th") {
    dynamicFields.innerHTML = `
      <label for="tType">Transaction Type:</label>
      <select id="tType" name="transaction_type" required>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>

      <label for="tStockSymbol">Ticker Symbol:</label>
      <input type="text" id="tStockSymbol" name="ticker_symbol" placeholder="e.g. PTT" required>

      <label for="tUnit">Unit:</label>
      <input type="number" id="tUnit" name="unit" placeholder="e.g. 100" step="0.0001" required>

      <label for="tUnitPrice">Unit Price (THB):</label>
      <input type="number" id="tUnitPrice" name="unit_price" placeholder="e.g. 35.50" step="0.01" required>

      <label for="tGross">Gross Amount (THB):</label>
      <input type="number" id="tGross" name="gross_amount_thb" placeholder="e.g. 3550.00" step="0.01" required>

      <label for="tFee">Fee (THB):</label>
      <input type="number" id="tFee" name="fee" placeholder="e.g. 10.00" step="0.01" required>

      <label for="tVat">VAT (THB):</label>
      <input type="number" id="tVat" name="vat" placeholder="e.g. 0.70" step="0.01" required>

      <label for="tDate">Transaction Date:</label>
      <input type="date" id="tDate" name="date" required>

      <label for="tSecurityType">Securities Type:</label>
      <select id="tSecurityType" name="securities_type" required>
        <option value="">-- Select Type --</option>
        <option value="stock">Stock</option>
        <option value="mutual_fund">Mutual Fund</option>
      </select>

      <div id="mutualFundField" style="display:none; margin-top:10px;">
        <label for="tFundType">Mutual Fund Type:</label>
        <select id="tFundType" name="mutual_fund_type" required>
          <option value="">-- Select Type --</option>
          <option value="THAIESG">THAIESG</option>
          <option value="RMF">RMF</option>
          <option value="SSF">SSF</option>
          <option value="_">_</option>
        </select>
      </div>
    `;

    const securityType = document.getElementById("tSecurityType");
    const mutualFundField = document.getElementById("mutualFundField");
    const fundTypeInput = document.getElementById("tFundType");

    securityType.addEventListener("change", function () {
      if (this.value === "mutual_fund") {
        mutualFundField.style.display = "block";
        fundTypeInput.setAttribute("required", true);
      } else {
        mutualFundField.style.display = "none";
        fundTypeInput.removeAttribute("required");
      }
    });
  }
});

document.getElementById("savetransaction").addEventListener("click", () => {
  const option = tOption.value;
  let apiUrl = '';
  let payload = {};

  let baseUrl = '/api/user/account/' + account_id + '/transaction/';

  // ---------------- EXCHANGE ----------------
  if (option === "exchange") {
    apiUrl = baseUrl + 'exchange';
    payload = {
      transaction_type: document.getElementById("tType").value,
      amount_thb: parseFloat(document.getElementById("tAmountTHB").value) || 0,
      amount_usd: parseFloat(document.getElementById("tAmountUSD").value) || 0,
      exchange_rate: parseFloat(document.getElementById("tRate").value),
      transaction_date: document.getElementById("tDate").value,
      account_id
    };
  } 

  // ---------------- TRADE US ----------------
  else if (option === "trade_us") {
    apiUrl = baseUrl + 'trade_us';
    payload = {
      transaction_type: document.getElementById("tType").value,
      stock_symbol: document.getElementById("tStockSymbol").value,
      unit: parseFloat(document.getElementById("tUnit").value),
      unit_price: parseFloat(document.getElementById("tUnitPrice").value),
      gross_amount_usd: parseFloat(document.getElementById("tGross").value),
      fee: parseFloat(document.getElementById("tFee").value),
      vat: parseFloat(document.getElementById("tVat").value),
      transaction_date: document.getElementById("tDate").value,
      account_id
    };
  }

  // // ---------------- TRADE TH ----------------
  else if (option === "trade_th") {
    apiUrl = baseUrl + 'trade_th';
    payload = {
      transaction_type: document.getElementById("tType").value,
      ticker_symbol: document.getElementById("tStockSymbol").value,
      unit: parseFloat(document.getElementById("tUnit").value),
      unit_price: parseFloat(document.getElementById("tUnitPrice").value),
      gross_amount_thb: parseFloat(document.getElementById("tGross").value),
      fee: parseFloat(document.getElementById("tFee").value),
      vat: parseFloat(document.getElementById("tVat").value),
      transaction_date: document.getElementById("tDate").value,
      securities_type: document.getElementById("tSecurityType").value,
      mutual_fund_type: document.getElementById("tFundType") ? document.getElementById("tFundType").value : null,
      account_id
    };
  }

  fetch(apiUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json' // THIS IS IMPORTANT
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to save transaction');
    }
    return response.json();
  })
  .then(data => {
    Swal.fire({
      icon: 'success',
      title: 'Transaction saved successfully',
      html: 'Your transaction has been saved successfully.<br>Redirecting to transaction overview in <b>2</b> seconds.',
      timer: 2000,
      didOpen: () => {
        const b = Swal.getHtmlContainer().querySelector('b');
        const countdown = setInterval(() => {
          b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
        }, 1000);
        Swal.showLoading();
      }
    }).then(() => {
      window.location.href = '/dashboard/transaction.html';
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