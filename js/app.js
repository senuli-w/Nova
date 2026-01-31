/* ==========================================
   Nova Budget Manager - Main Application
   Complete Firebase Integration
   ========================================== */

// ==========================================
// Global State
// ==========================================
let currentUser = null;
let accounts = [];
let transactions = [];
let budgets = [];
let unsubscribeListeners = [];
let currentFilter = 'all';
let currentCalendarDate = new Date();
let selectedDate = null;
let pendingDeleteCallback = null;

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
// DOM Helpers
// ==========================================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ==========================================
// Initialize App
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupEventListeners();
    
    // Set current date display
    updateCurrentDateDisplay();
    
    // Set default date for transaction form
    const txnDateInput = $('#txn-date');
    if (txnDateInput) txnDateInput.valueAsDate = new Date();
    
    // Listen for auth state changes
    auth.onAuthStateChanged(handleAuthStateChange);
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.error('SW failed:', err));
    }
});

// ==========================================
// Auth State Handler
// ==========================================
function handleAuthStateChange(user) {
    $('#loading-screen').classList.add('hidden');
    
    if (user) {
        currentUser = user;
        updateUserDisplay();
        showMainApp();
        loadAllData();
    } else {
        currentUser = null;
        cleanupListeners();
        showAuthPage();
    }
}

function updateUserDisplay() {
    const initial = currentUser.email ? currentUser.email[0].toUpperCase() : 'U';
    const email = currentUser.email || 'user@email.com';
    const name = email.split('@')[0];
    
    $('#user-initial').textContent = initial;
    $('#menu-user-avatar').textContent = initial;
    $('#menu-user-name').textContent = capitalizeFirst(name);
    $('#menu-user-email').textContent = email;
}

function updateCurrentDateDisplay() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    $('#current-date').textContent = now.toLocaleDateString('en-US', options);
}

function showAuthPage() {
    $('#auth-page').classList.remove('hidden');
    $('#main-app').classList.add('hidden');
}

function showMainApp() {
    $('#auth-page').classList.add('hidden');
    $('#main-app').classList.remove('hidden');
    lucide.createIcons();
}

// ==========================================
// Event Listeners Setup
// ==========================================
function setupEventListeners() {
    // Menu toggle
    $('#menu-toggle').addEventListener('click', openMenu);
    $('#menu-close').addEventListener('click', closeMenu);
    $('#menu-overlay').addEventListener('click', closeMenu);
    
    // Navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigation(e.currentTarget.dataset.page);
            closeMenu();
        });
    });
    
    // See All link
    $$('[data-goto]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigation(e.currentTarget.dataset.goto);
        });
    });
    
    // Auth
    $('#auth-form').addEventListener('submit', handleAuthSubmit);
    $('#auth-toggle-btn').addEventListener('click', toggleAuthMode);
    $('#logout-btn').addEventListener('click', handleLogout);
    
    // Add buttons
    $('#quick-add-btn').addEventListener('click', () => openModal('transaction-modal'));
    $('#add-account-btn').addEventListener('click', () => openModal('account-modal'));
    $('#add-transaction-btn').addEventListener('click', () => openModal('transaction-modal'));
    $('#add-budget-btn').addEventListener('click', () => openModal('budget-modal'));
    
    // Modal close buttons
    $$('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            closeModal(modalId);
        });
    });
    
    // Modal backdrop close
    $$('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.add('hidden');
        });
    });
    
    // Transaction type tabs
    $$('.type-btn').forEach(btn => {
        btn.addEventListener('click', handleTransactionTypeChange);
    });
    
    // Filter tabs
    $$('.filter-tab').forEach(tab => {
        tab.addEventListener('click', handleFilterChange);
    });
    
    // Forms
    $('#transaction-form').addEventListener('submit', handleTransactionSubmit);
    $('#account-form').addEventListener('submit', handleAccountSubmit);
    $('#budget-form').addEventListener('submit', handleBudgetSubmit);
    
    // Calendar navigation
    $('#prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    $('#next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Day modal add transaction
    $('#add-txn-to-day').addEventListener('click', () => {
        closeModal('day-modal');
        openModal('transaction-modal');
        if (selectedDate) {
            $('#txn-date').valueAsDate = selectedDate;
        }
    });
    
    // Confirm modal
    $('#confirm-cancel').addEventListener('click', () => {
        closeModal('confirm-modal');
        pendingDeleteCallback = null;
    });
    $('#confirm-ok').addEventListener('click', () => {
        if (pendingDeleteCallback) {
            pendingDeleteCallback();
            pendingDeleteCallback = null;
        }
        closeModal('confirm-modal');
    });
}

