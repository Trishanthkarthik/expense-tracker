// ============================================================
// script.js — Expense Tracker (Upgraded Auth Edition)
// ============================================================
// NEW in this version:
//   • Google OAuth login
//   • GitHub OAuth login
//   • Forgot Password (password reset email)
//   • Detailed error messages (duplicate email, weak password…)
//   • Loading spinners on every async button
//   • Session persisted across page refreshes by Supabase
//   • Auto-redirect: logged-in users skip straight to dashboard
// ============================================================

import { supabase } from "./supabase.js";

// ── DOM: Auth panels ─────────────────────────────────────────
const authSection   = document.getElementById("auth-section");
const loginPanel    = document.getElementById("login-panel");
const signupPanel   = document.getElementById("signup-panel");
const forgotPanel   = document.getElementById("forgot-panel");

// Login panel elements
const loginEmailEl  = document.getElementById("login-email");
const loginPassEl   = document.getElementById("login-password");
const loginBtn      = document.getElementById("login-btn");
const loginError    = document.getElementById("login-error");

// Sign-up panel elements
const signupEmailEl = document.getElementById("signup-email");
const signupPassEl  = document.getElementById("signup-password");
const signupBtn     = document.getElementById("signup-btn");
const signupError   = document.getElementById("signup-error");

// Forgot-password panel elements
const forgotEmailEl = document.getElementById("forgot-email");
const forgotBtn     = document.getElementById("forgot-btn");
const forgotError   = document.getElementById("forgot-error");

// Panel navigation links
const goSignup      = document.getElementById("go-signup");
const goLogin       = document.getElementById("go-login");
const forgotLink    = document.getElementById("forgot-link");
const goLoginForgot = document.getElementById("go-login-from-forgot");

// OAuth buttons (one per panel)
const googleBtns = [document.getElementById("google-btn"), document.getElementById("google-btn-signup")];
const githubBtns = [document.getElementById("github-btn"), document.getElementById("github-btn-signup")];

// ── DOM: App (dashboard) ─────────────────────────────────────
const appSection    = document.getElementById("app-section");
const userEmailSpan = document.getElementById("user-email");
const logoutBtn     = document.getElementById("logout-btn");

// Expense form
const expenseForm   = document.getElementById("expense-form");
const amountInput   = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const noteInput     = document.getElementById("note");
const dateInput     = document.getElementById("date");
const formError     = document.getElementById("form-error");

// Expense list & summary
const expenseList   = document.getElementById("expense-list");
const totalDisplay  = document.getElementById("total-display");
const filterSelect  = document.getElementById("filter-category");
const emptyState    = document.getElementById("empty-state");

// ── State ────────────────────────────────────────────────────
let currentUser = null;
let allExpenses = [];

// ── Supabase redirect URL ────────────────────────────────────
// auto-detects the current domain (works on localhost AND Vercel)
const REDIRECT_URL = window.location.origin;


// ════════════════════════════════════════════════════════════
// INITIALISATION — runs on every page load
// ════════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", async () => {
  dateInput.value = new Date().toISOString().split("T")[0];

  // Check for an existing session (persisted in localStorage by Supabase)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    showDashboard(session.user);
  }

  // Single listener for all auth events: login, logout, token refresh, OAuth callback
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showDashboard(session.user);
    } else {
      showAuthScreen();
    }
  });
});


// ════════════════════════════════════════════════════════════
// PANEL NAVIGATION
// ════════════════════════════════════════════════════════════
function showPanel(panelName) {
  loginPanel.classList.add("hidden");
  signupPanel.classList.add("hidden");
  forgotPanel.classList.add("hidden");

  if (panelName === "login")  loginPanel.classList.remove("hidden");
  if (panelName === "signup") signupPanel.classList.remove("hidden");
  if (panelName === "forgot") forgotPanel.classList.remove("hidden");

  [loginError, signupError, forgotError].forEach(el => {
    el.textContent = "";
    el.style.color = "";
  });
}

goSignup.addEventListener("click",      (e) => { e.preventDefault(); showPanel("signup"); });
goLogin.addEventListener("click",       (e) => { e.preventDefault(); showPanel("login");  });
forgotLink.addEventListener("click",    (e) => { e.preventDefault(); showPanel("forgot"); });
goLoginForgot.addEventListener("click", (e) => { e.preventDefault(); showPanel("login");  });


// ════════════════════════════════════════════════════════════
// LOADING STATE HELPERS
// ════════════════════════════════════════════════════════════
function setLoading(btn, isLoading) {
  const text    = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled  = isLoading;
  if (isLoading) {
    text?.classList.add("hidden");
    spinner?.classList.remove("hidden");
  } else {
    text?.classList.remove("hidden");
    spinner?.classList.add("hidden");
  }
}


