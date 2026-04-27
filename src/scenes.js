export const scenes = [
  {
    id: 'approach',
    title: 'Approach Road',
    image: '/panos/WH_Approach_Road_001_cf651047ec.jpg.jpeg',
    minimap: { x: 0.986, y: 0.336 },
    hotspots: [
      { to: 'gate', pitch: -2.34, yaw: -170.05 },
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
  },
  {
    id: 'restroom',
    title: 'Restroom & Fire Exit',
    image: '/panos/WH_Restroom_and_Fire_Exit_001_6f30b13921.jpg.jpeg',
    minimap: { x: 0.613, y: 0.836 },
    hotspots: [
      { to: 'entry', pitch: 0.06, yaw: -116.1 },
    ],
  },
];

export const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
