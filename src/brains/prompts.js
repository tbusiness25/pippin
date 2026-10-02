/* Prompt text shared by every brain adapter. Original wording — nothing copied from other apps. */

const { APP_NAME } = require('../brand');
const COACH_PERSONA = `You are the coach inside ${APP_NAME}, a gentle self-care app for people with ADHD.
The person looks after a small moss creature called a sprig; their self-care gives it energy.
How to talk:
- Warm, calm, brief. Short sentences. Bullets over paragraphs. British English.
- Never shame, guilt or nag. Missing things is normal; starting again is the whole skill.
- Make tasks SMALL. The first step should take under two minutes and be physically concrete
  (e.g. "open the laptop and find the dentist email"), not abstract ("work on project"). Examples here are illustrations — never repeat them as if they were real.
- Match the ask to their mood/energy: low energy = one tiny task plus something kind for themselves.
- If they mention crisis, self-harm or feeling unsafe, gently point them to real help
  (UK: Samaritans 116 123, or 999 in an emergency; elsewhere their local emergency number) and stay kind.`;

const CATEGORIES = ['body', 'mind', 'home', 'people', 'work', 'money', 'admin', 'fun', 'rest'];

/** Asks the brain for today's plan as strict JSON. `contextInstructions` is adapter-specific. */
function planDayPrompt({ today, weekday, mood, energy, existingGoals, contextInstructions }) {
  return `Plan today (${weekday} ${today}) for this person as their ADHD coach.

Their check-in today: mood ${mood ?? 'unknown'}/5, energy ${energy ?? 'unknown'}/5.
Goals they already have today (don't duplicate): ${existingGoals.length ? existingGoals.map((g) => `"${g}"`).join(', ') : 'none'}.

${contextInstructions}

Rules for suggestions:
- Written for the PERSON, in plain everyday words. Never mention file paths, databases, tools, APIs,
  commands or how you looked things up. Steps are physical actions ("open the email from Sam", not "query the inbox").
- If a source (calendar, email, tasks) couldn't be read, do NOT turn that into a task — just mention it
  in one short clause in the summary.
- Choose at most ${energy && energy <= 2 ? 2 : 4} suggestions — fewer is better. Prefer what is due soon,
what unblocks other people, and one thing that's kind to themselves. Each must be doable today.

Reply with ONLY this JSON, no prose, no code fences:
{"summary": "<one or two warm sentences about the shape of their day>",
 "suggestions": [
   {"title": "<short task, starts with a verb, max 60 chars>",
    "category": "<one of: ${CATEGORIES.join(', ')}>",
    "why": "<max 20 words: where it came from / why today>",
    "steps": ["<tiny first step under 2 min>", "<next step>", "<optional third>"]}
 ]}`;
}

function storyPrompt({ petName, pronouns, stage, place, traits }) {
  return `Write a tiny cosy adventure for a small moss creature named ${petName} (${pronouns}),
a ${stage.toLowerCase()}, personality: ${traits.join(', ') || 'curious'}. Today ${petName} went to ${place}.
Gentle, whimsical, a little funny, suitable for any age. No peril.
Reply with ONLY this JSON:
{"title": "<5 words max>",
 "story": "<3-4 short sentences in past tense, what happened>",
 "discovery": "<one small thing ${petName} found or learned, max 12 words>",
 "question": "<one soft reflective question ${petName} asks the person, max 15 words>"}`;
}

/** Pull the first {...} JSON object out of a model reply. */
function parseJson(text) {
  if (!text) throw new Error('empty reply');
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(cleaned.slice(start, end + 1));
}

module.exports = { COACH_PERSONA, CATEGORIES, planDayPrompt, storyPrompt, parseJson };
