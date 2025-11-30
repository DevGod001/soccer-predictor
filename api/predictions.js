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

// Get team standings and calculate strength rating (0-100)
async function getTeamStrength(teamId, competitionId) {
  try {
    const standings = await fetchFootballData(`/competitions/${competitionId}/standings`);
    const table = standings.standings[0].table;
    
    const team = table.find(t => t.team.id === teamId);
    if (!team) return 50; // Default if not found
    
    // Calculate strength based on position, points, and goal difference
    const position = team.position;
    const maxTeams = table.length;
    const positionScore = ((maxTeams - position) / maxTeams) * 40; // 0-40
    const pointsPerGame = team.playedGames > 0 ? (team.points / team.playedGames) : 0;
    const pointsScore = (pointsPerGame / 3) * 30; // 0-30 (max 3 points per game)
    const goalDiff = team.goalDifference;
    const maxGoalDiff = Math.max(...table.map(t => Math.abs(t.goalDifference)));
    const goalDiffScore = (goalDiff / (maxGoalDiff || 1)) * 30; // 0-30
    
    return Math.min(100, Math.max(0, positionScore + pointsScore + goalDiffScore));
  } catch (error) {
    console.error('Error calculating team strength:', error);
    return 50; // Default fallback
  }
}

// Get team form (last 5 matches)
async function getTeamForm(teamId) {
  try {
    const matches = await fetchFootballData(`/teams/${teamId}/matches?status=FINISHED&limit=5`);
    if (!matches.matches || matches.matches.length === 0) return 50;
    
    let formScore = 0;
    matches.matches.forEach(match => {
      const isHome = match.homeTeam.id === teamId;
      const team = isHome ? match.homeTeam : match.awayTeam;
      const opponent = isHome ? match.awayTeam : match.homeTeam;
      
      if (match.status !== 'FINISHED') return;
      
      // Win: 3 points, Draw: 1 point, Loss: 0 points
      if (team.id === match.winner?.id) formScore += 3;
      else if (match.winner === null) formScore += 1;
    });
    
    // Normalize form to 0-100 (max 15 points from 5 matches)
    return (formScore / 15) * 100;
  } catch (error) {
    console.error('Error calculating team form:', error);
    return 50;
  }
}

// Get head-to-head history
async function getHeadToHead(homeTeamId, awayTeamId) {
  try {
    const h2h = await fetchFootballData(`/teams/${homeTeamId}/matches?opponent=${awayTeamId}&limit=10`);
    if (!h2h.matches || h2h.matches.length === 0) return { homeWins: 0, draws: 0, awayWins: 0 };
    
    let stats = { homeWins: 0, draws: 0, awayWins: 0 };
    
    h2h.matches.forEach(match => {
      if (match.status !== 'FINISHED') return;
      
      const isHomeTeamHome = match.homeTeam.id === homeTeamId;
      
      if (match.winner === null) stats.draws++;
      else if (isHomeTeamHome && match.homeTeam.id === match.winner.id) stats.homeWins++;
      else if (!isHomeTeamHome && match.awayTeam.id === match.winner.id) stats.awayWins++;
      else if (isHomeTeamHome) stats.awayWins++;
      else stats.homeWins++;
    });
    
    return stats;
  } catch (error) {
    console.error('Error calculating H2H:', error);
    return { homeWins: 0, draws: 0, awayWins: 0 };
  }
}

// Calculate goal-scoring ability
async function getGoalScoringAbility(teamId) {
  try {
    const matches = await fetchFootballData(`/teams/${teamId}/matches?status=FINISHED&limit=10`);
    if (!matches.matches || matches.matches.length === 0) return { goalsFor: 1.5, goalsAgainst: 1.5 };
    
    let totalGoalsFor = 0;
    let totalGoalsAgainst = 0;
    let gameCount = 0;
    
    matches.matches.forEach(match => {
      if (match.status !== 'FINISHED') return;
      
      const isHome = match.homeTeam.id === teamId;
      totalGoalsFor += isHome ? match.score.fullTime.home : match.score.fullTime.away;
      totalGoalsAgainst += isHome ? match.score.fullTime.away : match.score.fullTime.home;
      gameCount++;
    });
    
    return {
      goalsFor: gameCount > 0 ? totalGoalsFor / gameCount : 1.5,
      goalsAgainst: gameCount > 0 ? totalGoalsAgainst / gameCount : 1.5
    };
  } catch (error) {
    console.error('Error calculating goal ability:', error);
    return { goalsFor: 1.5, goalsAgainst: 1.5 };
  }
}

