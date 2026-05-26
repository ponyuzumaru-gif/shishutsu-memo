const categories = [
  "食費",
  "外食・カフェ",
  "日用品",
  "その他",
  "子ども・家族",
  "医療・美容",
  "交通",
  "趣味・娯楽",
  "ローン",
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

const incomeSources = ["給与", "副業", "臨時収入", "その他"];
const defaultCardNames = ["楽天カード", "PayPayカード", "三井住友カード", "その他カード"];
const businessIncomeCategories = ["売上", "報酬", "原稿料", "講師料", "その他収入"];
const businessExpenseCategories = [
  "通信費",
  "消耗品費",
  "交通費",
  "接待交際費",
  "広告宣伝費",
  "外注費",
  "支払手数料",
  "書籍・学習",
  "家事按分",
  "その他経費",
];

const defaultSettings = {
  monthlyBudget: 80000,
  defaultCategory: "食費",
  categories,
  tags,
  incomeSources,
  cardNames: defaultCardNames,
  businessIncomeCategories,
  businessExpenseCategories,
};

const state = {
  expenses: [],
  incomes: [],
  businessEntries: [],
  settings: { ...defaultSettings },
  activeScreen: "input",
  entryType: "expense",
  selectedCategory: "食費",
  selectedPaymentMethod: "cash",
  selectedIncomeSource: "給与",
  selectedTags: new Set(),
  editPaymentMethod: "cash",
  editTags: new Set(),
  viewingMonth: monthKey(new Date()),
  businessType: "income",
  businessYear: new Date().getFullYear(),
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
    "category-field",
    "payment-field",
    "card-name-field",
    "card-name",
    "card-name-suggestions",
    "income-source-options",
    "income-source-field",
    "tag-options",
    "tag-details",
    "form-error",
    "form-success",
    "expense-form",
    "month-title",
    "month-total",
    "month-income-total",
    "month-balance",
    "month-budget",
    "month-remaining",
    "daily-remaining",
    "category-summary",
    "payment-summary",
    "reflection-list",
    "history-list",
    "filter-type",
    "filter-month",
    "filter-category",
    "filter-payment",
    "filter-tag",
    "business-form",
    "business-title",
    "business-date",
    "business-amount",
    "business-category",
    "business-partner",
    "business-note",
    "business-receipt",
    "business-error",
    "business-success",
    "business-income-total",
    "business-expense-total",
    "business-profit-total",
    "business-category-summary",
    "business-list",
    "export-business-csv",
    "settings-form",
    "monthly-budget",
    "default-category",
    "settings-success",
    "edit-dialog",
    "edit-form",
    "edit-title",
    "edit-id",
    "edit-type",
    "edit-amount",
    "edit-date",
    "edit-category-field",
    "edit-category",
    "edit-payment-field",
    "edit-card-name-field",
    "edit-card-name",
    "edit-income-source-field",
    "edit-income-source",
    "edit-memo",
    "edit-tags-field",
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
  els.filterType.addEventListener("change", renderHistory);
  els.filterMonth.addEventListener("change", renderHistory);
  els.filterCategory.addEventListener("change", renderHistory);
  els.filterPayment.addEventListener("change", renderHistory);
  els.filterTag.addEventListener("change", renderHistory);
  els.exportCsv.addEventListener("click", exportCsv);
  els.businessForm.addEventListener("submit", handleAddBusinessEntry);
  els.exportBusinessCsv.addEventListener("click", exportBusinessCsv);
  document.getElementById("prev-month").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("next-month").addEventListener("click", () => shiftMonth(1));
  document.getElementById("prev-business-year").addEventListener("click", () => shiftBusinessYear(-1));
  document.getElementById("next-business-year").addEventListener("click", () => shiftBusinessYear(1));
  document.getElementById("close-dialog").addEventListener("click", closeEditDialog);
  document.getElementById("cancel-edit").addEventListener("click", closeEditDialog);
  document.getElementById("delete-expense").addEventListener("click", deleteEditingExpense);
  document.querySelectorAll("[data-entry-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.entryType = button.dataset.entryType;
      renderInputMode();
    });
  });
  document.querySelectorAll("[data-payment-method]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPaymentMethod = button.dataset.paymentMethod;
      renderPaymentMode();
    });
  });
  document.querySelectorAll("[data-edit-payment-method]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editPaymentMethod = button.dataset.editPaymentMethod;
      renderEditPaymentMode();
    });
  });
  document.querySelectorAll("[data-business-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.businessType = button.dataset.businessType;
      renderBusinessType();
    });
  });
}

