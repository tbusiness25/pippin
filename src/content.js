/*
 * Self-care content: all original writing, except the PHQ-9 / GAD-7 / WHO-5 questionnaires, which are
 * published for free use (PHQ-9 & GAD-7: Pfizer, no permission required; WHO-5: WHO, free with attribution).
 */

const BREATHING = [
  { id: 'box', name: 'Box breathing', about: 'Steady and even. Good before something stressful.', pattern: [['in', 4], ['hold', 4], ['out', 4], ['hold', 4]] },
  { id: 'calm', name: 'Long out-breath', about: 'Breathing out longer than in tells your body it’s safe.', pattern: [['in', 4], ['out', 6]] },
  { id: '478', name: '4-7-8', about: 'A slow, sleepy rhythm for winding down.', pattern: [['in', 4], ['hold', 7], ['out', 8]] },
  { id: 'sigh', name: 'Double sigh', about: 'Two quick breaths in, one long sigh out. Fast reset.', pattern: [['in', 2], ['in', 1], ['out', 6]] },
  { id: 'coherent', name: 'Even flow', about: 'Five and a half in, five and a half out. Very balancing.', pattern: [['in', 5.5], ['out', 5.5]] },
  { id: 'triangle', name: 'Triangle', about: 'In, hold, out — simple to remember.', pattern: [['in', 4], ['hold', 4], ['out', 4]] },
  { id: 'energise', name: 'Wake-up breath', about: 'Short and brisk, for a foggy afternoon.', pattern: [['in', 2], ['out', 2]] },
];

const STRETCHES = [
  { id: 'desk', name: 'Desk reset', about: 'Undo two hours of hunching.', steps: [
    ['Shoulder rolls', 'Roll your shoulders slowly backwards, big circles.', 30],
    ['Neck side', 'Tip your right ear towards your right shoulder. Breathe. Swap halfway.', 40],
    ['Chest opener', 'Clasp hands behind your back and gently lift, chest forward.', 30],
    ['Seated twist', 'Sit tall, turn to the right using the chair back. Swap halfway.', 40],
    ['Wrist circles', 'Circle both wrists one way, then the other.', 20],
  ] },
  { id: 'morning', name: 'Morning wake-up', about: 'Gentle, before the day grabs you.', steps: [
    ['Big reach', 'Stand and reach both arms up high. Get tall.', 20],
    ['Side bends', 'Reach over to one side, then the other.', 30],
    ['Forward fold', 'Soft knees, let your top half hang. Sway a little.', 30],
    ['Calf raises', 'Up on your toes, down again. Slowly.', 30],
    ['Shake out', 'Shake your hands, arms, legs. Be silly.', 20],
  ] },
  { id: 'wind', name: 'Wind-down', about: 'Slow stretches for the end of the day.', steps: [
    ['Child’s pose', 'Kneel, sit back on your heels, arms long in front.', 45],
    ['Knee hug', 'Lying down, hug both knees to your chest.', 40],
    ['Lying twist', 'Knees to one side, arms out wide. Swap halfway.', 60],
    ['Legs up', 'Legs up the wall or on a chair. Just breathe.', 60],
  ] },
];

