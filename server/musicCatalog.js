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

export function chooseGameplayTrack() {
  if (GAMEPLAY_TRACKS.length === 0) return TITLE_TRACK;
  const index = Math.floor(Math.random() * GAMEPLAY_TRACKS.length);
  return { ...GAMEPLAY_TRACKS[index] };
}
