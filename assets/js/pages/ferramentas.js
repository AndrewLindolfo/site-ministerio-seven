import { autoCorrelate, centsOff, medianFrequency, normalizeMetronomeBpm, normalizeTimeSignature, noteFromPitch, NOTE_NAMES, secondsPerBeat } from "../lib/audio-tools.js";

const TOOL_FOCUS_CLASS="tool-focus-active";
const tunerEls={};
const metroEls={};
let tunerAudioContext=null;
let tunerAnalyser=null;
let tunerMediaStream=null;
let tunerSource=null;
let tunerAnimationFrame=null;
let tunerBuffer=null;
let tunerStarting=false;
let lastTunerAnalysisAt=0;
let tunerRequestId=0;
let tunerFrequencyWindow=[];

let metronomeCtx=null;
let metronomeTimer=null;
let metronomeBeatIndex=0;
let metronomeBpm=72;
let metronomeSignature=4;
let metronomeNextBeatAt=0;
const metronomeVisualTimers=new Set();
const METRONOME_LOOKAHEAD_MS=25;
const METRONOME_SCHEDULE_AHEAD_SECONDS=0.12;

function $(s){return document.querySelector(s)}
function $all(s){return Array.from(document.querySelectorAll(s))}

function setToggleButtonState(button, running, labels={start:"Iniciar", stop:"Parar"}){
  if(!button) return;
  button.textContent = running ? labels.stop : labels.start;
  button.classList.toggle("is-running", !!running);
  button.classList.toggle("is-stopped", !running);
  button.setAttribute("aria-pressed", running ? "true" : "false");
}


function setToolBodyVisible(target, visible){
  const body=document.getElementById(`tool-body-${target}`);
  if(!body)return;
  body.classList.toggle("hidden",!visible);
  const expandBtn=document.querySelector(`.tool-expand-btn[data-target="${target}"]`);
  if(expandBtn){
    expandBtn.textContent=visible?"Fechar":"Abrir";
    expandBtn.setAttribute("aria-expanded", visible ? "true" : "false");
  }
  if(!visible&&target==="afinador") stopTuner();
  if(!visible&&target==="metronomo") stopMetronome();
}
function isToolBodyVisible(target){
  const body=document.getElementById(`tool-body-${target}`);
  return body?!body.classList.contains("hidden"):false;
}
function setFocusMode(target=""){
  const cards=$all(".tool-card");
  const body=document.body;
  if(!target){
    body.classList.remove(TOOL_FOCUS_CLASS);
    cards.forEach(card=>{
      card.classList.remove("is-focus");
      const btn=card.querySelector(".tool-focus-btn");
      if(btn)btn.setAttribute("aria-pressed","false");
    });
    return;
  }
  body.classList.add(TOOL_FOCUS_CLASS);
  if(target!=="afinador")stopTuner();
  if(target!=="metronomo")stopMetronome();
  cards.forEach(card=>{
    const active=card.dataset.tool===target;
    card.classList.toggle("is-focus",active);
    const btn=card.querySelector(".tool-focus-btn");
    if(btn)btn.setAttribute("aria-pressed",active?"true":"false");
    if(active)setToolBodyVisible(target,true);
  });
}

function toggleToolFullscreen(target){
  const card=document.getElementById(`tool-card-${target}`);
  if(!card)return;
  const btn=card.querySelector(".tool-fullscreen-btn");
  const isFs=document.fullscreenElement===card;
  if(isFs){
    document.exitFullscreen?.();
    return;
  }
  card.requestFullscreen?.().catch(()=>{});
}
function syncToolFullscreenButtons(){
  const current=document.fullscreenElement;
  $all(".tool-fullscreen-btn").forEach(btn=>{
    const target=btn.dataset.target;
    const card=document.getElementById(`tool-card-${target}`);
    const active=!!current && current===card;
    btn.classList.toggle("is-active",active);
    btn.setAttribute("aria-pressed",active?"true":"false");
    btn.setAttribute("title",active?"Sair da tela cheia":"Tela cheia");
  });
}
function initToolCardActions(){
  $all(".tool-expand-btn").forEach(button=>{
    button.addEventListener("click",()=>{
      const target=button.dataset.target;
      setToolBodyVisible(target,!isToolBodyVisible(target));
    });
  });
  $all(".tool-collapse-btn").forEach(button=>{
    button.addEventListener("click",()=>{
      const target=button.dataset.target;
      setToolBodyVisible(target,false);
    });
  });

  $all(".tool-fullscreen-btn").forEach(button=>{
    button.addEventListener("click",()=>{
      const target=button.dataset.target;
      toggleToolFullscreen(target);
    });
  });
  document.addEventListener("fullscreenchange",syncToolFullscreenButtons);
  $all(".tool-focus-btn").forEach(button=>{
    button.addEventListener("click",()=>{
      const target=button.dataset.target;
      const currentCard=document.getElementById(`tool-card-${target}`);
      if(currentCard?.classList.contains("is-focus")) setFocusMode("");
      else setFocusMode(target);
    });
  });
}

