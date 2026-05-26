const categories = [
  "食費",
  "外食・カフェ",
  "日用品",
  "その他",
  "子ども・家族",
  "医療・美容",
  "交通",
  "趣味・娯楽",
  "固定費",
];

const tags = [
  "予定外",
  "高め",
  "買ってよかった",
  "見直し候補",
  "一時的",
  "必要経費",
  "まとめ買い",
];

const defaultSettings = {
  monthlyBudget: 80000,
  defaultCategory: "食費",
  categories,
  tags,
};

const state = {
  expenses: [],
  settings: { ...defaultSettings },
  activeScreen: "input",
  selectedCategory: "食費",
  selectedTags: new Set(),
  editTags: new Set(),
  viewingMonth: monthKey(new Date()),
};

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  await db.open();
  await loadData();
  initializeUi();
  render();
  registerServiceWorker();
});

function cacheElements() {
  [
    "screen-title",
    "amount",
    "date",
    "memo",
    "category-options",
    "tag-options",
    "form-error",
    "form-success",
    "expense-form",
    "month-title",
    "month-total",
    "month-budget",
    "month-remaining",
    "daily-remaining",
    "category-summary",
    "reflection-list",
    "history-list",
    "filter-month",
    "filter-category",
    "filter-tag",
    "settings-form",
    "monthly-budget",
    "default-category",
    "settings-success",
    "edit-dialog",
    "edit-form",
    "edit-id",
    "edit-amount",
    "edit-date",
    "edit-category",
    "edit-memo",
    "edit-tags",
    "edit-error",
    "export-csv",
  ].forEach((id) => {
    els[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchScreen(button.dataset.screen));
  });

  els.expenseForm.addEventListener("submit", handleAddExpense);
  els.settingsForm.addEventListener("submit", handleSaveSettings);
  els.editForm.addEventListener("submit", handleEditExpense);
  els.filterMonth.addEventListener("change", renderHistory);
  els.filterCategory.addEventListener("change", renderHistory);
  els.filterTag.addEventListener("change", renderHistory);
  els.exportCsv.addEventListener("click", exportCsv);
  document.getElementById("prev-month").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("next-month").addEventListener("click", () => shiftMonth(1));
  document.getElementById("close-dialog").addEventListener("click", closeEditDialog);
  document.getElementById("cancel-edit").addEventListener("click", closeEditDialog);
  document.getElementById("delete-expense").addEventListener("click", deleteEditingExpense);
}

function initializeUi() {
  els.date.value = todayKey();
  els.filterMonth.value = state.viewingMonth;
  els.monthlyBudget.value = state.settings.monthlyBudget || "";
  state.selectedCategory = state.settings.defaultCategory || categories[0];
  renderOptions();
}

function renderOptions() {
  els.categoryOptions.innerHTML = state.settings.categories
    .map((category) => chipButton(category, state.selectedCategory === category, "category"))
    .join("");
  els.tagOptions.innerHTML = state.settings.tags
    .map((tag) => chipButton(tag, state.selectedTags.has(tag), "tag"))
    .join("");

  els.categoryOptions.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCategory = button.dataset.value;
      renderOptions();
    });
  });

  els.tagOptions.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSetValue(state.selectedTags, button.dataset.value);
      renderOptions();
    });
  });

  populateSelect(els.filterCategory, ["すべてのカテゴリ", ...state.settings.categories]);
  populateSelect(els.filterTag, ["すべてのタグ", ...state.settings.tags]);
  populateSelect(els.defaultCategory, state.settings.categories, state.settings.defaultCategory);
  populateSelect(els.editCategory, state.settings.categories);
}

function render() {
  renderOptions();
  renderMonth();
  renderHistory();
}

function switchScreen(screen) {
  state.activeScreen = screen;
  document.querySelectorAll(".screen").forEach((section) => {
    section.classList.toggle("active", section.id === `screen-${screen}`);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screen);
  });
  const titles = { input: "入力", month: "今月", history: "履歴", settings: "設定" };
  els.screenTitle.textContent = titles[screen];
  render();
}

async function handleAddExpense(event) {
  event.preventDefault();
  clearMessages();
  const amount = parseAmount(els.amount.value);
  const validation = validateExpense({ amount, date: els.date.value, category: state.selectedCategory });
  if (validation) {
    els.formError.textContent = validation;
    return;
  }

  const now = new Date().toISOString();
  const expense = {
    id: crypto.randomUUID(),
    date: els.date.value,
    amount,
    category: state.selectedCategory,
    memo: els.memo.value.trim(),
    tags: [...state.selectedTags],
    createdAt: now,
    updatedAt: now,
  };

  await db.put("expenses", expense);
  state.expenses.push(expense);
  state.settings.defaultCategory = state.selectedCategory;
  await saveSettings();

  els.amount.value = "";
  els.memo.value = "";
  els.date.value = todayKey();
  state.selectedTags.clear();
  els.formSuccess.textContent = "登録しました";
  window.setTimeout(() => (els.formSuccess.textContent = ""), 2200);
  render();
}

