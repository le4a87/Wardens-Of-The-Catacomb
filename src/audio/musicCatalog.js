export const TITLE_TRACK = {
  title: "Ward the Catacombs",
  src: "./assets/music/Ward%20the%20Catacombs.mp3"
};

export const GAMEPLAY_TRACKS = [
  {
    title: "Evil Lair",
    src: "./assets/music/Evil%20Lair.mp3"
  },
  {
    title: "Hidden Danger",
    src: "./assets/music/Hidden%20Danger.mp3"
  },
  {
    title: "The Crypt",
    src: "./assets/music/The%20Crypt.mp3"
  }
];

export const BOSS_TRACKS = [
  {
    title: "Crypt Crisis",
    src: "./assets/music/boss/Crypt%20Crisis.mp3"
  },
  {
    title: "Sewer Slayer",
    src: "./assets/music/boss/Sewer%20Slayer.mp3"
  }
];

export const VICTORY_TRACK = {
  title: "Victoria nobis est",
  src: "./assets/sounds/Victoria%20nobis%20est.mp3",
  loop: false
};

export const ALL_MUSIC_TRACKS = [TITLE_TRACK, ...GAMEPLAY_TRACKS, ...BOSS_TRACKS, VICTORY_TRACK];

export function getBossTrackDefinitionForBiome(biomeKey = "") {
  if (biomeKey === "sewer") return BOSS_TRACKS[1];
  return BOSS_TRACKS[0];
}
