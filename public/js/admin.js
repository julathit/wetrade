// REFACTORED: Global state variables to keep track of the current context.
// This is essential for knowing what to re-load after a deletion.
let currentUserId = null;
let currentUsername = null;
let currentAccountId = null;
let currentAccountName = null;

document.addEventListener('DOMContentLoaded', () => {
    // REFACTORED: Call fetchUsers on page load to get the initial user list.
    fetchUsers();
});

// --- Navigation Functions (Global - Unchanged) ---
function showUserTable() {
    document.getElementById('user-overview').classList.remove('hidden');
    document.getElementById('account-detail').classList.add('hidden');
    document.getElementById('transaction-detail').classList.add('hidden');
    currentUserId = null;
    currentUsername = null;
    currentAccountId = null;
    currentAccountName = null;
}

function showAccountTable() {
    document.getElementById('user-overview').classList.add('hidden');
    document.getElementById('account-detail').classList.remove('hidden');
    document.getElementById('transaction-detail').classList.add('hidden');
    currentAccountId = null;
    currentAccountName = null;
}

function showTransactionTable() {
    document.getElementById('user-overview').classList.add('hidden');
    document.getElementById('account-detail').classList.add('hidden');
    document.getElementById('transaction-detail').classList.remove('hidden');
}

// --- Loading & Rendering Functions ---

// REFACTORED: This function now fetches users from your Express route.
function fetchUsers() {
    const tbody = document.getElementById('userTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading users...</td></tr>';

    fetch('/api/user/account_adm') // This is the route you provided
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
    tbody.innerHTML = ''; // Clear existing rows

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        // Use property names from your SQL query (e.g., user.id, user.username, user.email)
        const row = tbody.insertRow();
        row.insertCell().textContent = user.id;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.email;
        
        const actionCell = row.insertCell();
        
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Accounts';
        viewBtn.className = 'table-view-btn';
        // REFACTORED: Click handler now calls viewAccounts with user info
        viewBtn.onclick = () => viewAccounts(user.id, user.username);
        actionCell.appendChild(viewBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        // REFACTORED: Click handler now calls the API delete function
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
        // Adjust property names based on your new API response (e.g., account.id, account.name)
        const row = tbody.insertRow();
        row.insertCell().textContent = account.id;
        row.insertCell().textContent = account.name;
        row.insertCell().textContent = account.currency;
        row.insertCell().textContent = new Date(account.created).toLocaleDateString(); // Format date

        const actionCell = row.insertCell();

        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Transactions';
        viewBtn.className = 'table-view-btn';
        viewBtn.onclick = () => viewTransactions(account.id, account.name);
        actionCell.appendChild(viewBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        // REFACTORED: Passes only accountId. We use currentUserId from global state.
        deleteBtn.onclick = () => deleteAccount(account.id);
        actionCell.appendChild(deleteBtn);
    });
}

// REFACTORED: This function now renders transactions it's given.
function renderTransactionTable(transactions, accountName) {
    const tbody = document.getElementById('transactionTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    document.getElementById('transactionHeader').textContent = `Transactions for ${accountName}`;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No transactions found for this account.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        // Adjust property names based on your new API response
        const row = tbody.insertRow();
        row.insertCell().textContent = new Date(tx.date).toLocaleDateString();
        row.insertCell().textContent = tx.type;
        row.insertCell().textContent = tx.symbol;
        row.insertCell().textContent = (tx.unit || 0).toFixed(4);
        row.insertCell().textContent = `$${(tx.price || 0).toFixed(2)}`;
        row.insertCell().textContent = `$${(tx.gross || 0).toFixed(2)}`;
        row.insertCell().textContent = `$${(tx.fee || 0).toFixed(2)}`;
        
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        // REFACTORED: Assumes transaction object has an 'id'
        deleteBtn.onclick = () => deleteTransaction(tx.id); 
        actionCell.appendChild(deleteBtn);
    });
}

// --- Action Functions (Data-Driven) ---

// REFACTORED: Now fetches accounts for a specific user from a new API route.
function viewAccounts(userId, username) {
    console.log(`Fetching accounts for user: ${username} (ID: ${userId})`);
    currentUserId = userId; // Set global state
    currentUsername = username;

    const tbody = document.getElementById('accountTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading accounts...</td></tr>';
    showAccountTable(); // Show the account section

    // *** YOU MUST CREATE THIS API ROUTE ON YOUR BACKEND ***
    fetch(`/api/users/${userId}/accounts`)
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

// REFACTORED: Now fetches transactions for a specific account from a new API route.
function viewTransactions(accountId, accountName) {
    console.log(`Fetching transactions for account: ${accountName} (ID: ${accountId})`);
    currentAccountId = accountId; // Set global state
    currentAccountName = accountName;

    const tbody = document.getElementById('transactionTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading transactions...</td></tr>';
    showTransactionTable(); // Show the transaction section

    // *** YOU MUST CREATE THIS API ROUTE ON YOUR BACKEND ***
    fetch(`/api/accounts/${accountId}/transactions`)
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

    // *** YOU MUST CREATE THIS API ROUTE ON YOUR BACKEND ***
    fetch(`/api/users/${userId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete user.');
        return response.json(); // Or response.text() if you don't return JSON
    })
    .then(data => {
        showToast(`User ${userId} deleted successfully!`);
        fetchUsers(); // Refresh the user table
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        showToast('Error deleting user.', 'error');
    });
}

// REFACTORED: Sends a DELETE request to the server.
function deleteAccount(accountId) {
    if (!confirm(`Are you sure you want to delete account ${accountId}? This is permanent.`)) return;

    // *** YOU MUST CREATE THIS API ROUTE ON YOUR BACKEND ***
    fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete account.');
        return response.json();
    })
    .then(data => {
        showToast(`Account ${accountId} deleted successfully!`);
        // Refresh the account table for the current user
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

    // *** YOU MUST CREATE THIS API ROUTE ON YOUR BACKEND ***
    fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to delete transaction.');
        return response.json();
    })
    .then(data => {
        showToast('Transaction deleted successfully!');
        // Refresh the transaction table for the current account
        if (currentAccountId && currentAccountName) {
            viewTransactions(currentAccountId, currentAccountName);
        }
    })
    .catch(error => {
        console.error('Error deleting transaction:', error);
        showToast('Error deleting transaction.', 'error');
    });
}