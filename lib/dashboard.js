// Dashboard functionality with database pagination
let currentPage = 1;
let totalPages = 1;
let itemsPerPage = 15;
let currentSearchTerm = '';
let currentGroupFilter = '';
let currentTagFilter = '';
let currentDurationFilter = '';
let editingAccountId = null;
let totalRecords = 0;
let allGroups = [];
let allTags = [];
let editingTagGroupType = '';
let editingTagGroupAccountId = null;
let justSelected = false;

async function initializeDashboard() {
    await loadFilterOptions();
    await loadAccounts();
    setupEventListeners();
}

function setupEventListeners() {
    // Action dropdown functionality
    const actionDropdownBtn = document.getElementById('action-dropdown-btn');
    const actionDropdownMenu = document.getElementById('action-dropdown-menu');
    
    actionDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = actionDropdownBtn.classList.contains('active');
        
        if (isActive) {
            closeActionDropdown();
        } else {
            actionDropdownBtn.classList.add('active');
            actionDropdownMenu.classList.add('active');
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown-container')) {
            closeActionDropdown();
        }
    });
    
    // Bulk action handlers
    document.getElementById('bulk-edit-group').addEventListener('click', () => {
        handleBulkEditGroup();
        closeActionDropdown();
    });
    
    document.getElementById('bulk-edit-tag').addEventListener('click', () => {
        handleBulkEditTag();
        closeActionDropdown();
    });
    
    document.getElementById('bulk-delete').addEventListener('click', () => {
        handleBulkDelete();
        closeActionDropdown();
    });
    
    // Search functionality with debounce
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearchTerm = e.target.value.toLowerCase();
            currentPage = 1;
            loadAccounts();
        }, 300); // 300ms debounce
    });
    
    // Items per page selector
    document.getElementById('items-per-page').addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        loadAccounts();
    });
    
    // Group filter
    const groupFilter = document.getElementById('group-filter');
    groupFilter.addEventListener('input', (e) => {
        const value = e.target.value;
        showSuggestions('group', value);
        currentGroupFilter = value;
        currentPage = 1;
        loadAccounts();
    });
    
    groupFilter.addEventListener('click', () => {
        showSuggestions('group', groupFilter.value);
    });
    
    groupFilter.addEventListener('focus', () => {
        showSuggestions('group', groupFilter.value);
    });
    
    // Tag filter
    const tagFilter = document.getElementById('tag-filter');
    tagFilter.addEventListener('input', (e) => {
        const value = e.target.value;
        showSuggestions('tag', value);
        currentTagFilter = value;
        currentPage = 1;
        loadAccounts();
    });
    
    tagFilter.addEventListener('click', () => {
        showSuggestions('tag', tagFilter.value);
    });
    
    tagFilter.addEventListener('focus', () => {
        showSuggestions('tag', tagFilter.value);
    });
    
    // Duration filter
    const durationFilter = document.getElementById('duration-filter');
    durationFilter.addEventListener('change', (e) => {
        currentDurationFilter = e.target.value;
        currentPage = 1;
        loadAccounts();
    });
    
    // Export functionality
    const exportBtn = document.getElementById('export-btn');
    
    exportBtn.addEventListener('click', () => {
        handleExport('xlsx'); // Default to Excel format
    });
    
    // Reset buttons
    document.getElementById('group-reset').addEventListener('click', () => {
        resetFilter('group');
    });
    
    document.getElementById('tag-reset').addEventListener('click', () => {
        resetFilter('tag');
    });
    
    document.getElementById('duration-reset').addEventListener('click', () => {
        resetFilter('duration');
    });
    
    // Tag/Group modal event listeners
    document.getElementById('close-tag-group-modal').addEventListener('click', closeTagGroupModal);
    document.getElementById('cancel-tag-group-btn').addEventListener('click', closeTagGroupModal);
    document.getElementById('save-tag-group-btn').addEventListener('click', saveTagGroup);
    
    // Tag/Group modal overlay click
    document.getElementById('tag-group-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('tag-group-modal')) {
            closeTagGroupModal();
        }
    });
    
    // Tag/Group input with suggestions
    const tagGroupInput = document.getElementById('tag-group-input');
    tagGroupInput.addEventListener('input', (e) => {
        if (!justSelected) {
            showTagGroupSuggestions(e.target.value);
        }
        updateTagGroupResetVisibility();
    });
    
    tagGroupInput.addEventListener('click', () => {
        if (!justSelected) {
            showTagGroupSuggestions(tagGroupInput.value);
        }
    });
    
    tagGroupInput.addEventListener('focus', () => {
        if (!justSelected) {
            showTagGroupSuggestions(tagGroupInput.value);
        }
    });
    
    // Tag/Group reset button
    document.getElementById('tag-group-reset').addEventListener('click', () => {
        resetTagGroupInput();
    });
    
    // Modal close buttons
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    
    // Modal overlay click
    document.getElementById('account-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('account-modal')) {
            closeModal();
        }
    });
    
    // Save button
    document.getElementById('save-btn').addEventListener('click', saveAccount);
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = './login/';
    });
    
    // Select all checkbox
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
        updateExportButtonState();
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-group')) {
            hideSuggestions();
        }
        if (!e.target.closest('.tag-group-input-container')) {
            hideTagGroupSuggestions();
        }
    });
}