function openMenu() {
    $('#side-menu').classList.add('open');
    $('#menu-overlay').classList.add('open');
}

function closeMenu() {
    $('#side-menu').classList.remove('open');
    $('#menu-overlay').classList.remove('open');
}

// ==========================================
// Navigation
// ==========================================
function handleNavigation(page) {
    // Update nav items
    $$('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update pages
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page-${page}`).classList.add('active');
    
    // Refresh data based on page
    if (page === 'accounts') loadAccounts();
    if (page === 'transactions') loadTransactions();
    if (page === 'budgets') loadBudgets();
    if (page === 'calendar') renderCalendar();
}

// ==========================================
// Authentication
// ==========================================
let isLoginMode = true;

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    
    $('#auth-submit-text').textContent = isLoginMode ? 'Sign In' : 'Sign Up';
    $('#auth-toggle-text').textContent = isLoginMode 
        ? "Don't have an account?" 
        : "Already have an account?";
    $('#auth-toggle-btn').textContent = isLoginMode ? 'Sign Up' : 'Sign In';
    
    $('#auth-error').classList.add('hidden');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const submitBtn = $('#auth-submit');
    const submitText = $('#auth-submit-text');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Please wait...';
    $('#auth-error').classList.add('hidden');
    
    try {
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            if (cred && cred.user) {
                await db.collection('users').doc(cred.user.uid).set({
                    email: cred.user.email || email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }
    } catch (error) {
        $('#auth-error').textContent = error.message.replace('Firebase: ', '');
        $('#auth-error').classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showToast('Signed out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ==========================================
// Data Loading - Firebase Integration
// ==========================================
function loadAllData() {
    cleanupListeners();
    
    // Real-time listener for accounts
    const accountsUnsub = db.collection('users').doc(currentUser.uid)
        .collection('accounts')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAccounts();
            updateAccountSelects();
            updateDashboard();
        }, handleFirestoreError);
    unsubscribeListeners.push(accountsUnsub);
    
    // Real-time listener for transactions
    const txnUnsub = db.collection('users').doc(currentUser.uid)
        .collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTransactions();
            renderRecentTransactions();
            updateDashboard();
            renderCalendar();
            renderBudgets(); // Update budget spent
        }, handleFirestoreError);
    unsubscribeListeners.push(txnUnsub);
    
    // Real-time listener for budgets
    const budgetUnsub = db.collection('users').doc(currentUser.uid)
        .collection('budgets')
        .onSnapshot(snapshot => {
            budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBudgets();
        }, handleFirestoreError);
    unsubscribeListeners.push(budgetUnsub);
}

// Explicit load functions for page navigation
async function loadAccounts() {
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('accounts')
            .orderBy('createdAt', 'desc')
            .get();
        accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAccounts();
        updateAccountSelects();
    } catch (error) {
        handleFirestoreError(error);
    }
}

async function loadTransactions() {
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('transactions')
            .orderBy('date', 'desc')
            .get();
        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTransactions();
    } catch (error) {
        handleFirestoreError(error);
    }
}

async function loadBudgets() {
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('budgets')
            .get();
        budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBudgets();
    } catch (error) {
        handleFirestoreError(error);
    }
}

function cleanupListeners() {
    unsubscribeListeners.forEach(unsub => unsub());
    unsubscribeListeners = [];
}

function handleFirestoreError(error) {
    console.error('Firestore error:', error);
    showToast('Error loading data', 'error');
}

// ==========================================
// Modal Functions
// ==========================================
function openModal(modalId) {
    const modal = $(`#${modalId}`);
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeModal(modalId) {
    $(`#${modalId}`).classList.add('hidden');
    
    // Reset forms
    if (modalId === 'transaction-modal') {
        $('#transaction-form').reset();
        $('#edit-transaction-id').value = '';
        $('#transaction-modal-title').textContent = 'New Transaction';
        $('#transaction-submit-text').textContent = 'Save Transaction';
        $('#txn-date').valueAsDate = new Date();
        $$('.type-btn').forEach(btn => btn.classList.remove('active'));
        $('.type-btn.expense').classList.add('active');
        $('#to-account-group').classList.add('hidden');
        $('#category-group').classList.remove('hidden');
    } else if (modalId === 'account-modal') {
        $('#account-form').reset();
        $('#edit-account-id').value = '';
        $('#account-modal-title').textContent = 'New Account';
        $('#account-submit-text').textContent = 'Add Account';
        $('input[name="acc-type"][value="bank"]').checked = true;
    } else if (modalId === 'budget-modal') {
        $('#budget-form').reset();
        $('#edit-budget-id').value = '';
        $('#budget-modal-title').textContent = 'Set Budget';
        $('#budget-submit-text').textContent = 'Set Budget';
    }
}

function showConfirmModal(title, message, callback) {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    pendingDeleteCallback = callback;
    openModal('confirm-modal');
}

function editTransaction(transactionId) {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return;
    
    // Set edit mode
    $('#edit-transaction-id').value = transactionId;
    $('#transaction-modal-title').textContent = 'Edit Transaction';
    $('#transaction-submit-text').textContent = 'Update Transaction';
    
    // Set form values
    $('#txn-amount').value = txn.amount;
    $('#txn-account').value = txn.accountId;
    if (txn.toAccountId) {
        $('#txn-to-account').value = txn.toAccountId;
    }
    $('#txn-category').value = txn.category;
    $('#txn-description').value = txn.description || '';
    $('#txn-date').valueAsDate = new Date(txn.date);
    
    // Set transaction type
    $$('.type-btn').forEach(btn => btn.classList.remove('active'));
    $(`.type-btn[data-type="${txn.type}"]`).classList.add('active');
    
    // Show/hide fields based on type
    if (txn.type === 'transfer') {
        $('#to-account-group').classList.remove('hidden');
        $('#category-group').classList.add('hidden');
        $('#txn-category').required = false;
        $('#txn-to-account').required = true;
    } else {
        $('#to-account-group').classList.add('hidden');
        $('#category-group').classList.remove('hidden');
        $('#txn-category').required = true;
        $('#txn-to-account').required = false;
    }
    
    openModal('transaction-modal');
}

function handleTransactionTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    
    $$('.type-btn').forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    if (type === 'transfer') {
        $('#to-account-group').classList.remove('hidden');
        $('#category-group').classList.add('hidden');
        $('#txn-category').required = false;
        $('#txn-to-account').required = true;
    } else {
        $('#to-account-group').classList.add('hidden');
        $('#category-group').classList.remove('hidden');
        $('#txn-category').required = true;
        $('#txn-to-account').required = false;
    }
}

function handleFilterChange(e) {
    currentFilter = e.currentTarget.dataset.filter;
    $$('.filter-tab').forEach(tab => tab.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderTransactions();
}

// ==========================================
// Form Handlers
// ==========================================
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const editId = $('#edit-transaction-id').value;
    const activeType = $('.type-btn.active').dataset.type;
    const amount = parseFloat($('#txn-amount').value);
    const accountId = $('#txn-account').value;
    const toAccountId = activeType === 'transfer' ? $('#txn-to-account').value : null;
    const category = activeType === 'transfer' ? 'transfer' : $('#txn-category').value;
    const description = $('#txn-description').value.trim();
    const date = new Date($('#txn-date').value).getTime();
    
    if (!accountId) {
        showToast('Please select an account', 'error');
        return;
    }
    
    if (activeType === 'transfer' && !toAccountId) {
        showToast('Please select destination account', 'error');
        return;
    }
    
    if (activeType === 'transfer' && accountId === toAccountId) {
        showToast('Cannot transfer to same account', 'error');
        return;
    }
    
    try {
        if (editId) {
            // UPDATE EXISTING TRANSACTION
            // First, reverse the old transaction's balance changes
            const oldTxn = transactions.find(t => t.id === editId);
            if (oldTxn) {
                const oldAccountRef = db.collection('users').doc(currentUser.uid)
                    .collection('accounts').doc(oldTxn.accountId);
                const oldAccountDoc = await oldAccountRef.get();
                
                if (oldAccountDoc.exists) {
                    if (oldTxn.type === 'expense') {
                        await oldAccountRef.update({
                            balance: firebase.firestore.FieldValue.increment(oldTxn.amount)
                        });
                    } else if (oldTxn.type === 'income') {
                        await oldAccountRef.update({
                            balance: firebase.firestore.FieldValue.increment(-oldTxn.amount)
                        });
                    } else if (oldTxn.type === 'transfer' && oldTxn.toAccountId) {
                        await oldAccountRef.update({
                            balance: firebase.firestore.FieldValue.increment(oldTxn.amount)
                        });
                        const oldToAccountRef = db.collection('users').doc(currentUser.uid)
                            .collection('accounts').doc(oldTxn.toAccountId);
                        const oldToAccountDoc = await oldToAccountRef.get();
                        if (oldToAccountDoc.exists) {
                            await oldToAccountRef.update({
                                balance: firebase.firestore.FieldValue.increment(-oldTxn.amount)
                            });
                        }
                    }
                }
            }
            
            // Update transaction
            await db.collection('users').doc(currentUser.uid)
                .collection('transactions').doc(editId)
                .update({
                    type: activeType,
                    amount,
                    accountId,
                    toAccountId,
                    category,
                    description,
                    date
                });
            
            // Apply new balance changes
            const accountRef = db.collection('users').doc(currentUser.uid)
                .collection('accounts').doc(accountId);
            
            if (activeType === 'expense') {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(-amount)
                });
            } else if (activeType === 'income') {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(amount)
                });
            } else if (activeType === 'transfer') {
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
            showToast('Transaction updated!', 'success');
        } else {
            // ADD NEW TRANSACTION
            await db.collection('users').doc(currentUser.uid)
                .collection('transactions')
                .add({
                    type: activeType,
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
            
            if (activeType === 'expense') {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(-amount)
                });
            } else if (activeType === 'income') {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(amount)
                });
            } else if (activeType === 'transfer') {
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
            showToast('Transaction added!', 'success');
        }
    } catch (error) {
        console.error('Error saving transaction:', error);
        showToast('Failed to save transaction', 'error');
    }
}