function renderMonth() {
  const monthExpenses = expensesForMonth(state.viewingMonth);
  const total = sum(monthExpenses.map((expense) => expense.amount));
  const budget = Number(state.settings.monthlyBudget) || 0;
  const remaining = budget - total;
  const daily = dailyRemaining(state.viewingMonth, remaining);

  els.monthTitle.textContent = formatMonthTitle(state.viewingMonth);
  els.monthTotal.textContent = yen(total);
  els.monthBudget.textContent = yen(budget);
  els.monthRemaining.textContent = yen(remaining);
  els.monthRemaining.style.color = remaining < 0 ? "var(--warn)" : "var(--ink)";
  els.dailyRemaining.textContent = daily == null ? "-" : yen(Math.floor(daily));

  if (!monthExpenses.length) {
    els.categorySummary.innerHTML = `<p class="empty-state">この月の支出はまだありません</p>`;
  } else {
    const byCategory = groupBy(monthExpenses, "category");
    els.categorySummary.innerHTML = state.settings.categories
      .filter((category) => byCategory[category])
      .map((category) => {
        const items = byCategory[category];
        const categoryTotal = sum(items.map((item) => item.amount));
        const percent = total ? Math.round((categoryTotal / total) * 100) : 0;
        return `
          <div class="summary-row">
            <div>
              <strong>${escapeHtml(category)}</strong>
              <small>${items.length}件</small>
            </div>
            <strong>${yen(categoryTotal)}</strong>
            <div class="progress" aria-hidden="true"><i style="--value:${percent}%"></i></div>
          </div>
        `;
      })
      .join("");
  }

  renderReflection(monthExpenses);
}

function renderReflection(monthExpenses) {
  const groups = [
    { title: "見直し候補", tags: ["見直し候補"] },
    { title: "買ってよかった", tags: ["買ってよかった"] },
    { title: "今月だけの出費", tags: ["一時的", "まとめ買い"] },
    { title: "予定外・高め", tags: ["予定外", "高め"] },
  ];

  els.reflectionList.innerHTML = groups
    .map((group) => {
      const items = monthExpenses
        .filter((expense) => expense.tags.some((tag) => group.tags.includes(tag)))
        .sort(sortNewest)
        .slice(0, 6);
      const total = sum(items.map((item) => item.amount));
      return `
        <div class="reflection-block">
          <h4>${group.title} <span class="expense-meta">${items.length}件 / ${yen(total)}</span></h4>
          ${
            items.length
              ? `<div class="mini-list">${items.map(renderMiniExpense).join("")}</div>`
              : `<p class="empty-state">該当する支出はありません</p>`
          }
        </div>
      `;
    })
    .join("");
}

function renderMiniExpense(expense) {
  return `
    <div class="mini-expense">
      <span>${formatDate(expense.date)} ${escapeHtml(expense.memo || expense.category)}</span>
      <strong>${yen(expense.amount)}</strong>
    </div>
  `;
}

function renderHistory() {
  const categoryFilter = els.filterCategory.value;
  const tagFilter = els.filterTag.value;
  const monthFilter = els.filterMonth.value;
  let items = [...state.expenses];

  if (monthFilter) items = items.filter((expense) => expense.date.startsWith(monthFilter));
  if (categoryFilter && categoryFilter !== "すべてのカテゴリ") {
    items = items.filter((expense) => expense.category === categoryFilter);
  }
  if (tagFilter && tagFilter !== "すべてのタグ") {
    items = items.filter((expense) => expense.tags.includes(tagFilter));
  }

  items.sort(sortNewest);

  els.historyList.innerHTML = items.length
    ? items.map(renderExpenseItem).join("")
    : `<p class="empty-state">条件に合う支出はありません</p>`;

  els.historyList.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => openEditDialog(button.dataset.id));
  });
}

