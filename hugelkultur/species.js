// The clearing's flora list. Living rows are counted from the cube.
// The rest are known to the wood and not sown yet. This list is the seed of admin mode.
export const FLORA = [
  { id: 'oak', name: 'White oak', group: 'tree', swatch: '#1c6b40', note: 'Dense crown. Heavy sticks.' },
  { id: 'maple', name: 'Sugar maple', group: 'tree', swatch: '#4fd18b', note: 'Open crown. You can see through it.' },
  { id: 'birch', name: 'Paper birch', group: 'tree', swatch: '#f3d7a6', note: 'Pale trunk. A thin crown.' },
  { id: 'carrot', name: 'Carrot', group: 'crop', swatch: '#d97736', note: 'A bite, and the step quickens.', pace: 1.42, lasts: 9 },
  { id: 'turnip', name: 'Turnip', group: 'crop', swatch: '#f7efe2', note: 'A long, steady hurry.', pace: 1.34, lasts: 12 },
  { id: 'mushroom', name: 'Meadow mushroom', group: 'crop', swatch: '#e0a04a', note: 'A short, sharp hurry.', pace: 1.58, lasts: 7 },
  { id: 'beech', name: 'American beech', group: 'tree', swatch: '#2f8f55', note: 'Smooth bark.' },
  { id: 'ash', name: 'White ash', group: 'tree', swatch: '#8d5b4c', note: 'Light wood.' },
  { id: 'linden', name: 'Linden', group: 'tree', swatch: '#b6e38a', note: 'Heart leaves.' },
  { id: 'hornbeam', name: 'Hornbeam', group: 'tree', swatch: '#5a3e2e', note: 'Hard gray trunk.' },
  { id: 'alder', name: 'Speckled alder', group: 'tree', swatch: '#1d6f8a', note: 'Likes the wet edge.' },
  { id: 'willow', name: 'Black willow', group: 'tree', swatch: '#7ec8c2', note: 'Long wands.' },
  { id: 'pine', name: 'White pine', group: 'tree', swatch: '#1c6b40', note: 'Soft needles.' },
  { id: 'hemlock', name: 'Eastern hemlock', group: 'tree', swatch: '#252629', note: 'A dark lace crown.' },
  { id: 'cherry', name: 'Black cherry', group: 'tree', swatch: '#c49a62', note: 'Bitter bark.' },
  { id: 'chestnut', name: 'American chestnut', group: 'tree', swatch: '#e6bc82', note: 'Wide and sweet.' },
  { id: 'serviceberry', name: 'Serviceberry', group: 'tree', swatch: '#f4c56a', note: 'Early white bloom.' },
  { id: 'hazel', name: 'Beaked hazel', group: 'shrub', swatch: '#4fd18b', note: 'A low thicket.' },
  { id: 'elder', name: 'Elder', group: 'shrub', swatch: '#e0a04a', note: 'Hollow stems.' },
  { id: 'fern', name: 'Cinnamon fern', group: 'plant', swatch: '#2f8f55', note: 'A damp frond.' },
  { id: 'ginger', name: 'Wild ginger', group: 'plant', swatch: '#5a3e2e', note: 'A ground leaf.' }
];

export function floraById(id) {
  return FLORA.find(item => item.id === id) || null;
}

export function floraName(id) {
  return floraById(id)?.name || id;
}
