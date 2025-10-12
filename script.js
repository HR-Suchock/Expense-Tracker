// ==========================
// 💰 Pro Expense Tracker JS
// ==========================

let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let budgets = JSON.parse(localStorage.getItem("budgets")) || {}; // multiple month budget
let chart;

// DOM Elements
const expenseForm = document.getElementById("expense-form");
const expenseList = document.getElementById("expense-list");
const budgetAlert = document.getElementById("budget-alert");
const budgetInput = document.getElementById("budget-input");
const setBudgetBtn = document.getElementById("set-budget-btn");
const monthFilter = document.getElementById("month-filter");
const categoryFilter = document.getElementById("category-filter");
const filterBtn = document.getElementById("filter-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const darkToggle = document.getElementById("dark-mode-toggle");
const expenseChartCanvas = document.getElementById("expense-chart");

const displayBudget = document.getElementById("display-budget");
const displayExpense = document.getElementById("display-expense");
const displayRemaining = document.getElementById("display-remaining");

// --------------------------
// Dark Mode
// --------------------------
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");
darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});

// --------------------------
// Set Monthly Budget
// --------------------------
setBudgetBtn.addEventListener("click", () => {
  const month = monthFilter.value || new Date().toISOString().slice(0, 7); // default current month
  const budgetValue = parseFloat(budgetInput.value);
  if (!budgetValue || budgetValue <= 0) return alert("Enter a valid budget amount!");

  budgets[month] = budgetValue;
  localStorage.setItem("budgets", JSON.stringify(budgets));
  renderExpenses();
  budgetInput.value = "";
});

// --------------------------
// Add Expense
// --------------------------
expenseForm.addEventListener("submit", e => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const date = document.getElementById("date").value;
  const note = document.getElementById("note").value;

  const entry = { id: Date.now(), amount, category, date, note };
  expenses.push(entry);
  localStorage.setItem("expenses", JSON.stringify(expenses));
  renderExpenses();
  expenseForm.reset();
});

// --------------------------
// Render Expenses (default this month)
// --------------------------
function renderExpenses() {
  expenseList.innerHTML = "";

  const selectedMonth = monthFilter.value || new Date().toISOString().slice(0, 7); // default current month
  let filtered = expenses.filter(exp => exp.date.startsWith(selectedMonth));

  if (categoryFilter.value) filtered = filtered.filter(exp => exp.category === categoryFilter.value);

  let totalExpense = 0;
  const categoryData = {};
  const categorySet = new Set();

  filtered.forEach(exp => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${exp.amount}</td>
      <td>${exp.category}</td>
      <td>${exp.date}</td>
      <td>${exp.note}</td>
      <td><button class="c-button delete-btn" onclick="deleteExpense(${exp.id})">Delete</button></td>
    `;
    expenseList.appendChild(row);

    totalExpense += exp.amount;
    categoryData[exp.category] = (categoryData[exp.category] || 0) + exp.amount;
    categorySet.add(exp.category);
  });

  // Month-based budget
  const monthBudget = budgets[selectedMonth] || 0;
  displayBudget.innerText = monthBudget.toFixed(2);
  displayExpense.innerText = totalExpense.toFixed(2);
  displayRemaining.innerText = (monthBudget - totalExpense).toFixed(2);

  if (monthBudget) {
    const remaining = monthBudget - totalExpense;
    budgetAlert.innerText = remaining < 0
      ? `⚠️ ${selectedMonth} Budget Exceeded by ${Math.abs(remaining).toFixed(2)} BDT`
      : `Remaining for ${selectedMonth}: ${remaining.toFixed(2)} BDT`;
    budgetAlert.style.color = remaining < 0 ? "red" : "lime";
  } else {
    budgetAlert.innerText = `⚠️ No budget set for ${selectedMonth}`;
    budgetAlert.style.color = "orange";
  }

  updateCategoryFilter(categorySet);
  updateChart(categoryData);
}

// --------------------------
// Delete Expense
// --------------------------
function deleteExpense(id) {
  expenses = expenses.filter(exp => exp.id !== id);
  localStorage.setItem("expenses", JSON.stringify(expenses));
  renderExpenses();
}

// --------------------------
// Dynamic Category Filter
// --------------------------
function updateCategoryFilter(categorySet) {
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  categorySet.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.innerText = cat;
    categoryFilter.appendChild(opt);
  });
}

// --------------------------
// Dynamic Chart
// --------------------------
function updateChart(categoryData) {
  const ctx = expenseChartCanvas.getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(categoryData),
      datasets: [{
        data: Object.values(categoryData),
        backgroundColor: generateColors(Object.keys(categoryData).length),
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              let value = ctx.raw;
              let total = Object.values(categoryData).reduce((a, b) => a + b, 0);
              let percent = ((value / total) * 100).toFixed(2);
              return `${ctx.label}: ${value} BDT (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

function generateColors(num) {
  const colors = [];
  for (let i = 0; i < num; i++) colors.push(`hsl(${Math.floor(Math.random() * 360)},70%,60%)`);
  return colors;
}

// --------------------------
// Filter Button
// --------------------------
filterBtn.addEventListener("click", renderExpenses);

// --------------------------
// Export PDF
// --------------------------
exportPdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Monthly Expense Report", 105, 15, null, null, "center");

  const selectedMonth = monthFilter.value || new Date().toISOString().slice(0, 7);
  let filtered = expenses.filter(exp => exp.date.startsWith(selectedMonth));

  let totalExpense = 0;
  let y = 30;
  filtered.forEach(exp => {
    doc.text(`${exp.date} | ${exp.category} | ${exp.amount} BDT | ${exp.note}`, 10, y);
    y += 10;
    totalExpense += exp.amount;
    if (y > 280) { doc.addPage(); y = 20; }
  });

  const monthBudget = budgets[selectedMonth] || 0;
  const remaining = monthBudget - totalExpense;
  y += 10;
  doc.text(`Total Expense: ${totalExpense.toFixed(2)} BDT`, 10, y);
  y += 10;
  doc.text(`Budget (${selectedMonth}): ${monthBudget.toFixed(2)} BDT`, 10, y);
  y += 10;
  doc.text(`Remaining: ${remaining.toFixed(2)} BDT`, 10, y);

  doc.save(`Expense_Report_${selectedMonth}.pdf`);
});

// --------------------------
// Initial Render
// --------------------------
renderExpenses();

// --------------------------
// PWA Service Worker
// --------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(() => console.log("Service Worker Registered"));
}
