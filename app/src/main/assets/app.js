(() => {
  const $ = id => document.getElementById(id);
  const status = $("status"), stateText = $("stateText"), orb = $("orb");
  const messages = $("messages"), startBtn = $("startBtn");
  const apiUrlInput = $("apiUrl"), accessInput = $("accessCode");
  let pc = null, localStream = null, dataChannel = null, connected = false;
  let currentAssistantBubble = null;
  apiUrlInput.value = localStorage.getItem("mira_api_url") || (window.MIRA_CONFIG?.apiBaseUrl || "");
  accessInput.value = localStorage.getItem("mira_access_code") || "";

  function setState(label, mode = "") {
    stateText.textContent = label;
    status.textContent = connected ? "Connected" : "Not connected";
    orb.className = "orb " + mode;
  }
  function addMessage(role, text) {
    const empty = messages.querySelector(".empty"); if (empty) empty.remove();
    const bubble = document.createElement("div"); bubble.className = "bubble " + role;
    const label = document.createElement("small"); label.textContent = role === "user" ? "You" : "Mira";
    const content = document.createElement("div"); content.textContent = text;
    bubble.append(label, content); messages.appendChild(bubble); messages.scrollTop = messages.scrollHeight;
    return content;
  }
  function getConfig() {
    const base = apiUrlInput.value.trim().replace(/\/+$/, ""), code = accessInput.value.trim();
    if (!/^https:\/\//i.test(base)) throw new Error("Enter your HTTPS backend URL in Connection settings.");
    if (!code) throw new Error("Enter the app access code provided by your backend administrator.");
    return {base, code};
  }
  async function waitForIce(peer) {
    if (peer.iceGatheringState === "complete") return;
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 12000);
      peer.addEventListener("icegatheringstatechange", () => {
        if (peer.iceGatheringState === "complete") { clearTimeout(timer); resolve(); }
      });
    });
  }
  function onEvent(event) {
    let data; try { data = JSON.parse(event.data); } catch { return; }
    const type = data.type || "";
    if (type === "input_audio_buffer.speech_started") setState("Listening…", "active");
    if (type === "input_audio_buffer.speech_stopped") setState("Thinking…", "active");
    if (type === "response.created") setState("Mira is replying…", "speaking");
    if (type === "conversation.item.input_audio_transcription.completed" && data.transcript) addMessage("user", data.transcript);
    if (type === "response.output_audio_transcript.delta" || type === "response.output_text.delta") {
      if (!currentAssistantBubble) currentAssistantBubble = addMessage("assistant", "");
      currentAssistantBubble.textContent += data.delta || "";
      messages.scrollTop = messages.scrollHeight;
    }
    if (type === "response.output_audio_transcript.done" || type === "response.done") {
      currentAssistantBubble = null; setState("Listening…", "active");
    }
    if (type === "error") {
      addMessage("assistant", "Connection notice: " + (data.error?.message || "Voice session error."));
      setState("Something needs attention.");
    }
  }
  async function stop(resetButton = true) {
    connected = false;
    if (dataChannel) { try { dataChannel.close(); } catch {} dataChannel = null; }
    if (pc) { try { pc.close(); } catch {} pc = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    const audio = $("remoteAudio"); audio.pause(); audio.srcObject = null;
    $("stopBtn").disabled = true; if (resetButton) startBtn.disabled = false;
    setState("Conversation ended.");
  }
  async function start() {
    try {
      const {base, code} = getConfig();
      startBtn.disabled = true; setState("Requesting microphone…", "active");
      localStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      pc = new RTCPeerConnection();
      pc.ontrack = event => { const audio = $("remoteAudio"); audio.srcObject = event.streams[0]; audio.play().catch(()=>{}); };
      pc.onconnectionstatechange = () => { if (pc && ["failed","disconnected","closed"].includes(pc.connectionState)) setState("Connection interrupted."); };
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      dataChannel = pc.createDataChannel("oai-events"); dataChannel.onmessage = onEvent;
      dataChannel.onopen = () => setState("Listening…", "active");
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      setState("Connecting securely…", "active"); await waitForIce(pc);
      const response = await fetch(base + "/session", {
        method:"POST", headers:{"Content-Type":"application/sdp","X-App-Access-Code":code},
        body:pc.localDescription.sdp
      });
      if (!response.ok) throw new Error((await response.text()) || `Backend error (${response.status})`);
      await pc.setRemoteDescription({type:"answer",sdp:await response.text()});
      connected = true; status.textContent = "Connecting…"; $("stopBtn").disabled = false;
      setState("Connected. Go ahead, I'm listening.", "active");
    } catch (error) {
      addMessage("assistant", error.message || "Could not start the conversation.");
      await stop(false); startBtn.disabled = false;
    }
  }
  $("startBtn").addEventListener("click", start);
  $("stopBtn").addEventListener("click", () => stop(true));
  $("saveSettings").addEventListener("click", () => {
    localStorage.setItem("mira_api_url", apiUrlInput.value.trim());
    localStorage.setItem("mira_access_code", accessInput.value.trim());
    setState("Settings saved on this device.");
  });
  $("clearBtn").addEventListener("click", () => messages.innerHTML = '<div class="empty">Your conversation will appear here.</div>');
  window.addEventListener("beforeunload", () => stop(false));
})();
