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
    THEME: 'spl_theme'
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
    // Try to load from localStorage first
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
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
}

// ========================================
// Admin Mode Functions
// ========================================
function updateAdminUI() {
    const adminControls = document.querySelectorAll('.admin-only');
    const adminStatus = document.getElementById('adminStatus');
    const adminLoginBtn = document.getElementById('adminLoginBtn');

    if (isAdminMode) {
        adminControls.forEach(el => el.style.display = '');
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

    // Bid Buttons - 500 and 1000
    const bid500 = document.getElementById('bid500');
    const bid1000 = document.getElementById('bid1000');
    const resetBid = document.getElementById('resetBidBtn');
    const customBidBtn = document.getElementById('customBidBtn');

    if (bid500) bid500.addEventListener('click', () => addBid(500));
    if (bid1000) bid1000.addEventListener('click', () => addBid(1000));
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

    // Get available players that haven't been picked in this session
    const availablePlayers = players.filter(p =>
        p.status === 'available' && !pickedPlayersInSession.includes(p.id)
    );

    if (availablePlayers.length === 0) {
        // Reset session if all have been picked
        pickedPlayersInSession = [];
        const allAvailable = players.filter(p => p.status === 'available');
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

function resetAuction() {
    if (confirm('Are you sure you want to reset all auction data? This will mark all players as available and reset team rosters.')) {
        // Reset players
        players.forEach(p => {
            p.status = 'available';
            p.soldTo = null;
            p.soldPrice = null;
        });

        // Reset teams - keep only original 3 players
        teams.forEach(team => {
            team.budget = 3000;
            team.players = team.players.slice(0, 3);
        });

        // Reset picked players session
        pickedPlayersInSession = [];

        saveToLocalStorage();

        // Reset UI
        document.getElementById('auctionArena').style.display = 'none';
        document.getElementById('startAuctionBtn').innerHTML = '<span class="btn-icon">▶</span> Start Auction';
        document.getElementById('startAuctionBtn').disabled = false;
        currentPlayer = null;
        currentBid = 0;

        initializeApp();
        alert('Auction has been reset successfully!');
    }
}

function selectPlayerForAuction(player) {
    if (player.status !== 'available') return;

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
}

function resetToBasePrice() {
    if (!isAdminMode) {
        alert('Only Admin can reset bids!');
        return;
    }
    if (!currentPlayer) return;
    currentBid = currentPlayer.basePrice;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;
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

    // Check if team has budget
    if (team.budget < currentBid) {
        alert(`${team.name} doesn't have enough budget! Available: ₹${team.budget}`);
        return;
    }

    // Check if team already has 7 players
    if (team.players.length >= 7) {
        alert(`${team.name} already has 7 players!`);
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

    saveToLocalStorage();

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
    saveToLocalStorage();

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

function populateTeamSelect() {
    const select = document.getElementById('buyingTeam');
    select.innerHTML = '<option value="">-- Select Team --</option>';

    teams.forEach(team => {
        const canBuy = team.players.length < 7 && team.budget > 0;
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.name} (₹${team.budget}, ${team.players.length}/7)`;
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
    const availablePlayers = players.filter(p => p.status === 'available');

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

        saveToLocalStorage();

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
    if (!player || player.status !== 'available') {
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

    saveToLocalStorage();

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

    const availablePlayers = players.filter(p => p.status === 'available');

    const countEl = document.getElementById('availableCount');
    if (countEl) countEl.textContent = `(${availablePlayers.length})`;

    grid.innerHTML = availablePlayers.map(player => `
        <div class="player-mini-card ${player.status !== 'available' ? 'sold' : ''}"
             data-id="${player.id}"
             onclick="selectPlayerForAuction(players.find(p => p.id === ${player.id}))">
            <div class="mini-avatar" style="background: ${player.photo ? 'transparent' : getAvatarColor(player.role)}">
                ${player.photo ? `<img src="${player.photo}" alt="${player.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='${getInitials(player.name)}'">` : getInitials(player.name)}
            </div>
            <div class="mini-name">${player.name}</div>
            <div class="mini-role">${player.role}</div>
            <div class="mini-price">₹${player.basePrice}</div>
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
            <div class="player-card ${player.status === 'sold' ? 'sold' : ''}">
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
                    <button class="team-edit-btn admin-only" onclick="openTeamEditModal(${team.id})" style="${isAdminMode ? '' : 'display:none'}">Edit</button>
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
