// ========================================
// SPL Auction - Sangria Premier League
// ========================================

// Global Variables
let players = [];
let teams = [];
let filteredPlayers = [];
let currentFilter = 'all';
let searchQuery = '';
let currentPlayer = null;
let currentBid = 0;

// Local Storage Keys
const STORAGE_KEYS = {
    PLAYERS: 'spl_players',
    TEAMS: 'spl_teams'
};

// ========================================
// Initialize Application
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initEventListeners();
});

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
    populateTeamSelect();
    updateStats();
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
}

// ========================================
// Event Listeners
// ========================================
function initEventListeners() {
    // Search Input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        filterAndRenderPlayers();
    });

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
    document.getElementById('startAuctionBtn').addEventListener('click', startAuction);
    document.getElementById('resetAuctionBtn').addEventListener('click', resetAuction);

    // Bid Buttons
    document.getElementById('bid50').addEventListener('click', () => addBid(50));
    document.getElementById('bid100').addEventListener('click', () => addBid(100));
    document.getElementById('bid200').addEventListener('click', () => addBid(200));
    document.getElementById('bid500').addEventListener('click', () => addBid(500));

    // Sold/Unsold Buttons
    document.getElementById('soldBtn').addEventListener('click', markAsSold);
    document.getElementById('unsoldBtn').addEventListener('click', markAsUnsold);

    // Modal Close
    const modal = document.getElementById('playerModal');
    const modalClose = document.querySelector('.modal-close');
    const modalOverlay = document.querySelector('.modal-overlay');

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
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
            }
        });
    });
}

// ========================================
// Auction Functions
// ========================================
function startAuction() {
    document.getElementById('auctionArena').style.display = 'block';
    document.getElementById('startAuctionBtn').textContent = 'Auction Started';
    document.getElementById('startAuctionBtn').disabled = true;

    // Select first available player
    const availablePlayer = players.find(p => p.status === 'available');
    if (availablePlayer) {
        selectPlayerForAuction(availablePlayer);
    }
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

        saveToLocalStorage();

        // Reset UI
        document.getElementById('auctionArena').style.display = 'none';
        document.getElementById('startAuctionBtn').textContent = '▶ Start Auction';
        document.getElementById('startAuctionBtn').disabled = false;
        currentPlayer = null;
        currentBid = 0;

        initializeApp();
    }
}

function selectPlayerForAuction(player) {
    if (player.status !== 'available') return;

    currentPlayer = player;
    currentBid = player.basePrice;

    // Update UI
    document.getElementById('currentPlayerAvatar').innerHTML = `<span>${getInitials(player.name)}</span>`;
    document.getElementById('currentPlayerName').textContent = player.name;
    document.getElementById('currentPlayerFlat').textContent = player.flatNo;
    document.getElementById('currentPlayerRole').textContent = player.role;
    document.getElementById('currentPlayerAge').textContent = `Age: ${player.age}`;
    document.getElementById('currentPlayerBatting').textContent = player.battingStyle;
    document.getElementById('currentPlayerBowling').textContent = player.bowlingStyle;
    document.getElementById('basePrice').textContent = `₹${player.basePrice}`;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;

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
    if (!currentPlayer) return;
    currentBid += amount;
    document.getElementById('currentBid').textContent = `₹${currentBid}`;
}

function markAsSold() {
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

    // Reset and move to next player
    setTimeout(() => {
        hideSoldAnimation();
        renderPlayers();
        renderTeams();
        renderAuctionPlayers();
        populateTeamSelect();

        // Select next available player
        const nextPlayer = players.find(p => p.status === 'available');
        if (nextPlayer) {
            selectPlayerForAuction(nextPlayer);
        } else {
            document.getElementById('auctionArena').style.display = 'none';
            alert('Auction completed! All players have been sold or marked unsold.');
        }
    }, 3000);
}

function markAsUnsold() {
    if (!currentPlayer) {
        alert('Please select a player first!');
        return;
    }

    currentPlayer.status = 'unsold';
    saveToLocalStorage();

    renderPlayers();
    renderAuctionPlayers();

    // Select next available player
    const nextPlayer = players.find(p => p.status === 'available');
    if (nextPlayer) {
        selectPlayerForAuction(nextPlayer);
    } else {
        document.getElementById('auctionArena').style.display = 'none';
        alert('Auction completed! All players have been processed.');
    }
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
        option.textContent = `${team.name} (Budget: ₹${team.budget}, Players: ${team.players.length}/7)`;
        option.disabled = !canBuy;
        select.appendChild(option);
    });
}

// ========================================
// Render Functions
// ========================================
function renderAuctionPlayers() {
    const grid = document.getElementById('auctionPlayersGrid');
    const availablePlayers = players.filter(p => p.status === 'available');

    grid.innerHTML = availablePlayers.map(player => `
        <div class="player-mini-card ${player.status !== 'available' ? 'sold' : ''}"
             data-id="${player.id}"
             onclick="selectPlayerForAuction(players.find(p => p.id === ${player.id}))">
            <div class="mini-avatar" style="background: ${getAvatarColor(player.role)}">
                ${getInitials(player.name)}
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
                            player.flatNo.toLowerCase().includes(searchQuery) ||
                            player.role.toLowerCase().includes(searchQuery);

        return matchesFilter && matchesSearch;
    });

    renderPlayers();
}

function renderPlayers() {
    const grid = document.getElementById('playersGrid');

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
                    <div class="player-image" style="background: ${getAvatarColor(player.role)}">
                        ${getInitials(player.name)}
                    </div>
                    <div class="player-info">
                        <h3 class="player-name">${player.name}</h3>
                        <div class="player-flat">
                            <span>🏠</span>
                            <span>${player.flatNo}</span>
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

    grid.innerHTML = teams.map(team => {
        const emptySlots = 7 - team.players.length;

        return `
            <div class="team-card">
                <div class="team-header" style="background: linear-gradient(135deg, ${team.color}22, transparent)">
                    <div class="team-info">
                        <div class="team-logo" style="background: ${team.color}">
                            ${team.shortName}
                        </div>
                        <div class="team-name">${team.name}</div>
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
                                        <div class="team-player-flat">${player.flatNo}</div>
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
    document.getElementById('totalPlayers').textContent = availableCount;
}

// ========================================
// Modal Functions
// ========================================
function closeModal() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('active');
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
