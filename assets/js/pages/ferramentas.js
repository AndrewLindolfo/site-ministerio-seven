
const TOOL_FOCUS_CLASS="tool-focus-active";
const tunerEls={};
const metroEls={};
let tunerAudioContext=null;
let tunerAnalyser=null;
let tunerMediaStream=null;
let tunerSource=null;
let tunerAnimationFrame=null;

let metronomeCtx=null;
let metronomeTimer=null;
let metronomeBeatIndex=0;
let metronomeBpm=72;
let metronomeSignature=4;

const NOTE_NAMES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

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
function noteFromPitch(frequency){
  const noteNumber=12*(Math.log(frequency/440)/Math.log(2));
  const midi=Math.round(noteNumber)+69;
  const noteIndex=((midi%12)+12)%12;
  const octave=Math.floor(midi/12)-1;
  return {midi,noteIndex,octave};
}
function centsOff(frequency,midi){
  const reference=440*Math.pow(2,(midi-69)/12);
  return Math.floor(1200*Math.log2(frequency/reference));
}
function autoCorrelate(buffer,sampleRate){
  let rms=0;
  for(let i=0;i<buffer.length;i+=1)rms+=buffer[i]*buffer[i];
  rms=Math.sqrt(rms/buffer.length);
  if(rms<0.01)return -1;
  let r1=0; let r2=buffer.length-1; const threshold=0.2;
  for(let i=0;i<buffer.length/2;i+=1){if(Math.abs(buffer[i])<threshold){r1=i;break;}}
  for(let i=1;i<buffer.length/2;i+=1){if(Math.abs(buffer[buffer.length-i])<threshold){r2=buffer.length-i;break;}}
  const sliced=buffer.slice(r1,r2); const size=sliced.length; const correlations=new Array(size).fill(0);
  for(let offset=0;offset<size;offset+=1){
    for(let i=0;i<size-offset;i+=1){correlations[offset]+=sliced[i]*sliced[i+offset]}
  }
  let d=0; while(d+1<size&&correlations[d]>correlations[d+1])d+=1;
  let maxval=-1; let maxpos=-1;
  for(let i=d;i<size;i+=1){if(correlations[i]>maxval){maxval=correlations[i];maxpos=i}}
  if(maxpos===-1)return -1;
  let T0=maxpos;
  if(T0>0&&T0<size-1){
    const x1=correlations[T0-1], x2=correlations[T0], x3=correlations[T0+1];
    const a=(x1+x3-2*x2)/2; const b=(x3-x1)/2;
    if(a)T0-=b/(2*a);
  }
  return sampleRate/T0;
}
function updateTunerMeter(cents=0){
  const clamped=Math.max(-50,Math.min(50,cents));
  const left=50+clamped;
  tunerEls.needle.style.left=`${left}%`;
  if(Math.abs(clamped)<=5) updateTunerStatus("Afinado",tunerEls.note.textContent,tunerEls.octave.textContent,tunerEls.hz.textContent);
  else if(clamped<0) updateTunerStatus(clamped<-25?"Muito baixo":"Baixo",tunerEls.note.textContent,tunerEls.octave.textContent,tunerEls.hz.textContent);
  else updateTunerStatus(clamped>25?"Muito alto":"Alto",tunerEls.note.textContent,tunerEls.octave.textContent,tunerEls.hz.textContent);
}
function tunerLoop(){
  if(!tunerAnalyser)return;
  const buffer=new Float32Array(tunerAnalyser.fftSize);
  tunerAnalyser.getFloatTimeDomainData(buffer);
  const frequency=autoCorrelate(buffer,tunerAudioContext.sampleRate);
  if(frequency!==-1){
    const {midi,noteIndex,octave}=noteFromPitch(frequency);
    const cents=centsOff(frequency,midi);
    tunerEls.note.textContent=NOTE_NAMES[noteIndex];
    tunerEls.octave.textContent=`Oitava ${octave}`;
    tunerEls.hz.textContent=`${frequency.toFixed(1)} Hz`;
    updateTunerMeter(cents);
  }else{
    updateTunerStatus("Escutando...","--","--","-- Hz");
  }
  tunerAnimationFrame=requestAnimationFrame(tunerLoop);
}
async function startTuner(){
  setToggleButtonState($("#tuner-start-btn"), true, {start:"Iniciar afinador", stop:"Parar afinador"});
  try{
    if(!navigator.mediaDevices?.getUserMedia){updateTunerStatus("Microfone indisponível");return;}
    tunerMediaStream=await navigator.mediaDevices.getUserMedia({audio:true});
    tunerAudioContext=new (window.AudioContext||window.webkitAudioContext)();
    tunerAnalyser=tunerAudioContext.createAnalyser();
    tunerAnalyser.fftSize=2048;
    tunerSource=tunerAudioContext.createMediaStreamSource(tunerMediaStream);
    tunerSource.connect(tunerAnalyser);
    updateTunerStatus("Escutando...","--","--","-- Hz");
    if(tunerAnimationFrame) cancelAnimationFrame(tunerAnimationFrame);
    tunerLoop();
  }catch(error){
    console.error("Erro ao iniciar afinador:",error);
    updateTunerStatus("Permissão negada ou microfone indisponível");
    setToggleButtonState($("#tuner-start-btn"), false, {start:"Iniciar afinador", stop:"Parar afinador"});
  }
}
function stopTuner(){
  if(tunerAnimationFrame) cancelAnimationFrame(tunerAnimationFrame);
  tunerAnimationFrame=null;
  if(tunerSource){try{tunerSource.disconnect()}catch{}}
  if(tunerAnalyser){try{tunerAnalyser.disconnect()}catch{}}
  if(tunerAudioContext){try{tunerAudioContext.close()}catch{}}
  if(tunerMediaStream){tunerMediaStream.getTracks().forEach(track=>track.stop())}
  tunerAudioContext=null; tunerAnalyser=null; tunerMediaStream=null; tunerSource=null;
  tunerEls.needle.style.left="50%";
  updateTunerStatus("Afinador parado");
  setToggleButtonState($("#tuner-start-btn"), false, {start:"Iniciar afinador", stop:"Parar afinador"});
}

