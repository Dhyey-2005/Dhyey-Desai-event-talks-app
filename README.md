# BQ Pulse: Google BigQuery Release Radar & Broadcaster

**BQ Pulse** is a modern, responsive web application built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript**. It fetches, parses, and formats the official Google BigQuery release notes feed into a clean, searchable, and filterable developer dashboard. It also features a custom Tweet Composer to easily format, count characters, and broadcast updates directly to Twitter/X.

---

## ✨ Features

*   **⚡ Smart Feed Parsing & Flattening:** Splices multi-item updates published under a single date into individual, self-contained update cards for precise tracking.
*   **💾 In-Memory Cache with Fallbacks:** Cache-backed retrieval system updates every 15 minutes, reducing network latency and preventing Google rate limits. If the network goes offline, it seamlessly falls back to cached data.
*   **🔍 Live Search & Filter:** Instantly filter updates by type (*Features, Issues, Deprecations, Others*) and perform real-time text searches across updates.
*   **🎨 Premium Glassmorphism UI:** Features a high-end, responsive dark theme with ambient background glow effects, smooth CSS transitions, skeletal loaders, and mobile-friendly layouts.
*   **🐦 Twitter/X Broadcaster:**
    *   Composes a pre-formatted tweet draft automatically when you select any release item.
    *   Dynamic circular progress ring with character count limit alerts (up to 280 characters).
    *   Uses Twitter Web Intent to securely direct you to X for posting.
*   **📜 Local Broadcast History:** Saves your broadcast timeline to the browser's persistent `localStorage` and logs it in the sidebar timeline.

---

## 🛠️ Technology Stack

*   **Backend:** Python 3.12, Flask (REST API)
*   **Frontend:** Vanilla HTML5, CSS3 (Custom Variables, Flexbox, CSS Grid), JavaScript (ES6, Web Intents, Web Storage)
*   **Data parsing:** Python `xml.etree.ElementTree` and regular expressions

---

## 📂 Directory Structure

```text
├── app.py                  # Flask web server, XML parser, & caching controller
├── requirements.txt        # Python library dependencies
├── .gitignore              # Git ignored files & bytecodes
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Main application page structure
└── static/
    ├── css/
    │   └── style.css       # Stylesheet, colors, custom animations & grids
    └── js/
        └── app.js          # Main client-side script & modal manager
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Python 3.12+ installed on your system.

### 2. Installation
Clone the repository (or navigate to the workspace directory) and install dependencies:
```bash
pip install -r requirements.txt
```

### 3. Run the Web Server
Launch the Flask development server:
```bash
python app.py
```

By default, the server starts in debug mode on port 5000:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📖 How to Use

1.  **Monitor Releases:** The main page will load BigQuery release notes. The green dot in the header indicates standard sync.
2.  **Filter and Sort:** Click filter badges (*Features, Issues, Deprecations*) or select sorting order in the toolbar card.
3.  **Search Notes:** Type keywords in the search bar. The card layout matches matching terms in real-time.
4.  **Copy Links & Text:** 
    *   Click **Link** to copy the direct link anchor to your clipboard.
    *   Click **Copy Text** to copy pre-formatted plain text containing the update content and source link.
5.  **Broadcast updates:**
    *   Click **Tweet Summary** on any card.
    *   Edit the draft inside the composer modal.
    *   Click **Post to X / Twitter** to open a new browser tab with your tweet, or click **Save to History** to log it locally inside your BQ Pulse dashboard timeline.
