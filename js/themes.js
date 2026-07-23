// ---------------------------------------------------------------------------
// BROSTORM - level themes
//
// A theme is every colour decision for one mission: terrain palettes, the
// surface crust, sky gradient, parallax ridges, sun and liquid hazard. Swapping
// it re-skins the whole game without touching a line of rendering code.
//
// Tile keys are numeric (see terrain.js: DIRT 1, STONE 2, WOOD 3, BEDROCK 4,
// METAL 6) so this file has no load-order dependency on the constants.
// ---------------------------------------------------------------------------

const THEMES = {

  // Dusk over a green valley.
  gulch: {
    id: 'gulch',
    tile: {
      1: ['#6d4a2c', '#7a5433', '#5e3f26'],   // dirt
      2: ['#565d69', '#616975', '#4b515c'],   // stone
      3: ['#8a5a2f', '#96653a', '#7a4d27'],   // wood
      4: ['#2b2f38', '#31353f', '#252932'],   // bedrock
      6: ['#5b6470', '#69727e', '#4d555f'],   // metal
      7: ['#a8cfe0', '#bcdcea', '#93bccf']    // ice
    },
    crustTop: '#63a94a', crustMid: '#4f8f3c', crustH: 4,
    blades: true, roots: true, grit: '#8b8175',
    bgDark: ['#1c1e26', '#20222b'],
    sky: [[0, '#2a3d63'], [0.45, '#6a5f7a'], [0.75, '#c07a5a'], [1, '#e0a25e']],
    ridges: [
      { p: 0.10, base: 150, amp: 22, col: '#4b4a66' },
      { p: 0.22, base: 176, amp: 18, col: '#3d3d55' },
      { p: 0.40, base: 205, amp: 14, col: '#2e3044' }
    ],
    sun: {
      x: 380, y: 92, r: 58, px: 0.04, py: 0.05,
      stops: [[0, 'rgba(255,233,180,0.90)'], [0.26, 'rgba(255,209,133,0.62)'],
      [0.34, 'rgba(255,180,110,0.22)'], [0.62, 'rgba(255,150,90,0.07)'],
      [1, 'rgba(255,140,80,0)']]
    },
    liquid: { hot: '#ff9a2e', cool: '#e8511a', rim: '#ffd36b' },
    haze: 0
  },

  // Blistering sunset over a desert fuel refinery.
  refinery: {
    id: 'refinery',
    tile: {
      1: ['#c2a068', '#cfae76', '#b0905b'],   // sand
      2: ['#8a6b45', '#977853', '#775c3a'],   // sandstone
      3: ['#8a5a2f', '#96653a', '#7a4d27'],   // crates
      4: ['#3a332a', '#423a30', '#322c25'],   // bedrock
      6: ['#79808a', '#868e99', '#666d77'],   // catwalk steel
      7: ['#a8cfe0', '#bcdcea', '#93bccf']    // ice
    },
    crustTop: '#e2c68e', crustMid: '#cdad72', crustH: 3,
    blades: false, roots: false, grit: '#9c8a6a',
    bgDark: ['#241d16', '#2b231a'],
    sky: [[0, '#3a2a52'], [0.35, '#8a4a55'], [0.62, '#d4703f'], [0.85, '#eb9a52'], [1, '#f6c073']],
    ridges: [
      { p: 0.10, base: 154, amp: 20, col: '#6b4550' },
      { p: 0.22, base: 180, amp: 15, col: '#573a44' },
      { p: 0.40, base: 208, amp: 12, col: '#402d36' }
    ],
    sun: {
      x: 330, y: 116, r: 70, px: 0.03, py: 0.04,
      stops: [[0, 'rgba(255,244,206,0.95)'], [0.22, 'rgba(255,206,120,0.75)'],
      [0.30, 'rgba(255,160,80,0.30)'], [0.60, 'rgba(255,110,60,0.10)'],
      [1, 'rgba(255,90,50,0)']]
    },
    liquid: { hot: '#ff7a20', cool: '#7a2d12', rim: '#ffc25e' },
    haze: 1
  }
  ,

  // Dripping green under a heavy canopy.
  jungle: {
    id: 'jungle',
    tile: {
      1: ['#4a5c2e', '#556a34', '#3e4e27'],   // loam
      2: ['#4c5a56', '#576663', '#414d4a'],   // wet rock
      3: ['#7d6a34', '#8a763c', '#6b5a2c'],   // bamboo
      4: ['#232a24', '#29312a', '#1e241f'],
      6: ['#5b6470', '#69727e', '#4d555f'],
      7: ['#a8cfe0', '#bcdcea', '#93bccf']
    },
    crustTop: '#6faa3e', crustMid: '#54893a', crustH: 5,
    blades: true, roots: true, grit: '#7a8a63',
    bgDark: ['#141c16', '#18211a'],
    sky: [[0, '#16321f'], [0.4, '#2c5230'], [0.72, '#5a7b3c'], [1, '#8a9c4a']],
    ridges: [
      { p: 0.10, base: 150, amp: 20, col: '#274428' },
      { p: 0.22, base: 178, amp: 16, col: '#1f3722' },
      { p: 0.40, base: 206, amp: 12, col: '#182b1c' }
    ],
    sun: {
      x: 300, y: 70, r: 62, px: 0.03, py: 0.04,
      stops: [[0, 'rgba(226,255,190,0.55)'], [0.3, 'rgba(170,220,120,0.24)'],
      [0.6, 'rgba(120,180,90,0.08)'], [1, 'rgba(90,150,70,0)']]
    },
    liquid: { hot: '#4fa85a', cool: '#25612f', rim: '#8fe07a' },
    haze: 0, weather: 'drip'
  },

  // A fortress buried in a blizzard.
  snow: {
    id: 'snow',
    tile: {
      1: ['#8f9bab', '#9daab9', '#7f8b9a'],   // packed snow over rock
      2: ['#5a6472', '#66707e', '#4d5665'],
      3: ['#6d5a41', '#7a664a', '#5e4d37'],
      4: ['#242a33', '#2a313a', '#1f242c'],
      6: ['#6e7681', '#868e99', '#666d77'],
      7: ['#a8cfe0', '#bcdcea', '#93bccf']    // ice
    },
    crustTop: '#f2f8ff', crustMid: '#d6e4f0', crustH: 5,
    blades: false, roots: false, grit: '#aab6c4',
    bgDark: ['#161b24', '#1b2129'],
    sky: [[0, '#1b2740'], [0.45, '#3d5470'], [0.78, '#7d94ad'], [1, '#a9bccd']],
    ridges: [
      { p: 0.10, base: 152, amp: 22, col: '#41526b' },
      { p: 0.22, base: 180, amp: 16, col: '#33415a' },
      { p: 0.40, base: 208, amp: 12, col: '#28334a' }
    ],
    sun: {
      x: 360, y: 78, r: 54, px: 0.03, py: 0.04,
      stops: [[0, 'rgba(228,240,255,0.60)'], [0.3, 'rgba(190,215,240,0.22)'],
      [0.65, 'rgba(150,180,215,0.07)'], [1, 'rgba(130,160,200,0)']]
    },
    liquid: { hot: '#6fd2f0', cool: '#2a6a8a', rim: '#cdf2ff' },
    haze: 0, weather: 'snow'
  },

  // Airless, and lit only by the Earth.
  moon: {
    id: 'moon',
    tile: {
      1: ['#5c5f6e', '#686b7a', '#4f5260'],   // regolith
      2: ['#3f4250', '#494c5a', '#363945'],
      3: ['#6d5a41', '#7a664a', '#5e4d37'],
      4: ['#1a1c24', '#1f222a', '#16181f'],
      6: ['#7d8592', '#8b939f', '#6b7280'],
      7: ['#a8cfe0', '#bcdcea', '#93bccf']
    },
    crustTop: '#9aa0b0', crustMid: '#7c8290', crustH: 3,
    blades: false, roots: false, grit: '#8f96a6',
    bgDark: ['#101219', '#14161e'],
    sky: [[0, '#03040a'], [0.5, '#070912'], [1, '#0d1019']],
    ridges: [
      { p: 0.10, base: 158, amp: 18, col: '#20242f' },
      { p: 0.22, base: 184, amp: 14, col: '#191d26' },
      { p: 0.40, base: 210, amp: 10, col: '#13161e' }
    ],
    sun: {
      x: 430, y: 44, r: 26, px: 0.02, py: 0.02,
      stops: [[0, 'rgba(255,255,255,0.95)'], [0.35, 'rgba(240,245,255,0.35)'],
      [0.7, 'rgba(200,220,255,0.06)'], [1, 'rgba(180,200,255,0)']]
    },
    // Earth, hanging there judging you
    planet: { x: 110, y: 84, r: 42, px: 0.05, py: 0.05 },
    stars: true,
    liquid: { hot: '#7fe0c0', cool: '#1c5a4a', rim: '#b8ffe8' },
    haze: 0, weather: 'dust', gravity: 0.42
  }
};

let THEME = THEMES.gulch;

function setTheme(id) {
  THEME = THEMES[id] || THEMES.gulch;
  return THEME;
}
