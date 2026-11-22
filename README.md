# Mira — Independent Android Voice Assistant

Mira is a new independent Android voice assistant. It is not the Sesame app and is not affiliated with Sesame AI. Its voice direction is warm, expressive, conversational, and feminine-presenting, without copying a proprietary voice.

## Included
- Android WebView shell with AndroidX HTTPS asset loader.
- Microphone permission handling.
- WebRTC voice conversation client.
- FastAPI backend proxy; permanent API key stays server-side.
- Transcript display and conversation controls.
- Docker backend and Render Blueprint.
- GitHub Actions debug APK build.

## Credentials required for live conversations
The APK builds without credentials, but live AI conversations require:
- `OPENAI_API_KEY`: a server-side OpenAI API key with Realtime API access and billing enabled.
- `APP_ACCESS_CODE`: a long random code you choose and enter in the app.

Never put the OpenAI API key in Android, GitHub source, or `config.js`.

## Deploy backend
1. Push the project to your GitHub repository.
2. Create a Render Blueprint from the repository using `render.yaml`.
3. Set `OPENAI_API_KEY` and `APP_ACCESS_CODE` in the Render service environment.
4. Deploy and copy the HTTPS service URL.
5. Check `https://YOUR-BACKEND/health`.

The built-in per-process rate limiter is only a basic guardrail. Before public launch, add durable rate limiting, monitoring, abuse controls, and real user authentication. A shared access code is not strong user authentication.

### Local backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```
Set `OPENAI_API_KEY` and `APP_ACCESS_CODE` environment variables, then run:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Configure Android
1. Optionally set `apiBaseUrl` in `app/src/main/assets/config.js`.
2. Build and install the APK.
3. Open Connection settings; enter backend HTTPS URL and access code.
4. Save settings, grant microphone permission, then tap Start talking.

The local app content uses `https://appassets.androidplatform.net` so WebView microphone capture runs from a secure origin.

## GitHub Actions build
1. Create a repository and upload the project files, including `.github/workflows/android-build.yml`.
2. Open Actions → Build Mira Android APK → Run workflow.
3. Open the completed run and download `mira-debug-apk`.
4. Extract and install `app-debug.apk`.

The workflow uses JDK 17 and Gradle 8.9. This is a debug APK for testing, not a signed public release. Configure your own release keystore securely for distribution.

## Voice
- Realtime model: `gpt-realtime-2.1-mini`
- Voice: `coral`
- Input transcription: `gpt-4o-mini-transcribe`
- Turn detection: semantic VAD

`coral` is a built-in synthetic voice chosen as a warm feminine-presenting starting point. It is not Sesame's Maya voice and is not a clone. Voice instructions guide style but cannot guarantee accent or emotion. Change `REALTIME_VOICE` in the backend environment to another supported voice and redeploy; voice is fixed for each session.

## Current limitations
This is a first working foundation, not a feature-for-feature recreation of another app. Firebase login, synced memory, push notifications, calling, image understanding, and account management are not yet implemented. Realtime API usage is metered and may incur charges. Set usage limits and monitor billing. The app discloses that its voice is AI-generated.

## Security before public release
- Keep the OpenAI API key only on the backend.
- Use HTTPS.
- Replace shared access code with authenticated sessions.
- Add persistent rate limiting and abuse monitoring.
- Add privacy, consent, and data-retention controls.
- Generate and securely back up your own Android release signing key.
