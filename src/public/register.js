const USERNAME_RE = /^[a-zA-Z0-9_-]{1,24}$/;

const form = document.getElementById("register-form");
const usernameInput = document.getElementById("register-username");
const passwordInput = document.getElementById("register-password");
const errorEl = document.getElementById("register-error");

function normalizeUsername(name) {
  return String(name).trim().toLowerCase();
}

function setError(message) {
  errorEl.textContent = message;
}

form.addEventListener("submit", onRegister);

async function onRegister(event) {
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
  if (password.length < 8) {
    setError("Password must be at least 8 characters.");
    form.classList.remove("loading");
    return;
  }

  try {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (res.status === 403) {
      setError("You're already logged in.");
      return;
    }
    if (res.status === 409) {
      setError("That username is already taken.");
      return;
    }
    if (res.status === 400) {
      const data = await res.json().catch(() => null);
      setError((data && data.error) || "Something went wrong. Please try again.");
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