async function loadAccounts() {
    showTableLoading();
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Build query - if duration filter is active, fetch all data for client-side filtering
        let query = supabase
            .from('Account')
            .select('*', { count: 'exact' })
            .eq('user_email', user.email)
            .order('id', { ascending: false });
        
        // Only apply pagination if no duration filter
        if (!currentDurationFilter) {
            const offset = (currentPage - 1) * itemsPerPage;
            query = query.range(offset, offset + itemsPerPage - 1);
        }
        
        // Add search filter if search term exists
        if (currentSearchTerm) {
            query = query.or(`username_shopee.ilike.%${currentSearchTerm}%,user_email.ilike.%${currentSearchTerm}%,group_name.ilike.%${currentSearchTerm}%,tag_name.ilike.%${currentSearchTerm}%`);
        }
        
        // Add group filter if selected
        if (currentGroupFilter) {
            query = query.eq('group_name', currentGroupFilter);
        }
        
        // Add tag filter if selected
        if (currentTagFilter) {
            query = query.eq('tag_name', currentTagFilter);
        }
        
        // Note: Duration filter will be applied client-side due to date format mismatch
        // Database stores dates as Indonesian string format, can't use SQL date comparison
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        let filteredData = data || [];
        
        // Apply duration filter (client-side) if active
        if (currentDurationFilter) {
            filteredData = filteredData.filter(account => {
                const days = calculateDurationDaysFromString(account.tanggal_buat);
                return matchesDurationFilter(days, currentDurationFilter);
            });
        }
        
        // Apply pagination if duration filter is active
        if (currentDurationFilter) {
            totalRecords = filteredData.length;
            totalPages = Math.ceil(totalRecords / itemsPerPage);
            
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            filteredData = filteredData.slice(startIndex, endIndex);
        } else {
            totalRecords = count || 0;
            totalPages = Math.ceil(totalRecords / itemsPerPage);
        }
        
        displayAccounts(filteredData);
        renderPagination();
        updatePaginationStats();
        setupRowCheckboxListeners();
        updateResetButtonVisibility();
        updateExportButtonState();
        
    } catch (error) {
        console.error('Error loading accounts:', error);
        showEmptyState('Error loading accounts');
    } finally {
        hideTableLoading();
    }
}

function displayAccounts(accounts) {
    const tableBody = document.getElementById('accounts-table-body');
    
    if (accounts.length === 0) {
        showEmptyState();
        return;
    }
    
    tableBody.innerHTML = accounts.map(account => `
        <tr>
            <td>
                <label class="checkbox-container">
                    <input type="checkbox" class="row-checkbox" data-account-id="${escapeHtml(account.id)}">
                    <span class="checkmark"></span>
                </label>
            </td>
            <td>${escapeHtml(account.id)}</td>
            <td>${escapeHtml(account.username_shopee) || '-'}</td>
            <td title="${escapeHtml(account.user_agent) || ''}">${truncateTextSafe(account.user_agent || '-', 30)}</td>
            <td>${escapeHtml(account.user_email) || '-'}</td>
            <td>${createBadgeWithEdit(account.group_name, 'group', account.id)}</td>
            <td>${createBadgeWithEdit(account.tag_name, 'tag', account.id)}</td>
            <td>${escapeHtml(formatDate(account.tanggal_buat))}</td>
            <td>
                <span class="duration-text" title="Created: ${escapeHtml(formatDate(account.tanggal_buat))}">
                    ${escapeHtml(calculateDuration(account.tanggal_buat))}
                </span>
            </td>
        </tr>
    `).join('');
}

function showEmptyState(message = 'No accounts found') {
    const tableBody = document.getElementById('accounts-table-body');
    tableBody.innerHTML = `
        <tr>
            <td colspan="9">
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <div class="empty-state-text">${message}</div>
                    <div class="empty-state-subtext">No accounts available to display</div>
                </div>
            </td>
        </tr>
    `;
    
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('pagination-stats').innerHTML = '';
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button class="pagination-btn pagination-prev" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            Prev
        </button>
    `;
    
    // Page numbers with smart truncation
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page and ellipsis
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="pagination-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="pagination-btn" onclick="changePage(${i})">${i}</button>`;
        }
    }
    
    // Last page and ellipsis
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button class="pagination-btn pagination-next" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            Next
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

function updatePaginationStats() {
    const paginationStats = document.getElementById('pagination-stats');
    
    if (totalRecords === 0) {
        paginationStats.innerHTML = '';
        return;
    }
    
    const startRecord = (currentPage - 1) * itemsPerPage + 1;
    const endRecord = Math.min(currentPage * itemsPerPage, totalRecords);
    
    const hasFilters = currentSearchTerm || currentGroupFilter || currentTagFilter || currentDurationFilter;
    paginationStats.innerHTML = `
        Showing ${startRecord} to ${endRecord} of ${totalRecords} entries
        ${hasFilters ? `(filtered from total records)` : ''}
    `;
}

function changePage(page) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        loadAccounts();
    }
}

