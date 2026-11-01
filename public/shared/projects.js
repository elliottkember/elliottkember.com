export const person = {
  name: 'Elliott Kember',
  role: 'Software Engineer',
  location: 'Auckland, New Zealand',
  tagline: 'I design and build fast, high-quality software for the web and mobile — and care about the details people feel but never see.',
  bio: "I'm a software engineer with a decade of experience shipping products across the stack — from pixel-level frontend polish to the infrastructure that keeps it running. I like small teams, sharp tools, and problems that reward taste.",
  email: 'elliott.kember@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/elliottkember' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/elliott-kember-a0252986/' },
    { label: 'X', href: 'https://x.com/elliottkember' },
    { label: 'Email', href: 'mailto:elliott.kember@gmail.com' },
  ],
};

// hue drives each exploration's palette for that project; `did` feeds the Lumen cards
export const projects = [
  {
    slug: 'openspace',
    // DRAFT — edit to taste: what Elliott did on this project
    did: [
      'Built the React Native app crews carry to walk a site and capture it in 360°.',
      'Live floor-plan navigation: your path and capture points traced as you walk.',
      'Kept capture smooth and reliable on phones out in the field.',
    ],
    title: 'OpenSpace',
    years: '2020 — now',
    blurb: '360° capture and AI-powered documentation for construction sites.',
    tags: ['React Native', 'TypeScript'],
    hue: 195,
  },
  {
    slug: 'clearbit-x',
    // DRAFT — edit to taste: what Elliott did on this project
    did: [
      'Designed and built the segment builder — stack rules to filter visitors and companies.',
      'Live counts as you filter, so marketers watch their funnel narrow in real time.',
      'Turned complex queries into a UI anyone on a marketing team could use.',
    ],
    title: 'Clearbit X',
    years: '2018 — 2020',
    blurb: "Clearbit's marketing intelligence product for identifying and acting on website visitors.",
    tags: ['React', 'TypeScript'],
    hue: 265,
  },
  {
    slug: 'soulmate',
    // DRAFT — edit to taste: what Elliott did on this project
    did: [
      'Wrote open-source firmware for ESP32-powered LED controllers.',
      'Designed the hardware, and the React Native app that drives installations.',
      'Built the pattern library — trippy LED animations like the one behind this card.',
    ],
    title: 'Soulmate',
    years: '2016 — 2020',
    blurb: 'Open-source LED firmware, hardware and apps for building and controlling addressable light installations.',
    tags: ['C++', 'ESP32', 'React Native'],
    hue: 330,
  },
  {
    slug: 'dropbox',
    // DRAFT — edit to taste: what Elliott did on this project
    did: [
      'Came up with the Dropbox desktop app — a Finder-style browser for everything in your Dropbox, which has since shipped.',
      'Invented Betacoins for the Mailbox for Mac beta: golden-coin images with the invite hidden inside them using steganography.',
      'Mobile engineering on Mailbox, home of swipe-to-archive and snooze.',
    ],
    title: 'Dropbox',
    years: '2014 — 2016',
    blurb: 'Mobile engineer on Dropbox and Mailbox, the email app that popularised swipe-to-archive and snooze.',
    tags: ['iOS', 'Objective-C'],
    hue: 215,
  },
];
