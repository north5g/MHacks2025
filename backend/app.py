import os
import asyncio
import random
from typing import Dict, Optional, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, constr
import google.generativeai as genai


# -----------------------------------------
# Config & Secrects
# -----------------------------------------

# Load environvement variables to fetch API key
load_dotenv()


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

# -----------------------------------------
# FastAPI Logic
# -----------------------------------------

app = FastAPI(title="MHacks2025", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# -----------------------------------------
# Schemas (API contract)
# -----------------------------------------
"""Single source of truth for what the extension
   must send and what the backend will return."""
class RewriteReq(BaseModel):
    text: constr(min_length=1, max_length=8000)
    tone: Optional[str] = Field(
        default=None, description="User-selected tone (overrides preset if set)"
    )
    tags: Optional[List[str]] = Field(
        default_factory=list, description="Optional tags influencing style or content"
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
def build_prompt(text: str, tone: Optional[str] = None, tags: Optional[List[str]] = None) -> List[str]:
    """
    Builds a high-quality system + user prompt that converts arbitrary plaintext
    into a polished AI prompt suitable for downstream models, without adding formatting, explanations, or summaries.
    """
    instructions = []

    # Tone
    if tone:
        instructions.append(f"Tone: {tone.strip()}")

    # Tags / context
    if tags:
        instructions.append("Include contextual information based on these tags: " + ", ".join(tags))
    
    # instructions.append("Tone: clear, concise, professional")

    style_description = "; ".join(instructions)

    system = (
        "You are a prompt engineer for Meta-Prompt. "
        "Your task is to transform the user's raw input into a clear and actionable AI instruction that asks the next AI agent to explain the context, provide reasoning, and deliver a helpful answer. "
        f"The rewritten prompt must follow this style: {style_description}. "
        "Do not simply paraphrase the input. "
        "Instead, reformulate it as a complete question or task for an AI assistant, ensuring it requests relevant context or explanation where needed. "
        "Do not add extra information not present in the input. "
        "Output only the rewritten instruction, as plain text, ready to be passed to another AI API. "
    )

    user = f"Input:\n{text}\n"

    print('\n', f'sys: {system}', f'user: {user}', '\n')
    return [system, user]


async def call_gemini_with_timeout(messages: List[str]) -> str:
    """
    Call Gemini with the provided timeout and retry count.
    Uses asyncio.to_thread because the SDK call is synchronous.
    """
    async def once() -> str:
        def sync_call() -> str:
            model = genai.GenerativeModel(MODEL_NAME)
            resp = model.generate_content(messages)
            return (getattr(resp, "text", "") or "").strip()

        return await asyncio.to_thread(sync_call)
    
    last_err: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES+1):
        try:
            return await asyncio.wait_for(once(), timeout=REQUEST_TIMEOUT_SECONDS)
        except Exception as e:
            last_err = e
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


@app.post("/rewrite", response_model=RewriteResp)
async def rewrite(req: RewriteReq):
    messages = build_prompt(req.text, req.tone, req.tags)
    rewritten = await call_gemini_with_timeout(messages)

    if not rewritten:
        raise HTTPException(status_code=502, detail="No response from model")

    return RewriteResp(rewritten=rewritten)


# -----------------------------------------
# Main
# -----------------------------------------
if __name__ == "__main__":
    
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)