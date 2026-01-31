/* ========================================
   Nova Budget Manager - Main Application
   Clean, easy to follow JavaScript code
======================================== */

// ==========================================
// Global State
// ==========================================
let currentUser = null;
let accounts = [];
let transactions = [];
let budgets = [];
let unsubscribeListeners = [];

// Calendar state
let currentCalendarDate = new Date();
let selectedDayDate = null;

// Category emojis mapping
const categoryEmojis = {
    food: '🍔',
    transport: '🚗',
    shopping: '🛍️',
    entertainment: '🎬',
    bills: '📄',
    health: '💊',
    education: '📚',
    salary: '💰',
    freelance: '💼',
    investment: '📈',
    transfer: '🔄',
    other: '📦'
};

// Account type icons
const accountIcons = {
    bank: '🏦',
    cash: '💵',
    savings: '🏧',
    credit: '💳'
};

// ==========================================
// DOM Elements
// ==========================================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Screens
const loadingScreen = $('#loading-screen');
const authPage = $('#auth-page');
const mainApp = $('#main-app');

// Auth elements
const authForm = $('#auth-form');
const authTitle = $('#auth-title');
const authSubtitle = $('#auth-subtitle');
const authError = $('#auth-error');
const authEmail = $('#auth-email');
const authPassword = $('#auth-password');
const authSubmit = $('#auth-submit');
const authToggleText = $('#auth-toggle-text');
const authToggleBtn = $('#auth-toggle-btn');

// State for auth mode
let isLoginMode = true;

// ==========================================
// Initialize App
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Set default date for transaction form
    $('#txn-date').valueAsDate = new Date();
    
    // Initialize calendar to current month
    currentCalendarDate = new Date();
    
    // Setup event listeners
    setupEventListeners();
    
    // Listen for auth state changes
    auth.onAuthStateChanged(handleAuthStateChange);
});

// ==========================================
// Auth State Handler
// ==========================================
function handleAuthStateChange(user) {
    // Hide loading screen
    loadingScreen.classList.add('hidden');
    
    if (user) {
        // User is logged in
        currentUser = user;
        showMainApp();
        loadUserData();
    } else {
        // User is logged out
        currentUser = null;
        cleanupListeners();
        showAuthPage();
    }
}

function showAuthPage() {
    authPage.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

function showMainApp() {
    authPage.classList.add('hidden');
    mainApp.classList.remove('hidden');
}

// ==========================================
// Event Listeners Setup
// ==========================================
function setupEventListeners() {
    // Auth form toggle
    authToggleBtn.addEventListener('click', toggleAuthMode);
    
    // Auth form submit
    authForm.addEventListener('submit', handleAuthSubmit);
    
    // Logout button
    $('#logout-btn').addEventListener('click', handleLogout);
    
    // Navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });
    
    // Modal buttons
    $('#add-transaction-btn').addEventListener('click', () => openModal('transaction-modal'));
    $('#add-account-btn').addEventListener('click', () => openModal('account-modal'));
    $('#add-budget-btn').addEventListener('click', () => openModal('budget-modal'));
    
    // Calendar navigation
    $('#prev-month-btn').addEventListener('click', () => changeCalendarMonth(-1));
    $('#next-month-btn').addEventListener('click', () => changeCalendarMonth(1));
    
    // Add transaction from day detail modal
    $('#add-day-transaction-btn').addEventListener('click', () => {
        closeModal('day-detail-modal');
        openTransactionModalForDate(selectedDayDate);
    });
    
    // Modal close buttons
    $$('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.currentTarget.dataset.closeModal;
            closeModal(modalId);
        });
    });
    
    // Modal backdrop click to close
    $$('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.add('hidden');
        });
    });
    
    // Transaction type tabs
    $$('.type-tab').forEach(tab => {
        tab.addEventListener('click', handleTransactionTypeChange);
    });
    
    // Forms
    $('#transaction-form').addEventListener('submit', handleTransactionSubmit);
    $('#account-form').addEventListener('submit', handleAccountSubmit);
    $('#budget-form').addEventListener('submit', handleBudgetSubmit);
}