// ════════════════════════════════════════════════════════════
// ERROR MESSAGE HELPER
// Maps Supabase error messages → friendly plain-English text
// ════════════════════════════════════════════════════════════
function friendlyError(error) {
  const msg = (error?.message || "").toLowerCase();

  if (msg.includes("user already registered") || msg.includes("already been registered"))
    return "⚠️ This email is already registered. Try logging in instead.";
  if (msg.includes("invalid login credentials") || msg.includes("invalid email or password"))
    return "❌ Incorrect email or password. Please try again.";
  if (msg.includes("password should be at least") || msg.includes("weak password"))
    return "🔒 Password must be at least 6 characters long.";
  if (msg.includes("email not confirmed"))
    return "📧 Please confirm your email before logging in. Check your inbox.";
  if (msg.includes("rate limit") || msg.includes("too many requests"))
    return "⏳ Too many attempts. Please wait a minute and try again.";
  if (msg.includes("invalid email"))
    return "📧 Please enter a valid email address.";
  if (msg.includes("signup is disabled"))
    return "🚫 New signups are currently disabled. Contact support.";

  return error?.message || "Something went wrong. Please try again.";
}


// ════════════════════════════════════════════════════════════
// LOGIN — Email / Password
// ════════════════════════════════════════════════════════════
loginBtn.addEventListener("click", async () => {
  const email    = loginEmailEl.value.trim();
  const password = loginPassEl.value.trim();
  loginError.textContent = "";
  loginError.style.color = "";

  if (!email || !password) {
    loginError.textContent = "⚠️ Please enter your email and password.";
    return;
  }

  setLoading(loginBtn, true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setLoading(loginBtn, false);

  if (error) loginError.textContent = friendlyError(error);
  // On success onAuthStateChange fires → showDashboard() is called automatically
});

loginPassEl.addEventListener("keydown", (e) => { if (e.key === "Enter") loginBtn.click(); });


// ════════════════════════════════════════════════════════════
// SIGN UP — Email / Password
// ════════════════════════════════════════════════════════════
signupBtn.addEventListener("click", async () => {
  const email    = signupEmailEl.value.trim();
  const password = signupPassEl.value.trim();
  signupError.textContent = "";
  signupError.style.color = "";

  if (!email) {
    signupError.textContent = "⚠️ Please enter your email address.";
    return;
  }
  if (!password || password.length < 6) {
    signupError.textContent = "🔒 Password must be at least 6 characters long.";
    return;
  }

  setLoading(signupBtn, true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  setLoading(signupBtn, false);

  if (error) {
    signupError.textContent = friendlyError(error);
    return;
  }

  // If Supabase email confirmation is ON, session will be null after signup
  if (data.user && !data.session) {
    signupError.style.color = "var(--green)";
    signupError.textContent = "✅ Account created! Check your email to confirm, then log in.";
  }
  // If email confirmation is OFF, session is returned and onAuthStateChange fires
});

signupPassEl.addEventListener("keydown", (e) => { if (e.key === "Enter") signupBtn.click(); });


// ════════════════════════════════════════════════════════════
// FORGOT PASSWORD — Send Reset Email
// ════════════════════════════════════════════════════════════
forgotBtn.addEventListener("click", async () => {
  const email = forgotEmailEl.value.trim();
  forgotError.textContent = "";
  forgotError.style.color = "";

  if (!email) {
    forgotError.textContent = "⚠️ Please enter your email address.";
    return;
  }

  setLoading(forgotBtn, true);

  // Supabase sends a password-reset email with a secure link.
  // The link redirects back to REDIRECT_URL where Supabase auto-handles
  // the token and lets the user set a new password.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: REDIRECT_URL,
  });

  setLoading(forgotBtn, false);

  if (error) {
    forgotError.textContent = friendlyError(error);
  } else {
    forgotError.style.color = "var(--green)";
    forgotError.textContent = "✅ Reset link sent! Check your inbox (and spam folder).";
  }
});

forgotEmailEl.addEventListener("keydown", (e) => { if (e.key === "Enter") forgotBtn.click(); });


// ════════════════════════════════════════════════════════════
// GOOGLE OAUTH
// ════════════════════════════════════════════════════════════
// signInWithOAuth() redirects the browser to Google.
// After the user approves, Google redirects back to REDIRECT_URL.
// Supabase SDK automatically exchanges the code for a session.
googleBtns.forEach(btn => {
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: REDIRECT_URL },
    });
    if (error) loginError.textContent = "Google login failed: " + error.message;
  });
});


