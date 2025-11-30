const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

// In-memory cache (will reset on serverless function cold start, which is fine for temporary caching)
const CACHE_VERSION = 'v3'; // Increment this to invalidate old cache
let teamsCache = null;
let cacheTimestamp = null;
let cacheVersion = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper: Fetch from Football-Data API
async function fetchFootballData(endpoint) {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) throw new Error('Missing FOOTBALL_API_KEY');
  
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
    
    // Check in-memory cache (invalidate if version changed)
    const now = Date.now();
    const isCacheValid = teamsCache && 
                         cacheTimestamp && 
                         cacheVersion === CACHE_VERSION &&
                         (now - cacheTimestamp < CACHE_DURATION);
    
    let allTeams = teamsCache;
    
    if (!isCacheValid) {
      // Fetch available competitions from API
      allTeams = [];
      
      try {
        const competitionsData = await fetchFootballData('/competitions');
        const competitions = competitionsData.competitions || [];
        
        // Filter to only free-tier competitions (plan: "TIER_ONE")
        const freeCompetitions = competitions.filter(comp => comp.plan === 'TIER_ONE');
        
        console.log(`Found ${freeCompetitions.length} free competitions`);
        
        // Fetch teams from each competition
        for (const competition of freeCompetitions) {
          try {
            const teams = await fetchFootballData(`/competitions/${competition.id}/teams`);
            if (teams.teams && Array.isArray(teams.teams)) {
              const competitionTeams = teams.teams.map(team => ({
                id: team.id,
                name: team.name,
                competition: competition.code,
                competitionName: competition.name,
                crest: team.crest || ''
              }));
              allTeams = allTeams.concat(competitionTeams);
            }
          } catch (error) {
            console.warn(`Warning: Could not fetch teams for ${competition.name}:`, error.message);
          }
        }
      } catch (error) {
        console.error('Failed to fetch competitions:', error);
        throw new Error('Failed to load competitions from API');
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
      cacheVersion = CACHE_VERSION;
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
