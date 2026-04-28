export const scenes = [
  {
    id: 'approach',
    title: 'Approach Road',
    image: '/panos/WH_Approach_Road_001_cf651047ec.jpg.jpeg',
    minimap: { x: 0.986, y: 0.336 },
    hotspots: [
      { to: 'gate', pitch: -2.34, yaw: -170.05 },
    ],
    audio: null, // e.g. '/audio/approach.mp3'
    annotations: [
      { title: 'Location', body: '1 km from Attibele–Anekal highway (STRR).' },
      { title: 'Road width', body: '25 ft.' },
    ],
  },
  {
    id: 'gate',
    title: 'Entrance Gate',
    image: '/panos/WH_Entrance_Gate_001_93790826a1.jpg.jpeg',
    minimap: { x: 0.847, y: 0.336 },
    hotspots: [
      { to: 'approach', pitch: 0.5, yaw: 179.14 },
      { to: 'way', pitch: -5.47, yaw: -41.23 },
    ],
    audio: null, // e.g. '/audio/approach.mp3'
    annotations: [
      { title: 'Gate width', body: '~30 ft.' },
      { title: 'Trailer access', body: 'Parallel inbound/outbound passage.' },
    ],
  },
  {
    id: 'way',
    title: 'Entrance Way',
    image: '/panos/WH_Entrance_Way_001_74db3b81c7.jpg.jpeg',
    minimap: { x: 0.653, y: 0.434 },
    hotspots: [
      { to: 'gate', pitch: 3.25, yaw: -140.19 },
      { to: 'entry', pitch: -0.6, yaw: -63.18 },
    ],
    audio: null, // e.g. '/audio/approach.mp3'
    annotations: [
      { title: 'Driveway', body: '8 m / 26 ft, wraps the entire box.' },
      { title: 'Passage', body: '~30 ft wide, supports parallel trailer movement.' },
    ],
  },
  {
    id: 'entry',
    title: 'Entry',
    image: '/panos/WH_Entry_001_34d9d5e86f.jpg.jpeg',
    minimap: { x: 0.725, y: 0.618 },
    hotspots: [
      { to: 'way', pitch: -1.31, yaw: -13.82 },
      { to: 'interior', pitch: 0.43, yaw: -119.13 },
    ],
    audio: null, // e.g. '/audio/approach.mp3'
    annotations: [
      { title: 'Driveway', body: '8 m / 26 ft, wraps the box.' },
      { title: 'Dock apron', body: '9 m east (here) · 18 m west.' },
      { title: 'Docks', body: '2 built · expandable to 11 with canopy.' },
    ],
  },
  {
    id: 'interior',
    title: 'Interior',
    image: '/panos/WH_interior_001_9eac05827a.jpg.jpeg',
    minimap: { x: 0.477, y: 0.73 },
    hotspots: [
      { to: 'entry', pitch: -2.39, yaw: -174.59 },
      { to: 'restroom', pitch: -4.49, yaw: -52.85 },
    ],
    audio: null, // e.g. '/audio/approach.mp3'
    annotations: [
      { title: 'Flooring', body: 'FM2 compliant · 8 t/sqm load.' },
      { title: 'Heights', body: 'Eaves 12.5 m · centre 14.5 m. Wide-span grid.' },
      { title: 'Daylight & ventilation', body: '~5% skylights · ridge vents · side exhaust fans.' },
      { title: 'Fire safety', body: 'FM hydrants & sprinklers · fire tank · STP plant.' },
      { title: 'Utilities & security', body: '24×7 power & water · CCTV · 12 ft walls with barbed wire.' },
    ],
  },
  {
    id: 'restroom',
    title: 'Restroom & Fire Exit',
    image: '/panos/WH_Restroom_and_Fire_Exit_001_6f30b13921.jpg.jpeg',
    minimap: { x: 0.613, y: 0.836 },
    hotspots: [
      { to: 'entry', pitch: 0.06, yaw: -116.1 },
    ],
    audio: null, // e.g. '/audio/approach.mp3'
    annotations: [
      { title: 'Restroom', body: 'Placeholder — number of stalls, accessibility.' },
      { title: 'Fire exit', body: 'Placeholder — exit width and route info.' },
    ],
  },
];

export const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