// ==========================================
// Authentication Functions
// ==========================================
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    
    if (isLoginMode) {
        authTitle.textContent = 'Welcome Back';
        authSubtitle.textContent = 'Enter your details to access your wealth.';
        authSubmit.innerHTML = '<span>Sign In</span><i data-lucide="arrow-right"></i>';
        authToggleText.textContent = "Don't have an account?";
        authToggleBtn.textContent = 'Sign Up';
    } else {
        authTitle.textContent = 'Create Account';
        authSubtitle.textContent = 'Start your journey to financial freedom.';
        authSubmit.innerHTML = '<span>Sign Up</span><i data-lucide="arrow-right"></i>';
        authToggleText.textContent = 'Already have an account?';
        authToggleBtn.textContent = 'Sign In';
    }
    
    // Re-initialize icons
    lucide.createIcons();
    
    // Clear any errors
    authError.classList.add('hidden');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    // Clear previous errors
    authError.classList.add('hidden');
    
    // Disable button
    authSubmit.disabled = true;
    authSubmit.innerHTML = '<span>Please wait...</span>';
    
    try {
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
        // Auth state change will handle the rest
    } catch (error) {
        authError.textContent = error.message.replace('Firebase: ', '');
        authError.classList.remove('hidden');
    } finally {
        authSubmit.disabled = false;
        authSubmit.innerHTML = isLoginMode 
            ? '<span>Sign In</span><i data-lucide="arrow-right"></i>'
            : '<span>Sign Up</span><i data-lucide="arrow-right"></i>';
        lucide.createIcons();
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ==========================================
// Data Loading Functions
// ==========================================
function loadUserData() {
    // Cleanup any existing listeners
    cleanupListeners();
    
    // Listen to accounts
    const accountsUnsubscribe = db.collection('users').doc(currentUser.uid)
        .collection('accounts')
        .onSnapshot(snapshot => {
            accounts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderAccounts();
            updateAccountSelects();
            updateDashboard();
        }, error => {
            console.error('Error loading accounts:', error);
        });
    unsubscribeListeners.push(accountsUnsubscribe);
    
    // Listen to transactions
    const transactionsUnsubscribe = db.collection('users').doc(currentUser.uid)
        .collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderTransactions();
            updateDashboard();
            renderCalendar();
        }, error => {
            console.error('Error loading transactions:', error);
        });
    unsubscribeListeners.push(transactionsUnsubscribe);
    
    // Listen to budgets
    const budgetsUnsubscribe = db.collection('users').doc(currentUser.uid)
        .collection('budgets')
        .onSnapshot(snapshot => {
            budgets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderBudgets();
        }, error => {
            console.error('Error loading budgets:', error);
        });
    unsubscribeListeners.push(budgetsUnsubscribe);
}

function cleanupListeners() {
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = [];
}

