import { kv } from '@vercel/kv';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'SA', 'IT', 'BL1', 'FL1'];

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
    if (!team) return 50;
    
    const position = team.position;
    const maxTeams = table.length;
    const positionScore = ((maxTeams - position) / maxTeams) * 40;
    const pointsPerGame = team.playedGames > 0 ? (team.points / team.playedGames) : 0;
    const pointsScore = (pointsPerGame / 3) * 30;
    const goalDiff = team.goalDifference;
    const maxGoalDiff = Math.max(...table.map(t => Math.abs(t.goalDifference)));
    const goalDiffScore = (goalDiff / (maxGoalDiff || 1)) * 30;
    
    return Math.min(100, Math.max(0, positionScore + pointsScore + goalDiffScore));
  } catch (error) {
    console.error('Error calculating team strength:', error);
    return 50;
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
      
      if (match.status !== 'FINISHED') return;
      
      if (team.id === match.winner?.id) formScore += 3;
      else if (match.winner === null) formScore += 1;
    });
    
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
    
    const [homeStrength, awayStrength, homeForm, awayForm, h2h, homeGoals, awayGoals] = await Promise.all([
      getTeamStrength(homeTeamId, competitionId),
      getTeamStrength(awayTeamId, competitionId),
      getTeamForm(homeTeamId),
      getTeamForm(awayTeamId),
      getHeadToHead(homeTeamId, awayTeamId),
      getGoalScoringAbility(homeTeamId),
      getGoalScoringAbility(awayTeamId)
    ]);
    
    const weights = {
      strength: 0.35,
      form: 0.25,
      h2h: 0.15,
      goalAbility: 0.15,
      homeAdvantage: 0.10
    };
    
    let homeScore = 0;
    homeScore += homeStrength * weights.strength;
    homeScore += homeForm * weights.form;
    homeScore += (h2h.homeWins / (h2h.homeWins + h2h.draws + h2h.awayWins || 1)) * 100 * weights.h2h;
    homeScore += (homeGoals.goalsFor / (homeGoals.goalsFor + homeGoals.goalsAgainst || 1)) * 100 * weights.goalAbility;
    homeScore += 55 * weights.homeAdvantage;
    
    let awayScore = 0;
    awayScore += awayStrength * weights.strength;
    awayScore += awayForm * weights.form;
    awayScore += (h2h.awayWins / (h2h.homeWins + h2h.draws + h2h.awayWins || 1)) * 100 * weights.h2h;
    awayScore += (awayGoals.goalsFor / (awayGoals.goalsFor + awayGoals.goalsAgainst || 1)) * 100 * weights.goalAbility;
    awayScore += 45 * weights.homeAdvantage;
    
    const totalScore = homeScore + awayScore;
    let homeWinProb = (homeScore / totalScore) * 100;
    let awayWinProb = (awayScore / totalScore) * 100;
    
    const scoreDiff = Math.abs(homeScore - awayScore);
    let drawProb = 0;
    
    if (scoreDiff < 5) drawProb = 35;
    else if (scoreDiff < 15) drawProb = 25;
    else if (scoreDiff < 25) drawProb = 15;
    else drawProb = 8;
    
    const adjustmentFactor = (100 - drawProb) / 100;
    homeWinProb *= adjustmentFactor;
    awayWinProb *= adjustmentFactor;
    
    const variance = (Math.random() - 0.5) * 4;
    homeWinProb = Math.max(0, Math.min(100, homeWinProb + variance));
    awayWinProb = Math.max(0, Math.min(100, awayWinProb - variance));
    
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb = (homeWinProb / total) * 100;
    drawProb = (drawProb / total) * 100;
    awayWinProb = (awayWinProb / total) * 100;
    
    const maxProb = Math.max(homeWinProb, drawProb, awayWinProb);
    
    let recommendation = 'Draw';
    let winChance = drawProb;
    
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
      recommendation = homeWinProb > 55 ? 'Home Win' : 'Home Win (Safe)';
      winChance = homeWinProb;
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
      recommendation = awayWinProb > 55 ? 'Away Win' : 'Away Win (Safe)';
      winChance = awayWinProb;
    }
    
    const secondBest = maxProb === homeWinProb 
      ? Math.max(drawProb, awayWinProb)
      : maxProb === drawProb
      ? Math.max(homeWinProb, awayWinProb)
      : Math.max(homeWinProb, drawProb);
    
    const confidenceGap = maxProb - secondBest;
    const confidence = Math.min(100, 50 + (confidenceGap * 5));
    
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

// Main handler - Get curated picks (60%+ win chance, 80%+ confidence)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `curated-picks:${today}`;
    
    // Check cache first
    const cachedPicks = await kv.get(cacheKey);
    if (cachedPicks) {
      return res.status(200).json({
        success: true,
        picks: JSON.parse(cachedPicks),
        cached: true,
        nextUpdate: new Date(Date.now() + 5 * 60000).toISOString() // 5 min from now
      });
    }
    
    // Get upcoming matches
    const matches = await fetchFootballData(`/matches?status=SCHEDULED&competitions=${COMPETITIONS.join(',')}`);
    
    if (!matches.matches || matches.matches.length === 0) {
      return res.status(200).json({
        success: true,
        picks: [],
        cached: false,
        nextUpdate: new Date(Date.now() + 60 * 60000).toISOString()
      });
    }
    
    // Calculate predictions and filter VVIP picks
    const curatedPicks = [];
    for (const match of matches.matches) {
      const prediction = await calculatePrediction(match);
      
      if (prediction && prediction.winChance >= 60 && prediction.confidence >= 80) {
        curatedPicks.push({
          match: {
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            date: match.utcDate,
            competition: match.competition.name,
            id: match.id
          },
          prediction
        });
      }
      
      // Limit to 10 high-quality picks
      if (curatedPicks.length >= 10) break;
    }
    
    // Sort by quality score descending
    curatedPicks.sort((a, b) => {
      const scoreA = (a.prediction.winChance * a.prediction.confidence) / 100;
      const scoreB = (b.prediction.winChance * b.prediction.confidence) / 100;
      return scoreB - scoreA;
    });
    
    // Keep only top 3-4 picks
    const topPicks = curatedPicks.slice(0, 4);
    
    // Cache for 5 minutes
    await kv.setex(cacheKey, 5 * 60, JSON.stringify(topPicks));
    
    return res.status(200).json({
      success: true,
      picks: topPicks,
      cached: false,
      nextUpdate: new Date(Date.now() + 5 * 60000).toISOString(),
      count: topPicks.length
    });
    
  } catch (error) {
    console.error('Curated picks handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch curated picks'
    });
  }
}
