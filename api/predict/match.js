export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { homeStats, awayStats, homeTeamName, awayTeamName } = req.body;
    
    if (!homeStats || !awayStats || !homeTeamName || !awayTeamName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // PROTECTED PREDICTION ALGORITHM - Server-side only
    const prediction = calculatePrediction(
      { name: homeTeamName },
      { name: awayTeamName },
      homeStats,
      awayStats
    );
    
    res.status(200).json(prediction);
    
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Prediction failed', message: error.message });
  }
}

// PROTECTED: Prediction algorithm (not visible to client) - REALISTIC FORMULA
function calculatePrediction(homeTeam, awayTeam, homeStats, awayStats) {
  const homeAdvantage = 0.05; // Realistic 5% home advantage
  
  // Calculate expected goals with proper formula
  const homeAttack = homeStats.attackStrength;
  const awayDefense = awayStats.defenseStrength;
  const awayAttack = awayStats.attackStrength;
  const homeDefense = homeStats.defenseStrength;
  
  // Enhanced goal calculation with dynamic factors
  const homeGoalBase = homeAttack - awayDefense + 1.0;
  const awayGoalBase = awayAttack - homeDefense + 0.9;
  
  // Add form impact on goals
  const homeFormFactor = calculateFormStrength(homeStats.form) * 0.3;
  const awayFormFactor = calculateFormStrength(awayStats.form) * 0.3;
  
  // Raw expected goals with dynamic adjustments
  let rawExpectedHome = Math.max(0.2, homeGoalBase + homeFormFactor + (homeAdvantage * 2));
  let rawExpectedAway = Math.max(0.2, awayGoalBase + awayFormFactor);
  
  // Apply -0.5 safety margin for conservative betting
  const safeExpectedHome = Math.max(0, rawExpectedHome - 0.5);
  const safeExpectedAway = Math.max(0, rawExpectedAway - 0.5);
  
  // Calculate win probabilities - EQUAL BASELINE + 5% HOME
  const strengthDiff = homeStats.strength - awayStats.strength;
  const formDiff = calculateFormStrength(homeStats.form) - calculateFormStrength(awayStats.form);
  
  // Start with equal baseline (33.33% each)
  const baseProb = 0.3333;
  
  // Apply strength and form differentials
  let homeWinProb = baseProb + (strengthDiff * 0.35) + (formDiff * 0.12) + homeAdvantage;
  let awayWinProb = baseProb + (-strengthDiff * 0.35) + (-formDiff * 0.12);
  let drawProb = baseProb - (Math.abs(strengthDiff) * 0.08);
  
  // Add variance for unpredictability (real matches have surprises)
  const variance = Math.random() * 0.03 - 0.015; // ±1.5% randomness
  homeWinProb += variance;
  awayWinProb -= variance * 0.5;
  
  // Normalize probabilities to ensure they sum to 100%
  const total = homeWinProb + drawProb + awayWinProb;
  homeWinProb /= total;
  drawProb /= total;
  awayWinProb /= total;
  
  // Determine betting recommendation with PROPER handicap logic
  let recommendation;
  let recommendationType;
  let winner;
  let winChance;
  
  if (homeWinProb >= 0.60) {
    recommendation = `${homeTeam.name} Win`;
    recommendationType = 'win';
    winner = homeTeam.name;
    winChance = homeWinProb;
  } else if (homeWinProb >= 0.49 && homeWinProb < 0.60) {
    recommendation = `${homeTeam.name} Win or Draw`;
    recommendationType = 'win-or-draw';
    winner = homeTeam.name;
    winChance = homeWinProb;
  } else if (homeWinProb < 0.49 && homeWinProb > awayWinProb) {
    recommendation = `${homeTeam.name} +2 Handicap`;
    recommendationType = 'handicap-2';
    winner = homeTeam.name;
    winChance = homeWinProb;
  } else if (awayWinProb >= 0.60) {
    recommendation = `${awayTeam.name} Win`;
    recommendationType = 'win';
    winner = awayTeam.name;
    winChance = awayWinProb;
  } else if (awayWinProb >= 0.49 && awayWinProb < 0.60) {
    recommendation = `${awayTeam.name} Win or Draw`;
    recommendationType = 'win-or-draw';
    winner = awayTeam.name;
    winChance = awayWinProb;
  } else if (awayWinProb < 0.49 && awayWinProb > homeWinProb) {
    recommendation = `${awayTeam.name} +2 Handicap`;
    recommendationType = 'handicap-2';
    winner = awayTeam.name;
    winChance = awayWinProb;
  } else {
    // Very close match - safest bet is Draw or Double Chance
    if (Math.abs(homeWinProb - awayWinProb) < 0.05) {
      recommendation = 'Draw or Double Chance';
      recommendationType = 'draw-safe';
      winner = 'Draw';
      winChance = drawProb;
    } else if (homeWinProb > awayWinProb) {
      recommendation = `${homeTeam.name} +2 Handicap`;
      recommendationType = 'handicap-2';
      winner = homeTeam.name;
      winChance = homeWinProb;
    } else {
      recommendation = `${awayTeam.name} +2 Handicap`;
      recommendationType = 'handicap-2';
      winner = awayTeam.name;
      winChance = awayWinProb;
    }
  }
  
  // Conservative BTTS and Over 2.5
  const safeTotalGoals = safeExpectedHome + safeExpectedAway;
  const btts = (safeExpectedHome >= 1.0 && safeExpectedAway >= 1.0);
  const over25 = safeTotalGoals >= 3.0;
  
  const confidence = Math.min(0.9, 0.4 + Math.abs(strengthDiff) + 0.2);
  
  return {
    winner,
    winChance: winChance * 100,
    confidence: confidence * 100,
    homeWinProb: homeWinProb * 100,
    drawProb: drawProb * 100,
    awayWinProb: awayWinProb * 100,
    recommendation,
    recommendationType,
    expectedGoalsHome: rawExpectedHome,
    expectedGoalsAway: rawExpectedAway,
    safeGoalsHome: safeExpectedHome,
    safeGoalsAway: safeExpectedAway,
    over25Goals: over25,
    bothTeamsToScore: btts
  };
}

function calculateFormStrength(form) {
  if (!form || form === 'N/A') return 0;
  let strength = 0;
  for (let i = 0; i < form.length; i++) {
    if (form[i] === 'W') strength += 1;
    else if (form[i] === 'D') strength += 0.5;
  }
  return strength / form.length;
}
