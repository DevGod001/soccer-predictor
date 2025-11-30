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
  
  const { competitionId } = req.query;
  
  try {
    const response = await fetch(`https://api.football-data.org/v4/competitions/${competitionId}/standings`, {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Standings API error:', error);
    res.status(500).json({ error: 'Failed to fetch standings', message: error.message });
  }
}