function initializeUi() {
  els.date.value = todayKey();
  els.filterMonth.value = state.viewingMonth;
  els.monthlyBudget.value = state.settings.monthlyBudget || "";
  els.businessDate.value = todayKey();
  state.selectedCategory = state.settings.defaultCategory || categories[0];
  state.selectedIncomeSource = state.settings.incomeSources[0] || incomeSources[0];
  state.selectedPaymentMethod = "cash";
  renderOptions();
  renderInputMode();
  renderBusinessType();
}

function renderOptions() {
  state.settings.categories = mergeDefaults(state.settings.categories, categories);
  els.categoryOptions.innerHTML = state.settings.categories
    .map((category) => chipButton(category, state.selectedCategory === category, "category"))
    .join("");
  els.tagOptions.innerHTML = state.settings.tags
    .map((tag) => chipButton(tag, state.selectedTags.has(tag), "tag"))
    .join("");
  els.incomeSourceOptions.innerHTML = state.settings.incomeSources
    .map((source) => chipButton(source, state.selectedIncomeSource === source, "income-source"))
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
  els.incomeSourceOptions.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedIncomeSource = button.dataset.value;
      renderOptions();
    });
  });

  populateSelect(els.filterCategory, ["すべてのカテゴリ", ...state.settings.categories]);
  populateSelect(els.filterPayment, ["すべての支払い方法", "現金", ...state.settings.cardNames]);
  populateSelect(els.filterTag, ["すべてのタグ", ...state.settings.tags]);
  populateSelect(els.defaultCategory, state.settings.categories, state.settings.defaultCategory);
  populateSelect(els.editCategory, state.settings.categories);
  populateSelect(els.editIncomeSource, state.settings.incomeSources);
  els.cardNameSuggestions.innerHTML = state.settings.cardNames
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

function render() {
  renderOptions();
  renderMonth();
  renderHistory();
  renderBusiness();
}

function switchScreen(screen) {
  state.activeScreen = screen;
  document.querySelectorAll(".screen").forEach((section) => {
    section.classList.toggle("active", section.id === `screen-${screen}`);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screen);
  });
  const titles = { input: "入力", month: "今月", history: "履歴", business: "副業", settings: "設定" };
  els.screenTitle.textContent = titles[screen];
  render();
}

async function handleAddExpense(event) {
  event.preventDefault();
  clearMessages();
  const amount = parseAmount(els.amount.value);
  const validation = validateEntry({
    amount,
    date: els.date.value,
    type: state.entryType,
    category: state.selectedCategory,
    source: state.selectedIncomeSource,
    paymentMethod: state.selectedPaymentMethod,
    cardName: els.cardName.value.trim(),
  });
  if (validation) {
    els.formError.textContent = validation;
    return;
  }

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    date: els.date.value,
    amount,
    memo: els.memo.value.trim(),
    createdAt: now,
    updatedAt: now,
  };

  if (state.entryType === "income") {
    const income = { ...entry, source: state.selectedIncomeSource };
    await db.put("incomes", income);
    state.incomes.push(income);
  } else {
    const paymentMethod = state.selectedPaymentMethod;
    const cardName = paymentMethod === "card" ? els.cardName.value.trim() : "";
    const expense = {
      ...entry,
      category: state.selectedCategory,
      paymentMethod,
      cardName,
      tags: [...state.selectedTags],
    };
    await db.put("expenses", expense);
    state.expenses.push(expense);
    state.settings.defaultCategory = state.selectedCategory;
    rememberCardName(cardName);
    await saveSettings();
  }

  els.amount.value = "";
  els.memo.value = "";
  if (state.selectedPaymentMethod === "cash") els.cardName.value = "";
  els.date.value = todayKey();
  state.selectedTags.clear();
  els.formSuccess.textContent = state.entryType === "income" ? "収入を登録しました" : "支出を登録しました";
  window.setTimeout(() => (els.formSuccess.textContent = ""), 2200);
  render();
}

