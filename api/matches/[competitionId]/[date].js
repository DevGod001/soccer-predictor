export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { competitionId, date } = req.query;
  
  try {
    // Validate inputs
    if (!competitionId || !date) {
      return res.status(400).json({ 
        error: 'Missing parameters',
        message: 'Both competitionId and date are required' 
      });
    }
    
    const response = await fetch(
      `https://api.football-data.org/v4/competitions/${competitionId}/matches?dateFrom=${date}&dateTo=${date}`,
      {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Return matches with team info
    res.status(200).json({
      matches: data.matches || [],
      competition: data.competition
    });
    
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch matches',
      message: error.message 
    });
  }
}
