// ============================================================
// script.js — Expense Tracker Application Logic
// ============================================================
// Handles: Authentication (sign-up / login / logout),
//          Adding expenses, loading expenses, deleting expenses,
//          Filtering by category, and live total calculation.
// ============================================================

import { supabase } from "./supabase.js";

// ── DOM References ───────────────────────────────────────────
// Auth section
const authSection     = document.getElementById("auth-section");
const appSection      = document.getElementById("app-section");
const authTitle       = document.getElementById("auth-title");
const emailInput      = document.getElementById("email");
const passwordInput   = document.getElementById("password");
const authBtn         = document.getElementById("auth-btn");
const authToggleLink  = document.getElementById("auth-toggle-link");
const authToggleText  = document.getElementById("auth-toggle-text");
const authError       = document.getElementById("auth-error");
const logoutBtn       = document.getElementById("logout-btn");
const userEmailSpan   = document.getElementById("user-email");

// Expense form
const expenseForm     = document.getElementById("expense-form");
const amountInput     = document.getElementById("amount");
const categoryInput   = document.getElementById("category");
const noteInput       = document.getElementById("note");
const dateInput       = document.getElementById("date");
const formError       = document.getElementById("form-error");

// Expense list & summary
const expenseList     = document.getElementById("expense-list");
const totalDisplay    = document.getElementById("total-display");
const filterSelect    = document.getElementById("filter-category");
const emptyState      = document.getElementById("empty-state");

// ── State ────────────────────────────────────────────────────
let isLoginMode   = true;   // toggles between Login and Sign Up
let currentUser   = null;   // holds the logged-in user object
let allExpenses   = [];     // cache of fetched expenses

// ── Initialisation ───────────────────────────────────────────
// Run when the page first loads
window.addEventListener("DOMContentLoaded", async () => {
  // Set today's date as default in the date field
  dateInput.value = new Date().toISOString().split("T")[0];

  // Check if a user is already logged in (session persisted by Supabase)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    handleLoginSuccess(session.user);
  }

  // Listen for auth state changes (login, logout, token refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      handleLoginSuccess(session.user);
    } else {
      handleLogout();
    }
  });
});

// ── Auth: Toggle between Login and Sign Up ───────────────────
authToggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  authError.textContent = "";

  if (isLoginMode) {
    authTitle.textContent        = "Welcome Back";
    authBtn.textContent          = "Log In";
    authToggleText.innerHTML     = `Don't have an account? <a href="#" id="auth-toggle-link">Sign Up</a>`;
  } else {
    authTitle.textContent        = "Create Account";
    authBtn.textContent          = "Sign Up";
    authToggleText.innerHTML     = `Already have an account? <a href="#" id="auth-toggle-link">Log In</a>`;
  }

  // Re-attach click listener because we replaced the element's HTML
  document.getElementById("auth-toggle-link").addEventListener("click", (ev) => {
    ev.preventDefault();
    authToggleLink.click(); // re-trigger the outer handler via a programmatic click
  });
});

// ── Auth: Handle Login / Sign Up button click ────────────────
authBtn.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();
  authError.textContent = "";

  // Basic validation
  if (!email || !password) {
    authError.textContent = "Please enter both email and password.";
    return;
  }

  authBtn.disabled    = true;
  authBtn.textContent = "Please wait…";

  if (isLoginMode) {
    // ── Log In ──────────────────────────────────────────────
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      authError.textContent = error.message;
    } else {
      handleLoginSuccess(data.user);
    }
  } else {
    // ── Sign Up ─────────────────────────────────────────────
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      authError.textContent = error.message;
    } else if (data.user && !data.session) {
      // Supabase sends a confirmation email by default
      authError.style.color  = "var(--green)";
      authError.textContent  = "✅ Check your email to confirm your account, then log in.";
    } else {
      handleLoginSuccess(data.user);
    }
  }

  authBtn.disabled    = false;
  authBtn.textContent = isLoginMode ? "Log In" : "Sign Up";
});

// Allow pressing Enter in password field to submit
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") authBtn.click();
});

// ── Auth: Logout ─────────────────────────────────────────────
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  // onAuthStateChange will call handleLogout() automatically
});