const REFLECTION_PROMPTS = [
  { tag: 'gratitude', text: 'What’s one small thing that went okay today?' },
  { tag: 'gratitude', text: 'Who made your day a bit easier recently?' },
  { tag: 'gratitude', text: 'What’s something you own that you’re glad you have?' },
  { tag: 'feelings', text: 'What’s taking up the most room in your head right now?' },
  { tag: 'feelings', text: 'If today’s mood were weather, what would it be — and why?' },
  { tag: 'feelings', text: 'What would you say to a friend who felt the way you do today?' },
  { tag: 'feelings', text: 'What’s one thing you’re worried about, and what’s one thing you can actually control about it?' },
  { tag: 'adhd', text: 'What did your brain do brilliantly today, even if it was the “wrong” thing?' },
  { tag: 'adhd', text: 'What task have you been avoiding? What’s the scariest part of it?' },
  { tag: 'adhd', text: 'When did you feel most focused recently? What was different?' },
  { tag: 'adhd', text: 'What’s one thing you could make 10% easier for tomorrow-you?' },
  { tag: 'adhd', text: 'What would “good enough” look like for the thing you’re perfecting?' },
  { tag: 'self', text: 'What do you need more of this week? Less of?' },
  { tag: 'self', text: 'What’s a boundary you kept — or wish you had?' },
  { tag: 'self', text: 'What’s something you’ve got better at this year?' },
  { tag: 'self', text: 'When did you last feel properly rested? What helped?' },
  { tag: 'people', text: 'Who would you like to see more of? What’s one tiny step toward that?' },
  { tag: 'people', text: 'Was there a conversation today you keep replaying? What would you add?' },
  { tag: 'future', text: 'What’s one thing you’re looking forward to, however small?' },
  { tag: 'future', text: 'Imagine next Sunday evening feeling calm. What happened this week to make that true?' },
];

// Daily "this or that" — no right answers, just a moment of fun.
const DAILY_QUESTIONS = [
  ['Sunrise', 'Sunset'], ['Tea', 'Coffee'], ['Beach', 'Forest'], ['Books', 'Films'], ['Cats', 'Dogs'],
  ['Rain on the window', 'Crisp frosty morning'], ['Pizza', 'Curry'], ['Early bird', 'Night owl'],
  ['Board games', 'Video games'], ['Mountains', 'Lakes'], ['Sweet', 'Savoury'], ['Hot bath', 'Hot shower'],
  ['Road trip', 'Train journey'], ['Plan everything', 'Wing it'], ['Big party', 'Small dinner'],
  ['Paint', 'Write'], ['Autumn', 'Spring'], ['Soup', 'Salad'], ['Museum', 'Theme park'], ['Cosy socks', 'Barefoot'],
  ['Podcasts', 'Music'], ['Stargazing', 'Cloud-watching'], ['Toast', 'Cereal'], ['Swimming', 'Cycling'],
  ['Comedy', 'Thriller'], ['Candles', 'Fairy lights'], ['Picnic', 'Pub lunch'], ['Snow', 'Sun'],
  ['Handwritten letter', 'Voice note'], ['Crisps', 'Chocolate'],
];

const QUIZZES = {
  phq9: {
    name: 'Mood check (PHQ-9)',
    about: 'A widely used questionnaire about low mood over the last two weeks. It’s a check-in, not a diagnosis.',
    intro: 'Over the last 2 weeks, how often have you been bothered by…',
    options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
    questions: [
      'Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless',
      'Trouble falling or staying asleep, or sleeping too much', 'Feeling tired or having little energy',
      'Poor appetite or overeating', 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
      'Trouble concentrating on things, such as reading the newspaper or watching television',
      'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
      'Thoughts that you would be better off dead or of hurting yourself in some way',
    ],
    bands: [[0, 'minimal'], [5, 'mild'], [10, 'moderate'], [15, 'moderately severe'], [20, 'severe']],
    safetyItem: 8,
  },
  gad7: {
    name: 'Worry check (GAD-7)',
    about: 'A widely used questionnaire about anxiety over the last two weeks. It’s a check-in, not a diagnosis.',
    intro: 'Over the last 2 weeks, how often have you been bothered by…',
    options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
    questions: [
      'Feeling nervous, anxious, or on edge', 'Not being able to stop or control worrying',
      'Worrying too much about different things', 'Trouble relaxing', 'Being so restless that it is hard to sit still',
      'Becoming easily annoyed or irritable', 'Feeling afraid, as if something awful might happen',
    ],
    bands: [[0, 'minimal'], [5, 'mild'], [10, 'moderate'], [15, 'severe']],
  },
  who5: {
    name: 'Wellbeing check (WHO-5)',
    about: 'Five questions about how you’ve been doing in the last two weeks. Higher is better.',
    intro: 'Over the last 2 weeks…',
    options: ['At no time', 'Some of the time', 'Less than half the time', 'More than half the time', 'Most of the time', 'All of the time'],
    questions: [
      'I have felt cheerful and in good spirits', 'I have felt calm and relaxed', 'I have felt active and vigorous',
      'I woke up feeling fresh and rested', 'My daily life has been filled with things that interest me',
    ],
    bands: [[0, 'low — worth talking to someone'], [13, 'okay'], [18, 'good']],
    higherIsBetter: true,
  },
};