function buildBeats(count=4){
  metroEls.beats.innerHTML="";
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
  if(!metronomeCtx) metronomeCtx=new (window.AudioContext||window.webkitAudioContext)();
  return metronomeCtx;
}
function clickTone(primary=false){
  const ctx=ensureMetronomeCtx();
  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type="sine";
  osc.frequency.value=primary?1200:850;
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(primary?0.18:0.12,now+0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+0.08);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now+0.09);
}
function metronomeTick(){
  const primary=metronomeBeatIndex===0;
  clickTone(primary);
  highlightBeat(metronomeBeatIndex);
  metronomeBeatIndex=(metronomeBeatIndex+1)%metronomeSignature;
}
function stopMetronome(){
  if(metronomeTimer) clearInterval(metronomeTimer);
  metronomeTimer=null; metronomeBeatIndex=0;
  setToggleButtonState(metroEls.toggle, false, {start:"Iniciar", stop:"Parar"});
  highlightBeat(-1);
}
function startMetronome(){
  stopMetronome();
  const interval=Math.max(40,Math.round(60000/metronomeBpm));
  setToggleButtonState(metroEls.toggle, true, {start:"Iniciar", stop:"Parar"});
  metronomeTick();
  metronomeTimer=setInterval(metronomeTick,interval);
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
    metronomeBpm=Number(value||72);
    metroEls.bpmValue.textContent=String(metronomeBpm);
    metroEls.slider.value=String(metronomeBpm);
    if(metronomeTimer) startMetronome();
  };
  $("#metronome-minus")?.addEventListener("click",()=>syncBpm(Math.max(30,metronomeBpm-1)));
  $("#metronome-plus")?.addEventListener("click",()=>syncBpm(Math.min(240,metronomeBpm+1)));
  metroEls.slider?.addEventListener("input",(event)=>syncBpm(event.target.value));
  metroEls.signature?.addEventListener("change",(event)=>{
    metronomeSignature=Number(event.target.value||4);
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
});
