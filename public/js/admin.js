// REFACTORED: Global state variables to keep track of the current context.
// This is essential for knowing what to re-load after a deletion.
let currentUserId = null;
let currentUsername = null;
let currentAccountId = null;
let currentAccountName = null;
let currentTransactionType = 'trade_us'; // NEW: Track current transaction type

document.addEventListener('DOMContentLoaded', () => {
    // REFACTORED: Call fetchUsers on page load to get the initial user list.
    fetchUsers();
    
    // NEW: Add event listener for transaction type dropdown
    const transactionDropdown = document.getElementById('transaction_option');
    if (transactionDropdown) {
        transactionDropdown.addEventListener('change', (e) => {
            currentTransactionType = e.target.value;
            // Update table headers immediately
            updateTransactionTableHeaders();
            // Reload transactions if we're currently viewing them
            if (currentAccountId && currentAccountName) {
                viewTransactions(currentAccountId, currentAccountName, currentTransactionType);
            }
        });
    }
});

// NEW: Function to update table headers without reloading data
function updateTransactionTableHeaders() {
    const table = document.getElementById('transactionTable');
    if (!table) return;
    
    const tableHeaders = {
        'trade_us': ['Date', 'Type', 'Symbol', 'Unit', 'Price', 'Gross Amount', 'Fee', 'Action'],
        'trade_th': ['Date', 'Type', 'Symbol', 'Unit', 'Price (THB)', 'Gross Amount (THB)', 'Fee (THB)', 'Action'],
        'exchange': ['Date', 'Type', 'amount_usd', 'amount_thb', 'Exchange Rate', 'Action']
    };
    
    const headers = tableHeaders[currentTransactionType] || tableHeaders['trade_us'];
    
    let thead = table.getElementsByTagName('thead')[0];
    if (!thead) {
        thead = table.createTHead();
    }
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
}

// --- Navigation Functions (Global - Unchanged) ---
function showUserTable() {
    document.getElementById('user-overview').classList.remove('hidden');
    document.getElementById('account-detail').classList.add('hidden');
    document.getElementById('transaction-detail').classList.add('hidden');
    document.getElementById('transaction_option').classList.add('hidden'); // NEW: Hide dropdown
    currentUserId = null;
    currentUsername = null;
    currentAccountId = null;
    currentAccountName = null;
}

function showAccountTable() {
    document.getElementById('user-overview').classList.add('hidden');
    document.getElementById('account-detail').classList.remove('hidden');
    document.getElementById('transaction-detail').classList.add('hidden');
    document.getElementById('transaction_option').classList.add('hidden'); // NEW: Hide dropdown
    currentAccountId = null;
    currentAccountName = null;
}

function showTransactionTable() {
    document.getElementById('user-overview').classList.add('hidden');
    document.getElementById('account-detail').classList.add('hidden');
    document.getElementById('transaction-detail').classList.remove('hidden');
    document.getElementById('transaction_option').classList.remove('hidden'); // NEW: Show dropdown
}

// --- Loading & Rendering Functions ---

