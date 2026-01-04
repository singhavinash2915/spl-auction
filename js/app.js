// ========================================
// SPL 5.0 Auction - Megapolis Sangria Society
// Created by Avinash Singh
// ========================================

// Admin Password (in production, this should be server-side)
const ADMIN_PASSWORD = 'spl2025';

// Global Variables
let players = [];
let teams = [];
let filteredPlayers = [];
let currentFilter = 'all';
let searchQuery = '';
let currentPlayer = null;
let currentBid = 0;
let editingTeam = null;
let isAdminMode = false;
let pickedPlayersInSession = []; // Track players already picked in random session

// Local Storage Keys
const STORAGE_KEYS = {
    PLAYERS: 'spl_players',
    TEAMS: 'spl_teams',
    ADMIN_MODE: 'spl_admin_mode',
    THEME: 'spl_theme',
    DELETED_PLAYERS: 'spl_deleted_players' // Track deleted player IDs
};

// ========================================
// Initialize Application
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    // Check if admin mode was previously enabled
    isAdminMode = localStorage.getItem(STORAGE_KEYS.ADMIN_MODE) === 'true';
    loadData();
    initEventListeners();
    updateAdminUI();
});

// ========================================
// Theme Functions
// ========================================
function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Default to dark theme
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
}

// Make theme function globally available
window.toggleTheme = toggleTheme;

// ========================================
// Load Data
// ========================================
async function loadData() {
    // Try Supabase first if available
    if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
        console.log('Loading data from Supabase...');
        try {
            const [supabasePlayers, supabaseTeams] = await Promise.all([
                loadPlayersFromSupabase(),
                loadTeamsFromSupabase()
            ]);

            // Get deleted player IDs to filter them out
            const deletedPlayerIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_PLAYERS) || '[]');

            if (supabasePlayers && supabasePlayers.length > 0) {
                // Filter out deleted players
                players = supabasePlayers.filter(p => !deletedPlayerIds.includes(p.id));
                console.log('Loaded players from Supabase:', supabasePlayers.length, '-> filtered to:', players.length);
            }

            if (supabaseTeams && supabaseTeams.length > 0) {
                // Parse players JSON string back to array
                teams = supabaseTeams.map(team => ({
                    ...team,
                    players: typeof team.players === 'string' ? JSON.parse(team.players) : team.players
                }));
                console.log('Loaded teams from Supabase:', teams.length);
            }

            if (players.length > 0 && teams.length > 0) {
                saveToLocalStorage(); // Keep localStorage in sync
                initializeApp();
                setupRealtimeSubscriptions();
                updateSyncStatus('synced'); // Show Live Sync status
                return;
            }
        } catch (error) {
            console.error('Error loading from Supabase, falling back to localStorage:', error);
        }
    }

    // Fallback: Try to load from localStorage
    const savedPlayers = localStorage.getItem(STORAGE_KEYS.PLAYERS);
    const savedTeams = localStorage.getItem(STORAGE_KEYS.TEAMS);

    if (savedPlayers && savedTeams) {
        players = JSON.parse(savedPlayers);
        teams = JSON.parse(savedTeams);
        initializeApp();
    } else {
        // Load from JSON files
        try {
            const [playersRes, teamsRes] = await Promise.all([
                fetch('data/players.json'),
                fetch('data/teams.json')
            ]);
            players = await playersRes.json();
            teams = await teamsRes.json();
            saveToLocalStorage();
            initializeApp();

            // If Supabase is available, sync initial data
            if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
                await syncToSupabase();
                setupRealtimeSubscriptions();
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
}

function initializeApp() {
    filteredPlayers = [...players];
    renderPlayers();
    renderTeams();
    renderAuctionPlayers();
    renderTeamsBudgetGrid();
    populateTeamSelect();
    updateStats();
    updateAdminUI();
    updateSyncStatus();
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
}

// ========================================
// Supabase Sync Functions
// ========================================
async function syncToSupabase() {
    if (typeof isSupabaseAvailable !== 'function' || !isSupabaseAvailable()) return;

    console.log('Syncing data to Supabase...');
    try {
        await Promise.all([
            saveAllPlayersToSupabase(players),
            saveAllTeamsToSupabase(teams)
        ]);
        console.log('Data synced to Supabase successfully');
        updateSyncStatus('synced');
    } catch (error) {
        console.error('Error syncing to Supabase:', error);
        updateSyncStatus('error');
    }
}

// Save data to both localStorage and Supabase
async function saveData() {
    // Always save to localStorage (fallback)
    saveToLocalStorage();

    // Also save to Supabase if available
    if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
        await syncToSupabase();
    }
}

// Setup real-time subscriptions for live updates
function setupRealtimeSubscriptions() {
    if (typeof isSupabaseAvailable !== 'function' || !isSupabaseAvailable()) return;

    console.log('Setting up real-time subscriptions...');

    // Subscribe to player changes
    subscribeToPlayers((payload) => {
        handlePlayerChange(payload);
    });

    // Subscribe to team changes
    subscribeToTeams((payload) => {
        handleTeamChange(payload);
    });
}

// Handle real-time player changes from other users
function handlePlayerChange(payload) {
    console.log('Real-time player update:', payload);

    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const updatedPlayer = payload.new;
        const index = players.findIndex(p => p.id === updatedPlayer.id);

        if (index !== -1) {
            players[index] = updatedPlayer;
        } else {
            players.push(updatedPlayer);
        }
    } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        players = players.filter(p => p.id !== deletedId);
    }

    // Update localStorage and refresh UI
    saveToLocalStorage();
    filteredPlayers = [...players];
    renderPlayers();
    renderAuctionPlayers();
    updateStats();

    // Update current player display if affected
    if (currentPlayer && payload.new && currentPlayer.id === payload.new.id) {
        currentPlayer = payload.new;
        selectPlayerForAuction(currentPlayer);
    }
}

// Handle real-time team changes from other users
function handleTeamChange(payload) {
    console.log('Real-time team update:', payload);

    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const updatedTeam = {
            ...payload.new,
            players: typeof payload.new.players === 'string'
                ? JSON.parse(payload.new.players)
                : payload.new.players
        };
        const index = teams.findIndex(t => t.id === updatedTeam.id);

        if (index !== -1) {
            teams[index] = updatedTeam;
        } else {
            teams.push(updatedTeam);
        }
    } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        teams = teams.filter(t => t.id !== deletedId);
    }

    // Update localStorage and refresh UI
    saveToLocalStorage();
    renderTeams();
    renderTeamsBudgetGrid();
    populateTeamSelect();
}

// Update sync status indicator in UI
function updateSyncStatus(status) {
    const indicator = document.getElementById('syncStatus');
    if (!indicator) return;

    if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
        indicator.style.display = 'inline-flex';
        if (status === 'synced') {
            indicator.innerHTML = '<span class="sync-dot synced"></span> Live Sync';
            indicator.title = 'Real-time sync enabled - all users see the same data';
        } else if (status === 'error') {
            indicator.innerHTML = '<span class="sync-dot error"></span> Sync Error';
            indicator.title = 'Sync error - using local data';
        } else {
            indicator.innerHTML = '<span class="sync-dot syncing"></span> Syncing...';
            indicator.title = 'Syncing data...';
        }
    } else {
        indicator.innerHTML = '<span class="sync-dot offline"></span> Local Only';
        indicator.title = 'Data stored locally - configure Supabase for real-time sync';
    }
}

