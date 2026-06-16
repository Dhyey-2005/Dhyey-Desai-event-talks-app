// BQ Pulse Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = [];
    let filteredNotes = [];
    let currentFilter = 'all';
    let currentSearch = '';
    let currentSort = 'newest';
    let broadcastHistory = JSON.parse(localStorage.getItem('bq_broadcast_history') || '[]');
    let activeTweetNote = null;

    // DOM Elements
    const skeletonFeed = document.getElementById('skeleton-feed');
    const notesList = document.getElementById('notes-list');
    const emptyState = document.getElementById('empty-state');
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    const btnRefresh = document.getElementById('btn-refresh');
    const refreshIconSvg = document.getElementById('refresh-icon-svg');
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const filterGroup = document.getElementById('filter-group');
    const sortSelect = document.getElementById('sort-select');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const iconSun = btnThemeToggle.querySelector('.icon-sun');
    const iconMoon = btnThemeToggle.querySelector('.icon-moon');
    
    // Stats elements
    const statTotalCount = document.getElementById('stat-total-count');
    const statFeatureCount = document.getElementById('stat-feature-count');
    const statIssueCount = document.getElementById('stat-issue-count');
    const statDeprecationCount = document.getElementById('stat-deprecation-count');
    
    // History elements
    const historyList = document.getElementById('history-list');
    const btnClearHistory = document.getElementById('btn-clear-history');

    // Modal elements
    const tweetModal = document.getElementById('tweet-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelTweet = document.getElementById('btn-cancel-tweet');
    const btnSaveLocal = document.getElementById('btn-save-local');
    const btnPostTweet = document.getElementById('btn-post-tweet');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountEl = document.getElementById('char-count');
    const charProgressCircle = document.getElementById('char-progress-circle');
    
    // Context elements in modal
    const contextBadge = document.getElementById('context-badge');
    const contextDate = document.getElementById('context-date');
    const contextText = document.getElementById('context-text');

    // Toast element
    const toastContainer = document.getElementById('toast-container');

    // Initial Progress Ring Configuration
    const ringRadius = 11;
    const ringCircumference = 2 * Math.PI * ringRadius; // ~69.115
    charProgressCircle.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    charProgressCircle.style.strokeDashoffset = ringCircumference;

    // Fetch and Load Data
    async function loadReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = forceRefresh ? '/api/notes?refresh=true' : '/api/notes';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'error') {
                throw new Error(result.message);
            }
            
            releaseNotes = result.data || [];
            filteredNotes = [...releaseNotes];
            
            // Render Stats
            updateStatsSummary(releaseNotes);
            
            // Apply current filters, search, and sort
            applyFilters();
            
            // Update status text
            const fetchDate = new Date(result.last_fetched * 1000);
            statusText.textContent = `Updated: ${fetchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            statusDot.className = 'status-dot';
            
            if (result.status === 'warning') {
                showToast(result.message, 'info');
            } else if (forceRefresh) {
                showToast('Release notes updated successfully!', 'success');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            statusText.textContent = 'Sync failed';
            statusDot.className = 'status-dot error';
            showToast(`Error: Could not retrieve release notes.`, 'error');
            
            // If we have no notes showing, show empty state
            if (releaseNotes.length === 0) {
                setLoadingState(false);
                notesList.style.display = 'none';
                emptyState.style.display = 'block';
            }
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            skeletonFeed.style.display = 'flex';
            notesList.style.display = 'none';
            emptyState.style.display = 'none';
            btnRefresh.disabled = true;
            refreshIconSvg.classList.add('spinning');
            statusDot.className = 'status-dot loading';
            statusText.textContent = 'Fetching latest updates...';
        } else {
            skeletonFeed.style.display = 'none';
            btnRefresh.disabled = false;
            refreshIconSvg.classList.remove('spinning');
        }
    }

    // Update Sidebar Stats
    function updateStatsSummary(notes) {
        statTotalCount.textContent = notes.length;
        
        const counts = { Feature: 0, Issue: 0, Deprecation: 0 };
        notes.forEach(note => {
            if (counts.hasOwnProperty(note.type)) {
                counts[note.type]++;
            }
        });
        
        statFeatureCount.textContent = counts.Feature;
        statIssueCount.textContent = counts.Issue;
        statDeprecationCount.textContent = counts.Deprecation;
    }

    // Filter, Search, and Sort Logic
    function applyFilters() {
        // 1. Category Filter
        if (currentFilter === 'all') {
            filteredNotes = [...releaseNotes];
        } else if (currentFilter === 'other') {
            const mainCategories = ['Feature', 'Issue', 'Deprecation'];
            filteredNotes = releaseNotes.filter(n => !mainCategories.includes(n.type));
        } else {
            filteredNotes = releaseNotes.filter(n => n.type === currentFilter);
        }

        // 2. Search Text Filter
        if (currentSearch.trim() !== '') {
            const query = currentSearch.toLowerCase().trim();
            filteredNotes = filteredNotes.filter(n => 
                n.type.toLowerCase().includes(query) ||
                n.date.toLowerCase().includes(query) ||
                n.content.toLowerCase().includes(query)
            );
        }

        // 3. Sorting
        filteredNotes.sort((a, b) => {
            const dateA = new Date(a.updated || a.date);
            const dateB = new Date(b.updated || b.date);
            return currentSort === 'newest' ? dateB - dateA : dateA - dateB;
        });

        // 4. Render UI
        renderNotes(filteredNotes);
    }

    // Render Release Notes List
    function renderNotes(notes) {
        notesList.innerHTML = '';
        
        if (notes.length === 0) {
            notesList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        notesList.style.display = 'flex';
        
        notes.forEach(note => {
            const card = document.createElement('article');
            const typeClass = ['Feature', 'Issue', 'Deprecation'].includes(note.type) ? note.type : 'other';
            card.className = `note-card note-card-${typeClass}`;
            card.id = `note-${note.id}`;
            
            // Format HTML content safe representation
            // Determine type tag class
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-metadata">
                        <span class="tag tag-${typeClass}">${note.type}</span>
                        <span class="card-date">${note.date}</span>
                    </div>
                    <div class="card-actions-top">
                        <button class="btn-card-action" onclick="copyCardLink('${note.link}', '${note.id}')" title="Copy link to this release note">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            <span>Link</span>
                        </button>
                    </div>
                </div>
                <div class="card-body">${note.content}</div>
                <div class="card-footer">
                    <div class="card-footer-left">
                        <button class="btn-card-action" onclick="copyCardText('${note.id}')" title="Copy text of update">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copy Text</span>
                        </button>
                    </div>
                    <button class="btn btn-card-action btn-card-tweet" onclick="openTweetModal('${note.id}')" title="Compose a tweet for this release note">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet Summary</span>
                    </button>
                </div>
            `;
            notesList.appendChild(card);
        });
    }

    // Helper functions for card events (exposed to window)
    window.copyCardText = (id) => {
        const note = releaseNotes.find(n => n.id === id);
        if (!note) return;
        
        const plainText = stripHtmlTags(note.content).trim();
        const textToCopy = `Google BigQuery [${note.type}] (${note.date}):\n${plainText}\n\nView notes: ${note.link}`;
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => showToast('Update text copied to clipboard!', 'success'))
            .catch(err => {
                console.error('Copy failed:', err);
                showToast('Failed to copy text.', 'error');
            });
    };

    window.copyCardLink = (link, id) => {
        if (!link) {
            showToast('No link available for this update.', 'info');
            return;
        }
        navigator.clipboard.writeText(link)
            .then(() => {
                showToast('Release link copied to clipboard!', 'success');
                // Highlight the card temporarily
                const card = document.getElementById(`note-${id}`);
                if (card) {
                    card.style.borderColor = 'rgba(66, 133, 244, 0.5)';
                    setTimeout(() => {
                        card.style.borderColor = '';
                    }, 1500);
                }
            })
            .catch(err => {
                console.error('Copy failed:', err);
                showToast('Failed to copy link.', 'error');
            });
    };

    // Strip HTML Tags
    function stripHtmlTags(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        // Clean anchor elements to just show their text and url in parentheses
        const links = div.querySelectorAll('a');
        links.forEach(a => {
            const href = a.getAttribute('href');
            if (href) {
                // If it's a relative URL, resolve it to google cloud docs
                const fullUrl = href.startsWith('http') ? href : `https://docs.cloud.google.com${href}`;
                a.textContent = `${a.textContent} (${fullUrl})`;
            }
        });
        return div.textContent || div.innerText || '';
    }

    // Tweet Composer Modal Management
    window.openTweetModal = (id) => {
        const note = releaseNotes.find(n => n.id === id);
        if (!note) return;
        
        activeTweetNote = note;
        
        // Prep details for context card
        const typeClass = ['Feature', 'Issue', 'Deprecation'].includes(note.type) ? note.type : 'other';
        contextBadge.className = `context-badge tag-${typeClass}`;
        contextBadge.textContent = note.type;
        contextDate.textContent = note.date;
        contextText.textContent = stripHtmlTags(note.content).trim();
        
        // Generate prefilled Tweet Text
        const prefilledText = generateTweetDraft(note);
        tweetTextarea.value = prefilledText;
        
        // Update character count
        updateCharCount();
        
        // Open Modal
        tweetModal.classList.add('open');
        tweetTextarea.focus();
        
        // Prevent scroll on body
        document.body.style.overflow = 'hidden';
    };

    function closeTweetModal() {
        tweetModal.classList.remove('open');
        activeTweetNote = null;
        document.body.style.overflow = '';
    }

    function generateTweetDraft(note) {
        // Strip HTML
        let rawContent = stripHtmlTags(note.content).trim();
        // Remove trailing lines or extra spaces
        rawContent = rawContent.replace(/\s+/g, ' ');
        
        // Max character allocation: 280
        // Templates structure:
        // 🚀 BQ [Type] ([Date]): [Snippet]... \n\nDetails: [Link] #BigQuery #GoogleCloud
        
        const prefix = `🚀 BQ ${note.type} (${note.date}): `;
        const hashtags = ` #BigQuery #GoogleCloud`;
        const linkStr = note.link ? `\n\nLink: ${note.link}` : '';
        
        // Calculate remaining space for snippet
        // Twitter treats URLs as 23 characters regardless of actual length
        const linkLengthInTweet = note.link ? 23 + 8 : 0; // 23 for URL, +8 for "\n\nLink: "
        const baseLength = prefix.length + hashtags.length + linkLengthInTweet;
        const availableSnippetLength = 280 - baseLength - 5; // -5 for ellipsis/padding
        
        let snippet = rawContent;
        if (rawContent.length > availableSnippetLength) {
            snippet = rawContent.substring(0, availableSnippetLength) + '...';
        }
        
        return `${prefix}${snippet}${linkStr}${hashtags}`;
    }

    function updateCharCount() {
        const currentLength = tweetTextarea.value.length;
        const remaining = 280 - currentLength;
        
        charCountEl.textContent = remaining;
        
        // CSS alert classes
        charCountEl.classList.remove('warning', 'danger');
        if (remaining <= 40 && remaining > 0) {
            charCountEl.classList.add('warning');
        } else if (remaining <= 0) {
            charCountEl.classList.add('danger');
        }
        
        // Disable/Enable Post Button
        if (currentLength === 0 || remaining < 0) {
            btnPostTweet.disabled = true;
            btnSaveLocal.disabled = true;
        } else {
            btnPostTweet.disabled = false;
            btnSaveLocal.disabled = false;
        }
        
        // Circular progress indicator
        const percentage = Math.min(currentLength / 280, 1);
        const offset = ringCircumference - (percentage * ringCircumference);
        charProgressCircle.style.strokeDashoffset = offset;
        
        // Color transition of progress ring
        if (remaining <= 0) {
            charProgressCircle.style.stroke = 'var(--google-red)';
        } else if (remaining <= 40) {
            charProgressCircle.style.stroke = 'var(--google-yellow)';
        } else {
            charProgressCircle.style.stroke = 'var(--twitter-blue)';
        }
    }

    // Save Tweet to Broadcast History log
    function saveToHistory(tweetText) {
        if (!activeTweetNote) return;
        
        const historyItem = {
            id: Date.now().toString(),
            noteId: activeTweetNote.id,
            type: activeTweetNote.type,
            date: activeTweetNote.date,
            tweet: tweetText,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})
        };
        
        broadcastHistory.unshift(historyItem);
        
        // Keep max 20 items
        if (broadcastHistory.length > 20) {
            broadcastHistory.pop();
        }
        
        localStorage.setItem('bq_broadcast_history', JSON.stringify(broadcastHistory));
        renderHistory();
    }

    // Render Broadcast History Timeline
    function renderHistory() {
        const emptyText = historyList.querySelector('.empty-history-text');
        
        // Remove existing items, keep empty state element
        const items = historyList.querySelectorAll('.history-item');
        items.forEach(el => el.remove());
        
        if (broadcastHistory.length === 0) {
            if (emptyText) emptyText.style.display = 'block';
            btnClearHistory.style.display = 'none';
            return;
        }
        
        if (emptyText) emptyText.style.display = 'none';
        btnClearHistory.style.display = 'block';
        
        broadcastHistory.forEach(item => {
            const el = document.createElement('div');
            const badgeType = ['Feature', 'Issue', 'Deprecation'].includes(item.type) ? item.type : 'other';
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-badge history-badge-${badgeType}">${item.type}</span>
                    <span class="history-item-time">${item.timestamp}</span>
                </div>
                <div class="history-item-tweet">${escapeHtml(item.tweet)}</div>
            `;
            
            // Allow clicking to re-open modal or re-copy
            el.addEventListener('click', () => {
                navigator.clipboard.writeText(item.tweet)
                    .then(() => showToast('Tweet text re-copied to clipboard!', 'info'))
                    .catch(() => {});
            });
            
            historyList.appendChild(el);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Toast Notifications System
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.classList.add('removing');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 4000);
    }

    // Event Listeners
    btnRefresh.addEventListener('click', () => {
        loadReleaseNotes(true);
    });

    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        if (currentSearch.trim() !== '') {
            searchClearBtn.style.display = 'block';
        } else {
            searchClearBtn.style.display = 'none';
        }
        applyFilters();
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        searchClearBtn.style.display = 'none';
        applyFilters();
        searchInput.focus();
    });

    filterGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        
        // Remove active class from all
        filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class
        btn.classList.add('active');
        
        currentFilter = btn.dataset.filter;
        applyFilters();
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        applyFilters();
    });

    btnResetFilters.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        searchClearBtn.style.display = 'none';
        currentFilter = 'all';
        filterGroup.querySelectorAll('.filter-btn').forEach(b => {
            if (b.dataset.filter === 'all') b.classList.add('active');
            else b.classList.remove('active');
        });
        currentSort = 'newest';
        sortSelect.value = 'newest';
        applyFilters();
    });

    // Modal listeners
    btnCloseModal.addEventListener('click', closeTweetModal);
    btnCancelTweet.addEventListener('click', closeTweetModal);
    tweetTextarea.addEventListener('input', updateCharCount);
    
    // Backdrop click close
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Save to history locally
    btnSaveLocal.addEventListener('click', () => {
        const text = tweetTextarea.value;
        saveToHistory(text);
        showToast('Saved to local broadcast log!', 'success');
        closeTweetModal();
    });

    // Post to Twitter/X Web Intent
    btnPostTweet.addEventListener('click', () => {
        const text = tweetTextarea.value;
        
        // Log in dashboard history
        saveToHistory(text);
        
        // Create Twitter Intent URL
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        
        // Open in new tab
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        
        showToast('Redirected to Twitter to complete post.', 'success');
        closeTweetModal();
    });

    // Clear broadcast history logs
    btnClearHistory.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your local broadcast history?')) {
            broadcastHistory = [];
            localStorage.removeItem('bq_broadcast_history');
            renderHistory();
            showToast('Broadcast history cleared.', 'info');
        }
    });

    // Theme Management (Light / Dark Mode)
    const savedTheme = localStorage.getItem('bq_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
    } else {
        document.body.classList.remove('light-mode');
        iconSun.style.display = 'block';
        iconMoon.style.display = 'none';
    }

    btnThemeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-mode');
        if (isLight) {
            localStorage.setItem('bq_theme', 'light');
            iconSun.style.display = 'none';
            iconMoon.style.display = 'block';
            showToast('Swapped to Light Theme', 'success');
        } else {
            localStorage.setItem('bq_theme', 'dark');
            iconSun.style.display = 'block';
            iconMoon.style.display = 'none';
            showToast('Swapped to Dark Theme', 'success');
        }
    });

    // Initial Loading Sequence
    renderHistory();
    loadReleaseNotes(false);
});
