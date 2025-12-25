// ========================================
// SPL Auction - Main JavaScript
// ========================================

// Global Variables
let players = [];
let filteredPlayers = [];
let currentFilter = 'all';
let currentSort = 'name';
let searchQuery = '';

// ========================================
// Initialize Application
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    initEventListeners();
    startCountdown();
});

// ========================================
// Load Players Data
// ========================================
async function loadPlayers() {
    try {
        const response = await fetch('data/players.json');
        players = await response.json();
        filteredPlayers = [...players];
        renderPlayers();
        updateStats();
    } catch (error) {
        console.error('Error loading players:', error);
        // Fallback: try relative path
        try {
            const response = await fetch('./data/players.json');
            players = await response.json();
            filteredPlayers = [...players];
            renderPlayers();
            updateStats();
        } catch (e) {
            console.error('Failed to load players:', e);
        }
    }
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

    // Sort Select
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        filterAndRenderPlayers();
    });

    // Modal Close
    const modal = document.getElementById('playerModal');
    const modalClose = document.querySelector('.modal-close');
    const modalOverlay = document.querySelector('.modal-overlay');

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Escape key to close modal
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

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav');

    mobileMenuBtn.addEventListener('click', () => {
        nav.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
    });
}

// ========================================
// Filter and Sort Players
// ========================================
function filterAndRenderPlayers() {
    // Filter by role
    filteredPlayers = players.filter(player => {
        const matchesFilter = currentFilter === 'all' || player.role === currentFilter;
        const matchesSearch = player.name.toLowerCase().includes(searchQuery) ||
                            player.country.toLowerCase().includes(searchQuery) ||
                            player.role.toLowerCase().includes(searchQuery);
        return matchesFilter && matchesSearch;
    });

    // Sort
    filteredPlayers.sort((a, b) => {
        switch (currentSort) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'price-high':
                return b.basePrice - a.basePrice;
            case 'price-low':
                return a.basePrice - b.basePrice;
            case 'runs':
                return b.runs - a.runs;
            case 'wickets':
                return b.wickets - a.wickets;
            case 'age':
                return a.age - b.age;
            default:
                return 0;
        }
    });

    renderPlayers();
}

