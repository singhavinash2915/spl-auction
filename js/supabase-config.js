// ========================================
// Supabase Configuration for SPL Auction
// ========================================

// IMPORTANT: Replace these with your actual Supabase credentials
// Get these from: https://app.supabase.com/project/YOUR_PROJECT/settings/api
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // e.g., 'https://xyzcompany.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // e.g., 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// Feature flag to enable/disable Supabase sync
// Set to false to use localStorage only (fallback mode)
const SUPABASE_ENABLED = false; // Change to true after setting up Supabase

// Initialize Supabase client (will be null if not configured)
let supabase = null;

if (SUPABASE_ENABLED && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        supabase = null;
    }
}

// ========================================
// Supabase Database Functions
// ========================================

// Check if Supabase is available and configured
function isSupabaseAvailable() {
    return supabase !== null && SUPABASE_ENABLED;
}

// Load players from Supabase
async function loadPlayersFromSupabase() {
    if (!isSupabaseAvailable()) return null;

    try {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('id');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error loading players from Supabase:', error);
        return null;
    }
}

// Load teams from Supabase
async function loadTeamsFromSupabase() {
    if (!isSupabaseAvailable()) return null;

    try {
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .order('id');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error loading teams from Supabase:', error);
        return null;
    }
}

// Save/Update a player in Supabase
async function savePlayerToSupabase(player) {
    if (!isSupabaseAvailable()) return false;

    try {
        const { error } = await supabase
            .from('players')
            .upsert(player, { onConflict: 'id' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving player to Supabase:', error);
        return false;
    }
}

// Save/Update a team in Supabase
async function saveTeamToSupabase(team) {
    if (!isSupabaseAvailable()) return false;

    try {
        // Convert players array to JSON string for storage
        const teamData = {
            ...team,
            players: JSON.stringify(team.players)
        };

        const { error } = await supabase
            .from('teams')
            .upsert(teamData, { onConflict: 'id' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving team to Supabase:', error);
        return false;
    }
}

// Save all players to Supabase
async function saveAllPlayersToSupabase(players) {
    if (!isSupabaseAvailable()) return false;

    try {
        const { error } = await supabase
            .from('players')
            .upsert(players, { onConflict: 'id' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving all players to Supabase:', error);
        return false;
    }
}

// Save all teams to Supabase
async function saveAllTeamsToSupabase(teams) {
    if (!isSupabaseAvailable()) return false;

    try {
        // Convert players arrays to JSON strings
        const teamsData = teams.map(team => ({
            ...team,
            players: JSON.stringify(team.players)
        }));

        const { error } = await supabase
            .from('teams')
            .upsert(teamsData, { onConflict: 'id' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving all teams to Supabase:', error);
        return false;
    }
}

// Subscribe to real-time changes for players
function subscribeToPlayers(callback) {
    if (!isSupabaseAvailable()) return null;

    return supabase
        .channel('players-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'players' },
            (payload) => {
                console.log('Player change detected:', payload);
                callback(payload);
            }
        )
        .subscribe();
}

// Subscribe to real-time changes for teams
function subscribeToTeams(callback) {
    if (!isSupabaseAvailable()) return null;

    return supabase
        .channel('teams-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'teams' },
            (payload) => {
                console.log('Team change detected:', payload);
                callback(payload);
            }
        )
        .subscribe();
}

// Insert a new player to Supabase
async function insertPlayerToSupabase(player) {
    if (!isSupabaseAvailable()) return false;

    try {
        const { error } = await supabase
            .from('players')
            .insert(player);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error inserting player to Supabase:', error);
        return false;
    }
}

// Make functions globally available
window.isSupabaseAvailable = isSupabaseAvailable;
window.loadPlayersFromSupabase = loadPlayersFromSupabase;
window.loadTeamsFromSupabase = loadTeamsFromSupabase;
window.savePlayerToSupabase = savePlayerToSupabase;
window.saveTeamToSupabase = saveTeamToSupabase;
window.saveAllPlayersToSupabase = saveAllPlayersToSupabase;
window.saveAllTeamsToSupabase = saveAllTeamsToSupabase;
window.subscribeToPlayers = subscribeToPlayers;
window.subscribeToTeams = subscribeToTeams;
window.insertPlayerToSupabase = insertPlayerToSupabase;