// ========================================
// Admin Mode Functions
// ========================================
function updateAdminUI() {
    const adminControls = document.querySelectorAll('.admin-only');
    const adminStatus = document.getElementById('adminStatus');
    const adminLoginBtn = document.getElementById('adminLoginBtn');

    if (isAdminMode) {
        adminControls.forEach(el => {
            // Use inline-flex for buttons, block for other elements
            if (el.tagName === 'BUTTON') {
                el.style.display = 'inline-flex';
            } else {
                el.style.display = 'block';
            }
        });
        if (adminStatus) adminStatus.textContent = 'Admin Mode Active';
        if (adminLoginBtn) adminLoginBtn.textContent = 'Logout Admin';
        document.body.classList.add('admin-mode');
    } else {
        adminControls.forEach(el => el.style.display = 'none');
        if (adminStatus) adminStatus.textContent = 'View Only Mode';
        if (adminLoginBtn) adminLoginBtn.textContent = 'Admin Login';
        document.body.classList.remove('admin-mode');
    }
}

function showAdminLoginModal() {
    if (isAdminMode) {
        // Logout
        isAdminMode = false;
        localStorage.setItem(STORAGE_KEYS.ADMIN_MODE, 'false');
        updateAdminUI();
        alert('Logged out of Admin Mode');
    } else {
        document.getElementById('adminLoginModal').classList.add('active');
        document.getElementById('adminLoginPassword').value = '';
        document.getElementById('adminLoginPassword').focus();
    }
}

function closeAdminLoginModal() {
    document.getElementById('adminLoginModal').classList.remove('active');
}

function verifyAdminLogin() {
    const password = document.getElementById('adminLoginPassword').value;
    if (password === ADMIN_PASSWORD) {
        isAdminMode = true;
        localStorage.setItem(STORAGE_KEYS.ADMIN_MODE, 'true');
        closeAdminLoginModal();
        updateAdminUI();
        alert('Admin Mode Activated! You can now control the auction.');
    } else {
        alert('Incorrect password! Access denied.');
    }
}

// Make functions globally available
window.showAdminLoginModal = showAdminLoginModal;
window.closeAdminLoginModal = closeAdminLoginModal;
window.verifyAdminLogin = verifyAdminLogin;

// ========================================
// Event Listeners
// ========================================
function initEventListeners() {
    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            filterAndRenderPlayers();
        });
    }

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filterAndRenderPlayers();
        });
    });

    // Auction Controls
    const startBtn = document.getElementById('startAuctionBtn');
    const randomBtn = document.getElementById('randomPickBtn');
    const adminResetBtn = document.getElementById('adminResetBtn');
    const adminLoginBtn = document.getElementById('adminLoginBtn');

    if (startBtn) startBtn.addEventListener('click', startAuction);
    if (randomBtn) randomBtn.addEventListener('click', randomPickPlayer);
    if (adminResetBtn) adminResetBtn.addEventListener('click', showAdminModal);
    if (adminLoginBtn) adminLoginBtn.addEventListener('click', showAdminLoginModal);

    // Add Player Button
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    if (addPlayerBtn) addPlayerBtn.addEventListener('click', showAddPlayerModal);

    // Add Team Button
    const addTeamBtn = document.getElementById('addTeamBtn');
    if (addTeamBtn) addTeamBtn.addEventListener('click', showAddTeamModal);

    // Bid Button - 10000
    const bid10000 = document.getElementById('bid10000');
    const resetBid = document.getElementById('resetBidBtn');
    const customBidBtn = document.getElementById('customBidBtn');

    if (bid10000) bid10000.addEventListener('click', () => addBid(10000));
    if (resetBid) resetBid.addEventListener('click', resetToBasePrice);
    if (customBidBtn) customBidBtn.addEventListener('click', applyCustomBid);

    // Sold/Unsold Buttons
    const soldBtn = document.getElementById('soldBtn');
    const unsoldBtn = document.getElementById('unsoldBtn');

    if (soldBtn) soldBtn.addEventListener('click', markAsSold);
    if (unsoldBtn) unsoldBtn.addEventListener('click', markAsUnsold);

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeAdminModal();
            closeTeamEditModal();
            closeAdminLoginModal();
            closeAddPlayerModal();
            closeEditCricHeroesModal();
        }
    });

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile menu after clicking
                const nav = document.querySelector('.nav');
                const mobileBtn = document.querySelector('.mobile-menu-btn');
                if (nav) nav.classList.remove('active');
                if (mobileBtn) mobileBtn.classList.remove('active');
            }
        });
    });

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav');
    if (mobileMenuBtn && nav) {
        mobileMenuBtn.addEventListener('click', () => {
            nav.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        const nav = document.querySelector('.nav');
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        if (nav && nav.classList.contains('active')) {
            if (!nav.contains(e.target) && !mobileBtn.contains(e.target)) {
                nav.classList.remove('active');
                mobileBtn.classList.remove('active');
            }
        }
    });

    // Handle touch events for better mobile experience
    document.addEventListener('touchstart', () => {}, { passive: true });
}

// ========================================
// Admin Reset Functions
// ========================================
function showAdminModal() {
    if (!isAdminMode) {
        alert('Please login as Admin first!');
        return;
    }
    document.getElementById('adminModal').classList.add('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
}

function verifyAdminPassword() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        closeAdminModal();
        resetAuction();
    } else {
        alert('Incorrect password! Access denied.');
    }
}

// Make functions globally available
window.closeAdminModal = closeAdminModal;
window.verifyAdminPassword = verifyAdminPassword;

// ========================================
// Auction Functions
// ========================================
function startAuction() {
    if (!isAdminMode) {
        alert('Only Admin can start the auction!');
        return;
    }
    document.getElementById('auctionArena').style.display = 'block';
    document.getElementById('startAuctionBtn').innerHTML = '<span class="btn-icon">▶</span> Auction Started';
    document.getElementById('startAuctionBtn').disabled = true;

    // Select first available player
    const availablePlayer = players.find(p => p.status === 'available');
    if (availablePlayer) {
        selectPlayerForAuction(availablePlayer);
    }
}

function randomPickPlayer() {
    if (!isAdminMode) {
        alert('Only Admin can pick players!');
        return;
    }

    // Get available or unsold players that haven't been picked in this session
    const availablePlayers = players.filter(p =>
        (p.status === 'available' || p.status === 'unsold') && !pickedPlayersInSession.includes(p.id)
    );

    if (availablePlayers.length === 0) {
        // Reset session if all have been picked
        pickedPlayersInSession = [];
        const allAvailable = players.filter(p => p.status === 'available' || p.status === 'unsold');
        if (allAvailable.length === 0) {
            alert('No available players left!');
            return;
        }
        alert('All players have been picked once. Starting new round!');
        randomPickPlayer();
        return;
    }

    // Show random animation
    const overlay = document.getElementById('randomOverlay');
    overlay.classList.add('active');

    // Animate through random players
    let iterations = 0;
    const maxIterations = 20;
    const interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const randomPlayer = availablePlayers[randomIndex];

        // Update spinner text with player initials
        document.getElementById('randomSpinner').textContent = getInitials(randomPlayer.name);

        iterations++;
        if (iterations >= maxIterations) {
            clearInterval(interval);

            // Final selection
            const finalIndex = Math.floor(Math.random() * availablePlayers.length);
            const selectedPlayer = availablePlayers[finalIndex];

            // Add to picked list so they won't be picked again until all are picked
            pickedPlayersInSession.push(selectedPlayer.id);

            setTimeout(() => {
                overlay.classList.remove('active');
                document.getElementById('randomSpinner').textContent = '🎲';

                // Show auction arena and select player
                document.getElementById('auctionArena').style.display = 'block';
                document.getElementById('startAuctionBtn').innerHTML = '<span class="btn-icon">▶</span> Auction Started';
                document.getElementById('startAuctionBtn').disabled = true;
                selectPlayerForAuction(selectedPlayer);
            }, 500);
        }
    }, 100);
}

