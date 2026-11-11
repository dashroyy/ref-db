// The Learn section. Order here = order on /learn/ and the "next guide" links.
export const GUIDES = [
  {
    slug: 'materials',
    title: 'Choosing a material',
    summary: 'PLA, PETG, TPU, ASA or silk? What each plastic is good at, and where it lets you down.',
    idea: 'Pick the plastic for where the part will live, not just how it looks.',
    tool: 'Material comparison',
    cta: { text: 'Know your material? Pick a print.', label: 'Browse the shop', href: '/shop/' },
    minutes: 4,
  },
  {
    slug: 'pricing',
    title: 'What a print costs, and why',
    summary: 'Where the money in a 3D print actually goes, with an estimator you can play with.',
    idea: 'Most of a print\'s cost is time on the machine, not plastic.',
    tool: 'Print price estimator',
    cta: { text: 'Have a 3D file? Get an exact price from its real volume.', label: 'Instant STL quote', href: '/custom/#stl' },
    minutes: 5,
  },
  {
    slug: 'pen-launcher-physics',
    title: 'Pen Launcher physics',
    summary: 'How a spring turns a pull-back into a pen flying across the room, and how far it goes.',
    idea: 'Spring energy becomes speed; speed and angle decide range.',
    tool: 'Launch lab',
    cta: { text: 'Now try it for real.', label: 'Get a Pen Launcher', href: '/shop/pen-launcher/' },
    minutes: 6,
  },
];