function openModal(title, account) {
    document.getElementById('modal-title').textContent = title;
    const modal = document.getElementById('account-modal');
    
    // Only handle edit functionality now
    if (account) {
        editingAccountId = account.id;
        document.getElementById('username_shopee').value = account.username_shopee || '';
        document.getElementById('user_agent').value = account.user_agent || '';
        document.getElementById('user_email').value = account.user_email || '';
        document.getElementById('group_name').value = account.group_name || '';
        document.getElementById('tag_name').value = account.tag_name || '';
        document.getElementById('note').value = account.note || '';
    } else {
        // This should not happen anymore since we removed add functionality
        console.error('Modal opened without account data');
        return;
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('account-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    editingAccountId = null;
}

async function saveAccount() {
    const form = document.getElementById('account-form');
    const formData = new FormData(form);
    const saveBtn = document.getElementById('save-btn');
    
    // Only allow editing existing accounts
    if (!editingAccountId) {
        console.error('No account selected for editing');
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const accountData = {
            username_shopee: formData.get('username_shopee'),
            user_agent: formData.get('user_agent'),
            user_email: formData.get('user_email'),
            group_name: formData.get('group_name'),
            tag_name: formData.get('tag_name'),
            note: formData.get('note'),
            tanggal_buat: new Date().toISOString()
        };
        
        // Only update existing accounts
        const { error } = await supabase
            .from('Account')
            .update(accountData)
            .eq('id', editingAccountId)
            .eq('user_email', user.email);
        
        if (error) throw error;
        
        closeModal();
        await loadAccounts();
        
    } catch (error) {
        console.error('Error saving account:', error);
        showToast('Error saving account: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function editAccount(id) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('Account')
            .select('*')
            .eq('id', id)
            .eq('user_email', user.email)
            .single();
        
        if (error) throw error;
        
        if (data) {
            openModal('Edit Account', data);
        }
    } catch (error) {
        console.error('Error fetching account:', error);
        showToast('Error fetching account data', 'error');
    }
}

async function deleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account?')) {
        return;
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('Account')
            .delete()
            .eq('id', id)
            .eq('user_email', user.email);
        
        if (error) throw error;
        
        // If we're on the last page and it becomes empty, go to previous page
        if (currentPage > 1 && ((currentPage - 1) * itemsPerPage) >= totalRecords - 1) {
            currentPage--;
        }
        
        await loadAccounts();
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Error deleting account: ' + error.message, 'error');
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}


function calculateDurationDaysFromString(dateString) {
    if (!dateString) return -1;
    
    // Parse Indonesian date format like "Kamis, 17 Juli 2025"
    const months = {
        'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
        'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
    };
    
    // Remove day name and parse "17 Juli 2025"
    const parts = dateString.split(', ');
    if (parts.length !== 2) return -1;
    
    const dateParts = parts[1].split(' ');
    if (dateParts.length !== 3) return -1;
    
    const day = parseInt(dateParts[0]);
    const month = months[dateParts[1]];
    const year = parseInt(dateParts[2]);
    
    if (isNaN(day) || month === undefined || isNaN(year)) return -1;
    
    const created = new Date(year, month, day);
    const now = new Date();
    
    // Set time to start of day for accurate day calculation
    const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffInMs = nowDay - createdDay;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    return diffInDays;
}

function matchesDurationFilter(days, filterValue) {
    if (!filterValue) return true;
    
    switch (filterValue) {
        case '0':
            return days === 0;
        case '1':
            return days === 1;
        case '2-7':
            return days >= 2 && days <= 7;
        case '8-30':
            return days >= 8 && days <= 30;
        case '31-365':
            return days >= 31 && days <= 365;
        case '365+':
            return days > 365;
        default:
            return true;
    }
}


function calculateDuration(createdDate) {
    if (!createdDate) return '-';
    
    let created;
    
    // Handle different date formats
    if (typeof createdDate === 'string') {
        // If it's already in display format like "17 Jul 2025"
        if (createdDate.includes(' ')) {
            // Parse Indonesian date format
            const months = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            
            const parts = createdDate.split(' ');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = months[parts[1]];
                const year = parseInt(parts[2]);
                
                if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                    created = new Date(year, month, day);
                } else {
                    created = new Date(createdDate);
                }
            } else {
                created = new Date(createdDate);
            }
        } else {
            created = new Date(createdDate);
        }
    } else {
        created = new Date(createdDate);
    }
    
    // Check if date is valid
    if (isNaN(created.getTime())) {
        return '-';
    }
    
    const now = new Date();
    
    // Set time to start of day for accurate day calculation
    const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffInMs = nowDay - createdDay;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    // For more accurate calculation, use actual time difference for hours/minutes
    const actualDiffInMs = now - created;
    const diffInMinutes = Math.floor(actualDiffInMs / (1000 * 60));
    const diffInHours = Math.floor(actualDiffInMs / (1000 * 60 * 60));
    
    // Handle future dates (negative difference)
    if (diffInDays < 0) {
        const futureDays = Math.abs(diffInDays);
        return `-${futureDays} Day${futureDays > 1 ? 's' : ''}`;
    }
    
    // Return appropriate format - Always show days format
    if (diffInDays < 30) {
        return `${diffInDays} Day${diffInDays > 1 ? 's' : ''}`;
    } else if (diffInDays < 365) {
        const months = Math.floor(diffInDays / 30);
        return `${months} Month${months > 1 ? 's' : ''}`;
    } else {
        const years = Math.floor(diffInDays / 365);
        return `${years} Year${years > 1 ? 's' : ''}`;
    }
}

function createBadge(value, type) {
    if (!value || value === '-') {
        return `<span class="badge badge-empty">-</span>`;
    }
    
    const badgeClass = type === 'group' ? 'badge-group' : 'badge-tag';
    
    return `<span class="badge ${badgeClass}" title="${value}">
        ${truncateText(value, 10)}
    </span>`;
}

function createBadgeWithEdit(value, type, accountId) {
    if (!value || value === '-') {
        return `<div class="badge-container">
            <span class="badge badge-empty">-</span>
            <button class="badge-edit-btn" onclick="openTagGroupModal('${escapeHtml(type)}', ${accountId}, '')" title="Edit ${escapeHtml(type)}">
                <span class="edit-icon">✏️</span>
            </button>
        </div>`;
    }
    
    const badgeClass = type === 'group' ? 'badge-group' : 'badge-tag';
    const safeValue = escapeHtml(value);
    const safeType = escapeHtml(type);
    
    return `<div class="badge-container">
        <span class="badge ${badgeClass}" title="${safeValue}">
            ${truncateTextSafe(value, 10)}
        </span>
        <button class="badge-edit-btn" onclick="openTagGroupModal('${safeType}', ${accountId}, '${safeValue}')" title="Edit ${safeType}">
            <span class="edit-icon">✏️</span>
        </button>
    </div>`;
}

