// Mark a goal done for today. Energy and rewards only the first time it's completed that day.
const { pool } = require('./db');
const game = require('./game');
const rewards = require('./rewards');

async function completeGoal(uid, goalId, day) {
  const { rows } = await pool.query(
    `INSERT INTO goal_completions(goal_id, user_id, day) VALUES ($1,$2,$3)
     ON CONFLICT (goal_id, day) DO UPDATE SET undone=false RETURNING (xmax = 0) AS inserted`,
    [goalId, uid, day]);
  const first = rows[0].inserted;
  const energy = first ? await game.addEnergy(uid, game.ENERGY.goal, 'goal') : null;
  const messages = first ? await rewards.onGoalCompleted(uid, goalId, day) : [];
  return { first, energy, messages };
}

module.exports = { completeGoal };
