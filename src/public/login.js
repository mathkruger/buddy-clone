const USERNAME_RE = /^[a-zA-Z0-9_-]{1,24}$/;

const form = document.getElementById("login-form");
const usernameInput = document.getElementById("login-username");
const passwordInput = document.getElementById("login-password");
const errorEl = document.getElementById("login-error");

function normalizeUsername(name) {
  return String(name).trim().toLowerCase();
}

function setError(message) {
  errorEl.textContent = message;
}

form.addEventListener("submit", onLogin);

async function onLogin(event) {
  event.preventDefault();
  errorEl.textContent = "";
  form.classList.add("loading");

  const rawName = usernameInput.value.trim();
  const username = normalizeUsername(rawName);
  const password = passwordInput.value;

  if (!rawName || !USERNAME_RE.test(username)) {
    setError("Enter a valid username (letters, numbers, underscores or dashes, up to 24 characters).");
    form.classList.remove("loading");
    return;
  }
  if (!password) {
    setError("Enter your password.");
    form.classList.remove("loading");
    return;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (res.status === 401) {
      setError("That username or password isn't right, or your buddy has no password yet. Try again or create a new one.");
      return;
    }
    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }

    location.href = "/play";
  } catch {
    setError("Could not reach the server — is it running?");
  } finally {
    form.classList.remove("loading");
  }
}