async function loadFilterOptions() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get unique groups - keep for modal editing only
        const { data: groups } = await supabase
            .from('Account')
            .select('group_name')
            .eq('user_email', user.email)
            .not('group_name', 'is', null)
            .not('group_name', 'eq', '')
            .order('group_name');
        
        // Get unique tags - keep for modal editing only
        const { data: tags } = await supabase
            .from('Account')
            .select('tag_name')
            .eq('user_email', user.email)
            .not('tag_name', 'is', null)
            .not('tag_name', 'eq', '')
            .order('tag_name');
        
        // Store unique values globally - only for modal editing
        allGroups = [...new Set(groups?.map(item => item.group_name) || [])];
        allTags = [...new Set(tags?.map(item => item.tag_name) || [])];
        
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

async function showSuggestions(type, searchTerm) {
    const suggestionsContainer = document.getElementById(`${type}-suggestions`);
    
    // Show loading state
    suggestionsContainer.innerHTML = '<div class="suggestion-loading">Loading...</div>';
    suggestionsContainer.style.display = 'block';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const columnName = type === 'group' ? 'group_name' : 'tag_name';
        
        // Build query
        let query = supabase
            .from('Account')
            .select(columnName)
            .eq('user_email', user.email)
            .not(columnName, 'is', null)
            .not(columnName, 'eq', '');
        
        // Add search filter if search term exists
        if (searchTerm) {
            query = query.ilike(columnName, `%${searchTerm}%`);
        }
        
        const { data, error } = await query.order(columnName);
        
        if (error) throw error;
        
        // Get unique values
        const uniqueValues = [...new Set(data?.map(item => item[columnName]) || [])];
        
        if (uniqueValues.length === 0) {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        const suggestionsHTML = uniqueValues.map(item => `
            <div class="suggestion-item" onclick="selectSuggestion('${type}', '${item}')">
                ${item}
            </div>
        `).join('');
        
        suggestionsContainer.innerHTML = suggestionsHTML;
        suggestionsContainer.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading suggestions:', error);
        suggestionsContainer.innerHTML = '<div class="suggestion-error">Error loading suggestions</div>';
        suggestionsContainer.style.display = 'block';
    }
}

function selectSuggestion(type, value) {
    const input = document.getElementById(`${type}-filter`);
    input.value = value;
    
    if (type === 'group') {
        currentGroupFilter = value;
    } else {
        currentTagFilter = value;
    }
    
    currentPage = 1;
    loadAccounts();
    hideSuggestions();
}

function hideSuggestions() {
    document.getElementById('group-suggestions').style.display = 'none';
    document.getElementById('tag-suggestions').style.display = 'none';
}

function hideTagGroupSuggestions() {
    const suggestions = document.getElementById('tag-group-suggestions');
    if (suggestions) {
        suggestions.style.display = 'none';
    }
}

function resetFilter(type) {
    if (type === 'duration') {
        const select = document.getElementById('duration-filter');
        select.value = '';
        currentDurationFilter = '';
    } else {
        const input = document.getElementById(`${type}-filter`);
        input.value = '';
        
        if (type === 'group') {
            currentGroupFilter = '';
        } else {
            currentTagFilter = '';
        }
        hideSuggestions();
    }
    
    currentPage = 1;
    loadAccounts();
}

function updateResetButtonVisibility() {
    const groupReset = document.getElementById('group-reset');
    const tagReset = document.getElementById('tag-reset');
    const durationReset = document.getElementById('duration-reset');
    
    if (groupReset) {
        groupReset.style.display = currentGroupFilter ? 'flex' : 'none';
    }
    if (tagReset) {
        tagReset.style.display = currentTagFilter ? 'flex' : 'none';
    }
    if (durationReset) {
        durationReset.style.display = currentDurationFilter ? 'flex' : 'none';
    }
}

