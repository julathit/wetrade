document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const nameInput = document.getElementById("pName");
  const emailInput = document.getElementById("pEmail");
  const saveBtn = document.getElementById("saveProfileBtn");
  const passBtn = document.getElementById("changePasswordBtn");

  nameInput.value = user.name || "Demo User";
  emailInput.value = user.email || "user@test.com";

  saveBtn.addEventListener("click", () => {
    user.name = nameInput.value;
    localStorage.setItem("user", JSON.stringify(user));
    alert("Profile saved!");
  });

  passBtn.addEventListener("click", () => {
    const newPass = document.getElementById("newPassword").value;
    if (!newPass) return alert("Enter a new password");
    alert("Password changed (mock).");
    document.getElementById("newPassword").value = "";
  });
});