function renderMonth() {
  const monthExpenses = expensesForMonth(state.viewingMonth);
  const monthIncomes = incomesForMonth(state.viewingMonth);
  const total = sum(monthExpenses.map((expense) => expense.amount));
  const incomeTotal = sum(monthIncomes.map((income) => income.amount));
  const balance = incomeTotal - total;
  const budget = Number(state.settings.monthlyBudget) || 0;
  const remaining = budget - total;
  const daily = dailyRemaining(state.viewingMonth, remaining);

  els.monthTitle.textContent = formatMonthTitle(state.viewingMonth);
  els.monthTotal.textContent = yen(total);
  els.monthIncomeTotal.textContent = yen(incomeTotal);
  els.monthBalance.textContent = yen(balance);
  els.monthBalance.style.color = balance < 0 ? "var(--warn)" : "var(--good)";
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

  renderPaymentSummary(monthExpenses, total);
  renderReflection(monthExpenses);
}

function renderPaymentSummary(monthExpenses, total) {
  if (!monthExpenses.length) {
    els.paymentSummary.innerHTML = `<p class="empty-state">この月の支出はまだありません</p>`;
    return;
  }

  const byPayment = monthExpenses.reduce((groups, expense) => {
    const label = paymentLabel(expense);
    groups[label] ||= [];
    groups[label].push(expense);
    return groups;
  }, {});

  els.paymentSummary.innerHTML = Object.entries(byPayment)
    .sort(([, a], [, b]) => sum(b.map((item) => item.amount)) - sum(a.map((item) => item.amount)))
    .map(([label, items]) => {
      const paymentTotal = sum(items.map((item) => item.amount));
      const percent = total ? Math.round((paymentTotal / total) * 100) : 0;
      return `
        <div class="summary-row">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <small>${items.length}件</small>
          </div>
          <strong>${yen(paymentTotal)}</strong>
          <div class="progress" aria-hidden="true"><i style="--value:${percent}%"></i></div>
        </div>
      `;
    })
    .join("");
}

async function handleAddBusinessEntry(event) {
  event.preventDefault();
  els.businessError.textContent = "";
  els.businessSuccess.textContent = "";
  const amount = parseAmount(els.businessAmount.value);
  if (!els.businessDate.value) {
    els.businessError.textContent = "日付を選択してください";
    return;
  }
  if (!amount) {
    els.businessError.textContent = "金額を入力してください";
    return;
  }
  if (amount <= 0) {
    els.businessError.textContent = "1円以上で入力してください";
    return;
  }
  if (!els.businessCategory.value) {
    els.businessError.textContent = "区分を選択してください";
    return;
  }

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    type: state.businessType,
    date: els.businessDate.value,
    amount,
    category: els.businessCategory.value,
    partner: els.businessPartner.value.trim(),
    note: els.businessNote.value.trim(),
    hasReceipt: els.businessReceipt.checked,
    createdAt: now,
    updatedAt: now,
  };
  await db.put("businessEntries", entry);
  state.businessEntries.push(entry);
  els.businessAmount.value = "";
  els.businessPartner.value = "";
  els.businessNote.value = "";
  els.businessReceipt.checked = false;
  els.businessSuccess.textContent = "副業記録を追加しました";
  window.setTimeout(() => (els.businessSuccess.textContent = ""), 2200);
  renderBusiness();
}

function renderBusiness() {
  if (!els.businessTitle) return;
  const entries = businessEntriesForYear(state.businessYear);
  const incomes = entries.filter((entry) => entry.type === "income");
  const expenses = entries.filter((entry) => entry.type === "expense");
  const incomeTotal = sum(incomes.map((entry) => entry.amount));
  const expenseTotal = sum(expenses.map((entry) => entry.amount));
  const profit = incomeTotal - expenseTotal;

  els.businessTitle.textContent = `${state.businessYear}年`;
  els.businessIncomeTotal.textContent = yen(incomeTotal);
  els.businessExpenseTotal.textContent = yen(expenseTotal);
  els.businessProfitTotal.textContent = yen(profit);
  els.businessProfitTotal.style.color = profit < 0 ? "var(--warn)" : "var(--good)";

  renderBusinessCategorySummary(expenses, expenseTotal);
  renderBusinessList(entries);
}

