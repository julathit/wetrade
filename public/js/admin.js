// Dummy Data Structure
const mockUsers = [
    { id: 1, username: "Alice_Taxes", email: "alice@tax.com", 
      accounts: [
          { id: 'acc-1a', name: 'Binance Holdings', currency: 'USD', created: '2024-01-15', 
            transactions: [
                { date: '2024-03-01', type: 'BUY', symbol: 'BTC', unit: 0.01, price: 60000, gross: 600, fee: 5 },
                { date: '2024-03-10', type: 'SELL', symbol: 'ETH', unit: 0.5, price: 3500, gross: 1750, fee: 10 }
            ]
          },
          { id: 'acc-1b', name: 'Kraken Portfolio', currency: 'EUR', created: '2024-02-20', transactions: [] }
      ]
    },
    { id: 2, username: "Bob_Crypto", email: "bob@tax.com", 
      accounts: [
          { id: 'acc-2a', name: 'Coinbase Wallet', currency: 'CAD', created: '2024-04-01', 
            transactions: [
                { date: '2024-05-05', type: 'BUY', symbol: 'SOL', unit: 5, price: 150, gross: 750, fee: 2.5 }
            ]
          }
      ]
    }
];

let currentUserId = null;
let currentAccountId = null;

document.addEventListener('DOMContentLoaded', () => {
    renderUserTable();
});

// --- Navigation Functions (Global) ---
function showUserTable() {
    document.getElementById('user-overview').classList.remove('hidden');
    document.getElementById('account-detail').classList.add('hidden');
    document.getElementById('transaction-detail').classList.add('hidden');
    currentUserId = null;
    currentAccountId = null;
}

function showAccountTable() {
    document.getElementById('user-overview').classList.add('hidden');
    document.getElementById('account-detail').classList.remove('hidden');
    document.getElementById('transaction-detail').classList.add('hidden');
    currentAccountId = null;
    // The account table is re-rendered via the viewAccounts function call
}

// --- Rendering Functions ---

function renderUserTable() {
    const tbody = document.getElementById('userTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // Clear existing rows

    mockUsers.forEach(user => {
        const row = tbody.insertRow();
        row.insertCell().textContent = user.id;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.email;
        
        const actionCell = row.insertCell();
        
        // View Accounts Button
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Accounts';
        viewBtn.className = 'table-view-btn';
        viewBtn.onclick = () => viewAccounts(user.id, user.username);
        actionCell.appendChild(viewBtn);

        // Delete User Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        deleteBtn.onclick = () => deleteUser(user.id);
        actionCell.appendChild(deleteBtn);
    });
}

function renderAccountTable(user) {
    const tbody = document.getElementById('accountTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // Clear existing rows

    document.getElementById('accountHeader').textContent = `Accounts for ${user.username}`;

    user.accounts.forEach(account => {
        const row = tbody.insertRow();
        row.insertCell().textContent = account.id;
        row.insertCell().textContent = account.name;
        row.insertCell().textContent = account.currency;
        row.insertCell().textContent = account.created;

        const actionCell = row.insertCell();

        // View Transactions Button
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View Transactions';
        viewBtn.className = 'table-view-btn';
        viewBtn.onclick = () => viewTransactions(account.id, account.name);
        actionCell.appendChild(viewBtn);

        // Delete Account Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        deleteBtn.onclick = () => deleteAccount(user.id, account.id);
        actionCell.appendChild(deleteBtn);
    });
}

function renderTransactionTable(account) {
    const tbody = document.getElementById('transactionTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // Clear existing rows

    document.getElementById('transactionHeader').textContent = `Transactions for ${account.name}`;

    account.transactions.forEach(tx => {
        const row = tbody.insertRow();
        row.insertCell().textContent = tx.date;
        row.insertCell().textContent = tx.type;
        row.insertCell().textContent = tx.symbol;
        row.insertCell().textContent = tx.unit.toFixed(4);
        row.insertCell().textContent = `$${tx.price.toFixed(2)}`;
        row.insertCell().textContent = `$${tx.gross.toFixed(2)}`;
        row.insertCell().textContent = `$${tx.fee.toFixed(2)}`;
        
        // Add a delete button for the transaction
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'table-delete-btn';
        deleteBtn.onclick = () => deleteTransaction(account.id, tx); 
        actionCell.appendChild(deleteBtn);
    });

    if (account.transactions.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8;
        cell.textContent = 'No transactions found for this account.';
        cell.style.textAlign = 'center';
        cell.style.fontStyle = 'italic';
    }
}

// --- Action Functions ---

function viewAccounts(userId, username) {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
        currentUserId = userId;
        renderAccountTable(user);
        showAccountTable(); // Show the account section
    } else {
        showToast('User not found!', 'error');
    }
}

function viewTransactions(accountId, accountName) {
    const user = mockUsers.find(u => u.id === currentUserId);
    if (!user) return showToast('User context lost.', 'error');
    
    const account = user.accounts.find(a => a.id === accountId);
    if (account) {
        currentAccountId = accountId;
        renderTransactionTable(account);
        // Show the transaction section
        document.getElementById('account-detail').classList.add('hidden');
        document.getElementById('transaction-detail').classList.remove('hidden');
    } else {
        showToast('Account not found!', 'error');
    }
}

// --- CRUD Operations (Stubs for demonstration) ---

function deleteUser(userId) {
    // In a real application, you'd send an API request here.
    console.log(`Deleting user with ID: ${userId}`);
    // Simulate deletion from mock data
    const index = mockUsers.findIndex(u => u.id === userId);
    if (index !== -1) {
        mockUsers.splice(index, 1);
        renderUserTable();
        showToast(`User ${userId} deleted successfully!`);
    }
}

function deleteAccount(userId, accountId) {
    // In a real application, you'd send an API request here.
    console.log(`Deleting account ${accountId} for user ${userId}`);
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
        const index = user.accounts.findIndex(a => a.id === accountId);
        if (index !== -1) {
            user.accounts.splice(index, 1);
            renderAccountTable(user);
            showToast(`Account ${accountId} deleted successfully!`);
        }
    }
}

function deleteTransaction(accountId, transaction) {
    // In a real application, you'd send an API request here.
    console.log(`Deleting transaction from account ${accountId}:`, transaction);
    const user = mockUsers.find(u => u.id === currentUserId);
    if (user) {
        const account = user.accounts.find(a => a.id === accountId);
        if (account) {
            const index = account.transactions.indexOf(transaction);
            if (index !== -1) {
                account.transactions.splice(index, 1);
                renderTransactionTable(account);
                showToast('Transaction deleted successfully!');
            }
        }
    }
}

// Ensure 'showToast' utility is available (from utils.js)
// window.showToast = (message, type = 'success') => { ... } 
// (Assuming you have this in utils.js)