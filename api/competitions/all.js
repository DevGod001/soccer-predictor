export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const response = await fetch('https://api.football-data.org/v4/competitions', {
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
    console.error('All Competitions API Error:', error);
    res.status(500).json({ error: 'Failed to fetch competitions', message: error.message });
  }
}