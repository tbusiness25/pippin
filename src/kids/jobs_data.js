/*
 * Content for "My jobs" (a child's responsibilities), the weekly plan's activity bank, and the growing-up guide.
 * Written for children starting around age seven; parents edit the jobs in the Family panel and the rules live in settings.
 */

// slot: morning | after_school | bedtime | weekly · days: daily | school (Mon–Fri) | weekend (Sat–Sun) · timer: seconds
const DEFAULT_JOBS = [
  { slot: 'morning', days: 'daily', icon: '🧦', title: 'Get dressed', detail: 'Pants, top, socks and shoes on by yourself. Tomorrow’s clothes go on the chair at night.', sort: 10 },
  { slot: 'morning', days: 'daily', icon: '🥣', title: 'Make your own breakfast', detail: 'Cereal or toast. Get the bowl, spoon and milk out yourself.', sort: 20 },
  { slot: 'morning', days: 'daily', icon: '🍽️', title: 'Bowl and spoon to the sink', detail: 'Straight after you eat, before anything else.', sort: 30 },
  { slot: 'morning', days: 'daily', icon: '🫧', title: 'Wash up your bowl', detail: 'Hot water, soap, rinse, back on the drying rack.', sort: 35 },
  { slot: 'morning', days: 'daily', icon: '🚿', title: 'Have a shower or a proper wash', detail: 'Soap, then rinse, then dry off properly.', sort: 40 },
  { slot: 'morning', days: 'daily', icon: '🪥', title: 'Brush your teeth for 2 minutes', detail: 'Top, bottom, front, back, tongue. Turn the timer on so it really is two minutes.', timer: 120, sort: 50 },
  { slot: 'morning', days: 'daily', icon: '💧', title: 'Water bottle filled and in your bag', detail: 'Fill it, screw the lid on tight, check it’s zipped in.', sort: 60 },
  { slot: 'morning', days: 'school', icon: '🎒', title: 'School bag packed', detail: 'Reading book and record, PE kit on PE days. Check the letter or the board.', sort: 70 },
  { slot: 'after_school', days: 'school', icon: '🎒', title: 'School bag and shoes put away', detail: 'Bag on its hook, shoes on the rack, not on the stairs.', sort: 10 },
  { slot: 'after_school', days: 'daily', icon: '🧥', title: 'Coat on its hook', detail: 'As soon as you come in.', sort: 20 },
  { slot: 'after_school', days: 'daily', icon: '💧', title: 'Water bottle back in the kitchen', detail: 'Empty it, rinse it, put it on the side.', sort: 30 },
  { slot: 'after_school', days: 'daily', icon: '🎸', title: 'Instrument back in its case', detail: 'After you practise: case closed, zipped, on its stand.', sort: 40 },
  { slot: 'after_school', days: 'daily', icon: '🏊', title: 'Swim bag ready', detail: 'On swimming days: costume, towel, goggles, hat, and check it’s in the bag.', sort: 50 },
  { slot: 'bedtime', days: 'daily', icon: '🚽', title: 'Flush, and wash your hands', detail: 'Every single time. Check it’s flushed.', sort: 10 },
  { slot: 'bedtime', days: 'daily', icon: '🪥', title: 'Brush your teeth for 2 minutes', detail: 'Same as the morning. Timer on.', timer: 120, sort: 20 },
  { slot: 'bedtime', days: 'daily', icon: '🛏️', title: 'Tomorrow sorted', detail: 'Clothes on the chair, bag by the door.', sort: 30 },
  { slot: 'weekly', days: 'weekend', icon: '🧸', title: 'Tidy your room', detail: 'Things back in their boxes, bed made, floor clear enough to walk on.', sort: 10 },
  { slot: 'weekly', days: 'weekend', icon: '🧺', title: 'Dirty clothes in the basket', detail: 'Every day. Saturday is the check.', sort: 20 },
  { slot: 'weekly', days: 'weekend', icon: '📚', title: 'Library book back on the shelf', detail: 'Or in the bag if it’s due back.', sort: 30 },
];

const CATEGORIES = ['Arts & crafts', 'Sport', 'Construction', 'Reading', 'Maths', 'Gaming', 'Music', 'Outside'];
const ICON = { 'Arts & crafts': '🎨', Sport: '⚽', Construction: '🧱', Reading: '📖', Maths: '➗', Gaming: '🎮', Music: '🎸', Outside: '🌳' };

