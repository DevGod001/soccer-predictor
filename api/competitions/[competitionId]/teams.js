export default async function handler(req, res) {
  const { teamId, season } = req.query;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    // Use 2024 as default since that's the current season with data
    const currentSeason = season || '2024';
    
    console.log(`Fetching matches for team ${teamId}, season ${currentSeason}`);
    
    const response = await fetch(`https://api.football-data.org/v4/teams/${teamId}/matches?season=${currentSeason}&status=FINISHED`, {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Team Matches API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch team matches', 
      message: error.message 
    });
  }
}