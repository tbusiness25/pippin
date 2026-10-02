/*
 * Hermes brain: a Nous Research Hermes Agent reached through its OpenAI-compatible API server
 * (API_SERVER_ENABLED=true; default port 8642 inside the container). Hermes is a full agent with
 * its own tools, so it can read the person's calendar, email and task board itself — Pippin just
 * asks, and never sees credentials.
 *
 * Every request is a fresh agent run (~15 s+ because of Hermes' own system prompt), so planning
 * runs in the background and the UI polls.
 */
const { APP_NAME } = require('../brand');
const { COACH_PERSONA, planDayPrompt, parseJson } = require('./prompts');
const { openaiClient } = require('./openai');

const HERMES_CONTEXT = `Use your own tools to look (read-only — do NOT create, send, move or change anything):
1. Today's calendar: what's on, and gaps where a task could fit.
2. Email from the last 48 h that needs THIS person to act (reply, pay, book, sign). Skip newsletters.
3. Their open task board / kanban cards and anything overdue.
Name sources briefly in "why" (e.g. "Email from the school, due Fri"). Don't quote email text,
and keep other people's details out of the reply — first names or initials only.
NEVER INVENT: only suggest a task from calendar/email/tasks if you actually read that item with a tool
in THIS run. If a lookup failed or you didn't do it, say so in the summary and base the plan on the
check-in and goals instead. A made-up email is far worse than a short plan.
If a lookup errors, report it — do NOT install, chmod, repair or reconfigure anything to make it work.`;

function createHermesBrain(env, fallbackStory) {
  const complete = openaiClient({
    baseUrl: env.HERMES_API_URL,
    apiKey: env.HERMES_API_KEY,
    model: env.HERMES_MODEL || 'hermes-agent',
    timeoutMs: parseInt(env.HERMES_TIMEOUT_MS || '300000', 10),
  });
  return {
    name: 'hermes',
    label: 'Hermes',
    capabilities: { calendar: true, email: true, tasks: true },
    complete,
    async chat(history) {
      // Hermes has its own persona/memory; this frames the conversation as happening inside Pippin.
      return complete([
        { role: 'system', content: `${COACH_PERSONA}\n\nThis chat is happening inside the ${APP_NAME} app. You still have all your usual tools and memory.` },
        ...history,
      ]);
    },
    // Two steps: an agent run that GATHERS (tools, plain-text report), then a plan from that report.
    // Asking for JSON-only in one go makes the agent skip its tools and guess.
    async planDay(ctx) {
      const hint = env.HERMES_CONTEXT_HINT ? `\n${env.HERMES_CONTEXT_HINT}` : '';
      const report = await complete([{ role: 'user', content:
        `Today is ${ctx.weekday} ${ctx.today}. Gather context for this person's day plan — do NOT plan yet.
${HERMES_CONTEXT}${hint}
Run the lookups now with your tools, then reply with a plain bullet report under three headings:
CALENDAR (today's events + times), EMAIL (each item needing action: who (first name/org), what, deadline),
TASKS (open or overdue items). Under any heading whose lookup failed, write "LOOKUP FAILED: <why>".
Write "none" if a lookup worked and found nothing.` }]);
      const prompt = planDayPrompt({ ...ctx, contextInstructions:
        `Here is what their assistant found just now (the only source of facts — never add items not in it):\n${report}` });
      return parseJson(await complete([{ role: 'user', content: prompt }], { json: true }));
    },
    // Stories don't need an agent with tools — use the light story model when one is configured.
    story: fallbackStory,
  };
}

module.exports = { createHermesBrain };
