# Notch (Apex Island) 🏝️

> Ultra-responsive Dynamic Island & Productivity Hub for Windows 11. Built with Electron, React 18, Tailwind CSS, Framer Motion, Koffi (Win32 C bindings), and native WinRT GSMTC event hooks.

![Notch Preview](public/preview.png)

---

## ✨ Features

- **⚡ Zero-Latency GSMTC Media Layer**: Native event-driven Windows media integration (`WinRTMediaBridge`) with instant play/pause reactivity, source app identification (Spotify, YouTube, Apple Music, Discord, VLC), and album artwork.
- **🤖 Universal Agent Gateway**: Local HTTP server (`127.0.0.1:4141/agent-event`) accepting real-time telemetry from AI CLI agents (Claude Code, Antigravity, OpenCode, Cursor, Copilot) with dynamic brand marks, `awaiting_approval` warning state, and automatic completion collapse.
- **🔋 Direct Win32 Hardware Telemetry**: Native FFI (`kernel32.dll`, `user32.dll`, `psapi.dll`, `winmm.dll`) power/battery reading and CPU tracking matching Task Manager with 0% CPU overhead.
- **🧠 Auto Working Set Trimming**: Automatic paging of inactive working memory to Windows standby list via `SetProcessWorkingSetSize` for $< 15\text{MB}$ idle footprint.
- **🪟 Interactive Productivity Tabs**:
  - 🎵 **Now Playing**: Full playback controls, scrubbing bar, volume, source branding.
  - 📋 **Clipboard Manager**: History stack, pin items, search, instant copy.
  - 📸 **Screenshots**: Auto-monitored screenshot shelf with drag & drop.
  - ⏱️ **Focus Timer**: Pomodoro intervals with ring progression.
  - 💻 **System Monitor**: Real-time battery, CPU, RAM, and system uptime.
  - ⚙️ **Settings**: Custom compact width, start on boot, shortcut customizer.
- **🖱️ Click-Through Transparency**: Mouse events pass through transparent areas to background windows seamlessly.

---

## 🚀 Quick Start

### Prerequisites
- Windows 10 (19041+) or Windows 11
- Node.js 18+
- `.NET 8.0 SDK` *(only if modifying the C# WinRT daemon; precompiled binary included)*

### Installation

```bash
# Clone the repository
git clone https://github.com/danielamodu/Notch.git
cd Notch

# Install dependencies
npm install

# Start the application
npm start
```

### Build Production Binary

```bash
npm run build
```

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + \`` | Toggle Island Expansion |
| `Hover` | Expand interactive pill / enable mouse interaction |
| `Mouse Leave` | Auto-collapse to compact notch pill |

---

## 📡 Universal Agent Gateway

Send live agent status updates to Notch over local HTTP:

```bash
curl -X POST http://127.0.0.1:4141/agent-event \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "Claude Code",
    "status": "thinking",
    "detail": "Analyzing project dependencies..."
  }'
```

### Supported Statuses
- `'thinking'`: Amber pulsing brain with aura shimmer.
- `'executing'`: Emerald spinning gear with action text.
- `'awaiting_approval'`: Amber warning badge with `'Needs Approval'` / `'Action Required'`.
- `'completed'`: Green checkmark (persists for 3s before auto-collapsing).
- `'error'`: Rose alert badge with error message.

---

## 🛠️ Architecture

- **Renderer**: React 18 + Vite + Tailwind CSS + Framer Motion
- **Main Process**: Electron 34 + Native `node:http` Gateway
- **Hardware & OS Bindings**: Direct Win32 FFI via `koffi` (`kernel32.dll`, `user32.dll`, `psapi.dll`, `winmm.dll`)
- **Media Engine**: C# WinRT Daemon (`GlobalSystemMediaTransportControlsSessionManager`) over standard I/O JSON stream

---

## 📄 License

MIT License © 2026 Daniel Amodu