// Main prediction calculation
async function calculatePrediction(match) {
  try {
    const homeTeamId = match.homeTeam.id;
    const awayTeamId = match.awayTeam.id;
    const competitionId = match.competition.code;
    
    // Fetch all necessary data in parallel
    const [homeStrength, awayStrength, homeForm, awayForm, h2h, homeGoals, awayGoals] = await Promise.all([
      getTeamStrength(homeTeamId, competitionId),
      getTeamStrength(awayTeamId, competitionId),
      getTeamForm(homeTeamId),
      getTeamForm(awayTeamId),
      getHeadToHead(homeTeamId, awayTeamId),
      getGoalScoringAbility(homeTeamId),
      getGoalScoringAbility(awayTeamId)
    ]);
    
    // Weighted factors (total = 100)
    const weights = {
      strength: 0.35,      // 35% - team strength/league position
      form: 0.25,          // 25% - recent form
      h2h: 0.15,           // 15% - head-to-head history
      goalAbility: 0.15,   // 15% - offensive/defensive capability
      homeAdvantage: 0.10  // 10% - home field advantage
    };
    
    // Calculate home team score
    let homeScore = 0;
    homeScore += homeStrength * weights.strength;
    homeScore += homeForm * weights.form;
    homeScore += (h2h.homeWins / (h2h.homeWins + h2h.draws + h2h.awayWins || 1)) * 100 * weights.h2h;
    homeScore += (homeGoals.goalsFor / (homeGoals.goalsFor + homeGoals.goalsAgainst || 1)) * 100 * weights.goalAbility;
    homeScore += 55 * weights.homeAdvantage; // Home advantage base
    
    // Calculate away team score
    let awayScore = 0;
    awayScore += awayStrength * weights.strength;
    awayScore += awayForm * weights.form;
    awayScore += (h2h.awayWins / (h2h.homeWins + h2h.draws + h2h.awayWins || 1)) * 100 * weights.h2h;
    awayScore += (awayGoals.goalsFor / (awayGoals.goalsFor + awayGoals.goalsAgainst || 1)) * 100 * weights.goalAbility;
    awayScore += 45 * weights.homeAdvantage; // Away disadvantage base
    
    // Normalize scores
    const totalScore = homeScore + awayScore;
    let homeWinProb = (homeScore / totalScore) * 100;
    let awayWinProb = (awayScore / totalScore) * 100;
    
    // Draw probability based on similarity of teams
    const scoreDiff = Math.abs(homeScore - awayScore);
    let drawProb = 0;
    
    if (scoreDiff < 5) drawProb = 35; // Very similar teams
    else if (scoreDiff < 15) drawProb = 25;
    else if (scoreDiff < 25) drawProb = 15;
    else drawProb = 8;
    
    // Adjust win probabilities to account for draw
    const adjustmentFactor = (100 - drawProb) / 100;
    homeWinProb *= adjustmentFactor;
    awayWinProb *= adjustmentFactor;
    
    // Add random variance (±1-2%)
    const variance = (Math.random() - 0.5) * 4;
    homeWinProb = Math.max(0, Math.min(100, homeWinProb + variance));
    awayWinProb = Math.max(0, Math.min(100, awayWinProb - variance));
    
    // Ensure probabilities sum to 100
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb = (homeWinProb / total) * 100;
    drawProb = (drawProb / total) * 100;
    awayWinProb = (awayWinProb / total) * 100;
    
    // Calculate win chance (probability of recommendation winning)
    const maxProb = Math.max(homeWinProb, drawProb, awayWinProb);
    
    // Generate recommendation
    let recommendation = 'Draw';
    let winChance = drawProb;
    
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
      recommendation = homeWinProb > 55 ? 'Home Win' : 'Home Win (Safe)';
      winChance = homeWinProb;
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
      recommendation = awayWinProb > 55 ? 'Away Win' : 'Away Win (Safe)';
      winChance = awayWinProb;
    }
    
    // Calculate confidence based on probability gap
    const secondBest = maxProb === homeWinProb 
      ? Math.max(drawProb, awayWinProb)
      : maxProb === drawProb
      ? Math.max(homeWinProb, awayWinProb)
      : Math.max(homeWinProb, drawProb);
    
    const confidenceGap = maxProb - secondBest;
    const confidence = Math.min(100, 50 + (confidenceGap * 5)); // 50-100 scale
    
    return {
      recommendation,
      homeWinProb: Math.round(homeWinProb * 10) / 10,
      drawProb: Math.round(drawProb * 10) / 10,
      awayWinProb: Math.round(awayWinProb * 10) / 10,
      winChance: Math.round(winChance * 10) / 10,
      confidence: Math.round(confidence),
      factors: {
        homeStrength: Math.round(homeStrength),
        awayStrength: Math.round(awayStrength),
        homeForm: Math.round(homeForm),
        awayForm: Math.round(awayForm)
      }
    };
  } catch (error) {
    console.error('Error calculating prediction:', error);
    return null;
  }
}

// Main handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    // Check authorization
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing authorization' });
    }
    
    // Get upcoming matches from all competitions
    let allMatches = [];
    
    // Fetch matches from each competition individually
    for (const competitionCode of COMPETITIONS) {
      try {
        const competitionMatches = await fetchFootballData(`/competitions/${competitionCode}/matches?status=SCHEDULED`);
        if (competitionMatches.matches && competitionMatches.matches.length > 0) {
          allMatches = allMatches.concat(competitionMatches.matches);
        }
      } catch (error) {
        console.warn(`Warning: Could not fetch matches for ${competitionCode}:`, error.message);
      }
    }
    
    if (allMatches.length === 0) {
      return res.status(200).json({
        success: true,
        predictions: [],
        lastUpdated: new Date().toISOString(),
        message: 'No upcoming matches'
      });
    }
    
    // Calculate predictions for all matches
    const predictions = [];
    for (const match of allMatches.slice(0, 10)) { // Limit to 10 matches
      const prediction = await calculatePrediction(match);
      if (prediction) {
        predictions.push({
          matchId: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          date: match.utcDate,
          competition: match.competition.name,
          prediction
        });
      }
    }
    
    // Cache in KV for 1 hour
    const cacheKey = `predictions:${new Date().toISOString().split('T')[0]}`;
    await kv.setex(cacheKey, 3600, JSON.stringify(predictions));
    
    return res.status(200).json({
      success: true,
      predictions,
      lastUpdated: new Date().toISOString(),
      count: predictions.length
    });
    
  } catch (error) {
    console.error('Prediction handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate predictions'
    });
  }
}
