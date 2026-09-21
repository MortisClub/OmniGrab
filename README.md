<p align="center">
  <img src="docs/banner.svg" width="640" alt="OmniGrab">
</p>

<p align="center">
  <a href="https://github.com/MortisClub/OmniGrab/actions/workflows/release.yml"><img src="https://github.com/MortisClub/OmniGrab/actions/workflows/release.yml/badge.svg" alt="release build"></a>
  <a href="https://github.com/MortisClub/OmniGrab/releases"><img src="https://img.shields.io/github/v/release/MortisClub/OmniGrab" alt="latest release"></a>
  <img src="https://img.shields.io/github/license/MortisClub/OmniGrab" alt="license">
  <img src="https://img.shields.io/badge/Tauri-v2-24c8db" alt="tauri v2">
</p>

<p align="center">Fast, minimal desktop app for downloading video and audio. Paste a link, hit Download, done.</p>

## Screenshots

<p align="center">
  <img src="screens/main.png" width="800" alt="OmniGrab main window">
  <img src="screens/card.png" width="800" alt="Video preview with quality presets">
  <img src="screens/download.png" width="800" alt="Active download with live progress">
</p>

## Features

- Paste a link, get title, thumbnail and available formats in a second
- Presets: 4K Ultra, 1080p, MP3 320kbps, plus manual video+audio stream picker
- Live progress with speed and ETA, parallel downloads, cancel and retry
- Tray icon with background "download from clipboard"
- OS notification when a download finishes, reveal-in-folder button
- yt-dlp updates itself in the background, ffmpeg is fetched automatically

## Sites

YouTube, TikTok, VK, Instagram, X, Twitch, SoundCloud and 1000+ more through yt-dlp.

## Download

Grab the installer for your OS from the [Releases](https://github.com/MortisClub/OmniGrab/releases) page: `.exe` for Windows, `.dmg` for macOS (Intel and Silicon), `.AppImage` / `.deb` for Linux.

## Develop

```sh
npm install
npm run tauri dev
```

Windows needs the MSVC toolchain (stable Rust + VS Build Tools). First launch downloads yt-dlp into the app data dir.

```sh
npm run tauri build   # local installer
```

Pushing a `v*.*.*` tag builds all installers on CI and drafts a release.

## Stack

Tauri v2 (Rust) + React + TypeScript, Tailwind v4, zustand, framer-motion, lucide. Download engine: yt-dlp + ffmpeg.

```
src-tauri/src/ytdlp/   binary.rs (yt-dlp/ffmpeg management)
                       metadata.rs (fetch_metadata)
                       download.rs (queue, progress, cancel)
src/components/        URLInput, MediaCard, DownloadQueue, SettingsModal
src/stores/            downloads, settings
```

## License

MIT, see [LICENSE](LICENSE).
