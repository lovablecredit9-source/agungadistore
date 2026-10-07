# Music player & lyrics UI

- User lyrics UI (inline card, full player card, fullscreen) is one shared component `src/components/music/CinematicLyrics.tsx` that reads `audio.currentTime` per frame for active line/karaoke; styles are `.lyr-*` in `src/index.css`. Why: one renderer keeps every lyrics view in sync with the real audio clock.
- Music audio: volume/mute live only in PlaylistTab state (persisted via `src/lib/player-state.ts`); per-song audio listeners read `liveRef` (never closure state); `silenceOtherAudios` keeps exactly one audible element; true L/R balance is `fx.pan` on the StereoPanner, separate from the karaoke split (`fx.balance`). Why: stale closures and superseded loading songs caused overlap, stale repeat/shuffle and fake balance.
