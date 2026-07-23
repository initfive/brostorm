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
      6: ['#5b6470', '#69727e', '#4d555f']    // metal
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
      6: ['#79808a', '#868e99', '#666d77']    // catwalk steel
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
};

let THEME = THEMES.gulch;

function setTheme(id) {
  THEME = THEMES[id] || THEMES.gulch;
  return THEME;
}
