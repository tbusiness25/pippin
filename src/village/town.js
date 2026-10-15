/*
 * The village's townsfolk and the little bits of real information they share. Everything here is either
 * computed (days, sleeps until the weekend), read from the household's own sprig (acorns), fetched without a key
 * (Open-Meteo weather for BRIEF_LAT/BRIEF_LON, cached 20 min), or a curated fact/joke. Nothing else leaves the house.
 */
const FARE = 5;                         // acorns for the bus into town (the way home is free)
const LAT = Number(process.env.BRIEF_LAT) || 51.5072, LON = Number(process.env.BRIEF_LON) || -0.1276;

const CHARACTERS = {
  barnaby: { name: 'Barnaby', job: 'Weatherman', emoji: '🌦️' },
  mabel:   { name: 'Mabel', job: 'Newsagent', emoji: '🗞️' },
  fig:     { name: 'Professor Fig', job: 'Museum keeper', emoji: '🦉' },
  gus:     { name: 'Gus', job: 'Baker', emoji: '🥐' },
  pip:     { name: 'Pip', job: 'Bus driver', emoji: '🚌' },
};

const FACTS = [
  'Octopuses have three hearts, and the blue ones have copper in their blood.',
  'A group of flamingos is called a flamboyance.',
  'Honey never goes off. Archaeologists have found pots of it that are thousands of years old.',
  'Sharks are older than trees. Sharks have been around for about 400 million years.',
  'Your nose can remember about 50,000 different smells.',
  'Bananas are berries, but strawberries are not.',
  'A day on Venus is longer than a year on Venus.',
  'Snails can sleep for three years if the weather is bad.',
  'Wombat poo is cube-shaped, so it does not roll away.',
  'The Eiffel Tower grows about 15 cm taller in summer, because the metal expands in the heat.',
  'Penguins propose to their partners with a pebble.',
  'Your heart beats about 100,000 times a day.',
  'Koalas have fingerprints that look a lot like human ones.',
  'Lightning is five times hotter than the surface of the sun.',
];
const JOKES = [
  'Why did the bread go to the gym? To get a bit more dough-ble!',
  'What do you call a sleeping bull? A bulldozer.',
  'Why don’t eggs tell jokes? They’d crack each other up.',
  'What do you call a fake noodle? An impasta.',
  'Why was the cookie sad? Its mum was a wafer so long.',
];
const BACK_PAGE = [
  'The big story this week: someone spotted a hedgehog on the bus. Pip says it had a ticket.',
  'Local news: the duck pond is officially the best pond in town. The ducks have been told.',
  'Tonight’s telly: a documentary about how bread rises. It rises slowly, and it is very moving.',
];

const WMO = (c) => (c === 0 ? 'clear and sunny' : c <= 3 ? 'a bit cloudy' : c <= 48 ? 'foggy' : c <= 57 ? 'drizzly'
  : c <= 67 ? 'rainy' : c <= 77 ? 'snowy' : c <= 82 ? 'showery' : 'thundery');

let wx = { at: 0, data: null };
async function weather() {
  if (wx.data && Date.now() - wx.at < 20 * 60e3) return wx.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code`
    + '&hourly=precipitation_probability&forecast_hours=12&timezone=Europe%2FLondon';
  const j = await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  wx = { at: Date.now(), data: {
    tempC: Math.round(j.current.temperature_2m), sky: WMO(j.current.weather_code),
    rainChance: Math.max(0, ...(j.hourly?.precipitation_probability || [0])),
  } };
  return wx.data;
}

const londonDay = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/London' });
const londonDow = (d = new Date()) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).format(d));
const dayIndex = () => Math.floor(Date.now() / 864e5);

/** Lines a townsperson says. `acorns` is the sprig's balance, or null if there's no sprig yet. */
async function talk(npc, { acorns }) {
  const c = CHARACTERS[npc];
  if (npc === 'barnaby') {
    const w = await weather().catch(() => null);
    if (!w) return ['My barometer has gone all shy today. Ask me again in a bit!'];
    return [
      'Morning! Barnaby here, your very own weatherman.',
      `It’s ${w.tempC}°C and ${w.sky} out there.`,
      w.rainChance >= 40 ? `Take a brolly: about a ${w.rainChance}% chance of rain in the next 12 hours.`
        : `No brolly needed. Only a ${w.rainChance}% chance of rain in the next 12 hours.`,
      'Forecast by Barnaby. Accuracy not guaranteed, but the biscuits are.',
    ];
  }
  if (npc === 'mabel') {
    const dow = londonDow();
    const weekend = dow === 0 || dow === 6;
    const sleeps = weekend ? 0 : 6 - dow;
    return [
      `Welcome to Mabel’s! It’s ${londonDay()} today.`,
      sleeps === 0 ? 'It’s the weekend, so the papers are extra fat!' : `${sleeps} ${sleeps === 1 ? 'sleep' : 'sleeps'} until the weekend.`,
      `From the back page: ${BACK_PAGE[dayIndex() % BACK_PAGE.length]}`,
    ];
  }
  if (npc === 'fig') {
    return [
      'Ah, a visitor! Professor Fig at your service.',
      `Did you know? ${FACTS[dayIndex() % FACTS.length]}`,
      'Come back tomorrow for another, if your brain can cope.',
    ];
  }
  if (npc === 'gus') {
    const bal = acorns == null ? null : acorns;
    const acornLine = bal == null ? 'Hatch your sprig and I’ll tell you how many acorns you’ve got!'
      : bal >= FARE ? `You’ve got ${bal} 🌰, enough for ${Math.floor(bal / FARE)} bus ride${Math.floor(bal / FARE) === 1 ? '' : 's'} into town!`
      : `You’ve got ${bal} 🌰. The bus costs ${FARE}, so keep going with your jobs!`;
    return ['Hot buns! Gus here.', acornLine, JOKES[dayIndex() % JOKES.length]];
  }
  if (npc === 'pip') {
    return ['Next stop: home! Hop on, the way back is free.', 'Hold tight, and mind the cabbages.'];
  }
  return [`${c ? c.name : 'Someone'} waves at you.`];
}

module.exports = { FARE, CHARACTERS, weather, talk, londonDay };