async function handleAccountSubmit(e) {
    e.preventDefault();
    
    const editId = $('#edit-account-id').value;
    const name = $('#acc-name').value.trim();
    const type = $('input[name="acc-type"]:checked').value;
    const balance = parseFloat($('#acc-balance').value);
    
    try {
        if (editId) {
            // Update existing account
            await db.collection('users').doc(currentUser.uid)
                .collection('accounts').doc(editId)
                .update({ name, type, balance });
            showToast('Account updated!', 'success');
        } else {
            // Add new account
            await db.collection('users').doc(currentUser.uid)
                .collection('accounts')
                .add({
                    name,
                    type,
                    balance,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            showToast('Account added!', 'success');
        }
        
        closeModal('account-modal');
    } catch (error) {
        console.error('Error saving account:', error);
        showToast('Failed to save account', 'error');
    }
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    
    const editId = $('#edit-budget-id').value;
    const category = $('#budget-category').value;
    const limit = parseFloat($('#budget-limit').value);
    
    try {
        if (editId) {
            await db.collection('users').doc(currentUser.uid)
                .collection('budgets').doc(editId)
                .update({ category, limit });
            showToast('Budget updated!', 'success');
        } else {
            await db.collection('users').doc(currentUser.uid)
                .collection('budgets')
                .add({
                    category,
                    limit,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            showToast('Budget set!', 'success');
        }
        
        closeModal('budget-modal');
    } catch (error) {
        console.error('Error saving budget:', error);
        showToast('Failed to save budget', 'error');
    }
}

// ==========================================
// Delete Functions with Balance Reversal
// ==========================================
function confirmDeleteAccount(accountId, accountName) {
    showConfirmModal(
        'Delete Account?',
        `Are you sure you want to delete "${accountName}"? This cannot be undone.`,
        () => deleteAccount(accountId)
    );
}

async function deleteAccount(accountId) {
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('accounts').doc(accountId).delete();
        showToast('Account deleted', 'success');
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Failed to delete account', 'error');
    }
}

function confirmDeleteTransaction(transactionId) {
    showConfirmModal(
        'Delete Transaction?',
        'This will reverse the balance changes. Are you sure?',
        () => deleteTransaction(transactionId)
    );
}

async function deleteTransaction(transactionId) {
    try {
        // Get transaction to reverse balance
        const txnDoc = await db.collection('users').doc(currentUser.uid)
            .collection('transactions').doc(transactionId).get();
        
        if (!txnDoc.exists) {
            showToast('Transaction not found', 'error');
            return;
        }
        
        const txn = txnDoc.data();
        const accountRef = db.collection('users').doc(currentUser.uid)
            .collection('accounts').doc(txn.accountId);
        
        // Check if account still exists
        const accountDoc = await accountRef.get();
        
        if (accountDoc.exists) {
            // Reverse the balance change
            if (txn.type === 'expense') {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(txn.amount)
                });
            } else if (txn.type === 'income') {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(-txn.amount)
                });
            } else if (txn.type === 'transfer' && txn.toAccountId) {
                await accountRef.update({
                    balance: firebase.firestore.FieldValue.increment(txn.amount)
                });
                
                const toAccountRef = db.collection('users').doc(currentUser.uid)
                    .collection('accounts').doc(txn.toAccountId);
                const toAccountDoc = await toAccountRef.get();
                
                if (toAccountDoc.exists) {
                    await toAccountRef.update({
                        balance: firebase.firestore.FieldValue.increment(-txn.amount)
                    });
                }
            }
        }
        
        // Delete the transaction
        await db.collection('users').doc(currentUser.uid)
            .collection('transactions').doc(transactionId).delete();
        
        showToast('Transaction deleted', 'success');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Failed to delete transaction', 'error');
    }
}