function updateTunerStatus(text, note="--", octave="--", hz="-- Hz"){
  tunerEls.status.textContent=text;
  tunerEls.note.textContent=note;
  tunerEls.octave.textContent=octave;
  tunerEls.hz.textContent=hz;
}
function updateTunerMeter(cents=0){
  const clamped=Math.max(-50,Math.min(50,cents));
  const left=50+clamped;
  tunerEls.needle.style.left=`${left}%`;
  if(Math.abs(clamped)<=5) updateTunerStatus("Afinado",tunerEls.note.textContent,tunerEls.octave.textContent,tunerEls.hz.textContent);
  else if(clamped<0) updateTunerStatus(clamped<-25?"Muito baixo":"Baixo",tunerEls.note.textContent,tunerEls.octave.textContent,tunerEls.hz.textContent);
  else updateTunerStatus(clamped>25?"Muito alto":"Alto",tunerEls.note.textContent,tunerEls.octave.textContent,tunerEls.hz.textContent);
}
function tunerLoop(timestamp=0){
  if(!tunerAnalyser)return;
  if(timestamp-lastTunerAnalysisAt<50){
    tunerAnimationFrame=requestAnimationFrame(tunerLoop);
    return;
  }
  lastTunerAnalysisAt=timestamp;
  tunerAnalyser.getFloatTimeDomainData(tunerBuffer);
  const frequency=autoCorrelate(tunerBuffer,tunerAudioContext.sampleRate);
  if(frequency!==-1){
    tunerFrequencyWindow.push(frequency);
    if(tunerFrequencyWindow.length>5)tunerFrequencyWindow.shift();
    const stableFrequency=medianFrequency(tunerFrequencyWindow);
    const {midi,noteIndex,octave}=noteFromPitch(stableFrequency);
    const cents=centsOff(stableFrequency,midi);
    tunerEls.note.textContent=NOTE_NAMES[noteIndex];
    tunerEls.octave.textContent=`Oitava ${octave}`;
    tunerEls.hz.textContent=`${stableFrequency.toFixed(1)} Hz`;
    updateTunerMeter(cents);
  }else{
    tunerFrequencyWindow=[];
    updateTunerStatus("Escutando...","--","--","-- Hz");
  }
  tunerAnimationFrame=requestAnimationFrame(tunerLoop);
}
async function startTuner(){
  if(tunerStarting||tunerAnimationFrame)return;
  const button=$("#tuner-start-btn");
  if(!navigator.mediaDevices?.getUserMedia){
    updateTunerStatus("Microfone indisponível");
    return;
  }
  tunerStarting=true;
  const requestId=++tunerRequestId;
  if(button)button.disabled=true;
  try{
    tunerMediaStream=await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}
    });
    if(requestId!==tunerRequestId){
      tunerMediaStream.getTracks().forEach(track=>track.stop());
      tunerMediaStream=null;
      return;
    }
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error("Web Audio indisponível");
    tunerAudioContext=new AudioCtx();
    tunerAnalyser=tunerAudioContext.createAnalyser();
    tunerAnalyser.fftSize=1024;
    tunerBuffer=new Float32Array(tunerAnalyser.fftSize);
    tunerSource=tunerAudioContext.createMediaStreamSource(tunerMediaStream);
    tunerSource.connect(tunerAnalyser);
    updateTunerStatus("Escutando...","--","--","-- Hz");
    if(tunerAnimationFrame) cancelAnimationFrame(tunerAnimationFrame);
    lastTunerAnalysisAt=0;
    setToggleButtonState(button, true, {start:"Iniciar afinador", stop:"Parar afinador"});
    tunerLoop();
  }catch(error){
    console.error("Erro ao iniciar afinador:",error);
    stopTuner("Permissão negada ou microfone indisponível");
  }finally{
    tunerStarting=false;
    if(button)button.disabled=false;
  }
}
function stopTuner(status="Afinador parado"){
  tunerRequestId+=1;
  tunerFrequencyWindow=[];
  if(tunerAnimationFrame) cancelAnimationFrame(tunerAnimationFrame);
  tunerAnimationFrame=null;
  if(tunerSource){try{tunerSource.disconnect()}catch{}}
  if(tunerAnalyser){try{tunerAnalyser.disconnect()}catch{}}
  if(tunerAudioContext){try{tunerAudioContext.close()}catch{}}
  if(tunerMediaStream){tunerMediaStream.getTracks().forEach(track=>track.stop())}
  tunerAudioContext=null; tunerAnalyser=null; tunerMediaStream=null; tunerSource=null; tunerBuffer=null;
  if(tunerEls.needle)tunerEls.needle.style.left="50%";
  if(tunerEls.status)updateTunerStatus(status);
  setToggleButtonState($("#tuner-start-btn"), false, {start:"Iniciar afinador", stop:"Parar afinador"});
}