const BANK = {
  'Arts & crafts': ['Make a comic strip about your day', 'Paint a picture using a colour you’ve never used', 'Make a card for someone', 'Playdough creature with at least 3 legs', 'Cut and stick a collage from old magazines', 'Draw a dinosaur from your imagination'],
  Sport: ['Kick a ball in the garden for 15 minutes', 'Bike ride round the block', 'Skipping: beat your count from yesterday', '10 keepy-uppies, then 11', 'Swimming practice (length by length)', 'Star jump challenge: 30 in a row'],
  Construction: ['Build a Lego tower and test how tall it gets', 'Build a bridge from cardboard that holds a small car', 'Lego model from the instructions, all by yourself', 'Build a den with blankets and cushions', 'Make a marble run from tubes and tape'],
  Reading: ['Read for 15 minutes on your own', 'Read to someone in the family', 'Read a non-fiction page about dinosaurs', 'Listen to a Yoto story and draw the best bit', 'Write three sentences about your day'],
  Maths: ['10 minutes of times tables', 'Count the coins in your money pot', 'Play shop: set prices and give change', 'Maths app: beat yesterday’s score', 'Cooking: weigh and measure one ingredient'],
  Gaming: ['30 minutes of your game, then a stop', 'Co-op game with someone in the family', 'A puzzle game', 'Build something in Minecraft', 'Your pick: set the timer before you start'],
  Music: ['Instrument practice: 10 minutes', 'Sing and dance to a song you like', 'Make up a tune on an instrument'],
  Outside: ['Bug hunt in the garden', 'Draw the sky, and what the clouds look like', 'Go for a walk and find 5 different leaves'],
};

const GUIDE = [
  { h: 'What we want for you', p: 'We want you to grow up able to look after yourself: to get up, get ready, eat, keep your things together, look after your body and your home, and make your own choices well. Lots of grown-ups find this hard. That’s not because they’re bad at it — it’s because nobody taught them when they were small.' },
  { h: 'The earlier you start, the easier it gets', p: 'Doing something every day for a few weeks makes it automatic, like brushing your teeth. Right now, you’re learning the habits. When you’re older, you won’t need to think about them at all. That’s the point: it frees your brain up for the things you love.' },
  { h: 'Jobs are part of being in a family', p: 'You’re not doing jobs to earn something or to get in trouble. Everyone in a home does their part, and a home runs better when everyone does. Grown-ups have jobs too, every single day.' },
  { h: 'Nobody remembers everything — checklists do', p: 'Even grown-ups forget things. That’s why they use lists and routines. Your list in this app does the remembering so your brain can get on with the fun stuff. If you miss one, that’s fine: tick it when you remember.' },
  { h: 'Mistakes are how it sticks', p: 'If you forget something, we’ll remind you — kindly — and you try again. Nobody gets it right the first time. Getting better each week is the goal.' },
  { h: 'Plan the fun, so you don’t wander', p: 'Lots of choices can feel like too many to choose from. Before school, pick one thing for after school in your plan. On the weekend, plan a morning and an afternoon idea. A plan means you never have to wonder what to do.' },
  { h: 'Taking care of your body', p: 'Two minutes of brushing, every morning and every night, keeps your teeth strong. Showering, clean clothes, water in your bottle, and enough sleep help your brain think clearly too.' },
];

const GUIDE_PARENTS = [
  'Independence is a skill built from small, repeated, expected tasks, with a little less help each month. Starting early is the easiest time; by the teens it’s much harder to build.',
  'Make jobs expected, not negotiable, and not paid. Expected jobs teach responsibility; payment for them teaches a transaction. Rewards for extras can exist separately.',
  'Shift from doing → prompting → checking → simply trusting. Reduce reminders on purpose, and let natural consequences (a missed bus, the wrong PE kit) carry the lesson with warmth.',
  'Pick the same few routines and keep them boring. Consistency beats cleverness. Use the list, not your voice, as the reminder where you can.',
  'Give the “why” in one sentence, and let them try things that are a little hard. Praise effort and strategy (“you checked the bag twice”), not talent.',
  'For executive-function difficulty (ADHD-style): fewer, clearer choices; visible timers; a plan made in advance so the after-school moment isn’t a blank; and rests after effort. Ask them how it went rather than telling them.',
  'Review once a month: what’s going well, what to add, what can come off. Retire jobs they’ve mastered and add the next one. A good target by 10–11: packing their own bag, making a simple meal, handling their own timings.',
];

module.exports = { DEFAULT_JOBS, CATEGORIES, ICON, BANK, GUIDE, GUIDE_PARENTS };
