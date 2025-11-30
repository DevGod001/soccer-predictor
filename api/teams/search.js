const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'SA', 'BL1', 'PD', 'FL1']; // Premier League, La Liga, Bundesliga, Serie A, Ligue 1

// In-memory cache (will reset on serverless function cold start, which is fine for temporary caching)
let teamsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper: Fetch from Football-Data API
async function fetchFootballData(endpoint) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error('Missing FOOTBALL_DATA_API_KEY');
  
  const response = await fetch(`${FOOTBALL_API_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': apiKey }
  });
  
  if (!response.ok) throw new Error(`Football API error: ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { search = '' } = req.query;
    const searchLower = search.toLowerCase();
    
    // Check in-memory cache
    const now = Date.now();
    const isCacheValid = teamsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION);
    
    let allTeams = teamsCache;
    
    if (!isCacheValid) {
      // Fetch teams from all competitions
      allTeams = [];
      
      for (const competitionCode of COMPETITIONS) {
        try {
          const teams = await fetchFootballData(`/competitions/${competitionCode}/teams`);
          if (teams.teams && Array.isArray(teams.teams)) {
            const competitionTeams = teams.teams.map(team => ({
              id: team.id,
              name: team.name,
              competition: competitionCode,
              crest: team.crest || ''
            }));
            allTeams = allTeams.concat(competitionTeams);
          }
        } catch (error) {
          console.warn(`Warning: Could not fetch teams for ${competitionCode}:`, error.message);
        }
      }
      
      // Remove duplicates (some teams might appear in multiple sources)
      const uniqueTeams = {};
      allTeams.forEach(team => {
        if (!uniqueTeams[team.id]) {
          uniqueTeams[team.id] = team;
        }
      });
      allTeams = Object.values(uniqueTeams);
      
      // Sort by name
      allTeams.sort((a, b) => a.name.localeCompare(b.name));
      
      // Update in-memory cache
      teamsCache = allTeams;
      cacheTimestamp = now;
    }
    
    // Filter by search query
    let filteredTeams = allTeams;
    if (search && search.length > 0) {
      filteredTeams = allTeams.filter(team => 
        team.name.toLowerCase().includes(searchLower)
      );
    }
    
    // Limit to 20 results
    filteredTeams = filteredTeams.slice(0, 20);
    
    return res.status(200).json({
      success: true,
      teams: filteredTeams,
      count: filteredTeams.length
    });
    
  } catch (error) {
    console.error('Teams handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch teams'
    });
  }
}
