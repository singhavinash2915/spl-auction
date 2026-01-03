// ========================================
// Supabase Configuration for SPL Auction
// ========================================

// Supabase credentials
const SUPABASE_URL = 'https://qocletxuqmkpmksurluc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvY2xldHh1cW1rcG1rc3VybHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDE2MTksImV4cCI6MjA4MjkxNzYxOX0.JY3gCSKNKrSy3ViNEuXrSIwRY5LUsi0S4zBR1XsHsLc';

// Feature flag to enable/disable Supabase sync
// Set to false to use localStorage only (fallback mode)
const SUPABASE_ENABLED = true;

// Initialize Supabase client (will be null if not configured)
let supabaseClient = null;

if (SUPABASE_ENABLED && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
        // The CDN exposes supabase.createClient
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase client initialized successfully');
        } else if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase client initialized successfully (window)');
        } else {
            console.error('Supabase createClient not found. CDN may not have loaded.');
            console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('supa')));
        }
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        supabaseClient = null;
    }
}

// ========================================
// Supabase Database Functions
// ========================================

// Check if Supabase is available and configured
function isSupabaseAvailable() {
    return supabaseClient !== null && SUPABASE_ENABLED;
}

// Load players from Supabase
async function loadPlayersFromSupabase() {
    if (!isSupabaseAvailable()) return null;

    try {
        const { data, error } = await supabaseClient
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
        const { data, error } = await supabaseClient
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
        const { error } = await supabaseClient
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

        const { error } = await supabaseClient
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
        const { error } = await supabaseClient
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

        const { error } = await supabaseClient
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

    return supabaseClient
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

    return supabaseClient
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
        const { error } = await supabaseClient
            .from('players')
            .insert(player);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error inserting player to Supabase:', error);
        return false;
    }
}

// Delete a player from Supabase
async function deletePlayerFromSupabase(playerId) {
    if (!isSupabaseAvailable()) return false;

    try {
        const { error } = await supabaseClient
            .from('players')
            .delete()
            .eq('id', playerId);

        if (error) throw error;
        console.log('Player deleted from Supabase:', playerId);
        return true;
    } catch (error) {
        console.error('Error deleting player from Supabase:', error);
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
window.deletePlayerFromSupabase = deletePlayerFromSupabase;
