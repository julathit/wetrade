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
// No navigation needed - single table only

// function showTransactionTable() {
//     document.getElementById('user-overview').classList.add('hidden');
//     document.getElementById('account-detail').classList.add('hidden');
//     // document.getElementById('transaction-detail').classList.remove('hidden');
// }

// --- Loading & Rendering Functions ---

function fetchUsers() {
    const tbody = document.getElementById('userTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading users...</td></tr>';

    const noti = showNotification('Fetching user data...', 0);

    fetch('/api/admin/user') // This is the route you provided
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(users => {
            renderUserTable(users); 
        })
        .catch(error => {
            console.error('Error fetching users:', error);
            showNotification('Failed to load user data.', 2000);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center-error">Error loading data.</td></tr>';
        });
    hideNotification(noti);
}

function renderUserTable(users) {
    const tbody = document.getElementById('userTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // Clear existing rows

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        
        const row = tbody.insertRow();
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;
        
        const actionCell = row.insertCell();
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'viewbutton';
        
        editBtn.onclick = () => editUser(user.username, user.role);
        actionCell.appendChild(editBtn);
    });
}



// --- Action Functions (Data-Driven) ---

// --- CRUD Operations (API-based) ---

// REFACTORED: Sends a PUT request to edit user role.
function editUser(username, currentRole) {
    Swal.fire({
        title: `Edit User: ${username}`,
        html: `
            <div style="text-align: left;">
                <label for="roleSelect">Select Role:</label>
                <select id="roleSelect" style="width: 100%; padding: 8px; margin-top: 10px;">
                    <option value="user" ${currentRole === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="superadmin" ${currentRole === 'superadmin' ? 'selected' : ''}>Superadmin</option>
                </select>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (!result.isConfirmed) {
            return;
        }

        const newRole = document.getElementById('roleSelect').value;
        
        // TODO: Implement API call to update user role
        // fetch(`/api/admin/user/${username}`, {
        //     method: 'PUT',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({ role: newRole })
        // })
        // .then(response => {
        //     if (!response.ok) throw new Error('Failed to update user.');
        //     return response.json();
        // })
        // .then(data => {
        //     showNotification(`User ${username} role updated to ${newRole}`, 2000);
        //     fetchUsers(); // Refresh the user table
        // })
        // .catch(error => {
        //     console.error('Error updating user:', error);
        //     showNotification('Error updating user.', 2000);
        // });
    });
}

// REFACTORED: Sends a DELETE request to the server.
// function deleteTransaction(transactionId) {
//     if (!confirm(`Are you sure you want to delete transaction ${transactionId}?`)) return;

//     // *** YOU MUST CREATE THIS API ROUTE ON YOUR BACKEND ***
//     fetch(`/api/transactions/${transactionId}`, {
//         method: 'DELETE'
//     })
//     .then(response => {
//         if (!response.ok) throw new Error('Failed to delete transaction.');
//         return response.json();
//     })
//     .then(data => {
//         showToast('Transaction deleted successfully!');
//         // Refresh the transaction table for the current account
//         if (currentAccountId && currentAccountName) {
//             viewTransactions(currentAccountId, currentAccountName);
//         }
//     })
//     .catch(error => {
//         console.error('Error deleting transaction:', error);
//         showToast('Error deleting transaction.', 'error');
//     });
// }