// ========================================
// Render Players Grid
// ========================================
function renderPlayers() {
    const grid = document.getElementById('playersGrid');
    const noResults = document.getElementById('noResults');

    if (filteredPlayers.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';
    grid.innerHTML = filteredPlayers.map(player => createPlayerCard(player)).join('');

    // Add click events to cards
    document.querySelectorAll('.player-card').forEach((card, index) => {
        card.addEventListener('click', () => openModal(filteredPlayers[index]));
    });
}

// ========================================
// Create Player Card HTML
// ========================================
function createPlayerCard(player) {
    const roleClass = player.role.toLowerCase().replace('-', '-');

    return `
        <div class="player-card" data-id="${player.id}">
            <div class="player-card-header">
                <img src="${player.image}" alt="${player.name}" class="player-image" loading="lazy">
                <div class="player-info">
                    <h3 class="player-name">${player.name}</h3>
                    <div class="player-country">
                        <span>${getCountryFlag(player.country)}</span>
                        <span>${player.country}</span>
                    </div>
                </div>
                <span class="player-role-badge ${roleClass}">${player.role}</span>
            </div>
            <div class="player-card-body">
                <div class="player-stats-row">
                    <div class="player-stat">
                        <div class="player-stat-value">${player.matches}</div>
                        <div class="player-stat-label">Matches</div>
                    </div>
                    <div class="player-stat">
                        <div class="player-stat-value">${formatNumber(player.runs)}</div>
                        <div class="player-stat-label">Runs</div>
                    </div>
                    <div class="player-stat">
                        <div class="player-stat-value">${player.wickets}</div>
                        <div class="player-stat-label">Wickets</div>
                    </div>
                </div>
                <div class="player-price">
                    <span class="price-label">Base Price</span>
                    <span class="price-value">${formatPrice(player.basePrice)}</span>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Modal Functions
// ========================================
function openModal(player) {
    const modal = document.getElementById('playerModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="modal-player-header">
            <img src="${player.image}" alt="${player.name}" class="modal-player-image">
            <div class="modal-player-info">
                <h2 class="modal-player-name">${player.name}</h2>
                <div class="modal-player-meta">
                    <span>${getCountryFlag(player.country)} ${player.country}</span>
                    <span>Age: ${player.age}</span>
                    <span>${player.role}</span>
                </div>
            </div>
        </div>
        <div class="modal-stats-grid">
            <div class="modal-stat">
                <div class="modal-stat-value">${player.matches}</div>
                <div class="modal-stat-label">Matches</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-value">${formatNumber(player.runs)}</div>
                <div class="modal-stat-label">Runs</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-value">${player.wickets}</div>
                <div class="modal-stat-label">Wickets</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-value">${player.battingStyle}</div>
                <div class="modal-stat-label">Batting</div>
            </div>
        </div>
        <div class="modal-stat" style="margin-bottom: 24px;">
            <div class="modal-stat-value" style="font-size: 1rem;">${player.bowlingStyle}</div>
            <div class="modal-stat-label">Bowling Style</div>
        </div>
        <div class="modal-price">
            <div class="modal-price-label">Base Price</div>
            <div class="modal-price-value">${formatPrice(player.basePrice)}</div>
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// Update Statistics
// ========================================
function updateStats() {
    // Role counts
    const batsmenCount = players.filter(p => p.role === 'Batsman').length;
    const bowlersCount = players.filter(p => p.role === 'Bowler').length;
    const allroundersCount = players.filter(p => p.role === 'All-rounder').length;
    const keepersCount = players.filter(p => p.role === 'Wicketkeeper').length;

    document.getElementById('batsmenCount').textContent = batsmenCount;
    document.getElementById('bowlersCount').textContent = bowlersCount;
    document.getElementById('allroundersCount').textContent = allroundersCount;
    document.getElementById('keepersCount').textContent = keepersCount;

    // Top Run Scorers
    const topRunScorers = [...players].sort((a, b) => b.runs - a.runs).slice(0, 5);
    document.getElementById('topRunScorers').innerHTML = topRunScorers.map((p, i) => createTopItem(p, i, formatNumber(p.runs))).join('');

    // Top Wicket Takers
    const topWicketTakers = [...players].sort((a, b) => b.wickets - a.wickets).slice(0, 5);
    document.getElementById('topWicketTakers').innerHTML = topWicketTakers.map((p, i) => createTopItem(p, i, p.wickets + ' wkts')).join('');

    // Most Valuable
    const mostValuable = [...players].sort((a, b) => b.basePrice - a.basePrice).slice(0, 5);
    document.getElementById('mostValuable').innerHTML = mostValuable.map((p, i) => createTopItem(p, i, formatPrice(p.basePrice))).join('');

    // Country Distribution
    const countryCount = {};
    players.forEach(p => {
        countryCount[p.country] = (countryCount[p.country] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]);
    document.getElementById('countryGrid').innerHTML = sortedCountries.map(([country, count]) => `
        <div class="country-item">
            <span class="country-name">${getCountryFlag(country)} ${country}</span>
            <span class="country-count">${count}</span>
        </div>
    `).join('');

    // Update hero stats
    document.getElementById('totalCountries').textContent = Object.keys(countryCount).length;
    const totalPool = players.reduce((sum, p) => sum + p.basePrice, 0);
    document.getElementById('totalPool').textContent = '₹' + Math.round(totalPool / 10000000) + 'Cr';
}

function createTopItem(player, index, value) {
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    return `
        <div class="top-item">
            <span class="top-rank ${rankClass}">${index + 1}</span>
            <img src="${player.image}" alt="${player.name}" class="top-avatar">
            <div class="top-details">
                <div class="top-name">${player.name}</div>
                <div class="top-country">${player.country}</div>
            </div>
            <span class="top-value">${value}</span>
        </div>
    `;
}

// ========================================
// Countdown Timer
// ========================================
function startCountdown() {
    // Set auction date to next month
    const auctionDate = new Date();
    auctionDate.setMonth(auctionDate.getMonth() + 1);
    auctionDate.setDate(15);
    auctionDate.setHours(10, 0, 0, 0);

    function updateTimer() {
        const now = new Date();
        const diff = auctionDate - now;

        if (diff <= 0) {
            document.getElementById('days').textContent = '00';
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

// ========================================
// Utility Functions
// ========================================
function formatPrice(price) {
    if (price >= 10000000) {
        return '₹' + (price / 10000000).toFixed(1) + ' Cr';
    } else if (price >= 100000) {
        return '₹' + (price / 100000).toFixed(1) + ' L';
    }
    return '₹' + price.toLocaleString();
}

function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function getCountryFlag(country) {
    const flags = {
        'India': '🇮🇳',
        'Australia': '🇦🇺',
        'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'New Zealand': '🇳🇿',
        'South Africa': '🇿🇦',
        'Pakistan': '🇵🇰',
        'Bangladesh': '🇧🇩',
        'Sri Lanka': '🇱🇰',
        'West Indies': '🏝️',
        'Afghanistan': '🇦🇫'
    };
    return flags[country] || '🏳️';
}