function openTagGroupModal(type, accountId, currentValue) {
    editingTagGroupType = type;
    editingTagGroupAccountId = accountId;
    
    // Update modal title and label
    const modalTitle = document.getElementById('tag-group-modal-title');
    const inputLabel = document.getElementById('tag-group-label');
    const input = document.getElementById('tag-group-input');
    
    modalTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    inputLabel.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Name`;
    input.placeholder = `Enter ${type} name...`;
    input.value = currentValue;
    
    // Show modal
    const modal = document.getElementById('tag-group-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus on input
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
    
    // Show initial suggestions
    showTagGroupSuggestions(currentValue);
    
    // Update reset button visibility
    updateTagGroupResetVisibility();
}

async function showTagGroupSuggestions(searchTerm) {
    const suggestionsContainer = document.getElementById('tag-group-suggestions');
    
    if (!suggestionsContainer) return;
    
    // Show loading state
    suggestionsContainer.innerHTML = '<div class="suggestion-loading">Loading...</div>';
    suggestionsContainer.style.display = 'block';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const columnName = editingTagGroupType === 'group' ? 'group_name' : 'tag_name';
        
        // Build query
        let query = supabase
            .from('Account')
            .select(columnName)
            .eq('user_email', user.email)
            .not(columnName, 'is', null)
            .not(columnName, 'eq', '');
        
        // Add search filter if search term exists
        if (searchTerm) {
            query = query.ilike(columnName, `%${searchTerm}%`);
        }
        
        const { data, error } = await query.order(columnName);
        
        if (error) throw error;
        
        // Get unique values
        const uniqueValues = [...new Set(data?.map(item => item[columnName]) || [])];
        
        let suggestionsHTML = '';
        
        // Add existing suggestions
        if (uniqueValues.length > 0) {
            suggestionsHTML = uniqueValues.map(item => `
                <div class="tag-group-suggestion-item" onclick="selectTagGroupSuggestion('${item}')">
                    ${item}
                </div>
            `).join('');
        }
        
        // Add "Add New" suggestion if search term doesn't exist
        if (searchTerm && !uniqueValues.includes(searchTerm)) {
            suggestionsHTML += `
                <div class="tag-group-suggestion-item add-new" onclick="selectTagGroupSuggestion('${searchTerm}')">
                    <span class="add-icon">+</span> Add "${searchTerm}" as new ${editingTagGroupType}
                </div>
            `;
        }
        
        if (suggestionsHTML) {
            suggestionsContainer.innerHTML = suggestionsHTML;
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading suggestions:', error);
        suggestionsContainer.innerHTML = '<div class="suggestion-error">Error loading suggestions</div>';
        suggestionsContainer.style.display = 'block';
    }
}

function selectTagGroupSuggestion(value) {
    const input = document.getElementById('tag-group-input');
    
    // Set flag to prevent suggestions from showing
    justSelected = true;
    
    input.value = value;
    hideTagGroupSuggestions();
    updateTagGroupResetVisibility();
    
    // Reset flag after a short delay
    setTimeout(() => {
        justSelected = false;
    }, 100);
}

async function saveTagGroup() {
    const input = document.getElementById('tag-group-input');
    const saveBtn = document.getElementById('save-tag-group-btn');
    const newValue = input.value.trim();
    
    if (!editingTagGroupAccountId || !editingTagGroupType) return;
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const updateData = {};
        updateData[editingTagGroupType === 'group' ? 'group_name' : 'tag_name'] = newValue;
        
        // Check if bulk edit (array of IDs) or single edit
        if (Array.isArray(editingTagGroupAccountId)) {
            // Bulk update using batch operation
            const accounts = editingTagGroupAccountId;
            const progressItems = [`Batch updating ${accounts.length} accounts`];
            
            showProgressModal(`Updating ${editingTagGroupType} for ${accounts.length} accounts`, progressItems);
            
            // Update progress to show batch processing
            updateProgressItem(0, 'processing', '⏳');
            updateProgress(0, 1, `Batch updating ${accounts.length} accounts...`);
            
            // Perform batch update using Supabase's .in() method
            const { data, error } = await supabase
                .from('Account')
                .update(updateData)
                .in('id', accounts)
                .eq('user_email', user.email)
                .select('id');
            
            if (error) {
                updateProgressItem(0, 'error', '✕');
                throw error;
            }
            
            const successCount = data ? data.length : accounts.length;
            updateProgressItem(0, 'success', '✓');
            completeProgress(successCount, accounts.length);
            
            showToast(`Successfully updated ${successCount} account(s)`, 'success');
            
            // Uncheck all checkboxes after bulk edit
            document.querySelectorAll('.row-checkbox:checked').forEach(checkbox => {
                checkbox.checked = false;
            });
            document.getElementById('select-all-checkbox').checked = false;
            document.getElementById('select-all-checkbox').indeterminate = false;
        } else {
            // Single update
            const { error } = await supabase
                .from('Account')
                .update(updateData)
                .eq('id', editingTagGroupAccountId)
                .eq('user_email', user.email);
            
            if (error) throw error;
        }
        
        closeTagGroupModal();
        await loadAccounts();
        
    } catch (error) {
        console.error('Error updating:', error);
        showToast('Error updating ' + editingTagGroupType + ': ' + error.message, 'error');
        hideProgressModal();
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

function closeTagGroupModal() {
    const modal = document.getElementById('tag-group-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    // Reset form
    document.getElementById('tag-group-input').value = '';
    hideTagGroupSuggestions();
    
    // Reset editing state
    editingTagGroupType = '';
    editingTagGroupAccountId = null;
    justSelected = false;
    
    // Update reset button visibility
    updateTagGroupResetVisibility();
}

function resetTagGroupInput() {
    const input = document.getElementById('tag-group-input');
    justSelected = false;
    input.value = '';
    hideTagGroupSuggestions();
    updateTagGroupResetVisibility();
    input.focus();
}

function updateTagGroupResetVisibility() {
    const resetBtn = document.getElementById('tag-group-reset');
    const input = document.getElementById('tag-group-input');
    
    if (resetBtn && input) {
        resetBtn.style.display = input.value ? 'flex' : 'none';
    }
}

async function handleExport(format = 'xlsx') {
    try {
        // Get selected account IDs
        const selectedIds = getSelectedAccountIds();
        
        if (selectedIds.length === 0) {
            showToast('Please select accounts to export', 'info');
            return;
        }
        
        // Show progress modal for export process
        const progressSteps = [
            'Fetching account data...',
            'Processing export data...',
            `Generating ${format.toUpperCase()} file...`,
            'Preparing download...'
        ];
        
        showProgressModal(`Exporting ${selectedIds.length} accounts`, progressSteps);
        
        // Step 1: Fetching data
        updateProgressItem(0, 'processing', '⏳');
        updateProgress(0, 4, 'Fetching account data...');
        
        const allData = await getExportData();
        updateProgressItem(0, 'success', '✓');
        
        // Step 2: Processing data
        updateProgressItem(1, 'processing', '⏳');
        updateProgress(1, 4, 'Processing export data...');
        
        // Filter only selected accounts
        const exportData = allData.filter(account => 
            selectedIds.includes(account.id.toString())
        );
        
        if (exportData.length === 0) {
            hideProgressModal();
            showToast('No data to export', 'info');
            return;
        }
        
        updateProgressItem(1, 'success', '✓');
        
        // Step 3: Generating file
        updateProgressItem(2, 'processing', '⏳');
        updateProgress(2, 4, `Generating ${format.toUpperCase()} file...`);
        
        // Small delay to show the processing step
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (format === 'xlsx') {
            await exportToXLSX(exportData);
        } else {
            await exportToCSV(exportData);
        }
        
        updateProgressItem(2, 'success', '✓');
        
        // Step 4: Preparing download
        updateProgressItem(3, 'processing', '⏳');
        updateProgress(3, 4, 'Preparing download...');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 300));
        
        updateProgressItem(3, 'success', '✓');
        completeProgress(4, 4);
        
        showToast(`Successfully exported ${exportData.length} account(s) to ${format.toUpperCase()}`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Error exporting data: ' + error.message, 'error');
        hideProgressModal();
    }
}

async function getExportData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Build query for export - get all data without pagination
        let query = supabase
            .from('Account')
            .select('*')
            .eq('user_email', user.email)
            .order('id', { ascending: false });
        
        // Add search filter if search term exists
        if (currentSearchTerm) {
            query = query.or(`username_shopee.ilike.%${currentSearchTerm}%,user_email.ilike.%${currentSearchTerm}%,group_name.ilike.%${currentSearchTerm}%,tag_name.ilike.%${currentSearchTerm}%`);
        }
        
        // Add group filter if selected
        if (currentGroupFilter) {
            query = query.eq('group_name', currentGroupFilter);
        }
        
        // Add tag filter if selected
        if (currentTagFilter) {
            query = query.eq('tag_name', currentTagFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        let filteredData = data || [];
        
        // Apply duration filter (client-side) if active
        if (currentDurationFilter) {
            filteredData = filteredData.filter(account => {
                const days = calculateDurationDaysFromString(account.tanggal_buat);
                return matchesDurationFilter(days, currentDurationFilter);
            });
        }
        
        return filteredData;
    } catch (error) {
        throw error;
    }
}

async function exportToXLSX(data) {
    return new Promise((resolve) => {
        try {
            // Sanitize data function to prevent Excel corruption
            function sanitizeValue(value) {
                if (value === null || value === undefined) return '';
                let sanitized = String(value);
                // Remove or replace potentially problematic characters
                sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                // Limit length to prevent Excel issues
                return sanitized.length > 32767 ? sanitized.substring(0, 32767) : sanitized;
            }
            
            // Prepare data for XLSX based on excel-column-list.md
            const worksheetData = [
                // Headers
                [
                    'acc_id', 'ids', 'group', 'name', 'remark', 'platform', 'username', 
                    'password', 'fakey', 'cookie', 'proxytype', 'ipchecker', 'proxy', 
                    'proxyurl', 'proxyid', 'ip', 'countrycode', 'ua'
                ],
                // Data rows with sanitization
                ...data.map(account => [
                    '',                                                    // acc_id (empty)
                    '',                                                    // ids (empty)
                    sanitizeValue(account.group_name),                     // group (from group_name)
                    sanitizeValue(account.username_shopee),                // name (from username_shopee)
                    sanitizeValue(account.tag_name),                       // remark (from tag_name)
                    'shopee.co.id',                                        // platform (static)
                    sanitizeValue(account.username_shopee),                // username (from username_shopee)
                    '',                                                // password (empty for security)
                    '',                                                    // fakey (empty)
                    sanitizeValue(parseCookies(account.cookies)),           // cookie (parsed and filtered)
                    'noproxy',                                             // proxytype (static)
                    'ip2location',                                         // ipchecker (static)
                    '',                                                    // proxy (empty)
                    '',                                                    // proxyurl (empty)
                    '',                                                    // proxyid (empty)
                    '',                                                    // ip (empty)
                    'id',                                                  // countrycode (Indonesia)
                    sanitizeValue(account.user_agent)                      // ua (from user_agent)
                ])
            ];
            
            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            
            // Set column widths (simplified)
            worksheet['!cols'] = [
                { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
                { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 40 }, 
                { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, 
                { wch: 15 }, { wch: 12 }, { wch: 30 }
            ];
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts');
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `shopee_accounts_${timestamp}.xlsx`;
            
            // Download the file
            XLSX.writeFile(workbook, filename);
            
            // Resolve promise after file generation
            setTimeout(resolve, 200);
            
        } catch (error) {
            console.error('Error generating XLSX:', error);
            // Fallback to simple format if there's an error
            const simpleData = [
                ['acc_id', 'ids', 'group', 'name', 'remark', 'platform', 'username', 'password', 'cookie', 'countrycode', 'ua'],
                ...data.map(account => [
                    '', '', 
                    account.group_name || '', 
                    account.username_shopee || '',
                    account.tag_name || '',
                    'shopee.co.id',
                    account.username_shopee || '',
                    '',  // password (empty for security)
                    parseCookies(account.cookies) || '',
                    'id',
                    account.user_agent || ''
                ])
            ];
            
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(simpleData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts');
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            XLSX.writeFile(workbook, `shopee_accounts_${timestamp}.xlsx`);
            
            setTimeout(resolve, 200);
        }
    });
}

async function exportToCSV(data) {
    return new Promise((resolve) => {
        const headers = ['ID', 'Username Shopee', 'User Agent', 'Email', 'Group', 'Tag', 'Created', 'Duration'];
        const csvContent = [
            headers.join(','),
            ...data.map(account => [
                account.id,
                `"${(account.username_shopee || '').replace(/"/g, '""')}"`,
                `"${(account.user_agent || '').replace(/"/g, '""')}"`,
                `"${(account.user_email || '').replace(/"/g, '""')}"`,
                `"${(account.group_name || '').replace(/"/g, '""')}"`,
                `"${(account.tag_name || '').replace(/"/g, '""')}"`,
                `"${formatDate(account.tanggal_buat)}"`,
                `"${calculateDuration(account.tanggal_buat)}"`
            ].join(','))
        ].join('\n');
        
        downloadFile(csvContent, 'accounts.csv', 'text/csv');
        
        // Resolve promise after file generation
        setTimeout(resolve, 100);
    });
}


