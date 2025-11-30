import { kv } from '@vercel/kv';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'SA', 'IT', 'BL1', 'FL1']; // Premier League, La Liga, Serie A, Bundesliga, Ligue 1

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
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { search = '' } = req.query;
    const searchLower = search.toLowerCase();
    
    // Check cache first
    const cacheKey = `teams-all-competitions`;
    let allTeams = await kv.get(cacheKey);
    
    if (!allTeams) {
      // Fetch teams from all competitions
      allTeams = [];
      
      for (const competitionCode of COMPETITIONS) {
        try {
          const standings = await fetchFootballData(`/competitions/${competitionCode}/standings`);
          if (standings.standings && standings.standings[0] && standings.standings[0].table) {
            const competitionTeams = standings.standings[0].table.map(entry => ({
              id: entry.team.id,
              name: entry.team.name,
              competition: competitionCode,
              crest: entry.team.crest,
              position: entry.position
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
      
      // Cache for 24 hours
      await kv.setex(cacheKey, 86400, JSON.stringify(allTeams));
    } else {
      allTeams = JSON.parse(allTeams);
    }
    
    // Filter by search query
    let filteredTeams = allTeams;
    if (search) {
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