function renderBusinessCategorySummary(expenses, total) {
  if (!expenses.length) {
    els.businessCategorySummary.innerHTML = `<p class="empty-state">この年の経費はまだありません</p>`;
    return;
  }
  const byCategory = groupBy(expenses, "category");
  els.businessCategorySummary.innerHTML = Object.entries(byCategory)
    .sort(([, a], [, b]) => sum(b.map((item) => item.amount)) - sum(a.map((item) => item.amount)))
    .map(([category, items]) => {
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

function renderBusinessList(entries) {
  const sorted = [...entries].sort(sortNewest);
  els.businessList.innerHTML = sorted.length
    ? sorted.map(renderBusinessItem).join("")
    : `<p class="empty-state">この年の副業記録はまだありません</p>`;
  els.businessList.querySelectorAll(".business-delete").forEach((button) => {
    button.addEventListener("click", () => deleteBusinessEntry(button.dataset.id));
  });
}

function renderBusinessItem(entry) {
  const isIncome = entry.type === "income";
  return `
    <article class="expense-item ${isIncome ? "income" : ""}">
      <div class="expense-top">
        <div class="expense-title">
          <strong>${escapeHtml(entry.partner || entry.category)}</strong>
          <span class="expense-meta">${formatDate(entry.date)} / ${isIncome ? "収入" : "経費"} / ${escapeHtml(entry.category)}${entry.hasReceipt ? " / 証憑あり" : ""}</span>
        </div>
        <span class="expense-amount">${isIncome ? "+" : ""}${yen(entry.amount)}</span>
      </div>
      ${entry.note ? `<p class="expense-meta">${escapeHtml(entry.note)}</p>` : ""}
      <button class="edit-button business-delete" type="button" data-id="${entry.id}">削除</button>
    </article>
  `;
}

async function deleteBusinessEntry(id) {
  if (!id || !window.confirm("この副業記録を削除しますか？")) return;
  await db.delete("businessEntries", id);
  state.businessEntries = state.businessEntries.filter((entry) => entry.id !== id);
  renderBusiness();
}

function businessEntriesForYear(year) {
  return state.businessEntries.filter((entry) => entry.date.startsWith(`${year}-`));
}

function shiftBusinessYear(delta) {
  state.businessYear += delta;
  renderBusiness();
}

function renderBusinessType() {
  document.querySelectorAll("[data-business-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.businessType === state.businessType);
  });
  const categories =
    state.businessType === "income"
      ? state.settings.businessIncomeCategories
      : state.settings.businessExpenseCategories;
  populateSelect(els.businessCategory, categories);
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
  const typeFilter = els.filterType.value;
  const categoryFilter = els.filterCategory.value;
  const paymentFilter = els.filterPayment.value;
  const tagFilter = els.filterTag.value;
  const monthFilter = els.filterMonth.value;
  let items = [
    ...state.expenses.map((expense) => ({ ...expense, type: "expense" })),
    ...state.incomes.map((income) => ({ ...income, type: "income" })),
  ];

  if (typeFilter !== "all") items = items.filter((item) => item.type === typeFilter);
  if (monthFilter) items = items.filter((item) => item.date.startsWith(monthFilter));
  if (categoryFilter && categoryFilter !== "すべてのカテゴリ") {
    items = items.filter((item) => item.type === "expense" && item.category === categoryFilter);
  }
  if (paymentFilter && paymentFilter !== "すべての支払い方法") {
    items = items.filter((item) => item.type === "expense" && paymentLabel(item) === paymentFilter);
  }
  if (tagFilter && tagFilter !== "すべてのタグ") {
    items = items.filter((item) => item.type === "expense" && item.tags.includes(tagFilter));
  }

  items.sort(sortNewest);

  els.historyList.innerHTML = items.length
    ? items.map(renderEntryItem).join("")
    : `<p class="empty-state">条件に合う記録はありません</p>`;

  els.historyList.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => openEditDialog(button.dataset.type, button.dataset.id));
  });
}