function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


function setupRowCheckboxListeners() {
    // Add event listeners to all row checkboxes
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateSelectAllState();
            updateExportButtonState();
        });
    });
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;
    
    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === rowCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
    
    // Update export button state
    updateExportButtonState();
}

function getSelectedAccountIds() {
    const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    return Array.from(checkedCheckboxes).map(checkbox => checkbox.dataset.accountId);
}

function updateExportButtonState() {
    const exportBtn = document.getElementById('export-btn');
    const exportCount = document.getElementById('export-count');
    const actionDropdownBtn = document.getElementById('action-dropdown-btn');
    const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    const count = checkedCheckboxes.length;
    
    if (count > 0) {
        exportBtn.disabled = false;
        actionDropdownBtn.disabled = false;
        if (exportCount) {
            exportCount.textContent = count;
            exportCount.style.display = 'inline-flex';
        }
    } else {
        exportBtn.disabled = true;
        actionDropdownBtn.disabled = true;
        if (exportCount) {
            exportCount.style.display = 'none';
        }
    }
}


// Security: HTML escaping function to prevent XSS attacks
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Security: Safe text truncation with HTML escaping
function truncateTextSafe(text, maxLength) {
    if (!text) return '-';
    const escaped = escapeHtml(text);
    if (escaped.length <= maxLength) return escaped;
    return escaped.substring(0, maxLength) + '...';
}