// ── UI Helpers: show app or auth screen ──────────────────────
function handleLoginSuccess(user) {
  currentUser          = user;
  userEmailSpan.textContent = user.email;
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  loadExpenses(); // Fetch this user's expenses
}

function handleLogout() {
  currentUser = null;
  allExpenses = [];
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  emailInput.value    = "";
  passwordInput.value = "";
}

// ── Add Expense ──────────────────────────────────────────────
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // prevent page reload
  formError.textContent = "";

  const amount   = parseFloat(amountInput.value);
  const category = categoryInput.value;
  const note     = noteInput.value.trim();
  const date     = dateInput.value;

  // Validation
  if (!amount || amount <= 0) {
    formError.textContent = "Please enter a valid amount greater than 0.";
    return;
  }
  if (!date) {
    formError.textContent = "Please pick a date.";
    return;
  }

  // Insert into Supabase — user_id is tied to the logged-in user
  const { error } = await supabase
    .from("expenses")
    .insert([{ user_id: currentUser.id, amount, category, note, date }]);

  if (error) {
    formError.textContent = "Could not save expense: " + error.message;
    return;
  }

  // Reset form fields (keep date as today)
  amountInput.value   = "";
  noteInput.value     = "";
  dateInput.value     = new Date().toISOString().split("T")[0];
  categoryInput.value = "Food";

  // Reload the expense list to show the new item
  await loadExpenses();
});

// ── Load Expenses from Supabase ──────────────────────────────
async function loadExpenses() {
  // Fetch only the current user's expenses, newest first
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", currentUser.id)   // only this user's data (also enforced by RLS)
    .order("date", { ascending: false });

  if (error) {
    console.error("Failed to load expenses:", error.message);
    return;
  }

  allExpenses = data || [];
  renderExpenses(allExpenses);
  updateFilterOptions();
}

// ── Render Expense List ──────────────────────────────────────
function renderExpenses(expenses) {
  expenseList.innerHTML = ""; // clear old items

  // Apply the active category filter
  const selectedCategory = filterSelect.value;
  const filtered = selectedCategory === "All"
    ? expenses
    : expenses.filter((exp) => exp.category === selectedCategory);

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    totalDisplay.textContent = "Total: ₹0.00";
    return;
  }

  emptyState.classList.add("hidden");

  let total = 0;

  // Build a card for each expense
  filtered.forEach((exp) => {
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
        <button class="delete-btn" data-id="${exp.id}" title="Delete expense">✕</button>
      </div>
    `;

    // Attach delete handler directly on the card's button
    card.querySelector(".delete-btn").addEventListener("click", () => deleteExpense(exp.id));
    expenseList.appendChild(card);
  });

  // Show the running total
  totalDisplay.textContent = `Total: ₹${total.toFixed(2)}`;
}

// ── Delete Expense ───────────────────────────────────────────
async function deleteExpense(id) {
  // Remove from Supabase (RLS ensures users can only delete their own rows)
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Could not delete expense: " + error.message);
    return;
  }

  // Reload the list to reflect the deletion
  await loadExpenses();
}

// ── Filter by Category ───────────────────────────────────────
filterSelect.addEventListener("change", () => {
  renderExpenses(allExpenses);
});

// Populate the filter dropdown with categories present in allExpenses
function updateFilterOptions() {
  const currentFilter = filterSelect.value;
  const categories    = ["All", ...new Set(allExpenses.map((e) => e.category))];

  filterSelect.innerHTML = "";
  categories.forEach((cat) => {
    const opt   = document.createElement("option");
    opt.value   = cat;
    opt.textContent = cat;
    filterSelect.appendChild(opt);
  });

  // Restore previously selected filter if it still exists
  if (categories.includes(currentFilter)) {
    filterSelect.value = currentFilter;
  }
}

// ── Utility: Format date string nicely ──────────────────────
function formatDate(dateStr) {
  // dateStr is "YYYY-MM-DD"; Date constructor in UTC — add T00:00 to avoid timezone shift
  const d = new Date(dateStr + "T00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Utility: CSS class per category for colour-coding ────────
function getCategoryClass(category) {
  const map = {
    Food       : "cat-food",
    Transport  : "cat-transport",
    Shopping   : "cat-shopping",
    Health     : "cat-health",
    Bills      : "cat-bills",
    Education  : "cat-education",
    Other      : "cat-other",
  };
  return map[category] || "cat-other";
}