function confirmDeleteBudget(budgetId) {
    showConfirmModal(
        'Delete Budget?',
        'Are you sure you want to remove this budget?',
        () => deleteBudget(budgetId)
    );
}

async function deleteBudget(budgetId) {
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('budgets').doc(budgetId).delete();
        showToast('Budget deleted', 'success');
    } catch (error) {
        console.error('Error deleting budget:', error);
        showToast('Failed to delete budget', 'error');
    }
}

// ==========================================
// Render Functions
// ==========================================
function renderAccounts() {
    const container = $('#accounts-list');
    const totalEl = $('#accounts-total');
    
    if (accounts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="credit-card"></i>
                </div>
                <p>No accounts yet. Add your first account!</p>
            </div>
        `;
        totalEl.textContent = '0';
        lucide.createIcons();
        return;
    }
    
    const total = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    totalEl.textContent = formatNumber(total);
    
    container.innerHTML = accounts.map(account => `
        <div class="account-card">
            <div class="account-icon">${accountIcons[account.type] || '🏦'}</div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(account.name)}</div>
                <div class="account-type">${capitalizeFirst(account.type)}</div>
            </div>
            <div class="account-balance">Rs. ${formatNumber(account.balance || 0)}</div>
            <div class="account-actions">
                <button class="btn-action delete" onclick="confirmDeleteAccount('${account.id}', '${escapeHtml(account.name)}')">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
}