function renderExpenseItem(expense) {
  return `
    <article class="expense-item">
      <div class="expense-top">
        <div class="expense-title">
          <strong>${escapeHtml(expense.memo || expense.category)}</strong>
          <span class="expense-meta">${formatDate(expense.date)} / ${escapeHtml(expense.category)}</span>
        </div>
        <span class="expense-amount">${yen(expense.amount)}</span>
      </div>
      ${expense.tags.length ? `<div class="tag-row">${expense.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <button class="edit-button" type="button" data-id="${expense.id}">編集</button>
    </article>
  `;
}

function openEditDialog(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;
  els.editId.value = expense.id;
  els.editAmount.value = expense.amount;
  els.editDate.value = expense.date;
  els.editCategory.value = expense.category;
  els.editMemo.value = expense.memo;
  state.editTags = new Set(expense.tags);
  renderEditTags();
  els.editError.textContent = "";
  els.editDialog.showModal();
}

function renderEditTags() {
  els.editTags.innerHTML = state.settings.tags
    .map((tag) => chipButton(tag, state.editTags.has(tag), "edit-tag"))
    .join("");
  els.editTags.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSetValue(state.editTags, button.dataset.value);
      renderEditTags();
    });
  });
}

async function handleEditExpense(event) {
  event.preventDefault();
  const amount = parseAmount(els.editAmount.value);
  const validation = validateExpense({
    amount,
    date: els.editDate.value,
    category: els.editCategory.value,
  });
  if (validation) {
    els.editError.textContent = validation;
    return;
  }

  const expense = state.expenses.find((item) => item.id === els.editId.value);
  if (!expense) return;
  const updated = {
    ...expense,
    date: els.editDate.value,
    amount,
    category: els.editCategory.value,
    memo: els.editMemo.value.trim(),
    tags: [...state.editTags],
    updatedAt: new Date().toISOString(),
  };
  await db.put("expenses", updated);
  state.expenses = state.expenses.map((item) => (item.id === updated.id ? updated : item));
  closeEditDialog();
  render();
}

async function deleteEditingExpense() {
  const id = els.editId.value;
  if (!id || !window.confirm("この支出を削除しますか？")) return;
  await db.delete("expenses", id);
  state.expenses = state.expenses.filter((expense) => expense.id !== id);
  closeEditDialog();
  render();
}

function closeEditDialog() {
  els.editDialog.close();
}

async function handleSaveSettings(event) {
  event.preventDefault();
  state.settings.monthlyBudget = parseAmount(els.monthlyBudget.value) || 0;
  state.settings.defaultCategory = els.defaultCategory.value || categories[0];
  state.selectedCategory = state.settings.defaultCategory;
  await saveSettings();
  els.settingsSuccess.textContent = "設定を保存しました";
  window.setTimeout(() => (els.settingsSuccess.textContent = ""), 2200);
  render();
}

function shiftMonth(delta) {
  const [year, month] = state.viewingMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  state.viewingMonth = monthKey(next);
  els.filterMonth.value = state.viewingMonth;
  renderMonth();
}

function expensesForMonth(key) {
  return state.expenses.filter((expense) => expense.date.startsWith(key));
}

function dailyRemaining(key, remaining) {
  const nowKey = monthKey(new Date());
  const [year, month] = key.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (key < nowKey) return null;
  if (key > nowKey) return remaining / daysInMonth;
  const today = new Date().getDate();
  return remaining / (daysInMonth - today + 1);
}

function validateExpense({ amount, date, category }) {
  if (!date) return "日付を選択してください";
  if (!amount && amount !== 0) return "金額を入力してください";
  if (amount <= 0) return "1円以上で入力してください";
  if (!category) return "カテゴリを選択してください";
  return "";
}

function clearMessages() {
  els.formError.textContent = "";
  els.formSuccess.textContent = "";
}

function chipButton(label, active, name) {
  return `<button class="chip ${active ? "active" : ""}" type="button" data-name="${name}" data-value="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
}

function populateSelect(select, options, selected = "") {
  const previous = selected || select.value;
  select.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
  if (previous && options.includes(previous)) select.value = previous;
}

function toggleSetValue(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function parseAmount(value) {
  const normalized = String(value).replace(/[^\d]/g, "");
  if (!normalized) return null;
  return Number(normalized);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayKey() {
  const now = new Date();
  return `${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatMonthTitle(key) {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
}

function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function yen(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")}円`;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const group = item[key];
    groups[group] ||= [];
    groups[group].push(item);
    return groups;
  }, {});
}

function sortNewest(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.createdAt.localeCompare(a.createdAt);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function loadData() {
  const [expenses, savedSettings] = await Promise.all([db.getAll("expenses"), db.get("settings", "main")]);
  state.expenses = expenses || [];
  state.settings = { ...defaultSettings, ...(savedSettings?.value || {}) };
}

async function saveSettings() {
  await db.put("settings", { id: "main", value: state.settings });
}

function exportCsv() {
  const header = ["id", "date", "amount", "category", "memo", "tags", "createdAt", "updatedAt"];
  const rows = state.expenses.sort(sortNewest).map((expense) =>
    header.map((key) => csvCell(key === "tags" ? expense.tags.join("|") : expense[key])).join(",")
  );
  const csv = "\ufeff" + [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shishutsu-memo-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

const db = {
  instance: null,
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("shishutsu-memo-db", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("expenses")) {
          database.createObjectStore("expenses", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        db.instance = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },
  tx(store, mode = "readonly") {
    return db.instance.transaction(store, mode).objectStore(store);
  },
  getAll(store) {
    return requestToPromise(db.tx(store).getAll());
  },
  get(store, key) {
    return requestToPromise(db.tx(store).get(key));
  },
  put(store, value) {
    return requestToPromise(db.tx(store, "readwrite").put(value));
  },
  delete(store, key) {
    return requestToPromise(db.tx(store, "readwrite").delete(key));
  },
};

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