// REFACTORED: This function now fetches users from your Express route.
function fetchUsers() {
    const tbody = document.getElementById('userTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading users...</td></tr>';

    fetch('/api/user/user_adm')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(users => {
            renderUserTable(users); 
        })
        .catch(error => {
            console.error('Error fetching users:', error);
            showToast('Failed to load user data.', 'error');
            tbody.innerHTML = '<tr><td colspan="4" class="text-center-error">Error loading data.</td></tr>';
        });
}

// REFACTORED: This function now just renders the user data it's given.
function renderUserTable(users) {
    const tbody = document.getElementById('userTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tbody.insertRow();
        row.insertCell().textContent = user.id;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.email;
        
        const actionCell = row.insertCell();
        
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Accounts';
        viewBtn.className = 'table-view-btn';
        viewBtn.onclick = () => viewAccounts(user.id, user.username);
        actionCell.appendChild(viewBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        deleteBtn.onclick = () => deleteUser(user.id);
        actionCell.appendChild(deleteBtn);
    });
}

// REFACTORED: This function now renders accounts it's given.
function renderAccountTable(accounts, username) {
    const tbody = document.getElementById('accountTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; 

    document.getElementById('accountHeader').textContent = `Accounts for ${username}`;

    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No accounts found for this user.</td></tr>';
        return;
    }

    accounts.forEach(account => {
        const row = tbody.insertRow();
        row.insertCell().textContent = account.id;
        row.insertCell().textContent = account.name;
        row.insertCell().textContent = account.amount_thb;
        row.insertCell().textContent = account.amount_usd;
        row.insertCell().textContent = account.tax_year;

        const actionCell = row.insertCell();

        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Transactions';
        viewBtn.className = 'table-view-btn';
        viewBtn.onclick = () => viewTransactions(account.id, account.name);
        actionCell.appendChild(viewBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        deleteBtn.onclick = () => deleteAccount(account.id);
        actionCell.appendChild(deleteBtn);
    });
}

// REFACTORED: This function now renders transactions with dynamic columns based on type.
function renderTransactionTable(transactions, accountName) {
    const table = document.getElementById('transactionTable');
    const tbody = table.getElementsByTagName('tbody')[0];
    
    // NEW: Show transaction type in header
    const typeLabel = {
        'trade_us': 'US Assets',
        'trade_th': 'TH Assets',
        'exchange': 'Exchange'
    };
    document.getElementById('transactionHeader').textContent = 
        `Transactions for ${accountName} (${typeLabel[currentTransactionType] || 'All'})`;

    // NEW: Define different table headers for each transaction type
    const tableHeaders = {
        'trade_us': ['Date', 'Type', 'Symbol', 'Unit', 'Price', 'Gross Amount', 'Fee', 'Action'],
        'trade_th': ['Date', 'Type', 'Symbol', 'Unit', 'Price (THB)', 'Gross Amount (THB)', 'Fee (THB)', 'Action'],
        'exchange': ['Date', 'Type', 'amount_usd', 'amount_thb', 'Exchange Rate', 'Action']
    };

    // Update table headers based on current transaction type
    const headers = tableHeaders[currentTransactionType] || tableHeaders['trade_us'];
    
    // Get or create thead element and update its content
    let thead = table.getElementsByTagName('thead')[0];
    if (!thead) {
        thead = table.createTHead();
    }
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    
    // Clear tbody
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center">No transactions found for this account.</td></tr>`;
        return;
    }

    // NEW: Render rows based on transaction type
    transactions.forEach(tx => {
        const row = tbody.insertRow();
        
        if (currentTransactionType === 'trade_us') {
            row.insertCell().textContent = new Date(tx.transaction_date).toLocaleDateString();
            row.insertCell().textContent = tx.transaction_type;
            row.insertCell().textContent = tx.ticker_symbol;
            row.insertCell().textContent = tx.unit
            row.insertCell().textContent = tx.unit_price 
            row.insertCell().textContent = tx.gross_amount_usd 
            row.insertCell().textContent = tx.fee 
        } 
        else if (currentTransactionType === 'trade_th') {
            row.insertCell().textContent = new Date(tx.transaction_date).toLocaleDateString();
            row.insertCell().textContent = tx.transaction_type;
            row.insertCell().textContent = tx.ticker_symbol;
            row.insertCell().textContent = tx.unit
            row.insertCell().textContent = tx.unit_price 
            row.insertCell().textContent = tx.gross_amount_thb 
            row.insertCell().textContent = tx.fee 
        } 
        else if (currentTransactionType === 'exchange') {
            row.insertCell().textContent = new Date(tx.date).toLocaleDateString();
            row.insertCell().textContent = tx.type
            row.insertCell().textContent = tx.amount_usd 
            row.insertCell().textContent = tx.amount_thb 
            row.insertCell().textContent = tx.exchange_rate 
        }
        
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        deleteBtn.onclick = () => deleteTransaction(tx.id); 
        actionCell.appendChild(deleteBtn);
    });
}

// --- Action Functions (Data-Driven) ---

// REFACTORED: Now fetches accounts for a specific user from a new API route.
function viewAccounts(userId, username) {
    console.log(username);
    currentUserId = userId;
    currentUsername = username;

    const tbody = document.getElementById('accountTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading accounts...</td></tr>';
    showAccountTable();

    fetch(`/api/user/accountGet_adm/${username}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(accounts => {
            renderAccountTable(accounts, username);
        })
        .catch(error => {
            console.error('Error fetching accounts:', error);
            showToast('Failed to load accounts.', 'error');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center-error">Error loading accounts.</td></tr>';
        });
}

// REFACTORED: Now fetches transactions based on type from a new API route.
function viewTransactions(accountId, accountName, transactionType = null) {
    // Use provided type or fall back to current global type
    const txType = transactionType || currentTransactionType;
    currentTransactionType = txType; // Update global state
    
    console.log(`Fetching transactions for account: ${accountName} (ID: ${accountId}), Type: ${txType}`);
    currentAccountId = accountId;
    currentAccountName = accountName;

    const tbody = document.getElementById('transactionTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading transactions...</td></tr>';
    showTransactionTable();

    // NEW: Include transaction type in the API call
    // *** YOUR BACKEND SHOULD SUPPORT THIS QUERY PARAMETER ***
    fetch(`/api/user/trsGet_adm/${accountId}/transactions?type=${txType}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(transactions => {
            renderTransactionTable(transactions, accountName);
        })
        .catch(error => {
            console.error('Error fetching transactions:', error);
            showToast('Failed to load transactions.', 'error');
            tbody.innerHTML = '<tr><td colspan="8" class="text-center-error">Error loading transactions.</td></tr>';
        });
}

// --- CRUD Operations (API-based) ---

// REFACTORED: Sends a DELETE request to the server.
function deleteUser(userId) {
    if (!confirm(`Are you sure you want to delete user ${userId}? This is permanent.`)) return;

    fetch(`/api/users/${userId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete user.');
        return response.json();
    })
    .then(data => {
        showToast(`User ${userId} deleted successfully!`);
        fetchUsers();
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        showToast('Error deleting user.', 'error');
    });
}

// REFACTORED: Sends a DELETE request to the server.
function deleteAccount(accountId) {
    if (!confirm(`Are you sure you want to delete account ${accountId}? This is permanent.`)) return;

    fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete account.');
        return response.json();
    })
    .then(data => {
        showToast(`Account ${accountId} deleted successfully!`);
        if (currentUserId && currentUsername) {
            viewAccounts(currentUserId, currentUsername);
        }
    })
    .catch(error => {
        console.error('Error deleting account:', error);
        showToast('Error deleting account.', 'error');
    });
}

// REFACTORED: Sends a DELETE request to the server.
function deleteTransaction(transactionId) {
    if (!confirm(`Are you sure you want to delete transaction ${transactionId}?`)) return;

    fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete transaction.');
        return response.json();
    })
    .then(data => {
        showToast('Transaction deleted successfully!');
        if (currentAccountId && currentAccountName) {
            viewTransactions(currentAccountId, currentAccountName);
        }
    })
    .catch(error => {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction.', 'error');
    });
}