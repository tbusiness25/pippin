/*
 * Everything collectable. Items are drawn client-side (public/js/sprig.js, public/js/home.js) by id.
 * Acorns and event tokens are cosmetic-only currency: nothing here unlocks a self-care tool.
 */

// type: hat | neck | face | colour | furniture   slot (furniture): wall | window | floorL | floorR | rug | ceiling
const ITEMS = [
  // hats
  { id: 'hat-beanie', type: 'hat', name: 'Cosy beanie', price: 20 },
  { id: 'hat-acorn', type: 'hat', name: 'Acorn cap', price: 25 },
  { id: 'hat-flower', type: 'hat', name: 'Daisy crown', price: 30 },
  { id: 'hat-wizard', type: 'hat', name: 'Wizard hat', price: 45 },
  { id: 'hat-bow', type: 'hat', name: 'Big bow', price: 20 },
  { id: 'hat-cap', type: 'hat', name: 'Baseball cap', price: 25 },
  // neck
  { id: 'neck-scarf', type: 'neck', name: 'Stripy scarf', price: 20 },
  { id: 'neck-bandana', type: 'neck', name: 'Bandana', price: 15 },
  { id: 'neck-bowtie', type: 'neck', name: 'Bow tie', price: 20 },
  // face
  { id: 'face-glasses', type: 'face', name: 'Round glasses', price: 25 },
  { id: 'face-shades', type: 'face', name: 'Sunglasses', price: 30 },
  { id: 'face-blush', type: 'face', name: 'Extra blush', price: 10 },
  // colours (re-colour your sprig; the hatch colours are free)
  { id: 'colour-mint', type: 'colour', name: 'Mint', price: 40, colour: 'mint' },
  { id: 'colour-slate', type: 'colour', name: 'Slate', price: 40, colour: 'slate' },
  { id: 'colour-coral', type: 'colour', name: 'Coral', price: 40, colour: 'coral' },
  { id: 'colour-night', type: 'colour', name: 'Midnight', price: 60, colour: 'night' },
  { id: 'colour-cream', type: 'colour', name: 'Oat milk', price: 40, colour: 'cream' },
  // furniture
  { id: 'rug-round', type: 'furniture', slot: 'rug', name: 'Round rug', price: 20 },
  { id: 'rug-stripe', type: 'furniture', slot: 'rug', name: 'Stripy rug', price: 25 },
  { id: 'plant-monstera', type: 'furniture', slot: 'floorL', name: 'Big leafy plant', price: 30 },
  { id: 'lamp-floor', type: 'furniture', slot: 'floorL', name: 'Floor lamp', price: 30 },
  { id: 'shelf-books', type: 'furniture', slot: 'floorR', name: 'Bookshelf', price: 40 },
  { id: 'chair-bean', type: 'furniture', slot: 'floorR', name: 'Beanbag', price: 35 },
  { id: 'art-sun', type: 'furniture', slot: 'wall', name: 'Sunny painting', price: 25 },
  { id: 'art-map', type: 'furniture', slot: 'wall', name: 'Adventure map', price: 35 },
  { id: 'window-round', type: 'furniture', slot: 'window', name: 'Round window', price: 30 },
  { id: 'lights-fairy', type: 'furniture', slot: 'ceiling', name: 'Fairy lights', price: 30 },
  { id: 'mobile-stars', type: 'furniture', slot: 'ceiling', name: 'Star mobile', price: 25 },
  // event items (bought with event tokens, only during the event)
  { id: 'event-harvest-scarf', type: 'neck', name: 'Harvest scarf', price: 8, event: 'harvest' },
  { id: 'event-harvest-pumpkin', type: 'furniture', slot: 'floorR', name: 'Little pumpkin', price: 10, event: 'harvest' },
  { id: 'event-lights-hat', type: 'hat', name: 'Woolly bobble hat', price: 8, event: 'lights' },
  { id: 'event-lights-lantern', type: 'furniture', slot: 'floorL', name: 'Paper lantern', price: 10, event: 'lights' },
  { id: 'event-bloom-crown', type: 'hat', name: 'Blossom crown', price: 8, event: 'bloom' },
  { id: 'event-bloom-pots', type: 'furniture', slot: 'floorR', name: 'Seedling pots', price: 10, event: 'bloom' },
  { id: 'event-picnic-hat', type: 'hat', name: 'Sun hat', price: 8, event: 'picnic' },
  { id: 'event-picnic-rug', type: 'furniture', slot: 'rug', name: 'Picnic blanket', price: 10, event: 'picnic' },
];

// Tiny companions that follow your sprig around. Earned, never bought.
const COMPANIONS = [
  { id: 'snail', name: 'Shelly the snail', how: 'Finish any journey' },
  { id: 'ladybird', name: 'Dot the ladybird', how: 'Reach a 7-day category milestone' },
  { id: 'frog', name: 'Puddle the frog', how: 'Send 10 kind words' },
  { id: 'firefly', name: 'Glim the firefly', how: 'Complete 10 focus sessions' },
  { id: 'mushroom', name: 'Button the mushroom', how: 'Write 10 reflections' },
  { id: 'pebble', name: 'Stone-cold Steve (a pebble)', how: 'Your sprig’s 20th adventure' },
  { id: 'hedgehog', name: 'Bramble the hedgehog', how: 'Harvest event' },
  { id: 'robin', name: 'Pip the robin', how: 'Winter Lights event' },
  { id: 'bee', name: 'Hum the bee', how: 'Spring Bloom event' },
  { id: 'butterfly', name: 'Flit the butterfly', how: 'Summer Picnic event' },
];

// Seasonal events (month-day ranges, inclusive). Every goal done during an event earns a token.
const EVENTS = [
  { id: 'harvest', name: 'Harvest Festival', token: 'golden leaves', emoji: '🍂', from: '09-15', to: '11-15', companion: 'hedgehog', companionAt: 30 },
  { id: 'lights', name: 'Winter Lights', token: 'snowflakes', emoji: '❄️', from: '12-01', to: '01-10', companion: 'robin', companionAt: 30 },
  { id: 'bloom', name: 'Spring Bloom', token: 'petals', emoji: '🌸', from: '03-15', to: '05-01', companion: 'bee', companionAt: 30 },
  { id: 'picnic', name: 'Summer Picnic', token: 'strawberries', emoji: '🍓', from: '07-01', to: '08-31', companion: 'butterfly', companionAt: 30 },
];

function activeEvent(day) {                     // day = 'YYYY-MM-DD'
  const md = day.slice(5);
  return EVENTS.find((e) => (e.from <= e.to ? md >= e.from && md <= e.to : md >= e.from || md <= e.to)) || null;
}

const item = (id) => ITEMS.find((i) => i.id === id);

module.exports = { ITEMS, COMPANIONS, EVENTS, activeEvent, item };