function renderEntryItem(entry) {
  const isIncome = entry.type === "income";
  const label = isIncome ? entry.source : entry.category;
  const meta = isIncome ? label : `${label} / ${paymentLabel(entry)}`;
  const title = entry.memo || label;
  return `
    <article class="expense-item ${isIncome ? "income" : ""}">
      <div class="expense-top">
        <div class="expense-title">
          <strong>${escapeHtml(title)}</strong>
          <span class="expense-meta">${formatDate(entry.date)} / ${isIncome ? "収入" : "支出"} / ${escapeHtml(meta)}</span>
        </div>
        <span class="expense-amount">${isIncome ? "+" : ""}${yen(entry.amount)}</span>
      </div>
      ${!isIncome && entry.tags.length ? `<div class="tag-row">${entry.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <button class="edit-button" type="button" data-type="${entry.type}" data-id="${entry.id}">編集</button>
    </article>
  `;
}

function openEditDialog(type, id) {
  const entry = type === "income"
    ? state.incomes.find((item) => item.id === id)
    : state.expenses.find((item) => item.id === id);
  if (!entry) return;
  els.editTitle.textContent = type === "income" ? "収入を編集" : "支出を編集";
  els.editId.value = entry.id;
  els.editType.value = type;
  els.editAmount.value = entry.amount;
  els.editDate.value = entry.date;
  els.editMemo.value = entry.memo;
  els.editCategoryField.classList.toggle("hidden", type === "income");
  els.editPaymentField.classList.toggle("hidden", type === "income");
  els.editCardNameField.classList.toggle("hidden", type === "income");
  els.editIncomeSourceField.classList.toggle("hidden", type !== "income");
  els.editTagsField.classList.toggle("hidden", type === "income");
  if (type === "income") {
    els.editIncomeSource.value = entry.source;
    state.editTags = new Set();
  } else {
    els.editCategory.value = entry.category;
    state.editPaymentMethod = normalizedPaymentMethod(entry);
    els.editCardName.value = entry.cardName || "";
    state.editTags = new Set(entry.tags);
  }
  renderEditPaymentMode();
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
  const type = els.editType.value;
  const validation = validateEntry({
    amount,
    date: els.editDate.value,
    type,
    category: els.editCategory.value,
    source: els.editIncomeSource.value,
    paymentMethod: state.editPaymentMethod,
    cardName: els.editCardName.value.trim(),
  });
  if (validation) {
    els.editError.textContent = validation;
    return;
  }

  const list = type === "income" ? state.incomes : state.expenses;
  const entry = list.find((item) => item.id === els.editId.value);
  if (!entry) return;
  const updated = {
    ...entry,
    date: els.editDate.value,
    amount,
    memo: els.editMemo.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (type === "income") {
    updated.source = els.editIncomeSource.value;
    await db.put("incomes", updated);
    state.incomes = state.incomes.map((item) => (item.id === updated.id ? updated : item));
  } else {
    updated.category = els.editCategory.value;
    updated.paymentMethod = state.editPaymentMethod;
    updated.cardName = state.editPaymentMethod === "card" ? els.editCardName.value.trim() : "";
    updated.tags = [...state.editTags];
    await db.put("expenses", updated);
    state.expenses = state.expenses.map((item) => (item.id === updated.id ? updated : item));
    rememberCardName(updated.cardName);
    await saveSettings();
  }
  closeEditDialog();
  render();
}

async function deleteEditingExpense() {
  const id = els.editId.value;
  const type = els.editType.value;
  if (!id || !window.confirm(type === "income" ? "この収入を削除しますか？" : "この支出を削除しますか？")) return;
  if (type === "income") {
    await db.delete("incomes", id);
    state.incomes = state.incomes.filter((income) => income.id !== id);
  } else {
    await db.delete("expenses", id);
    state.expenses = state.expenses.filter((expense) => expense.id !== id);
  }
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

function incomesForMonth(key) {
  return state.incomes.filter((income) => income.date.startsWith(key));
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

function validateEntry({ amount, date, type, category, source, paymentMethod, cardName }) {
  if (!date) return "日付を選択してください";
  if (!amount && amount !== 0) return "金額を入力してください";
  if (amount <= 0) return "1円以上で入力してください";
  if (type === "income" && !source) return "収入種別を選択してください";
  if (type !== "income" && !category) return "カテゴリを選択してください";
  if (type !== "income" && paymentMethod === "card" && !cardName) return "カード名を入力してください";
  return "";
}

function clearMessages() {
  els.formError.textContent = "";
  els.formSuccess.textContent = "";
}

function renderInputMode() {
  const isIncome = state.entryType === "income";
  document.querySelectorAll("[data-entry-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.entryType === state.entryType);
  });
  els.categoryField.classList.toggle("hidden", isIncome);
  els.paymentField.classList.toggle("hidden", isIncome);
  els.incomeSourceField.classList.toggle("hidden", !isIncome);
  els.tagDetails.classList.toggle("hidden", isIncome);
  els.memo.placeholder = isIncome ? "給与・振込元など" : "店名・用途など";
  document.querySelector(".primary-action").textContent = isIncome ? "収入を登録する" : "登録する";
  if (isIncome) state.selectedTags.clear();
  renderPaymentMode();
  renderOptions();
}

function renderPaymentMode() {
  const isCard = state.selectedPaymentMethod === "card";
  document.querySelectorAll("[data-payment-method]").forEach((button) => {
    button.classList.toggle("active", button.dataset.paymentMethod === state.selectedPaymentMethod);
  });
  els.cardNameField.classList.toggle("hidden", state.entryType === "income" || !isCard);
}

function renderEditPaymentMode() {
  const isCard = state.editPaymentMethod === "card";
  document.querySelectorAll("[data-edit-payment-method]").forEach((button) => {
    button.classList.toggle("active", button.dataset.editPaymentMethod === state.editPaymentMethod);
  });
  els.editCardNameField.classList.toggle("hidden", els.editType.value === "income" || !isCard);
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
    const group = item[key] || "未分類";
    groups[group] ||= [];
    groups[group].push(item);
    return groups;
  }, {});
}

function normalizedPaymentMethod(expense) {
  return expense.paymentMethod === "card" ? "card" : "cash";
}

function paymentLabel(expense) {
  return normalizedPaymentMethod(expense) === "card" ? expense.cardName || "カード" : "現金";
}

function rememberCardName(name) {
  const normalized = String(name || "").trim();
  if (!normalized || state.settings.cardNames.includes(normalized)) return;
  state.settings.cardNames = [normalized, ...state.settings.cardNames].slice(0, 12);
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
  const [expenses, incomes, businessEntries, savedSettings] = await Promise.all([
    db.getAll("expenses"),
    db.getAll("incomes"),
    db.getAll("businessEntries"),
    db.get("settings", "main"),
  ]);
  state.expenses = expenses || [];
  state.incomes = incomes || [];
  state.businessEntries = businessEntries || [];
  state.settings = { ...defaultSettings, ...(savedSettings?.value || {}) };
  state.settings.incomeSources = state.settings.incomeSources || incomeSources;
  state.settings.cardNames = state.settings.cardNames || defaultCardNames;
  state.settings.businessIncomeCategories = state.settings.businessIncomeCategories || businessIncomeCategories;
  state.settings.businessExpenseCategories = state.settings.businessExpenseCategories || businessExpenseCategories;
  state.settings.categories = mergeDefaults(state.settings.categories, categories);
  state.expenses = state.expenses.map((expense) => ({
    paymentMethod: "cash",
    cardName: "",
    tags: [],
    ...expense,
  }));
}

function mergeDefaults(savedItems, defaultItems) {
  const merged = Array.isArray(savedItems) ? [...savedItems] : [];
  defaultItems.forEach((item) => {
    if (!merged.includes(item)) merged.push(item);
  });
  return merged;
}

async function saveSettings() {
  await db.put("settings", { id: "main", value: state.settings });
}

function exportCsv() {
  const header = [
    "type",
    "id",
    "date",
    "amount",
    "category",
    "source",
    "paymentMethod",
    "cardName",
    "memo",
    "tags",
    "createdAt",
    "updatedAt",
  ];
  const entries = [
    ...state.expenses.map((expense) => ({ ...expense, type: "expense", source: "" })),
    ...state.incomes.map((income) => ({
      ...income,
      type: "income",
      category: "",
      paymentMethod: "",
      cardName: "",
      tags: [],
    })),
  ].sort(sortNewest);
  const rows = entries.map((entry) =>
    header.map((key) => csvCell(key === "tags" ? (entry.tags || []).join("|") : entry[key])).join(",")
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

function exportBusinessCsv() {
  const header = [
    "type",
    "date",
    "amount",
    "category",
    "partner",
    "note",
    "hasReceipt",
    "createdAt",
    "updatedAt",
  ];
  const rows = businessEntriesForYear(state.businessYear)
    .sort(sortNewest)
    .map((entry) => header.map((key) => csvCell(entry[key])).join(","));
  const csv = "\ufeff" + [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `side-business-${state.businessYear}.csv`;
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
      const request = indexedDB.open("shishutsu-memo-db", 3);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("expenses")) {
          database.createObjectStore("expenses", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("incomes")) {
          database.createObjectStore("incomes", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("businessEntries")) {
          database.createObjectStore("businessEntries", { keyPath: "id" });
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
