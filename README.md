# 📅 trame (Track & Me) — Digital Activity & Milestone Tracker

> **trame** (derived from **track** and **me**) is a modern web-based digital activity tracker featuring a single scrollable yearly calendar, real-time Malaybalay City weather ambiance and outdoor activity recommendations, animated bookmark slideshows on date cells, night mode, custom modern confirmation pop-ups, and a pure JSON flat-file database with complete CRUD support.

---

## 🛠️ Technologies & Tools Used to Build This Project

This application was engineered using lightweight, modern, and zero-hassle technologies:

### 1. Backend & Server
- **[Node.js](https://nodejs.org/) (v22+)**: High-performance JavaScript runtime environment executing the local web server.
- **[Express.js](https://expressjs.com/) (v5)**: Minimalist web server framework providing RESTful API routes (`/api/tasks`, `/api/stats`, `/api/weather`) and serving static assets.
- **[CORS Middleware](https://www.npmjs.com/package/cors)**: Cross-Origin Resource Sharing middleware for safe local communication.

### 2. Primary Database & Storage
- **JSON Flat-File Database (`data/trame_db.json`)**: 
  - Strictly uses pure JSON as the primary and only storage medium—no external SQL, MongoDB, or heavy database installations required.
  - Features **atomic writes** (`fs.writeFileSync` to a `.tmp` file and renaming) to prevent corruption if the server is interrupted.
  - Complete **CRUD** support (Create, Read, Update, Delete) + Completion toggle + Disk space cleanup.

### 3. Weather Integration Engine
- **[Open-Meteo API](https://open-meteo.com/)**:
  - Free, open-source weather forecast API requiring zero API keys or complex setups.
  - Geocoded directly to **Malaybalay City, Bukidnon, Philippines** (`8.1575° N, 125.1278° E`).
  - Fetches real-time temperature (°C), WMO weather code (rain, drizzle, overcast, clear), humidity, wind speed, and daylight state.
  - Server-side caching (10-minute cache) to prevent unnecessary network requests.

### 4. Frontend UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework providing modern responsive layouts, typography, and dark mode theming.
- **[Lucide Icons](https://lucide.dev/)**: Clean, modern, and consistent SVG icon set for task priorities, weather, buttons, and navigation.
- **Google Fonts**:
  - **Outfit**: Modern display font for headings, badges, and calendar month headers.
  - **Plus Jakarta Sans**: Highly readable body typography for task titles and notes.

### 5. Graphics & Micro-Animations
- **HTML5 Canvas 2D API**:
  - Custom dynamic weather particle system (`public/js/weather.js`).
  - Animates realistic falling raindrops during rain showers, floating sun dust/ambient glow during sunny days, and twinkling stars at night.
- **Custom CSS3 Animations & Transitions**:
  - Keyframe transitions for bookmark ribbons.
  - Automated bookmark carousel slideshow tickers on calendar date cells.
  - Smooth modal scale-in and backdrop blur effects.

### 6. Document Generation & Export
- **[html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) & jsPDF**: Client-side PDF generation engine that turns your completed achievements list into a downloadable annual PDF Review Report (`.pdf`).

---

## 🚀 How to Run the App

### Cloning & First-Time Setup
If you just cloned this repository from GitHub:
1. Open your terminal in the project directory:
   ```bash
   git clone <repo-url>
   cd "Version 1"
   ```
2. Install the lightweight dependencies:
   ```bash
   npm install
   ```
3. **Automatic Database Generation**: You don't need to manually create any database! On your first launch, **tra•me** automatically creates your own private `data/trame_db.json` file. Your database is automatically excluded from Git (`.gitignore`) so your personal reminders, tasks, and notes will **never** be committed or shared.

---

### Prerequisites
Make sure **Node.js** (v18+) is installed on your computer. You can verify this by opening a terminal and typing:
```bash
node -v
```

---

### Method 1: Double-Click (Easiest for Windows)
1. In the project folder (`Version 1`), locate the file named **`start.bat`**.
2. **Double-click `start.bat`**.
3. A terminal window will open showing:
   ```
   =================================================
    ✨ Trame Webapp running at http://localhost:3000
    📅 Track and Me - Scrollable Yearly Calendar
    🌦️ Weather Base: Malaybalay City (Bukidnon)
    🗄️ Primary Storage: JSON file (data/trame_db.json)
   =================================================
   ```
4. Open your web browser and go to:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

### Method 2: From the Terminal (PowerShell or Command Prompt)
1. Open PowerShell or Command Prompt in the project folder:
   ```powershell
   npm start
   ```
   *or*
   ```powershell
   node server.js
   ```
2. Open your browser and visit:
   👉 **`http://localhost:3000`**

To stop the server at any time, press **`Ctrl + C`** in the terminal window.

---

## ⚙️ How the App Works Behind the Scenes

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    Browser Client (UI)                     │
  │  - Single Scrollable Yearly Calendar (12 stacked months)    │
  │  - HTML5 Canvas Weather Particle Engine (Malaybalay City)   │
  │  - Bookmark Carousel Slideshow Ticker                       │
  │  - Tracker Pop-up Modal (Customized Link Buttons)           │
  │  - Custom Modern Confirmation Toast / Modal                 │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ REST API (JSON)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                   Node.js + Express Server                  │
  │  - Static Asset File Server (HTML, CSS, JS)                 │
  │  - Malaybalay Weather Proxy (10-min cache)                  │
  │  - JSON Database Atomic File Controller                     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Atomic File Writes
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    JSON Primary Database                    │
  │                  (data/trame_db.json)                       │
  └─────────────────────────────────────────────────────────────┘
```

1. **When you open the webapp**:
   - The frontend calls `GET /api/weather` to fetch live conditions for Malaybalay City. The weather HUD informs you if it is safe to go outside and finish errands, while the background canvas adapts to the weather (rain, clouds, sun, or night stars).
   - The frontend calls `GET /api/tasks?year=2026` to read all activities from `data/trame_db.json`.

2. **Calendar Rendering**:
   - All 12 months are rendered in a stacked vertical scroll without requiring any zooming.
   - Week numbers (`W1`, `W2`, ...) are organized horizontally on the left of each row, with the days of the week laid out horizontally and subsequent weeks stacked below.

3. **Bookmark Ribbons & Slideshow**:
   - Single activity on a date: Shows a bookmark ribbon with color-coded priority and time deadline.
   - Multiple activities on a date: Automatically launches a continuous, smooth slideshow ticker that cycles through the activity titles.

4. **Tracker Modal & Customized Links**:
   - Clicking any date cell opens the **Tracker** modal.
   - Allows adding/editing tasks with title, details, time deadline, priority, category, and direct links.
   - **Customized Link Button**: When you provide a URL and label (e.g. *"Project Portal"* or *"Slide Deck"*), clicking the task displays a neat pill button instead of an unformatted, long raw URL.

5. **Modern Custom Confirmation Pop-up**:
   - Eliminates standard browser alert/confirm boxes.
   - When deleting an activity or cleaning up completed records, a custom glassmorphism confirmation toast modal appears with smooth transitions and keyboard accessibility (<kbd>Esc</kbd> / <kbd>Enter</kbd>).

6. **Completed Tasks Archive & PDF Review**:
   - Tasks marked as completed remain archived in the JSON file.
   - You can view them anytime via the **Completed Tasks** button.
   - **Generate PDF Review**: Exports an annual milestone summary report via `html2pdf.js`.
   - **Clean Up Completed (Free Space)**: Permanently purges completed entries from `data/trame_db.json` to optimize disk storage.

---

## 📁 Project Directory Structure

```
Version 1/
├── .gitignore             # Git ignore configuration (protects private database & temporary files)
├── server.js              # Express API server for JSON database CRUD & Malaybalay weather proxy
├── package.json           # Node.js project manifest & scripts ("start": "node server.js")
├── package-lock.json      # Dependency lockfile
├── start.bat              # One-click Windows launch script
├── README.md              # Project documentation, architecture & guide
├── data/
│   ├── .gitkeep           # Ensures data directory exists on clone
│   ├── trame_db.template.json # Template structure for new clones
│   └── trame_db.json      # Your private JSON database (auto-created on first run, Git-ignored)
└── public/
    ├── index.html         # Main single-page application layout
    ├── css/
    │   └── style.css      # Glassmorphism, bookmark ribbon styles, animations & dark mode
    └── js/
        ├── api.js         # Client-side REST API client for JSON CRUD operations
        ├── weather.js     # Live Malaybalay weather manager & HTML5 canvas particle engine
        └── app.js         # Core application logic, calendar generator, carousel & modals
```