async function resetAuction() {
    if (confirm('Are you sure you want to reset all auction data? This will reload fresh data from JSON files and sync to Supabase.')) {
        try {
            // Clear localStorage first (but keep deleted players list)
            localStorage.removeItem(STORAGE_KEYS.PLAYERS);
            localStorage.removeItem(STORAGE_KEYS.TEAMS);

            // Load fresh data from JSON files
            const [playersRes, teamsRes] = await Promise.all([
                fetch('data/players.json'),
                fetch('data/teams.json')
            ]);
            let freshPlayers = await playersRes.json();
            teams = await teamsRes.json();

            // Filter out permanently deleted players
            const deletedPlayerIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_PLAYERS) || '[]');
            players = freshPlayers.filter(p => !deletedPlayerIds.includes(p.id));

            console.log(`Loaded ${freshPlayers.length} players, filtered to ${players.length} (${deletedPlayerIds.length} deleted)`);

            // Reset picked players session
            pickedPlayersInSession = [];

            // Save to localStorage and sync to Supabase
            saveToLocalStorage();
            if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
                updateSyncStatus('syncing');

                // Delete removed players from Supabase
                for (const playerId of deletedPlayerIds) {
                    await deletePlayerFromSupabase(playerId);
                }

                await syncToSupabase();
                updateSyncStatus('synced');
            }

            // Reset UI
            document.getElementById('auctionArena').style.display = 'none';
            document.getElementById('startAuctionBtn').innerHTML = '<span class="btn-icon">▶</span> Start Auction';
            document.getElementById('startAuctionBtn').disabled = false;
            currentPlayer = null;
            currentBid = 0;

            initializeApp();
            alert('Auction has been reset successfully with fresh data!');
        } catch (error) {
            console.error('Error resetting auction:', error);
            alert('Error resetting auction. Please try again.');
        }
    }
}

function selectPlayerForAuction(player) {
    // Allow both 'available' and 'unsold' players to be selected for auction
    if (player.status !== 'available' && player.status !== 'unsold') return;

    currentPlayer = player;
    currentBid = player.basePrice;

    // Update UI - Show photo if available, otherwise show initials
    if (player.photo) {
        document.getElementById('currentPlayerAvatar').innerHTML = `<img src="${player.photo}" alt="${player.name}" onerror="this.parentElement.innerHTML='<span>${getInitials(player.name)}</span>'">`;
    } else {
        document.getElementById('currentPlayerAvatar').innerHTML = `<span>${getInitials(player.name)}</span>`;
    }
    document.getElementById('currentPlayerName').textContent = player.name;
    document.getElementById('currentPlayerFlat').textContent = player.flatNo || '-';
    document.getElementById('currentPlayerRole').textContent = player.role;
    document.getElementById('currentPlayerAge').textContent = player.age ? `Age: ${player.age}` : '';
    document.getElementById('currentPlayerBatting').textContent = player.battingStyle;
    document.getElementById('currentPlayerBowling').textContent = player.bowlingStyle;
    document.getElementById('basePrice').textContent = `₹${player.basePrice}`;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;

    // Update CricHeroes link
    const cricHeroesLink = document.getElementById('currentPlayerCricHeroes');
    if (cricHeroesLink) {
        if (player.cricHeroesUrl) {
            cricHeroesLink.href = player.cricHeroesUrl;
            cricHeroesLink.style.display = 'inline-flex';
        } else {
            cricHeroesLink.style.display = 'none';
        }
    }

    // Reset custom bid input
    const customBidInput = document.getElementById('customBidInput');
    if (customBidInput) customBidInput.value = '';

    // Highlight selected player in grid
    document.querySelectorAll('.player-mini-card').forEach(card => {
        card.classList.remove('selected');
        if (parseInt(card.dataset.id) === player.id) {
            card.classList.add('selected');
        }
    });

    // Show auction arena
    document.getElementById('auctionArena').style.display = 'block';
}

function addBid(amount) {
    if (!isAdminMode) {
        alert('Only Admin can modify bids!');
        return;
    }
    if (!currentPlayer) return;
    currentBid += amount;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;
    updateBidWarning();
}

// Check which teams can afford the current bid and show warning
function updateBidWarning() {
    const warningEl = document.getElementById('bidWarning');
    if (!warningEl) return;

    if (!currentPlayer || currentBid === 0) {
        warningEl.style.display = 'none';
        return;
    }

    // Get teams that can still participate (have slots and budget > 0)
    const activeTeams = teams.filter(t => t.players.length < 7 && t.budget > 0);

    // Check which teams can afford the current bid
    const teamsCanAfford = activeTeams.filter(t => getMaxBidForTeam(t) >= currentBid);
    const teamsCantAfford = activeTeams.filter(t => getMaxBidForTeam(t) < currentBid);

    if (teamsCantAfford.length === 0) {
        warningEl.style.display = 'none';
        return;
    }

    if (teamsCanAfford.length === 0) {
        warningEl.innerHTML = `<span class="warning-icon">⚠️</span> No team can afford ₹${currentBid}!`;
        warningEl.className = 'bid-warning danger';
    } else {
        const cantAffordNames = teamsCantAfford.map(t => t.shortName).join(', ');
        warningEl.innerHTML = `<span class="warning-icon">⚠️</span> Out: ${cantAffordNames} (${teamsCanAfford.length} teams left)`;
        warningEl.className = 'bid-warning warning';
    }
    warningEl.style.display = 'flex';
}

function resetToBasePrice() {
    if (!isAdminMode) {
        alert('Only Admin can reset bids!');
        return;
    }
    if (!currentPlayer) return;
    currentBid = currentPlayer.basePrice;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;
    updateBidWarning();
}

function applyCustomBid() {
    if (!isAdminMode) {
        alert('Only Admin can modify bids!');
        return;
    }
    if (!currentPlayer) return;

    const customBidInput = document.getElementById('customBidInput');
    const customAmount = parseInt(customBidInput.value);

    if (isNaN(customAmount) || customAmount < 0) {
        alert('Please enter a valid amount!');
        return;
    }

    currentBid = customAmount;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;
    customBidInput.value = '';
    updateBidWarning();
}