// Cookie parsing function (converted from Python parser-cookie.py)
function parseCookies(cookie) {
    try {
        if (!cookie) return '';
        
        let cookieData = cookie;
        
        // If it's a string, try to parse as JSON
        if (typeof cookieData === 'string') {
            try {
                cookieData = JSON.parse(cookieData);
            } catch (e) {
                // If parsing fails, return original string
                return cookie;
            }
        }
        
        // If it's already an array, return as JSON string
        if (Array.isArray(cookieData)) {
            return JSON.stringify(cookieData);
        }
        
        // If it's an object without 'cookies' property, return as is
        if (typeof cookieData === 'object' && !cookieData.hasOwnProperty('cookies')) {
            console.log("cookie is a list");
            return JSON.stringify(cookieData);
        }
        
        // If it has 'cookies' property, parse and filter Shopee cookies
        if (cookieData.cookies && Array.isArray(cookieData.cookies)) {
            const storeData = [];
            
            for (const data of cookieData.cookies) {
                // Check if domain contains 'shopee'
                if (data.domain && data.domain.includes('shopee')) {
                    const sample = {
                        name: data.name || '',
                        value: data.value || '',
                        domain: data.domain || '',
                        path: data.path || '',
                        httpOnly: String(data.httpOnly || false).toLowerCase(),
                        secure: String(data.secure || false).toLowerCase(),
                        session: String(data.session || false).toLowerCase(),
                        expires: data.expires || '',
                        sameSite: 'unspecified'
                    };
                    storeData.push(sample);
                }
            }
            
            if (storeData.length > 0) {
                return JSON.stringify(storeData);
            }
        }
        
        // Return original if no processing was possible
        return typeof cookieData === 'string' ? cookieData : JSON.stringify(cookieData);
        
    } catch (error) {
        console.error('Error parsing cookies:', error);
        // Return original cookie string if parsing fails
        return typeof cookie === 'string' ? cookie : '';
    }
}

// Toast notification functions
function showToast(message, type = 'success', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icons for different types
    const icons = {
        success: '✓',
        error: '✕',
        info: 'i'
    };
    
    // Toast HTML
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="removeToast(this.parentElement)">
            <span class="material-icons">close</span>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        removeToast(toast);
    }, duration);
}

function removeToast(toastElement) {
    if (!toastElement) return;
    
    // Add removing animation
    toastElement.classList.add('removing');
    
    // Remove after animation
    setTimeout(() => {
        toastElement.remove();
    }, 300);
}

// Progress modal functions
function showProgressModal(title, items) {
    const modal = document.getElementById('progress-modal');
    const titleElement = document.getElementById('progress-title');
    const textElement = document.getElementById('progress-text');
    const statsElement = document.getElementById('progress-stats');
    const fillElement = document.getElementById('progress-fill');
    const percentageElement = document.getElementById('progress-percentage');
    const detailsElement = document.getElementById('progress-details');
    
    titleElement.textContent = title;
    textElement.textContent = 'Preparing...';
    statsElement.textContent = `0 / ${items.length}`;
    fillElement.style.width = '0%';
    percentageElement.textContent = '0%';
    
    // Create progress items
    detailsElement.innerHTML = '';
    items.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'progress-item pending';
        itemElement.id = `progress-item-${index}`;
        itemElement.innerHTML = `
            <div class="progress-item-icon">⏳</div>
            <div class="progress-item-text">${item}</div>
        `;
        detailsElement.appendChild(itemElement);
    });
    
    modal.classList.add('active');
}

function updateProgress(currentIndex, total, currentAction = '') {
    const textElement = document.getElementById('progress-text');
    const statsElement = document.getElementById('progress-stats');
    const fillElement = document.getElementById('progress-fill');
    const percentageElement = document.getElementById('progress-percentage');
    
    const percentage = Math.round((currentIndex / total) * 100);
    
    textElement.textContent = currentAction || `Processing item ${currentIndex + 1}...`;
    statsElement.textContent = `${currentIndex} / ${total}`;
    fillElement.style.width = `${percentage}%`;
    percentageElement.textContent = `${percentage}%`;
}