// ════════════════════════════════════════════════════════════
// GITHUB OAUTH
// ════════════════════════════════════════════════════════════
githubBtns.forEach(btn => {
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: REDIRECT_URL },
    });
    if (error) loginError.textContent = "GitHub login failed: " + error.message;
  });
});


// ════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════
logoutBtn.addEventListener("click", async () => {
  // Clears the session from memory AND localStorage
  await supabase.auth.signOut();
  // onAuthStateChange fires → showAuthScreen() is called automatically
});


// ════════════════════════════════════════════════════════════
// UI: Show Dashboard vs Auth Screen
// ════════════════════════════════════════════════════════════
function showDashboard(user) {
  currentUser = user;
  // OAuth users may have a display name; email users just have an email
  userEmailSpan.textContent =
    user.user_metadata?.full_name ||
    user.user_metadata?.user_name ||
    user.email || "";

  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  loadExpenses();
}

function showAuthScreen() {
  currentUser = null;
  allExpenses = [];
  appSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  showPanel("login");
}


// ════════════════════════════════════════════════════════════
// ADD EXPENSE
// ════════════════════════════════════════════════════════════
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const amount   = parseFloat(amountInput.value);
  const category = categoryInput.value;
  const note     = noteInput.value.trim();
  const date     = dateInput.value;

  if (!amount || amount <= 0) {
    formError.textContent = "⚠️ Please enter a valid amount greater than 0.";
    return;
  }
  if (!date) {
    formError.textContent = "⚠️ Please pick a date.";
    return;
  }

  const { error } = await supabase
    .from("expenses")
    .insert([{ user_id: currentUser.id, amount, category, note, date }]);

  if (error) {
    formError.textContent = "Could not save expense: " + error.message;
    return;
  }

  amountInput.value   = "";
  noteInput.value     = "";
  dateInput.value     = new Date().toISOString().split("T")[0];
  categoryInput.value = "Food";
  await loadExpenses();
});


// ════════════════════════════════════════════════════════════
// LOAD EXPENSES
// ════════════════════════════════════════════════════════════
async function loadExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false });

  if (error) { console.error("Failed to load expenses:", error.message); return; }

  allExpenses = data || [];
  renderExpenses(allExpenses);
  updateFilterOptions();
}


// ════════════════════════════════════════════════════════════
// RENDER EXPENSE LIST
// ════════════════════════════════════════════════════════════
function renderExpenses(expenses) {
  expenseList.innerHTML = "";

  const selected = filterSelect.value;
  const filtered = selected === "All"
    ? expenses
    : expenses.filter(e => e.category === selected);

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    totalDisplay.textContent = "Total: ₹0.00";
    return;
  }

  emptyState.classList.add("hidden");
  let total = 0;

  filtered.forEach(exp => {
    total += parseFloat(exp.amount);
    const card = document.createElement("div");
    card.className = "expense-card";
    card.innerHTML = `
      <div class="expense-left">
        <span class="expense-category ${getCategoryClass(exp.category)}">${exp.category}</span>
        <span class="expense-note">${exp.note || "—"}</span>
        <span class="expense-date">${formatDate(exp.date)}</span>
      </div>
      <div class="expense-right">
        <span class="expense-amount">₹${parseFloat(exp.amount).toFixed(2)}</span>
        <button class="delete-btn" data-id="${exp.id}" title="Delete">✕</button>
      </div>
    `;
    card.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(exp.id));
    expenseList.appendChild(card);
  });

  totalDisplay.textContent = `Total: ₹${total.toFixed(2)}`;
}


// ════════════════════════════════════════════════════════════
// DELETE EXPENSE
// ════════════════════════════════════════════════════════════
async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) { alert("Could not delete: " + error.message); return; }
  await loadExpenses();
}


// ════════════════════════════════════════════════════════════
// FILTER
// ════════════════════════════════════════════════════════════
filterSelect.addEventListener("change", () => renderExpenses(allExpenses));

function updateFilterOptions() {
  const current    = filterSelect.value;
  const categories = ["All", ...new Set(allExpenses.map(e => e.category))];
  filterSelect.innerHTML = "";
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    filterSelect.appendChild(opt);
  });
  if (categories.includes(current)) filterSelect.value = current;
}


// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════
function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getCategoryClass(cat) {
  const map = {
    Food:"cat-food", Transport:"cat-transport", Shopping:"cat-shopping",
    Health:"cat-health", Bills:"cat-bills", Education:"cat-education", Other:"cat-other",
  };
  return map[cat] || "cat-other";
}