function renderRecentTransactions() {
    const container = $('#recent-transactions');
    const recent = transactions.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="receipt"></i>
                </div>
                <p>No transactions yet</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = recent.map(txn => createTransactionHTML(txn)).join('');
    lucide.createIcons();
}

function renderTransactions() {
    const container = $('#all-transactions');
    
    let filtered = transactions;
    if (currentFilter !== 'all') {
        filtered = transactions.filter(txn => txn.type === currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="receipt"></i>
                </div>
                <p>No ${currentFilter === 'all' ? '' : currentFilter} transactions</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = filtered.map(txn => createTransactionHTML(txn, true)).join('');
    lucide.createIcons();
}

function createTransactionHTML(txn, showActions = false) {
    const isExpense = txn.type === 'expense';
    const isTransfer = txn.type === 'transfer';
    const amountClass = isExpense ? 'expense' : isTransfer ? 'transfer' : 'income';
    const amountPrefix = isExpense ? '-' : isTransfer ? '' : '+';
    
    const date = new Date(txn.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
    
    // Get account name
    const account = accounts.find(a => a.id === txn.accountId);
    const accountName = account ? account.name : 'Unknown';
    const description = txn.description || accountName;
    
    return `
        <div class="transaction-item">
            <div class="txn-icon">${categoryEmojis[txn.category] || '📦'}</div>
            <div class="txn-details">
                <div class="txn-category">${capitalizeFirst(txn.category)}</div>
                <div class="txn-desc">${escapeHtml(description)}</div>
            </div>
            <div class="txn-right">
                <div class="txn-amount ${amountClass}">${amountPrefix}Rs. ${formatNumber(txn.amount)}</div>
                <div class="txn-date">${date}</div>
            </div>
            ${showActions ? `
                <button class="txn-action" onclick="editTransaction('${txn.id}')" title="Edit">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="txn-delete" onclick="confirmDeleteTransaction('${txn.id}')" title="Delete">
                    <i data-lucide="trash-2"></i>
                </button>
            ` : ''}
        </div>
    `;
}

function renderBudgets() {
    const container = $('#budgets-list');
    const totalBudgetEl = $('#total-budget');
    const totalSpentEl = $('#total-spent');
    
    if (budgets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="pie-chart"></i>
                </div>
                <p>No budgets set. Create your first budget!</p>
            </div>
        `;
        totalBudgetEl.textContent = 'Rs. 0';
        totalSpentEl.textContent = 'Rs. 0';
        lucide.createIcons();
        return;
    }
    
    // Calculate current month's expenses by category
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyExpenses = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txn.type === 'expense' &&
               txnDate.getMonth() === currentMonth &&
               txnDate.getFullYear() === currentYear;
    });
    
    const expensesByCategory = {};
    monthlyExpenses.forEach(txn => {
        expensesByCategory[txn.category] = (expensesByCategory[txn.category] || 0) + txn.amount;
    });
    
    let totalBudget = 0;
    let totalSpent = 0;
    
    budgets.forEach(budget => {
        totalBudget += budget.limit;
        totalSpent += expensesByCategory[budget.category] || 0;
    });
    
    totalBudgetEl.textContent = `Rs. ${formatNumber(totalBudget)}`;
    totalSpentEl.textContent = `Rs. ${formatNumber(totalSpent)}`;
    
    container.innerHTML = budgets.map(budget => {
        const spent = expensesByCategory[budget.category] || 0;
        const percentage = Math.min((spent / budget.limit) * 100, 100);
        let progressClass = '';
        if (percentage >= 90) progressClass = 'danger';
        else if (percentage >= 70) progressClass = 'warning';
        
        return `
            <div class="budget-card">
                <div class="budget-header">
                    <div class="budget-icon">${categoryEmojis[budget.category] || '📦'}</div>
                    <div class="budget-info">
                        <div class="budget-category">${capitalizeFirst(budget.category)}</div>
                        <div class="budget-amounts">
                            <span class="spent">Rs. ${formatNumber(spent)}</span> / Rs. ${formatNumber(budget.limit)}
                        </div>
                    </div>
                    <button class="budget-delete" onclick="confirmDeleteBudget('${budget.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="budget-bar">
                    <div class="budget-progress ${progressClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

function updateDashboard() {
    // Total balance (net worth)
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    $('#total-balance').textContent = formatNumber(totalBalance);
    
    // Monthly income and expenses
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
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
        `<option value="${acc.id}">${escapeHtml(acc.name)} (Rs. ${formatNumber(acc.balance || 0)})</option>`
    ).join('');
    
    selectFrom.innerHTML = '<option value="">Select account</option>' + options;
    selectTo.innerHTML = '<option value="">Select account</option>' + options;
}

// ==========================================
// Calendar Functions
// ==========================================
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    $('#calendar-month-year').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();
    
    const grid = $('#calendar-grid');
    grid.innerHTML = '';
    
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }
    
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = createCalendarDay(year, month, day, isCurrentMonth && day === todayDate);
        grid.appendChild(dayCell);
    }
    
    lucide.createIcons();
}

function createCalendarDay(year, month, day, isToday) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    if (isToday) dayCell.classList.add('today');
    
    // Get transactions for this day
    const dayTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate.getFullYear() === year &&
               txnDate.getMonth() === month &&
               txnDate.getDate() === day;
    });
    
    if (dayTransactions.length > 0) {
        dayCell.classList.add('has-transactions');
    }
    
    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayCell.appendChild(dayNumber);
    
    // Indicators
    if (dayTransactions.length > 0) {
        let income = 0;
        let expense = 0;
        
        dayTransactions.forEach(txn => {
            if (txn.type === 'income') income += txn.amount;
            else if (txn.type === 'expense') expense += txn.amount;
        });
        
        const indicator = document.createElement('div');
        indicator.className = 'day-indicator';
        
        if (income > 0) {
            const dot = document.createElement('span');
            dot.className = 'day-dot income';
            indicator.appendChild(dot);
        }
        if (expense > 0) {
            const dot = document.createElement('span');
            dot.className = 'day-dot expense';
            indicator.appendChild(dot);
        }
        
        dayCell.appendChild(indicator);
        
        // Total
        const total = income - expense;
        if (total !== 0) {
            const totalDiv = document.createElement('div');
            totalDiv.className = `day-total ${total > 0 ? 'positive' : 'negative'}`;
            totalDiv.textContent = `${total > 0 ? '+' : '-'}${formatCompact(Math.abs(total))}`;
            dayCell.appendChild(totalDiv);
        }
    }
    
    // Click handler
    dayCell.addEventListener('click', () => {
        openDayModal(year, month, day, dayTransactions);
    });
    
    return dayCell;
}

