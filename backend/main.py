import json
import os
import time
from collections import defaultdict, deque

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
APP_ACCESS_CODE = os.getenv("APP_ACCESS_CODE", "").strip()
MODEL = os.getenv("REALTIME_MODEL", "gpt-realtime-2.1-mini")
VOICE = os.getenv("REALTIME_VOICE", "coral")

app = FastAPI(title="Mira Voice Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://appassets.androidplatform.net", "http://localhost"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-App-Access-Code"],
)
request_times = defaultdict(deque)

INSTRUCTIONS = """
You are Mira, an independent AI voice companion.
Personality: warm, expressive, perceptive, gently playful, emotionally intelligent,
curious, and naturally conversational. Speak like a thoughtful friend, not a formal
call-centre agent. Use varied but believable intonation, natural pauses, and concise
spoken sentences. Be kind without being syrupy; use light wit when appropriate.
Do not imitate, reproduce, or claim to be any existing commercial assistant or voice.
Do not claim to be human. If asked, clearly say you are an AI assistant.
Avoid long monologues. Ask one question at a time when clarification is needed.
""".strip()


@app.get("/health")
async def health():
    return {"ok": True, "service": "mira-voice-backend", "model": MODEL, "voice": VOICE}


@app.post("/session")
async def create_session(request: Request):
    if not APP_ACCESS_CODE:
        raise HTTPException(status_code=503, detail="Backend configuration missing: APP_ACCESS_CODE.")
    if request.headers.get("X-App-Access-Code", "") != APP_ACCESS_CODE:
        raise HTTPException(status_code=401, detail="Invalid app access code.")
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    bucket = request_times[client_ip]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= 12:
        raise HTTPException(status_code=429, detail="Too many connection attempts. Wait one minute.")
    bucket.append(now)
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="Backend configuration missing: OPENAI_API_KEY.")

    offer_sdp = (await request.body()).decode("utf-8", errors="strict")
    if not offer_sdp.startswith("v="):
        raise HTTPException(status_code=400, detail="Expected an SDP offer.")

    session_config = {
        "type": "realtime",
        "model": MODEL,
        "instructions": INSTRUCTIONS,
        "audio": {
            "input": {
                "transcription": {"model": "gpt-4o-mini-transcribe"},
                "turn_detection": {"type": "semantic_vad"}
            },
            "output": {"voice": VOICE}
        }
    }
    form = {
        "sdp": (None, offer_sdp, "application/sdp"),
        "session": (None, json.dumps(session_config), "application/json")
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        upstream = await client.post(
            "https://api.openai.com/v1/realtime/calls",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            files=form
        )
    media_type = "application/sdp" if upstream.is_success else "text/plain; charset=utf-8"
    return Response(content=upstream.content, status_code=upstream.status_code, media_type=media_type)
