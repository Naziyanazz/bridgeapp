document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const authMessage = document.getElementById("auth-message");

    const loginSection = document.getElementById("login-section");
    const registerSection = document.getElementById("register-section");
    const showLoginBtn = document.getElementById("show-login");
    const showRegisterBtn = document.getElementById("show-register");

    const API_URL = "http://localhost:5000/api"; // Backend base URL

    // ✅ Helper function to toggle the active class on buttons
    const toggleActiveClass = (activeButton, inactiveButton) => {
        activeButton.classList.add("active");
        inactiveButton.classList.remove("active");
    };

    // ✅ Switch between Login/Register
    showLoginBtn.addEventListener("click", () => {
        loginSection.style.display = "block";
        registerSection.style.display = "none";
        authMessage.innerHTML = "";
        toggleActiveClass(showLoginBtn, showRegisterBtn);
    });

    showRegisterBtn.addEventListener("click", () => {
        loginSection.style.display = "none";
        registerSection.style.display = "block";
        authMessage.innerHTML = "";
        toggleActiveClass(showRegisterBtn, showLoginBtn);
    });

    // ✅ Show messages
    const showMessage = (message, type = "success") => {
        authMessage.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert w-25">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert w-25" aria-label="Close"></button>
      </div>
    `;
    };

    // ✅ Handle Login
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("token", data.token); // Save token
                showMessage("Login successful!", "success");

                // Auto-create or fetch chat with the user themself for simplicity
                const chatRes = await fetch(`${API_URL}/chats`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.token}`,
                    },
                    body: JSON.stringify({ userId: data._id }), // assuming `data.user` is returned
                });

                const chatData = await chatRes.json();
                if (chatRes.ok) {
                    localStorage.setItem("chatId", chatData._id); // Save chat ID
                    setTimeout(() => {
                        window.location.href = "home.html";
                    }, 1000);
                } else {
                    showMessage("Chat creation failed", "danger");
                }
            } else {
                showMessage(data.message || "Login failed.", "danger");
            }
        } catch (err) {
            showMessage("Error: " + err.message, "danger");
        }
    });

    // ✅ Handle Register
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("register-name").value;
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (res.ok) {
                showMessage("Registration successful!", "success");
                // Auto switch to login form after registration
                setTimeout(() => {
                    showLoginBtn.click();
                }, 1500);
            } else {
                showMessage(data.message || "Registration failed.", "danger");
            }
        } catch (err) {
            showMessage("Error: " + err.message, "danger");
        }
    });
});
