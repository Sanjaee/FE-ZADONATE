// YouTube IFrame API type definitions
declare namespace YT {
  interface PlayerState {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  }

  interface OnStateChangeEvent {
    data: number;
    target: Player;
  }

  interface OnReadyEvent {
    target: Player;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    mute?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    playsinline?: 0 | 1;
    start?: number;
    enablejsapi?: 0 | 1;
  }

  interface PlayerOptions {
    videoId?: string;
    playerVars?: PlayerVars;
    events?: {
      onStateChange?: (event: OnStateChangeEvent) => void;
      onReady?: (event: OnReadyEvent) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options?: PlayerOptions);
    getDuration(): number;
    pauseVideo(): void;
    playVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
  }
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};

