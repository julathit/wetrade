document.getElementById("addAccountBtn").addEventListener("click", () => {
  window.location.href = "/dashboard/add-account.html";
});

document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#accountTable tbody");

  let noti = showNotification("Loading accounts...", 0);
  fetch('/api/user/account', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch accounts');
    }
    return response.json();
  })
  .then(data => {
    table.innerHTML = data.map((account, i) => `
      <tr>
        <td>${account.name}</td>
        <td>${account.tax_year}</td>
        <td>${account.amount_thb}</td>
        <td>${account.amount_usd}</td>
        <td><button onclick="editAccount(${account.id})" class="editbutton">Edit</button></td>
      </tr>
    `).join("");
    hideNotification(noti);
  })
  .catch(err => console.error("Error:", err));
  hideNotification(noti);
});
function editAccount(id) {
  window.location.href = '/dashboard/edit-account.html?account_id=' + id;
}