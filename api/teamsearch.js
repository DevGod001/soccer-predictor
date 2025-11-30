import { kv } from '@vercel/kv';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'SA', 'IT', 'BL1', 'FL1'];

async function fetchFootballData(endpoint) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error('ERROR: FOOTBALL_DATA_API_KEY not found in environment');
    throw new Error('Missing FOOTBALL_DATA_API_KEY');
  }
  
  const response = await fetch(`${FOOTBALL_API_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': apiKey }
  });
  
  if (!response.ok) throw new Error(`Football API error: ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  console.log('=== TEAMS SEARCH ENDPOINT CALLED ===');
  console.log('Method:', req.method);
  console.log('Query:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { search = '' } = req.query;
    const searchLower = search.toLowerCase();
    
    console.log('Checking cache for teams...');
    const cacheKey = 'teams-all-competitions';
    let cachedTeams = await kv.get(cacheKey);
    let allTeams = cachedTeams ? JSON.parse(cachedTeams) : null;
    
    if (!allTeams) {
      console.log('Cache miss - fetching fresh teams from all competitions');
      allTeams = [];
      
      for (const competitionCode of COMPETITIONS) {
        try {
          console.log(`Fetching teams for ${competitionCode}...`);
          const standings = await fetchFootballData(`/competitions/${competitionCode}/standings`);
          if (standings.standings && standings.standings[0] && standings.standings[0].table) {
            const competitionTeams = standings.standings[0].table.map(entry => ({
              id: entry.team.id,
              name: entry.team.name,
              competition: competitionCode,
              crest: entry.team.crest || ''
            }));
            allTeams = allTeams.concat(competitionTeams);
            console.log(`Added ${competitionTeams.length} teams from ${competitionCode}`);
          }
        } catch (error) {
          console.warn(`Warning: Could not fetch teams for ${competitionCode}:`, error.message);
        }
      }
      
      console.log(`Total teams before dedup: ${allTeams.length}`);
      
      // Remove duplicates
      const uniqueTeams = {};
      allTeams.forEach(team => {
        if (!uniqueTeams[team.id]) {
          uniqueTeams[team.id] = team;
        }
      });
      allTeams = Object.values(uniqueTeams);
      
      console.log(`Total unique teams: ${allTeams.length}`);
      
      // Sort by name
      allTeams.sort((a, b) => a.name.localeCompare(b.name));
      
      // Cache for 24 hours
      try {
        await kv.setex(cacheKey, 86400, JSON.stringify(allTeams));
        console.log('Teams cached successfully');
      } catch (cacheError) {
        console.warn('Cache error:', cacheError.message);
      }
    } else {
      console.log(`Loaded ${allTeams.length} teams from cache`);
    }
    
    // Filter by search query
    let filteredTeams = allTeams;
    if (search && search.length > 0) {
      filteredTeams = allTeams.filter(team => 
        team.name.toLowerCase().includes(searchLower)
      );
      console.log(`Filtered to ${filteredTeams.length} teams matching "${search}"`);
    }
    
    // Limit to 20 results
    filteredTeams = filteredTeams.slice(0, 20);
    
    console.log(`Returning ${filteredTeams.length} teams`);
    return res.status(200).json({
      success: true,
      teams: filteredTeams,
      count: filteredTeams.length
    });
    
  } catch (error) {
    console.error('Teams handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch teams',
      details: error.stack
    });
  }
}