function updateProgressItem(index, status, icon) {
    const itemElement = document.getElementById(`progress-item-${index}`);
    if (itemElement) {
        itemElement.className = `progress-item ${status}`;
        const iconElement = itemElement.querySelector('.progress-item-icon');
        if (iconElement) {
            iconElement.textContent = icon;
        }
    }
}

function hideProgressModal() {
    const modal = document.getElementById('progress-modal');
    modal.classList.remove('active');
}

function completeProgress(successCount, total) {
    const textElement = document.getElementById('progress-text');
    const fillElement = document.getElementById('progress-fill');
    const percentageElement = document.getElementById('progress-percentage');
    
    textElement.textContent = `Completed! ${successCount}/${total} successful`;
    fillElement.style.width = '100%';
    percentageElement.textContent = '100%';
    
    // Auto hide after 2 seconds
    setTimeout(() => {
        hideProgressModal();
    }, 2000);
}

// Make functions globally accessible
window.changePage = changePage;
window.editAccount = editAccount;
window.deleteAccount = deleteAccount;
window.getSelectedAccountIds = getSelectedAccountIds;
window.selectSuggestion = selectSuggestion;
window.openTagGroupModal = openTagGroupModal;
window.selectTagGroupSuggestion = selectTagGroupSuggestion;
window.removeToast = removeToast;

// Loading state functions
function showTableLoading() {
    const tableBody = document.getElementById('accounts-table-body');
    const loadingDiv = document.getElementById('table-loading');
    
    if (tableBody) {
        tableBody.style.display = 'none';
    }
    
    if (loadingDiv) {
        loadingDiv.classList.add('active');
    }
}

function hideTableLoading() {
    const tableBody = document.getElementById('accounts-table-body');
    const loadingDiv = document.getElementById('table-loading');
    
    if (tableBody) {
        tableBody.style.display = '';
    }
    
    if (loadingDiv) {
        loadingDiv.classList.remove('active');
    }
}

// Dropdown helper function
function closeActionDropdown() {
    const actionDropdownBtn = document.getElementById('action-dropdown-btn');
    const actionDropdownMenu = document.getElementById('action-dropdown-menu');
    
    if (actionDropdownBtn) {
        actionDropdownBtn.classList.remove('active');
    }
    if (actionDropdownMenu) {
        actionDropdownMenu.classList.remove('active');
    }
}

// Bulk action functions
async function handleBulkEditGroup() {
    const selectedIds = getSelectedAccountIds();
    if (selectedIds.length === 0) {
        showToast('Please select accounts to edit', 'info');
        return;
    }
    
    // Open tag/group modal for bulk edit
    editingTagGroupType = 'group';
    editingTagGroupAccountId = selectedIds; // Store array of IDs
    
    const modalTitle = document.getElementById('tag-group-modal-title');
    const inputLabel = document.getElementById('tag-group-label');
    const input = document.getElementById('tag-group-input');
    
    modalTitle.textContent = `Edit Group (${selectedIds.length} accounts)`;
    inputLabel.textContent = 'Group Name';
    input.placeholder = 'Enter group name...';
    input.value = '';
    
    const modal = document.getElementById('tag-group-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        input.focus();
    }, 100);
    
    showTagGroupSuggestions('');
    updateTagGroupResetVisibility();
}

async function handleBulkEditTag() {
    const selectedIds = getSelectedAccountIds();
    if (selectedIds.length === 0) {
        showToast('Please select accounts to edit', 'info');
        return;
    }
    
    // Open tag/group modal for bulk edit
    editingTagGroupType = 'tag';
    editingTagGroupAccountId = selectedIds; // Store array of IDs
    
    const modalTitle = document.getElementById('tag-group-modal-title');
    const inputLabel = document.getElementById('tag-group-label');
    const input = document.getElementById('tag-group-input');
    
    modalTitle.textContent = `Edit Tag (${selectedIds.length} accounts)`;
    inputLabel.textContent = 'Tag Name';
    input.placeholder = 'Enter tag name...';
    input.value = '';
    
    const modal = document.getElementById('tag-group-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        input.focus();
    }, 100);
    
    showTagGroupSuggestions('');
    updateTagGroupResetVisibility();
}

async function handleBulkDelete() {
    const selectedIds = getSelectedAccountIds();
    if (selectedIds.length === 0) {
        showToast('Please select accounts to delete', 'info');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} account(s)?`)) {
        return;
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Show progress modal for batch operation
        const progressItems = [`Batch deleting ${selectedIds.length} accounts`];
        showProgressModal(`Deleting ${selectedIds.length} accounts`, progressItems);
        
        // Update progress to show batch processing
        updateProgressItem(0, 'processing', '⏳');
        updateProgress(0, 1, `Batch deleting ${selectedIds.length} accounts...`);
        
        // Perform batch delete using Supabase's .in() method
        const { data, error } = await supabase
            .from('Account')
            .delete()
            .in('id', selectedIds)
            .eq('user_email', user.email)
            .select('id');
        
        if (error) {
            updateProgressItem(0, 'error', '✕');
            throw error;
        }
        
        const successCount = data ? data.length : selectedIds.length;
        updateProgressItem(0, 'success', '✓');
        completeProgress(successCount, selectedIds.length);
        
        // Uncheck all checkboxes
        document.querySelectorAll('.row-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        document.getElementById('select-all-checkbox').checked = false;
        document.getElementById('select-all-checkbox').indeterminate = false;
        
        // Reload accounts
        await loadAccounts();
        
        showToast(`Successfully deleted ${successCount} account(s)`, 'success');
        
    } catch (error) {
        console.error('Error during bulk delete:', error);
        showToast('Error deleting accounts: ' + error.message, 'error');
        hideProgressModal();
    }
}