// ==========================================
// Navigation Functions
// ==========================================
function handleNavigation(e) {
    e.preventDefault();
    
    const targetPage = e.currentTarget.dataset.page;
    
    // Update nav items
    $$('.nav-item').forEach(item => item.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Update pages
    $$('.page').forEach(page => page.classList.remove('active'));
    $(`#page-${targetPage}`).classList.add('active');
}

// ==========================================
// Modal Functions
// ==========================================
function openModal(modalId) {
    $(`#${modalId}`).classList.remove('hidden');
}

function closeModal(modalId) {
    $(`#${modalId}`).classList.add('hidden');
    
    // Reset forms
    if (modalId === 'transaction-modal') {
        $('#transaction-form').reset();
        $('#txn-date').valueAsDate = new Date();
        // Reset to expense tab
        $$('.type-tab').forEach(tab => tab.classList.remove('active'));
        $('.type-tab[data-type="expense"]').classList.add('active');
        $('#transfer-to-group').classList.add('hidden');
        $('#category-group').classList.remove('hidden');
    } else if (modalId === 'account-modal') {
        $('#account-form').reset();
    } else if (modalId === 'budget-modal') {
        $('#budget-form').reset();
    }
}

function handleTransactionTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    
    // Update tabs
    $$('.type-tab').forEach(tab => tab.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Show/hide transfer account field
    if (type === 'transfer') {
        $('#transfer-to-group').classList.remove('hidden');
        $('#category-group').classList.add('hidden');
    } else {
        $('#transfer-to-group').classList.add('hidden');
        $('#category-group').classList.remove('hidden');
    }
}

// ==========================================
// Form Submit Handlers
// ==========================================
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const activeTab = $('.type-tab.active');
    const type = activeTab.dataset.type;
    const amount = parseFloat($('#txn-amount').value);
    const accountId = $('#txn-account').value;
    const category = type === 'transfer' ? 'transfer' : $('#txn-category').value;
    const description = $('#txn-description').value;
    const date = new Date($('#txn-date').value).getTime();
    const toAccountId = type === 'transfer' ? $('#txn-to-account').value : null;
    
    if (!accountId || (type === 'transfer' && !toAccountId)) {
        alert('Please select account(s)');
        return;
    }
    
    try {
        // Add transaction
        await db.collection('users').doc(currentUser.uid)
            .collection('transactions')
            .add({
                type,
                amount,
                accountId,
                toAccountId,
                category,
                description,
                date,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Update account balance(s)
        const accountRef = db.collection('users').doc(currentUser.uid)
            .collection('accounts').doc(accountId);
        
        if (type === 'expense') {
            await accountRef.update({
                balance: firebase.firestore.FieldValue.increment(-amount)
            });
        } else if (type === 'income') {
            await accountRef.update({
                balance: firebase.firestore.FieldValue.increment(amount)
            });
        } else if (type === 'transfer') {
            await accountRef.update({
                balance: firebase.firestore.FieldValue.increment(-amount)
            });
            
            const toAccountRef = db.collection('users').doc(currentUser.uid)
                .collection('accounts').doc(toAccountId);
            await toAccountRef.update({
                balance: firebase.firestore.FieldValue.increment(amount)
            });
        }
        
        closeModal('transaction-modal');
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Failed to add transaction. Please try again.');
    }
}

async function handleAccountSubmit(e) {
    e.preventDefault();
    
    const name = $('#acc-name').value.trim();
    const type = $('#acc-type').value;
    const balance = parseFloat($('#acc-balance').value);
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('accounts')
            .add({
                name,
                type,
                balance,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        closeModal('account-modal');
    } catch (error) {
        console.error('Error adding account:', error);
        alert('Failed to add account. Please try again.');
    }
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    
    const category = $('#budget-category').value;
    const limit = parseFloat($('#budget-limit').value);
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('budgets')
            .add({
                category,
                limit,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        closeModal('budget-modal');
    } catch (error) {
        console.error('Error adding budget:', error);
        alert('Failed to add budget. Please try again.');
    }
}

// ==========================================
// Delete Functions
// ==========================================
async function deleteAccount(accountId) {
    if (!confirm('Delete this account? This cannot be undone.')) return;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('accounts').doc(accountId).delete();
    } catch (error) {
        console.error('Error deleting account:', error);
        alert('Failed to delete account.');
    }
}

async function deleteTransaction(transactionId) {
    if (!confirm('Delete this transaction?')) return;
    
    try {
        // Note: In a real app, you'd also reverse the account balance change
        await db.collection('users').doc(currentUser.uid)
            .collection('transactions').doc(transactionId).delete();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Failed to delete transaction.');
    }
}

async function deleteBudget(budgetId) {
    if (!confirm('Delete this budget?')) return;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('budgets').doc(budgetId).delete();
    } catch (error) {
        console.error('Error deleting budget:', error);
        alert('Failed to delete budget.');
    }
}

// ==========================================
// Render Functions
// ==========================================
function renderAccounts() {
    const container = $('#accounts-grid');
    
    if (accounts.length === 0) {
        container.innerHTML = '<p class="empty-state">No accounts yet. Add your first account!</p>';
        return;
    }
    
    container.innerHTML = accounts.map(account => `
        <div class="account-card">
            <div class="account-card-header">
                <div class="account-icon ${account.type}">
                    ${accountIcons[account.type] || '🏦'}
                </div>
                <button class="btn-danger" onclick="deleteAccount('${account.id}')">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <p class="account-type">${account.type}</p>
            <p class="account-name">${escapeHtml(account.name)}</p>
            <p class="account-balance">
                <span>Rs.</span> ${formatNumber(account.balance)}
            </p>
        </div>
    `).join('');
    
    lucide.createIcons();
}

function renderTransactions() {
    // Recent transactions (for dashboard)
    const recentContainer = $('#recent-transactions');
    const recentTransactions = transactions.slice(0, 5);
    
    if (recentTransactions.length === 0) {
        recentContainer.innerHTML = '<p class="empty-state">No transactions yet</p>';
    } else {
        recentContainer.innerHTML = recentTransactions.map(txn => createTransactionHTML(txn)).join('');
    }
    
    // All transactions
    const allContainer = $('#all-transactions');
    
    if (transactions.length === 0) {
        allContainer.innerHTML = '<p class="empty-state">No transactions yet</p>';
    } else {
        allContainer.innerHTML = transactions.map(txn => createTransactionHTML(txn)).join('');
    }
    
    lucide.createIcons();
}

function createTransactionHTML(txn) {
    const isExpense = txn.type === 'expense';
    const isIncome = txn.type === 'income';
    const amountClass = isExpense ? 'expense' : 'income';
    const amountPrefix = isExpense ? '-' : '+';
    const date = new Date(txn.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
    
    return `
        <div class="transaction-item">
            <div class="transaction-icon">
                ${categoryEmojis[txn.category] || '📦'}
            </div>
            <div class="transaction-info">
                <p class="transaction-category">${capitalizeFirst(txn.category)}</p>
                <p class="transaction-description">${escapeHtml(txn.description) || 'No description'}</p>
            </div>
            <div>
                <p class="transaction-amount ${amountClass}">
                    ${amountPrefix}Rs. ${formatNumber(txn.amount)}
                </p>
                <p class="transaction-date">${date}</p>
            </div>
            <button class="btn-danger" onclick="deleteTransaction('${txn.id}')">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `;
}

function renderBudgets() {
    const container = $('#budgets-list');
    
    if (budgets.length === 0) {
        container.innerHTML = '<p class="empty-state">No budgets set. Create your first budget!</p>';
        return;
    }
    
    // Get current month's expenses by category
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyExpenses = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txn.type === 'expense' && 
               txnDate.getMonth() === currentMonth && 
               txnDate.getFullYear() === currentYear;
    });
    
    const expensesByCategory = {};
    monthlyExpenses.forEach(txn => {
        if (!expensesByCategory[txn.category]) {
            expensesByCategory[txn.category] = 0;
        }
        expensesByCategory[txn.category] += txn.amount;
    });
    
    container.innerHTML = budgets.map(budget => {
        const spent = expensesByCategory[budget.category] || 0;
        const percentage = Math.min((spent / budget.limit) * 100, 100);
        let progressClass = 'safe';
        if (percentage >= 90) progressClass = 'danger';
        else if (percentage >= 70) progressClass = 'warning';
        
        return `
            <div class="budget-card">
                <div class="budget-header">
                    <div class="budget-category">
                        <div class="budget-category-icon">
                            ${categoryEmojis[budget.category] || '📦'}
                        </div>
                        <span class="budget-category-name">${capitalizeFirst(budget.category)}</span>
                    </div>
                    <div class="budget-amounts">
                        <p class="budget-spent">Rs. ${formatNumber(spent)}</p>
                        <p class="budget-limit">of Rs. ${formatNumber(budget.limit)}</p>
                    </div>
                    <button class="btn-danger" onclick="deleteBudget('${budget.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="budget-progress">
                    <div class="budget-progress-bar ${progressClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

function updateDashboard() {
    // Calculate total balance
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    $('#total-balance').textContent = formatNumber(totalBalance);
    
    // Calculate monthly income and expenses
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    
    transactions.forEach(txn => {
        const txnDate = new Date(txn.date);
        if (txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
            if (txn.type === 'income') {
                monthlyIncome += txn.amount;
            } else if (txn.type === 'expense') {
                monthlyExpense += txn.amount;
            }
        }
    });
    
    $('#monthly-income').textContent = formatNumber(monthlyIncome);
    $('#monthly-expense').textContent = formatNumber(monthlyExpense);
}

function updateAccountSelects() {
    const selectFrom = $('#txn-account');
    const selectTo = $('#txn-to-account');
    
    const options = accounts.map(acc => 
        `<option value="${acc.id}">${escapeHtml(acc.name)} (Rs. ${formatNumber(acc.balance)})</option>`
    ).join('');
    
    selectFrom.innerHTML = '<option value="">Select Account</option>' + options;
    selectTo.innerHTML = '<option value="">Select Account</option>' + options;
}

// ==========================================
// Utility Functions
// ==========================================
function formatNumber(num) {
    return num.toLocaleString('en-IN');
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// Calendar Functions
// ==========================================
function changeCalendarMonth(delta) {
    currentCalendarDate = new Date(
        currentCalendarDate.getFullYear(),
        currentCalendarDate.getMonth() + delta,
        1
    );
    renderCalendar();
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    $('#calendar-month-year').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Get transactions for this month
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();
    
    // Group transactions by day
    const transactionsByDay = {};
    transactions.forEach(txn => {
        if (txn.date >= monthStart && txn.date <= monthEnd) {
            const day = new Date(txn.date).getDate();
            if (!transactionsByDay[day]) {
                transactionsByDay[day] = { income: 0, expense: 0, transactions: [] };
            }
            if (txn.type === 'income') {
                transactionsByDay[day].income += txn.amount;
            } else if (txn.type === 'expense') {
                transactionsByDay[day].expense += txn.amount;
            }
            transactionsByDay[day].transactions.push(txn);
        }
    });
    
    // Find max values for scaling mini charts
    let maxAmount = 0;
    Object.values(transactionsByDay).forEach(day => {
        maxAmount = Math.max(maxAmount, day.income, day.expense);
    });
    if (maxAmount === 0) maxAmount = 1;
    
    // Build calendar HTML
    let html = '';
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="calendar-day other-month">
            <span class="calendar-day-number">${day}</span>
        </div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && today.getDate() === day;
        const dayData = transactionsByDay[day];
        const hasTransactions = dayData && (dayData.income > 0 || dayData.expense > 0);
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (hasTransactions) classes += ' has-transactions';
        
        // Calculate net for the day
        let netAmount = 0;
        let netClass = '';
        let miniChartHtml = '';
        
        if (dayData) {
            netAmount = dayData.income - dayData.expense;
            netClass = netAmount >= 0 ? 'positive' : 'negative';
            
            // Mini chart bars (scaled to max)
            const incomeWidth = (dayData.income / maxAmount) * 100;
            const expenseWidth = (dayData.expense / maxAmount) * 100;
            
            miniChartHtml = `
                <div class="day-mini-chart">
                    ${dayData.income > 0 ? `<div class="mini-bar income" style="width: ${incomeWidth}%"></div>` : ''}
                    ${dayData.expense > 0 ? `<div class="mini-bar expense" style="width: ${expenseWidth}%"></div>` : ''}
                </div>
                ${hasTransactions ? `<div class="day-total ${netClass}">${netAmount >= 0 ? '+' : ''}${formatNumber(netAmount)}</div>` : ''}
            `;
        }
        
        html += `
            <div class="${classes}" onclick="openDayDetail(${year}, ${month}, ${day})">
                <span class="calendar-day-number">${day}</span>
                ${miniChartHtml}
            </div>
        `;
    }
    
    // Next month days (fill remaining cells)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="calendar-day other-month">
            <span class="calendar-day-number">${day}</span>
        </div>`;
    }
    
    $('#calendar-grid').innerHTML = html;
}

function openDayDetail(year, month, day) {
    selectedDayDate = new Date(year, month, day);
    
    // Format date for title
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = selectedDayDate.toLocaleDateString('en-US', options);
    $('#day-detail-title').textContent = dateStr;
    
    // Get transactions for this day
    const dayStart = new Date(year, month, day, 0, 0, 0).getTime();
    const dayEnd = new Date(year, month, day, 23, 59, 59).getTime();
    
    const dayTransactions = transactions.filter(txn => 
        txn.date >= dayStart && txn.date <= dayEnd
    );
    
    // Calculate totals
    let dayIncome = 0;
    let dayExpense = 0;
    
    dayTransactions.forEach(txn => {
        if (txn.type === 'income') {
            dayIncome += txn.amount;
        } else if (txn.type === 'expense') {
            dayExpense += txn.amount;
        }
    });
    
    $('#day-income').textContent = formatNumber(dayIncome);
    $('#day-expense').textContent = formatNumber(dayExpense);
    
    // Render transactions
    const listContainer = $('#day-transactions-list');
    
    if (dayTransactions.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">No transactions on this day</p>';
    } else {
        listContainer.innerHTML = dayTransactions.map(txn => {
            const isIncome = txn.type === 'income';
            const typeClass = isIncome ? 'income' : 'expense';
            const prefix = isIncome ? '+' : '-';
            
            return `
                <div class="day-transaction-item">
                    <div class="day-txn-icon ${typeClass}">
                        ${categoryEmojis[txn.category] || '📦'}
                    </div>
                    <div class="day-txn-info">
                        <p class="day-txn-category">${capitalizeFirst(txn.category)}</p>
                        <p class="day-txn-desc">${escapeHtml(txn.description) || 'No description'}</p>
                    </div>
                    <div class="day-txn-amount ${typeClass}">
                        ${prefix}Rs. ${formatNumber(txn.amount)}
                    </div>
                    <button class="btn-danger" onclick="deleteTransaction('${txn.id}'); openDayDetail(${year}, ${month}, ${day});">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
        }).join('');
    }
    
    openModal('day-detail-modal');
    lucide.createIcons();
}

function openTransactionModalForDate(date) {
    // Set the date in the transaction form
    const dateStr = date.toISOString().split('T')[0];
    $('#txn-date').value = dateStr;
    openModal('transaction-modal');
}