// Journeys: a short run of days, one small task per day.
const JOURNEYS = [
  { id: 'mornings', name: 'Gentler mornings', emoji: '🌅', about: 'Five small changes that make mornings less of a scramble.', days: [
    ['Put tomorrow’s clothes out tonight', 'home'], ['Drink water before your phone', 'body'], ['Take meds with breakfast', 'body'],
    ['Write your one thing for today on a sticky note', 'mind'], ['Leave 5 minutes earlier than usual', 'rest'] ] },
  { id: 'inbox', name: 'Inbox calm', emoji: '📬', about: 'Make email less scary, a few minutes at a time.', days: [
    ['Unsubscribe from 3 newsletters', 'admin'], ['Reply to the oldest email you’re avoiding', 'work'],
    ['Archive everything older than 30 days (it’s still searchable)', 'admin'], ['Set up one filter', 'admin'],
    ['Do a 10-minute email session with a timer', 'work'] ] },
  { id: 'sleep', name: 'Sleep wind-down', emoji: '🌙', about: 'A week of gentle evening habits.', days: [
    ['Pick a “screens down” time and set an alarm for it', 'rest'], ['Do the wind-down stretch', 'body'],
    ['Charge your phone outside the bedroom', 'rest'], ['Write tomorrow’s worries on paper, then close the book', 'mind'],
    ['Dim the lights an hour before bed', 'rest'], ['Try the 4-7-8 breathing in bed', 'mind'], ['Notice how you slept this week', 'mind'] ] },
  { id: 'tidy', name: 'Tiny tidy', emoji: '🧺', about: 'One small space a day. No marathons.', days: [
    ['Clear the kitchen worktop', 'home'], ['Empty one bag you keep carrying', 'home'], ['Tidy your bedside table', 'home'],
    ['Put away one pile of clothes', 'home'], ['Five-minute whole-room reset with music', 'home'] ] },
  { id: 'people', name: 'Reconnect', emoji: '💛', about: 'Small ways back to the people you like.', days: [
    ['Send a meme to a friend', 'people'], ['Reply to a message you’ve left too long', 'people'],
    ['Ask someone how they really are', 'people'], ['Put a catch-up in the calendar', 'people'], ['Thank someone properly', 'people'] ] },
];

// Kind words to send friends. The first one each day gives the sender a little boost.
const KINDNESSES = [
  { id: 'proud', emoji: '🌟', text: 'I’m proud of you' }, { id: 'thinking', emoji: '💭', text: 'Thinking of you' },
  { id: 'rest', emoji: '🛋️', text: 'You deserve a rest' }, { id: 'water', emoji: '💧', text: 'Drink some water!' },
  { id: 'gotthis', emoji: '💪', text: 'You’ve got this' }, { id: 'hug', emoji: '🤗', text: 'Sending a hug' },
  { id: 'gentle', emoji: '🌿', text: 'Be gentle with yourself today' }, { id: 'sun', emoji: '☀️', text: 'Hope today is a good one' },
  { id: 'enough', emoji: '💛', text: 'You are enough' }, { id: 'breathe', emoji: '🫧', text: 'Remember to breathe' },
  { id: 'laugh', emoji: '😄', text: 'This made me think of you — hope you smile' }, { id: 'night', emoji: '🌙', text: 'Sleep well' },
];

module.exports = { BREATHING, STRETCHES, REFLECTION_PROMPTS, DAILY_QUESTIONS, QUIZZES, JOURNEYS, KINDNESSES };
