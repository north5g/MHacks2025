# MetaPrompt — MHacks 2025

## Team
- Cristian Dragoiu (dragoiuc@umich.edu)
- George North (george.north.v@gmail.com)
- Ednilson Chiambo (ednilsonc585@gmail.com)
- Maverick Brazill (mbrazill@umich.edu)

## Track
**Overdrive (Optimization):** Efficiency meets creativity. Explore algorithms, automation, and design strategies that make processes faster, smarter, and more seamless.

---

## Overview
Crafting effective prompts for AI tools is a time-consuming process. Developers often spend significant effort refining prompts to get high-quality results, which can slow down workflows and reduce productivity.

**MetaPrompt** is a browser extension that eliminates this bottleneck. By highlighting text and using our extension, developers can instantly generate optimized prompts designed to maximize the quality of responses from leading AI systems.

---

## Video Demonstration

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
  - **Prompt Fetch.ai**
    - Open Fetch.ai with your optimized prompt pre-filled.

---

## Why MetaPrompt?
- ⏱️ **Save Time** — Focus on learning, not building queries.  
- 🎯 **Boost Quality** — Get stronger, more helpful AI responses.  
- 🌐 **Seamless Integration** — Works directly in the browser.  
- 🔀 **Cross-Platform** — Optimized for ChatGPT, Gemini, and Claude.
- 💎 **Available to Prompt Anywhere** - Copy text to your clipboard for integration to your LLM of choice.

---

## Tech Stack
- **Frontend:** Browser Extension (Manifest V3), HTML, CSS, JavaScript
- **Backend:** Server Written with FastAPI, Pydantic, and Dotenv. Prompt Optimization Powered by Gemini API  
- **Platform Integrations:** ChatGPT, Gemini, Claude, FetchAPI  

---

## Getting Started

### Prerequisites
- [Gemini API Key](https://ai.google.dev/gemini-api/docs/api-key)
- Chrome or Chromium-based browser  
- Python 3.9+

### Installation
1. Clone the repo:
   ```bash
   git clone https://github.com/north5g/MHacks2025
   cd MHacks2025
   ```
2. Set up the .env file in backend folder
    ```
    GEMINI_API_KEY=<YOUR API KEY>
    REQUEST_TIMEOUT_SECONDS=20
    MAX_RETRIES=2
    ALLOWED_ORIGINS=chrome-extension://<YOUR_EXTENSION_ID>
    ```
3. move into backend folder if not there already
    ```bash
    cd backend
    ```
4. Set up the venv
    ```bash
    python3 -m venv .venv
    pip3 install -r requirements.txt
    ```
5.  Start the python server
    ```python
    python3 app.py
    ```
6. Navigate to [Extensions on Google Chrome](chrome://extensions/)
7. Click 'Load Unpacked' and navigate to the 'extension' file
8. Run the extension & Enjoy !