function openDayModal(year, month, day, dayTransactions) {
    selectedDate = new Date(year, month, day);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dateStr = `${monthNames[month]} ${day}, ${year}`;
    
    let income = 0;
    let expense = 0;
    dayTransactions.forEach(txn => {
        if (txn.type === 'income') income += txn.amount;
        else if (txn.type === 'expense') expense += txn.amount;
    });
    
    const total = income - expense;
    const summary = dayTransactions.length > 0 
        ? `${dayTransactions.length} transaction${dayTransactions.length !== 1 ? 's' : ''} · ${total >= 0 ? '+' : '-'}Rs. ${formatNumber(Math.abs(total))}`
        : 'No transactions';
    
    $('#day-modal-date').textContent = dateStr;
    $('#day-modal-summary').textContent = summary;
    
    const container = $('#day-transactions');
    
    if (dayTransactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No transactions for this day</p>
            </div>
        `;
    } else {
        container.innerHTML = dayTransactions.map(txn => createTransactionHTML(txn, true)).join('');
    }
    
    openModal('day-modal');
    lucide.createIcons();
}

// ==========================================
// Utility Functions
// ==========================================
function formatNumber(num) {
    return (num || 0).toLocaleString('en-IN');
}

function formatCompact(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = $('#toast');
    const msgEl = $('#toast-message');
    const iconEl = $('#toast-icon');
    
    msgEl.textContent = message;
    toast.className = `toast ${type}`;
    
    // Update icon based on type
    if (type === 'success') {
        iconEl.setAttribute('data-lucide', 'check-circle');
    } else if (type === 'error') {
        iconEl.setAttribute('data-lucide', 'x-circle');
    }
    
    lucide.createIcons();
    
    // Show
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make functions available globally
window.confirmDeleteAccount = confirmDeleteAccount;
window.confirmDeleteTransaction = confirmDeleteTransaction;
window.confirmDeleteBudget = confirmDeleteBudget;
window.editTransaction = editTransaction;