function markAsSold() {
    if (!isAdminMode) {
        alert('Only Admin can mark players as sold!');
        return;
    }
    if (!currentPlayer) {
        alert('Please select a player first!');
        return;
    }

    const teamId = document.getElementById('buyingTeam').value;
    if (!teamId) {
        alert('Please select a team!');
        return;
    }

    const team = teams.find(t => t.id === parseInt(teamId));
    if (!team) return;

    // Check if team already has 7 players
    if (team.players.length >= 7) {
        alert(`${team.name} already has 7 players!`);
        return;
    }

    // Check if team has budget
    if (team.budget < currentBid) {
        alert(`${team.name} doesn't have enough budget! Available: ₹${team.budget}`);
        return;
    }

    // Check max bid (must reserve budget for remaining slots at base price)
    const maxBid = getMaxBidForTeam(team);
    if (currentBid > maxBid) {
        const remainingSlots = 7 - team.players.length - 1;
        alert(`${team.name} can't bid more than ₹${maxBid}!\n\nThey need to reserve ₹${remainingSlots * 30000} (₹30,000 × ${remainingSlots} slots) for remaining players.`);
        return;
    }

    // Update player
    currentPlayer.status = 'sold';
    currentPlayer.soldTo = team.id;
    currentPlayer.soldPrice = currentBid;

    // Update team
    team.budget -= currentBid;
    team.players.push({
        name: currentPlayer.name,
        flatNo: currentPlayer.flatNo,
        role: currentPlayer.role,
        captain: false,
        soldPrice: currentBid
    });

    saveData(); // Save to both localStorage and Supabase

    // Show sold animation
    showSoldAnimation(currentPlayer, team, currentBid);

    // Reset current player
    currentPlayer = null;
    currentBid = 0;

    // Reset and update UI
    setTimeout(() => {
        hideSoldAnimation();
        renderPlayers();
        renderTeams();
        renderAuctionPlayers();
        renderTeamsBudgetGrid();
        populateTeamSelect();
        updateStats();

        // Clear the auction arena player display
        document.getElementById('currentPlayerName').textContent = 'Select a Player';
        document.getElementById('currentPlayerFlat').textContent = '--';
        document.getElementById('currentPlayerRole').textContent = '--';
        document.getElementById('currentPlayerAge').textContent = '';
        document.getElementById('currentPlayerBatting').textContent = '--';
        document.getElementById('currentPlayerBowling').textContent = '--';
        document.getElementById('basePrice').textContent = '₹0';
        document.getElementById('currentBid').textContent = '₹0';
        document.getElementById('currentPlayerAvatar').innerHTML = '<span>?</span>';
    }, 3000);
}

function markAsUnsold() {
    if (!isAdminMode) {
        alert('Only Admin can mark players as unsold!');
        return;
    }
    if (!currentPlayer) {
        alert('Please select a player first!');
        return;
    }

    currentPlayer.status = 'unsold';
    saveData(); // Save to both localStorage and Supabase

    currentPlayer = null;
    currentBid = 0;

    renderPlayers();
    renderAuctionPlayers();
    updateStats();

    // Clear the auction arena player display
    document.getElementById('currentPlayerName').textContent = 'Select a Player';
    document.getElementById('currentPlayerFlat').textContent = '--';
    document.getElementById('currentPlayerRole').textContent = '--';
    document.getElementById('currentPlayerAge').textContent = '';
    document.getElementById('currentPlayerBatting').textContent = '--';
    document.getElementById('currentPlayerBowling').textContent = '--';
    document.getElementById('basePrice').textContent = '₹0';
    document.getElementById('currentBid').textContent = '₹0';
    document.getElementById('currentPlayerAvatar').innerHTML = '<span>?</span>';
}

function showSoldAnimation(player, team, price) {
    document.getElementById('soldPlayerName').textContent = player.name;
    document.getElementById('soldTeamName').textContent = team.name;
    document.getElementById('soldPrice').textContent = `₹${price}`;
    document.getElementById('soldOverlay').classList.add('active');
}

function hideSoldAnimation() {
    document.getElementById('soldOverlay').classList.remove('active');
}

// Delete player function (admin only)
async function deletePlayer(playerId) {
    if (!isAdminMode) {
        alert('Only Admin can delete players!');
        return;
    }

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (!confirm(`Are you sure you want to remove "${player.name}" from the player list? This action cannot be undone.`)) {
        return;
    }

    // Track deleted player ID so it doesn't come back on reset
    const deletedPlayers = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_PLAYERS) || '[]');
    deletedPlayers.push(playerId);
    localStorage.setItem(STORAGE_KEYS.DELETED_PLAYERS, JSON.stringify(deletedPlayers));

    // Remove from players array
    players = players.filter(p => p.id !== playerId);

    // Save to localStorage
    saveToLocalStorage();

    // Delete from Supabase
    if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
        try {
            await deletePlayerFromSupabase(playerId);
        } catch (error) {
            console.error('Error deleting player from Supabase:', error);
        }
    }

    // Close modal and refresh UI
    closePlayerModal();
    filteredPlayers = [...players];
    renderPlayers();
    renderAuctionPlayers();
    updateStats();

    alert(`"${player.name}" has been removed from the player list.`);
}

// Make delete function globally available
window.deletePlayer = deletePlayer;

// Calculate max bid a team can make for current player
// Formula: Budget - (remaining slots after this purchase * base price)
function getMaxBidForTeam(team) {
    if (!team) return 0;
    const basePrice = 30000; // Base price for players
    const currentSlots = team.players.length;
    const maxSlots = 7;
    const remainingSlotsAfterPurchase = maxSlots - currentSlots - 1; // -1 for current player being bought
    const reserveForRemaining = remainingSlotsAfterPurchase * basePrice;
    const maxBid = team.budget - reserveForRemaining;
    return Math.max(maxBid, 0);
}

