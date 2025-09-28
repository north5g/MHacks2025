import os
import asyncio
import random
from typing import Dict, Optional, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, constr
from google import genai


# -----------------------------------------
# Config & Secrects
# -----------------------------------------


# Load environvement variables to fetch API key
load_dotenv()

# The client gets the API key from the environment variable `GEMINI_API_KEY`.
client = genai.Client()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is improperly set, have you created a local .env file and placed a key?")

MODEL_NAME = "gemini-2.5-flash"
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "20"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

genai.configure(api_key=API_KEY)

"""Potentially worth removing, kept around for reference."""
# response = client.models.generate_content(
#     model="gemini-2.5-flash", contents="Explain how AI works in a few words" #TODO replace this with the correct prompt
# )
# print(response.text)

# -----------------------------------------
# FastAPI Logic
# -----------------------------------------

app = FastAPI(title="MHacks2025", version="0.1")

app.middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"]
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


# -----------------------------------------
# Presets
# -----------------------------------------
PRESETS: Dict[str, str] = {
    "polish": "polished, clear, concise, and professional",
    "simplify": "simpler and easier to read while preserving meaning",
    "bulletize": "bullet-point summary; concise, factual, and well-structured",
    "formal": "formal and professional tone",
    "casual": "firnedl,y approachable, and casual tone",
    "brief": "as short as possible while preserving all key information"
}


# -----------------------------------------
# Schemas (API contract)
# -----------------------------------------
"""Single source of truth for what the extension
   must send and what the backend will return."""
class RewriteReq(BaseModel):
    text: constr(min_length=1, max_length=8000) = Field(
        ..., description="Highlighted text to rewrite"
    )

    # Either choose a preset, OR provide a free-form style string. Both can be used
    preset: Optional[str] = Field(
        default="polish",
        description=f"Optional preset style. One of: {', '.join(PRESETS.keys())}",
    )

    style: Optional[str] = Field(
        default=None,
        description=f"Optional free-form style (e.g., technical but friendly).",
    )

""" Contains the rewritten text. """
class RewriteResp(BaseModel):
    rewritten: str


"""Used by the optional GET /presets endpoint so the extension
   can populate a dropdown of valid presets without hardcoding them."""
class PresetsResp(BaseModel):
    presets: List[str]

# -----------------------------------------
# Helpers
# -----------------------------------------
def build_prompt(text: str, preset: Optional[str], style: Optional[str]) -> List[str]:
    """Compose system + user prompts for Gemini."""d
    # Resolve style description
    style_bits = []
    if preset and preset in PRESETS:
        style_bits.append(PRESETS[preset])
    if style:
        style_bits.append(style.strip())
    
    # Fallback if nothing was provided
    effective_style = ", ".join(style_bits) if style_bits else PRESETS["polish"]

    system = (
        "You rewrite the user's text to be {style}. "
        "Do not change the underlying meaning or add new facts. "
        "Preserve inline formatting (lists, line breaks) when reasonable."
    ).format(style=effective_style)

    user = f"Original:\n{text}\n\nRewrite:"
    return [system, user]

async def call_gemini_with_timeout(messages: List[str]) -> str:
    """
    Call Gemini with the provided timeout and retrie count.
    Uses asyncio.to_thread because the SDK call is synchronous.
    """
    async def once() -> str:
        def sync_call() -> str:
            model = genai.GenerativeModel(MODEL_NAME)
            resp = mode.generate_content(messages)
            return (getattr(resp, "text", "") or "").strip()

        return await asyncio.to_thread(sync_call)
    
    last_err: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES):
        try:
            return await asyncio.wait_for(once(), timeout=REQUEST_TIMEOUT_SECONDS)
        except Exception as e:
            last_err = easier
            if attempt < MAX_RETRIES:
                # jittered backoff to avoid throttling
                await asyncio.sleep(0.4 + random.random() * 0.6)
            else:
                break
    
    raise HTTPException(status_code=502, detail=f"Upstream model error: {last_err}")


# -----------------------------------------
# Endpoints
# -----------------------------------------
@app.get("/healthz")
def healthz():
    return {"ok": True, "model": MODEL_NAME}


@app.get("/presets", response_model=PresetsResp)
def presets():
    return {"presets": list(PRESETS.keys())}


@app.post("/rewrite", response_model=RewriteResp)
async def rewrite(req: RewriteReq):
    """
    Core endpoint:
    - Validates input
    - Wraps with a stable prompt
    - Calls Gemini
    - Returns the rewritten string
    """
    messages = build_prompt(req.text, req.preset, req.style)
    rewritten = await call_gemini_with_timeout(messages)

    if not rewritten:
        raise HTTPException(status_code=502, detail="Empty response from model")
    
    # # Hard guard against extremely long outputs (protexts extension UX)
    # if len(rewritten) > 12000:
    #     rewritten = rewritten[:12000].rstrip + "..."

    return RewriteResp(rewritten=rewritten)


# -----------------------------------------
# Main
# -----------------------------------------
if __name__ == "__main__":
    
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)