function buildBeats(count=4){
  metroEls.beats.replaceChildren();
  for(let i=0;i<count;i+=1){
    const dot=document.createElement("span");
    dot.className="metronome-beat";
    if(i===0) dot.classList.add("is-primary");
    metroEls.beats.appendChild(dot);
  }
}
function highlightBeat(index){
  const beats=Array.from(metroEls.beats.children);
  beats.forEach((beat,i)=>beat.classList.toggle("is-active",i===index));
}
function ensureMetronomeCtx(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return null;
  if(!metronomeCtx) metronomeCtx=new AudioCtx();
  return metronomeCtx;
}
function clickTone(primary=false,when=null){
  const ctx=ensureMetronomeCtx();
  if(!ctx)return;
  const now=Number.isFinite(when)?Math.max(ctx.currentTime,when):ctx.currentTime;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type="sine";
  osc.frequency.value=primary?1200:850;
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(primary?0.18:0.12,now+0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+0.08);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now+0.09);
}
function scheduleVisualBeat(index,when){
  const ctx=metronomeCtx;
  if(!ctx)return;
  const delay=Math.max(0,Math.round((when-ctx.currentTime)*1000));
  const timer=setTimeout(()=>{
    metronomeVisualTimers.delete(timer);
    if(metronomeTimer)highlightBeat(index);
  },delay);
  metronomeVisualTimers.add(timer);
}
function scheduleMetronome(){
  const ctx=ensureMetronomeCtx();
  if(!ctx||!metronomeTimer)return;
  while(metronomeNextBeatAt<ctx.currentTime+METRONOME_SCHEDULE_AHEAD_SECONDS){
    const index=metronomeBeatIndex;
    clickTone(index===0,metronomeNextBeatAt);
    scheduleVisualBeat(index,metronomeNextBeatAt);
    metronomeBeatIndex=(index+1)%metronomeSignature;
    metronomeNextBeatAt+=secondsPerBeat(metronomeBpm);
  }
}
function stopMetronome(){
  if(metronomeTimer) clearInterval(metronomeTimer);
  metronomeTimer=null; metronomeBeatIndex=0;
  metronomeNextBeatAt=0;
  metronomeVisualTimers.forEach(timer=>clearTimeout(timer));
  metronomeVisualTimers.clear();
  setToggleButtonState(metroEls.toggle, false, {start:"Iniciar", stop:"Parar"});
  highlightBeat(-1);
}
function startMetronome(){
  stopMetronome();
  const ctx=ensureMetronomeCtx();
  if(!ctx)return;
  if(ctx.state==="suspended")ctx.resume().catch(()=>{});
  metronomeNextBeatAt=ctx.currentTime+0.05;
  setToggleButtonState(metroEls.toggle, true, {start:"Iniciar", stop:"Parar"});
  metronomeTimer=setInterval(scheduleMetronome,METRONOME_LOOKAHEAD_MS);
  scheduleMetronome();
}
function toggleMetronome(){
  if(metronomeTimer) stopMetronome(); else startMetronome();
}
function initTuner(){
  tunerEls.status=$("#tuner-status");
  tunerEls.note=$("#tuner-note");
  tunerEls.octave=$("#tuner-octave");
  tunerEls.hz=$("#tuner-hz");
  tunerEls.needle=$("#tuner-needle");
  const tunerBtn=$("#tuner-start-btn");
  tunerBtn?.addEventListener("click",()=>{ if(tunerAnimationFrame) stopTuner(); else startTuner(); });
  setToggleButtonState(tunerBtn, false, {start:"Iniciar afinador", stop:"Parar afinador"});
}
function initMetronome(){
  metroEls.bpmValue=$("#metronome-bpm-value");
  metroEls.slider=$("#metronome-bpm-slider");
  metroEls.signature=$("#metronome-time-signature");
  metroEls.toggle=$("#metronome-toggle");
  metroEls.beats=$("#metronome-beats");
  buildBeats(metronomeSignature);
  setToggleButtonState(metroEls.toggle, false, {start:"Iniciar", stop:"Parar"});
  const syncBpm=(value)=>{
    metronomeBpm=normalizeMetronomeBpm(value);
    metroEls.bpmValue.textContent=String(metronomeBpm);
    metroEls.slider.value=String(metronomeBpm);
    if(metronomeTimer) startMetronome();
  };
  $("#metronome-minus")?.addEventListener("click",()=>syncBpm(Math.max(30,metronomeBpm-1)));
  $("#metronome-plus")?.addEventListener("click",()=>syncBpm(Math.min(240,metronomeBpm+1)));
  metroEls.slider?.addEventListener("input",(event)=>syncBpm(event.target.value));
  metroEls.signature?.addEventListener("change",(event)=>{
    metronomeSignature=normalizeTimeSignature(event.target.value);
    buildBeats(metronomeSignature);
    if(metronomeTimer) startMetronome();
  });
  metroEls.toggle?.addEventListener("click",toggleMetronome);
}
document.addEventListener("DOMContentLoaded",()=>{
  initToolCardActions();
  syncToolFullscreenButtons();
  initTuner();
  initMetronome();
});
window.addEventListener("beforeunload",()=>{
  stopTuner();
  stopMetronome();
  metronomeCtx?.close().catch(()=>{});
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden)stopTuner();
});
