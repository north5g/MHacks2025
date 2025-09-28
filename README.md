# MetaPrompt — MHacks 2025

## Team
- Cristian Dragoiu (dragoiuc@umich.edu)
- Ednilson Chiambo
- George North
- Maverick Brazill (mbrazill@umich.edu)

## Track
**Overdrive (Optimization):** Efficiency meets creativity. Explore algorithms, automation, and design strategies that make processes faster, smarter, and more seamless.

---

## Overview
Crafting effective prompts for AI tools is a time-consuming process. Developers often spend significant effort refining prompts to get high-quality results, which can slow down workflows and reduce productivity.

**MetaPrompt** is a browser extension that eliminates this bottleneck. By highlighting text and using our extension, developers can instantly generate optimized prompts designed to maximize the quality of responses from leading AI systems.

---

## Features

- **Highlight & Prompt**  
  Select any text on a webpage and open MetaPrompt’s context menu.

- **Customization Options (*Optional*)**  
  - **Prompt Types:** Academic, Exploratory, Technical  
  - **Tags:** Add project-specific tags (e.g., Python, UI Design, Optimization)

- **Actions**  
  - **Build Prompt**  
    - Generate a curated, high-quality prompt ready to copy and paste. *(Powered by Gemini)*  
  - **Prompt ChatGPT**  
    - Open ChatGPT with your optimized prompt pre-filled.  
  - **Prompt Gemini**  
    - Open Gemini with your optimized prompt pre-filled.  
  - **Prompt Claude**  
    - Open Claude with your optimized prompt pre-filled.  

---

## Why MetaPrompt?
- ⏱️ **Save Time** — Focus on building, not prompt tuning.  
- 🎯 **Boost Quality** — Get stronger, more relevant AI responses.  
- 🌐 **Seamless Integration** — Works directly in the browser.  
- 🔀 **Cross-Platform** — Optimized for ChatGPT, Gemini, and Claude.
- 💎 **Available to Prompt Anywhere** - Copy text to your clipboard for integration to your AI of choice.

---

## Tech Stack
- **Frontend:** Browser Extension (Manifest V3), HTML, CSS, JavaScript
- **Backend:** Powered by Gemini API for prompt optimization, Python for local server  
- **Platform Integrations:** ChatGPT, Gemini, Claude  

---

## Getting Started

### Prerequisites
- [Gemini API Key](https://ai.google.dev/gemini-api/docs/api-key)
- Chrome or Chromium-based browser  
- Python 3.9+

### Installation
1. Clone the repo:
   ```bash
   git clone https://github.com/your-username/metaprompt.git
   cd metaprompt
   ```
2. Set up the .env file in backend
    ```
    GEMINI_API_KEY=<YOUR API KEY>
    REQUEST_TIMEOUT_SECONDS=20
    MAX_RETRIES=2
    ALLOWED_ORIGINS=chrome-extension://<YOUR_EXTENSION_ID>
    ```
3. Set up the venv
    ```bash
    python3 -m venv .venv
    pip3 install -r requirements.txt
    ```
4. move into backend folder if not there already
    ```bash
    cd backend
    ```
5.  Start the python server
    ```python
    python3 app.py
    ```
6. Navigate to [Extensions on Google Chrome](chrome://extensions/)
7. Click 'Load Unpacked' and navigate to the 'extension' file
8. Run the extension & Enjoy !