function populateTeamSelect() {
    const select = document.getElementById('buyingTeam');
    select.innerHTML = '<option value="">-- Select Team --</option>';

    teams.forEach(team => {
        const maxBid = getMaxBidForTeam(team);
        const canBuy = team.players.length < 7 && team.budget > 0;
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.name} (₹${team.budget}, ${team.players.length}/7, Max: ₹${maxBid})`;
        option.disabled = !canBuy;
        select.appendChild(option);
    });
}

// ========================================
// Team Edit Functions
// ========================================
function openTeamEditModal(teamId) {
    if (!isAdminMode) {
        alert('Only Admin can edit teams!');
        return;
    }

    editingTeam = teams.find(t => t.id === teamId);
    if (!editingTeam) return;

    const modalBody = document.getElementById('teamEditModalBody');
    // Include both available and unsold players for manual addition
    const availablePlayers = players.filter(p => p.status === 'available' || p.status === 'unsold');

    modalBody.innerHTML = `
        <div class="team-edit-header">
            <div class="team-edit-logo ${editingTeam.logo ? 'has-logo' : ''}" style="background: ${editingTeam.logo ? 'transparent' : editingTeam.color}">
                ${editingTeam.logo ? `<img src="${editingTeam.logo}" alt="${editingTeam.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${editingTeam.shortName}'; this.parentElement.style.background='${editingTeam.color}'">` : editingTeam.shortName}
            </div>
            <div class="team-edit-info">
                <h3>${editingTeam.name}</h3>
                <div class="team-edit-budget">Budget: ₹${editingTeam.budget}</div>
            </div>
        </div>

        <div class="team-edit-players">
            <h4>Current Players (${editingTeam.players.length}/7)</h4>
            ${editingTeam.players.map((player, index) => `
                <div class="team-edit-player-item">
                    <div class="team-edit-player-info">
                        <div class="team-edit-player-avatar" style="background: ${editingTeam.color}">
                            ${getInitials(player.name)}
                        </div>
                        <div class="team-edit-player-details">
                            <span class="team-edit-player-name">
                                ${player.name}
                                ${player.captain ? '<span class="captain-badge">C</span>' : ''}
                            </span>
                            <span class="team-edit-player-meta">${player.flatNo || '-'} | ${player.role}${player.soldPrice ? ` | ₹${player.soldPrice}` : ''}</span>
                        </div>
                    </div>
                    <button class="remove-player-btn" onclick="removePlayerFromTeam(${teamId}, ${index})" ${index < 3 ? 'disabled title="Cannot remove original players"' : ''}>
                        Remove
                    </button>
                </div>
            `).join('')}
        </div>

        ${editingTeam.players.length < 7 ? `
        <div class="add-player-section">
            <h4>Add Player Manually</h4>
            <select class="add-player-select" id="addPlayerSelect">
                <option value="">-- Select Available Player --</option>
                ${availablePlayers.map(p => `
                    <option value="${p.id}">${p.name} (${p.flatNo || '-'}) - ${p.role} - Base: ₹${p.basePrice}</option>
                `).join('')}
            </select>
            <div class="add-player-price">
                <label>Price: ₹</label>
                <input type="number" id="addPlayerPrice" placeholder="Enter price" min="0">
            </div>
            <button class="btn-add-player" onclick="addPlayerToTeam(${teamId})">Add to Team</button>
        </div>
        ` : '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Team is full (7/7 players)</p>'}
    `;

    document.getElementById('teamEditModal').classList.add('active');
}

function closeTeamEditModal() {
    document.getElementById('teamEditModal').classList.remove('active');
    editingTeam = null;
}

function removePlayerFromTeam(teamId, playerIndex) {
    const team = teams.find(t => t.id === teamId);
    if (!team || playerIndex < 3) return; // Can't remove original 3 players

    const removedPlayer = team.players[playerIndex];

    if (confirm(`Remove ${removedPlayer.name} from ${team.name}?`)) {
        // Refund the sold price to team budget
        if (removedPlayer.soldPrice) {
            team.budget += removedPlayer.soldPrice;
        }

        // Remove player from team
        team.players.splice(playerIndex, 1);

        // Find the player in players array and reset their status
        const playerData = players.find(p => p.name === removedPlayer.name && p.flatNo === removedPlayer.flatNo);
        if (playerData) {
            playerData.status = 'available';
            playerData.soldTo = null;
            playerData.soldPrice = null;
        }

        saveData(); // Save to both localStorage and Supabase

        // Refresh UI
        renderTeams();
        renderAuctionPlayers();
        renderTeamsBudgetGrid();
        renderPlayers();
        populateTeamSelect();
        updateStats();

        // Refresh modal
        openTeamEditModal(teamId);
    }
}

function addPlayerToTeam(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team || team.players.length >= 7) return;

    const playerId = parseInt(document.getElementById('addPlayerSelect').value);
    const price = parseInt(document.getElementById('addPlayerPrice').value) || 0;

    if (!playerId) {
        alert('Please select a player!');
        return;
    }

    const player = players.find(p => p.id === playerId);
    // Allow both available and unsold players to be added to teams
    if (!player || (player.status !== 'available' && player.status !== 'unsold')) {
        alert('Player is not available!');
        return;
    }

    if (price > team.budget) {
        alert(`Not enough budget! Available: ₹${team.budget}`);
        return;
    }

    // Update player
    player.status = 'sold';
    player.soldTo = team.id;
    player.soldPrice = price;

    // Update team
    team.budget -= price;
    team.players.push({
        name: player.name,
        flatNo: player.flatNo,
        role: player.role,
        captain: false,
        soldPrice: price
    });

    saveData(); // Save to both localStorage and Supabase

    // Refresh UI
    renderTeams();
    renderAuctionPlayers();
    renderTeamsBudgetGrid();
    renderPlayers();
    populateTeamSelect();
    updateStats();

    // Refresh modal
    openTeamEditModal(teamId);
}

// Make functions globally available
window.openTeamEditModal = openTeamEditModal;
window.closeTeamEditModal = closeTeamEditModal;
window.removePlayerFromTeam = removePlayerFromTeam;
window.addPlayerToTeam = addPlayerToTeam;

// ========================================
// Add Player Functions (Ad-hoc)
// ========================================
function showAddPlayerModal() {
    if (!isAdminMode) {
        alert('Only Admin can add players!');
        return;
    }
    // Reset form
    document.getElementById('newPlayerName').value = '';
    document.getElementById('newPlayerFlat').value = '';
    document.getElementById('newPlayerRole').value = 'All-rounder';
    document.getElementById('newPlayerBatting').value = 'Right-hand bat';
    document.getElementById('newPlayerBowling').value = 'Right-arm medium';
    document.getElementById('newPlayerBasePrice').value = '30000';
    document.getElementById('newPlayerPhoto').value = '';
    document.getElementById('newPlayerCricHeroes').value = '';

    document.getElementById('addPlayerModal').classList.add('active');
    document.getElementById('newPlayerName').focus();
}

// Convert Google Drive link to direct image URL
function convertGoogleDriveUrl(url) {
    if (!url) return '';

    // Extract file ID from various Google Drive URL formats
    let fileId = '';

    // Format: https://drive.google.com/file/d/FILE_ID/view
    const match1 = url.match(/\/file\/d\/([^\/]+)/);
    if (match1) fileId = match1[1];

    // Format: https://drive.google.com/open?id=FILE_ID
    const match2 = url.match(/[?&]id=([^&]+)/);
    if (match2) fileId = match2[1];

    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
    }

    // If already in correct format or not a Google Drive URL, return as is
    return url;
}

function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').classList.remove('active');
}

function addNewPlayer() {
    const name = document.getElementById('newPlayerName').value.trim();
    const flatNo = document.getElementById('newPlayerFlat').value.trim();
    const role = document.getElementById('newPlayerRole').value;
    const battingStyle = document.getElementById('newPlayerBatting').value;
    const bowlingStyle = document.getElementById('newPlayerBowling').value;
    const basePrice = parseInt(document.getElementById('newPlayerBasePrice').value) || 30000;
    const photoUrl = document.getElementById('newPlayerPhoto').value.trim();
    const cricHeroesUrl = document.getElementById('newPlayerCricHeroes').value.trim();

    if (!name) {
        alert('Please enter player name!');
        return;
    }

    // Check if player already exists
    const existingPlayer = players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingPlayer) {
        alert('A player with this name already exists!');
        return;
    }

    // Generate new ID (max ID + 1)
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;

    // Convert Google Drive URL to direct image URL
    const convertedPhotoUrl = convertGoogleDriveUrl(photoUrl);

    // Create new player object
    const newPlayer = {
        id: newId,
        name: name,
        flatNo: flatNo,
        role: role,
        battingStyle: battingStyle,
        bowlingStyle: bowlingStyle,
        basePrice: basePrice,
        status: 'available',
        soldTo: null,
        soldPrice: null,
        photo: convertedPhotoUrl,
        cricHeroesUrl: cricHeroesUrl
    };

    // Add to players array
    players.push(newPlayer);

    // Save to localStorage and Supabase
    saveData();

    // Close modal
    closeAddPlayerModal();

    // Refresh UI
    filterAndRenderPlayers();
    renderAuctionPlayers();
    updateStats();

    alert(`Player "${name}" added successfully!`);

    // Optionally select this player for auction immediately
    if (document.getElementById('auctionArena').style.display !== 'none') {
        selectPlayerForAuction(newPlayer);
    }
}

// Make functions globally available
window.showAddPlayerModal = showAddPlayerModal;
window.closeAddPlayerModal = closeAddPlayerModal;
window.addNewPlayer = addNewPlayer;

// ========================================
// Add Team Functions
// ========================================
function showAddTeamModal() {
    if (!isAdminMode) {
        alert('Only Admin can add teams!');
        return;
    }
    document.getElementById('addTeamModal').classList.add('active');
    document.getElementById('newTeamName').focus();
}

function closeAddTeamModal() {
    document.getElementById('addTeamModal').classList.remove('active');
    // Clear form
    document.getElementById('newTeamName').value = '';
    document.getElementById('newTeamShortName').value = '';
    document.getElementById('newTeamColor').value = '#6366f1';
    document.getElementById('newTeamLogo').value = '';
    document.getElementById('newTeamBudget').value = '1000000';
    document.getElementById('newTeamCaptain').value = '';
}

async function addNewTeam() {
    const name = document.getElementById('newTeamName').value.trim();
    const shortName = document.getElementById('newTeamShortName').value.trim().toUpperCase();
    const color = document.getElementById('newTeamColor').value;
    let logo = document.getElementById('newTeamLogo').value.trim();
    const budget = parseInt(document.getElementById('newTeamBudget').value) || 1000000;
    const captainName = document.getElementById('newTeamCaptain').value.trim();

    if (!name || !shortName) {
        alert('Please fill in Team Name and Short Name!');
        return;
    }

    // Convert Google Drive URL if provided
    if (logo) {
        logo = convertGoogleDriveUrl(logo);
    }

    // Generate new team ID
    const maxId = Math.max(...teams.map(t => t.id), 0);
    const newTeam = {
        id: maxId + 1,
        name: name,
        shortName: shortName,
        color: color,
        logo: logo,
        budget: budget,
        maxPlayers: 7,
        players: captainName ? [{ name: captainName, flatNo: '', role: 'All-rounder', captain: true }] : []
    };

    // Add to teams array
    teams.push(newTeam);

    // Save to localStorage
    saveToLocalStorage();

    // Save to Supabase
    if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
        try {
            await saveTeamToSupabase(newTeam);
        } catch (error) {
            console.error('Error saving team to Supabase:', error);
        }
    }

    // Close modal and refresh UI
    closeAddTeamModal();
    renderTeams();
    renderTeamsBudgetGrid();
    populateTeamSelect();

    alert(`Team "${name}" has been added successfully!`);
}

// Delete team function (admin only)
async function deleteTeam(teamId) {
    if (!isAdminMode) {
        alert('Only Admin can delete teams!');
        return;
    }

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (team.players.length > 0) {
        if (!confirm(`Team "${team.name}" has ${team.players.length} players. Are you sure you want to delete this team? Players bought by this team will become available again.`)) {
            return;
        }
    } else {
        if (!confirm(`Are you sure you want to delete team "${team.name}"? This action cannot be undone.`)) {
            return;
        }
    }

    // Release any sold players back to available
    players.forEach(p => {
        if (p.soldTo === teamId) {
            p.status = 'available';
            p.soldTo = null;
            p.soldPrice = null;
        }
    });

    // Remove from teams array
    teams = teams.filter(t => t.id !== teamId);

    // Save to localStorage
    saveToLocalStorage();

    // Delete from Supabase
    if (typeof isSupabaseAvailable === 'function' && isSupabaseAvailable()) {
        try {
            await deleteTeamFromSupabase(teamId);
            await syncToSupabase(); // Sync players changes too
        } catch (error) {
            console.error('Error deleting team from Supabase:', error);
        }
    }

    // Refresh UI
    renderTeams();
    renderTeamsBudgetGrid();
    renderPlayers();
    renderAuctionPlayers();
    populateTeamSelect();
    updateStats();

    alert(`Team "${team.name}" has been deleted.`);
}

// Make team functions globally available
window.showAddTeamModal = showAddTeamModal;
window.closeAddTeamModal = closeAddTeamModal;
window.addNewTeam = addNewTeam;
window.deleteTeam = deleteTeam;

// ========================================
// Render Functions
// ========================================
function renderTeamsBudgetGrid() {
    const grid = document.getElementById('teamsBudgetGrid');
    if (!grid) return;

    grid.innerHTML = teams.map(team => `
        <div class="team-budget-card" onclick="openTeamEditModal(${team.id})">
            <div class="team-budget-info">
                <div class="team-budget-logo ${team.logo ? 'has-logo' : ''}" style="background: ${team.logo ? 'transparent' : team.color}">
                    ${team.logo ? `<img src="${team.logo}" alt="${team.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${team.shortName}'; this.parentElement.style.background='${team.color}'">` : team.shortName}
                </div>
                <div>
                    <div class="team-budget-name">${team.name}</div>
                    <div class="team-budget-slots">${team.players.length}/7 players</div>
                </div>
            </div>
            <div class="team-budget-amount">
                <div class="team-budget-value ${team.budget < 500 ? 'low' : ''}">₹${team.budget}</div>
            </div>
        </div>
    `).join('');
}

function renderAuctionPlayers() {
    const grid = document.getElementById('auctionPlayersGrid');
    if (!grid) return;

    // Include both available and unsold players for auction
    const auctionablePlayers = players.filter(p => p.status === 'available' || p.status === 'unsold');

    const countEl = document.getElementById('availableCount');
    if (countEl) countEl.textContent = `(${auctionablePlayers.length})`;

    grid.innerHTML = auctionablePlayers.map(player => `
        <div class="player-mini-card ${player.status === 'unsold' ? 'unsold' : ''}"
             data-id="${player.id}"
             onclick="selectPlayerForAuction(players.find(p => p.id === ${player.id}))">
            <div class="mini-avatar" style="background: ${player.photo ? 'transparent' : getAvatarColor(player.role)}">
                ${player.photo ? `<img src="${player.photo}" alt="${player.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${getInitials(player.name)}'">` : getInitials(player.name)}
            </div>
            <div class="mini-name">${player.name}</div>
            <div class="mini-role">${player.role}</div>
            <div class="mini-price">₹${player.basePrice}</div>
            ${player.status === 'unsold' ? '<div class="mini-unsold-badge">Unsold</div>' : ''}
        </div>
    `).join('');
}

function filterAndRenderPlayers() {
    filteredPlayers = players.filter(player => {
        let matchesFilter = true;

        if (currentFilter === 'available') {
            matchesFilter = player.status === 'available';
        } else if (currentFilter === 'sold') {
            matchesFilter = player.status === 'sold';
        } else if (currentFilter === 'unsold') {
            matchesFilter = player.status === 'unsold';
        } else if (currentFilter !== 'all') {
            matchesFilter = player.role === currentFilter;
        }

        const matchesSearch = player.name.toLowerCase().includes(searchQuery) ||
                            (player.flatNo || '').toLowerCase().includes(searchQuery) ||
                            player.role.toLowerCase().includes(searchQuery);

        return matchesFilter && matchesSearch;
    });

    renderPlayers();
}

function renderPlayers() {
    const grid = document.getElementById('playersGrid');
    if (!grid) return;

    if (filteredPlayers.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 40px;">No players found</p>';
        return;
    }

    grid.innerHTML = filteredPlayers.map(player => {
        const team = player.soldTo ? teams.find(t => t.id === player.soldTo) : null;
        const roleClass = player.role.toLowerCase().replace('-', '-');

        return `
            <div class="player-card ${player.status === 'sold' ? 'sold' : ''}" onclick="openPlayerModal(${player.id})">
                <div class="player-card-header">
                    <div class="player-image" style="background: ${player.photo ? 'transparent' : getAvatarColor(player.role)}">
                        ${player.photo ? `<img src="${player.photo}" alt="${player.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${getInitials(player.name)}'">` : getInitials(player.name)}
                    </div>
                    <div class="player-info">
                        <h3 class="player-name">${player.name}</h3>
                        <div class="player-flat">
                            <span>🏠</span>
                            <span>${player.flatNo || '-'}</span>
                        </div>
                    </div>
                    <span class="player-role-badge ${roleClass}">${player.role}</span>
                </div>
                <div class="player-card-body">
                    <div class="player-stats-row">
                        <div class="player-stat">
                            <div class="player-stat-value">${player.battingStyle}</div>
                            <div class="player-stat-label">Batting</div>
                        </div>
                        <div class="player-stat">
                            <div class="player-stat-value">${player.bowlingStyle}</div>
                            <div class="player-stat-label">Bowling</div>
                        </div>
                    </div>
                    <div class="player-price">
                        <span class="price-label">Base Price</span>
                        <span class="price-value">₹${player.basePrice}</span>
                    </div>
                    ${player.status === 'sold' ? `
                        <div class="sold-badge">SOLD - ₹${player.soldPrice}</div>
                        <div class="sold-to">To: ${team ? team.name : 'Unknown'}</div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderTeams() {
    const grid = document.getElementById('teamsGrid');
    if (!grid) return;

    grid.innerHTML = teams.map(team => {
        const emptySlots = 7 - team.players.length;

        return `
            <div class="team-card">
                <div class="team-header" style="background: linear-gradient(135deg, ${team.color}22, transparent)">
                    <div class="team-info">
                        <div class="team-logo ${team.logo ? 'has-logo' : ''}" style="background: ${team.logo ? 'transparent' : team.color}">
                            ${team.logo ? `<img src="${team.logo}" alt="${team.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${team.shortName}'; this.parentElement.style.background='${team.color}'">` : team.shortName}
                        </div>
                        <div class="team-name">${team.name}</div>
                    </div>
                    <div class="team-admin-actions" style="${isAdminMode ? '' : 'display:none'}">
                        <button class="team-edit-btn admin-only" onclick="openTeamEditModal(${team.id})">Edit</button>
                        <button class="team-delete-btn admin-only" onclick="deleteTeam(${team.id})">🗑️</button>
                    </div>
                    <div class="team-budget">
                        <div class="budget-label">Budget</div>
                        <div class="budget-value">₹${team.budget}</div>
                    </div>
                </div>
                <div class="team-players">
                    <div class="team-players-title">
                        <span>Squad</span>
                        <span class="player-count">${team.players.length}/7</span>
                    </div>
                    <div class="team-player-list">
                        ${team.players.map(player => `
                            <div class="team-player-item">
                                <div class="team-player-info">
                                    <div class="team-player-avatar" style="background: ${team.color}">
                                        ${getInitials(player.name)}
                                    </div>
                                    <div>
                                        <div class="team-player-name">
                                            ${player.name}
                                            ${player.captain ? '<span class="captain-badge">C</span>' : ''}
                                        </div>
                                        <div class="team-player-flat">${player.flatNo || '-'}</div>
                                    </div>
                                </div>
                                <span class="team-player-role">${player.role}</span>
                            </div>
                        `).join('')}
                        ${Array(emptySlots).fill(0).map(() => `
                            <div class="empty-slot">Empty Slot</div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const availableCount = players.filter(p => p.status === 'available').length;
    const totalEl = document.getElementById('totalPlayers');
    if (totalEl) totalEl.textContent = availableCount;
}

// ========================================
// Modal Functions
// ========================================
function closeModal() {
    const modal = document.getElementById('playerModal');
    if (modal) modal.classList.remove('active');
}

function openPlayerModal(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const team = player.soldTo ? teams.find(t => t.id === player.soldTo) : null;
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="player-modal-layout">
            <div class="player-modal-info">
                <div class="player-modal-header">
                    <span class="player-modal-role ${player.role.toLowerCase().replace('-', '')}">${player.role}</span>
                    <span class="player-modal-status ${player.status}">${player.status === 'sold' ? 'SOLD' : player.status === 'unsold' ? 'UNSOLD' : 'AVAILABLE'}</span>
                </div>
                <h2 class="player-modal-name">${player.name}</h2>
                ${player.flatNo ? `<p class="player-modal-flat"><span>🏠</span> Flat: ${player.flatNo}</p>` : ''}

                <div class="player-modal-stats">
                    <div class="player-modal-stat">
                        <div class="stat-icon">🏏</div>
                        <div class="stat-details">
                            <span class="stat-label">Batting</span>
                            <span class="stat-value">${player.battingStyle}</span>
                        </div>
                    </div>
                    <div class="player-modal-stat">
                        <div class="stat-icon">⚾</div>
                        <div class="stat-details">
                            <span class="stat-label">Bowling</span>
                            <span class="stat-value">${player.bowlingStyle}</span>
                        </div>
                    </div>
                </div>

                <div class="player-modal-price-section">
                    <div class="price-item">
                        <span class="price-label">Base Price</span>
                        <span class="price-amount">₹${player.basePrice}</span>
                    </div>
                    ${player.status === 'sold' ? `
                        <div class="price-item sold">
                            <span class="price-label">Sold For</span>
                            <span class="price-amount">₹${player.soldPrice}</span>
                        </div>
                    ` : ''}
                </div>

                ${team ? `
                    <div class="player-modal-team">
                        <span class="team-label">Bought by</span>
                        <div class="team-info-badge" style="background: ${team.color}20; border-color: ${team.color}">
                            <span class="team-short" style="background: ${team.color}">${team.shortName}</span>
                            <span class="team-name">${team.name}</span>
                        </div>
                    </div>
                ` : ''}

                <div class="cricheroes-section">
                    ${player.cricHeroesUrl ? `
                        <a href="${player.cricHeroesUrl}" target="_blank" class="cricheroes-link modal-cricheroes">
                            <span class="cricheroes-icon">📊</span> View Stats on CricHeroes
                        </a>
                    ` : `
                        <div class="no-cricheroes ${isAdminMode ? '' : 'hidden'}">
                            <span class="no-stats-text">No CricHeroes profile linked</span>
                        </div>
                    `}
                    ${isAdminMode ? `
                        <button class="edit-cricheroes-btn" onclick="showEditCricHeroesModal(${player.id})">
                            ${player.cricHeroesUrl ? 'Edit' : 'Add'} CricHeroes Link
                        </button>
                    ` : ''}
                </div>
                ${isAdminMode ? `
                    <div class="admin-player-actions">
                        <button class="delete-player-btn" onclick="deletePlayer(${player.id})">
                            🗑️ Remove Player
                        </button>
                    </div>
                ` : ''}
            </div>
            <div class="player-modal-photo">
                ${player.photo
                    ? `<img src="${player.photo}" alt="${player.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'photo-placeholder\\'>${getInitials(player.name)}</div>'">`
                    : `<div class="photo-placeholder">${getInitials(player.name)}</div>`
                }
            </div>
        </div>
    `;

    document.getElementById('playerModal').classList.add('active');
}

function closePlayerModal() {
    document.getElementById('playerModal').classList.remove('active');
}

// Edit CricHeroes Link
let editingPlayerId = null;

function showEditCricHeroesModal(playerId) {
    editingPlayerId = playerId;
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    document.getElementById('editCricHeroesUrl').value = player.cricHeroesUrl || '';
    document.getElementById('editCricHeroesPlayerName').textContent = player.name;
    document.getElementById('editCricHeroesModal').classList.add('active');
    document.getElementById('editCricHeroesUrl').focus();
}

function closeEditCricHeroesModal() {
    document.getElementById('editCricHeroesModal').classList.remove('active');
    editingPlayerId = null;
}

function saveCricHeroesUrl() {
    if (editingPlayerId === null) return;

    const player = players.find(p => p.id === editingPlayerId);
    if (!player) return;

    const url = document.getElementById('editCricHeroesUrl').value.trim();
    player.cricHeroesUrl = url;

    saveData(); // Save to both localStorage and Supabase
    closeEditCricHeroesModal();

    // Refresh the player modal
    openPlayerModal(editingPlayerId);

    // Refresh auction arena if this player is selected
    if (currentPlayer && currentPlayer.id === editingPlayerId) {
        selectPlayerForAuction(player);
    }

    alert('CricHeroes link updated successfully!');
}

// Make functions globally available
window.openPlayerModal = openPlayerModal;
window.closePlayerModal = closePlayerModal;
window.showEditCricHeroesModal = showEditCricHeroesModal;
window.closeEditCricHeroesModal = closeEditCricHeroesModal;
window.saveCricHeroesUrl = saveCricHeroesUrl;

// ========================================
// Utility Functions
// ========================================
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(role) {
    const colors = {
        'Batsman': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        'Bowler': 'linear-gradient(135deg, #ef4444, #dc2626)',
        'All-rounder': 'linear-gradient(135deg, #10b981, #059669)',
        'Wicketkeeper': 'linear-gradient(135deg, #f59e0b, #d97706)'
    };
    return colors[role] || 'linear-gradient(135deg, #6366f1, #4f46e5)';
}

// Make selectPlayerForAuction available globally
window.selectPlayerForAuction = selectPlayerForAuction;

// ========================================
// CSV Export Functions (Immediately Available)
// ========================================
window.downloadCSV = function(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportAllPlayers = function() {
    const headers = ['ID', 'Name', 'Flat No', 'Role', 'Batting Style', 'Bowling Style', 'Base Price', 'Status', 'Sold To', 'Sold Price'];
    const rows = players.map(p => {
        const team = p.soldTo ? teams.find(t => t.id === p.soldTo) : null;
        return [
            p.id,
            `"${p.name}"`,
            p.flatNo || '-',
            p.role,
            p.battingStyle,
            p.bowlingStyle,
            p.basePrice,
            p.status,
            team ? `"${team.name}"` : '-',
            p.soldPrice || '-'
        ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    window.downloadCSV('spl_all_players.csv', csvContent);
};

window.exportSoldPlayers = function() {
    const soldPlayers = players.filter(p => p.status === 'sold');
    const headers = ['Name', 'Flat No', 'Role', 'Base Price', 'Sold Price', 'Team', 'Profit/Loss'];
    const rows = soldPlayers.map(p => {
        const team = teams.find(t => t.id === p.soldTo);
        const profitLoss = p.soldPrice - p.basePrice;
        return [
            `"${p.name}"`,
            p.flatNo || '-',
            p.role,
            p.basePrice,
            p.soldPrice,
            team ? `"${team.name}"` : '-',
            profitLoss >= 0 ? `+${profitLoss}` : profitLoss
        ];
    });

    // Add summary row
    const totalBase = soldPlayers.reduce((sum, p) => sum + p.basePrice, 0);
    const totalSold = soldPlayers.reduce((sum, p) => sum + p.soldPrice, 0);
    rows.push(['', '', '', '', '', '', '']);
    rows.push(['TOTAL', '', `${soldPlayers.length} players`, totalBase, totalSold, '', totalSold - totalBase]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    window.downloadCSV('spl_sold_players.csv', csvContent);
};

window.exportTeams = function() {
    const headers = ['Team', 'Budget Remaining', 'Players Count', 'Player Name', 'Flat No', 'Role', 'Captain', 'Sold Price'];
    const rows = [];

    teams.forEach(team => {
        team.players.forEach((player, index) => {
            rows.push([
                index === 0 ? `"${team.name}"` : '',
                index === 0 ? team.budget : '',
                index === 0 ? `${team.players.length}/7` : '',
                `"${player.name}"`,
                player.flatNo || '-',
                player.role,
                player.captain ? 'Yes' : 'No',
                player.soldPrice || 'Original'
            ]);
        });
        // Add empty row between teams
        rows.push(['', '', '', '', '', '', '', '']);
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    window.downloadCSV('spl_teams.csv', csvContent);
};

window.exportAuctionSummary = function() {
    const soldPlayers = players.filter(p => p.status === 'sold');
    const unsoldPlayers = players.filter(p => p.status === 'unsold');
    const availablePlayers = players.filter(p => p.status === 'available');

    const totalSpent = soldPlayers.reduce((sum, p) => sum + p.soldPrice, 0);
    const avgPrice = soldPlayers.length > 0 ? Math.round(totalSpent / soldPlayers.length) : 0;
    const highestBid = soldPlayers.length > 0 ? Math.max(...soldPlayers.map(p => p.soldPrice)) : 0;
    const lowestBid = soldPlayers.length > 0 ? Math.min(...soldPlayers.map(p => p.soldPrice)) : 0;

    const highestPlayer = soldPlayers.find(p => p.soldPrice === highestBid);
    const lowestPlayer = soldPlayers.find(p => p.soldPrice === lowestBid);

    let csvContent = 'SPL 5.0 AUCTION SUMMARY REPORT\n';
    csvContent += `Generated on,${new Date().toLocaleString()}\n\n`;

    csvContent += 'OVERVIEW\n';
    csvContent += `Total Players,${players.length}\n`;
    csvContent += `Sold,${soldPlayers.length}\n`;
    csvContent += `Unsold,${unsoldPlayers.length}\n`;
    csvContent += `Available,${availablePlayers.length}\n\n`;

    csvContent += 'FINANCIAL SUMMARY\n';
    csvContent += `Total Amount Spent,₹${totalSpent}\n`;
    csvContent += `Average Selling Price,₹${avgPrice}\n`;
    csvContent += `Highest Bid,₹${highestBid}${highestPlayer ? ` (${highestPlayer.name})` : ''}\n`;
    csvContent += `Lowest Bid,₹${lowestBid}${lowestPlayer ? ` (${lowestPlayer.name})` : ''}\n\n`;

    csvContent += 'TEAM BUDGETS\n';
    csvContent += 'Team,Budget Remaining,Players,Amount Spent\n';
    teams.forEach(team => {
        const spent = 1000000 - team.budget;
        csvContent += `"${team.name}",₹${team.budget},${team.players.length}/7,₹${spent}\n`;
    });

    csvContent += '\nSOLD PLAYERS\n';
    csvContent += 'Name,Role,Sold Price,Team\n';
    soldPlayers.forEach(p => {
        const team = teams.find(t => t.id === p.soldTo);
        csvContent += `"${p.name}",${p.role},₹${p.soldPrice},"${team ? team.name : '-'}"\n`;
    });

    if (unsoldPlayers.length > 0) {
        csvContent += '\nUNSOLD PLAYERS\n';
        csvContent += 'Name,Role,Base Price\n';
        unsoldPlayers.forEach(p => {
            csvContent += `"${p.name}",${p.role},₹${p.basePrice}\n`;
        });
    }

    window.downloadCSV('spl_auction_summary.csv', csvContent);
};

// Toggle export menu
window.toggleExportMenu = function() {
    const menu = document.getElementById('exportMenu');
    menu.classList.toggle('active');
};

// Close export menu when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.export-dropdown');
    const menu = document.getElementById('exportMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.classList.remove('active');
    }
});
