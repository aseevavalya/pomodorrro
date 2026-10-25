const $ = (selector) => document.querySelector(selector);
const defaults = { focus: 25, short: 5, long: 15, rounds: 4, auto: false, sound: true };
let settings = { ...defaults };
try { const saved = JSON.parse(localStorage.getItem('tishe-settings')); if (saved) { for (const key of ['focus','short','long']) if (Number.isInteger(saved[key]) && saved[key]>=1 && saved[key]<=180) settings[key]=saved[key]; for (const key of ['auto','sound']) if(typeof saved[key]==='boolean') settings[key]=saved[key]; } } catch {}
try { const saved = JSON.parse(localStorage.getItem('tishe-settings')); if (Number.isInteger(saved?.rounds) && saved.rounds >= 1 && saved.rounds <= 12) settings.rounds = saved.rounds; } catch {}
let mode = 'focus', remaining = settings.focus * 60, total = remaining, running = false, deadline = 0, completed = 0, cycleCompleted = 0, audio;
const names = {focus:'Lernen',short:'Pause',long:'Lange Pause'};
const save = () => { try {localStorage.setItem('tishe-settings',JSON.stringify(settings));} catch {} };
function render() {
  const minutes = String(Math.floor(remaining / 60)).padStart(2,'0'), seconds = String(remaining % 60).padStart(2,'0');
  $('#time').innerHTML = `${minutes}<span>:</span>${seconds}`;
  $('#time').setAttribute('aria-label', `Noch ${minutes} Minuten und ${seconds} Sekunden`);
  document.title = `${minutes}:${seconds} · ${names[mode]} — Leise`;
  $('#progress').style.strokeDashoffset = 911.062 * (1-remaining/total);
  $('#start-label').textContent = running ? 'Anhalten' : remaining < total ? 'Fortsetzen' : 'Starten';
  $('#play-icon').textContent = running ? 'Ⅱ' : '▶';
}
function selectMode(next) {
  checkpoint(); segmentStart = null;
  running = false; mode = next; remaining = total = settings[mode]*60;
  if(mode==='focus' && cycleCompleted>=settings.rounds)cycleCompleted=0;
  document.querySelectorAll('[data-mode]').forEach(button => {button.classList.toggle('active',button.dataset.mode===mode);button.setAttribute('aria-pressed',String(button.dataset.mode===mode));});
  $('#phase').textContent = mode === 'focus' ? 'ZEIT, DICH ZU KONZENTRIEREN' : 'ZEIT ZUM DURCHATMEN';
  $('#caption').textContent = mode === 'focus' ? 'Nur du und deine Aufgabe.' : 'Blick weg vom Bildschirm. Atme durch.';
  updateSessions();render();
}
function updateSessions() {
  const dots = $('#dots'); dots.replaceChildren();
  for (let i=0; i<settings.rounds; i++) {
    const dot = document.createElement('i');
    if (i<cycleCompleted) dot.classList.add('done');
    dots.append(dot);
  }
  $('#dots').setAttribute('aria-label',`Abgeschlossene Einheiten insgesamt: ${completed}`);
  $('#session-label').textContent = cycleCompleted >= settings.rounds ? `Zyklus geschafft · ${settings.rounds} von ${settings.rounds}` : `Einheit ${Math.max(1,Math.min(cycleCompleted + (mode==='focus'?1:0),settings.rounds))} von ${settings.rounds}`;
}
function updateCycleNote() {
  const minutes = settings.focus * settings.rounds + settings.short * (settings.rounds-1);
  $('#settings-note').textContent = `Lange Pause nach ${settings.rounds} ${settings.rounds===1?'Lerneinheit':'Lerneinheiten'} · ${minutes} Min. bis dahin. Bei Änderung der Anzahl beginnt die Zählung neu.`;
}
function unlockAudio() { try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if(audio.state==='suspended') audio.resume(); } catch {} }
function chime() { if(!settings.sound || !audio) return; [0,.22,.44].forEach((delay,i)=>{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=[523.25,659.25,783.99][i];gain.gain.setValueAtTime(0,audio.currentTime+delay);gain.gain.linearRampToValueAtTime(.12,audio.currentTime+delay+.025);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+delay+.8);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(audio.currentTime+delay);oscillator.stop(audio.currentTime+delay+.85);}); }
let segmentStart = null, segmentId = null;
function checkpoint() {
  if (!running || segmentStart === null) return;
  HistoryTracker.record(segmentId, segmentStart, Math.min(Date.now(), deadline), mode);
}
function start() { unlockAudio(); running=true;segmentStart=Date.now();segmentId=HistoryTracker.newId();deadline=segmentStart+remaining*1000;render(); }
function advance(finished=false) {
  let next='focus';
  if(mode==='focus') {
    if(cycleCompleted>=settings.rounds)cycleCompleted=0;
    if(finished) { completed++; cycleCompleted++; }
    next=finished && cycleCompleted>=settings.rounds?'long':'short';
  } else if(mode==='long') cycleCompleted=0;
  selectMode(next);updateSessions();
  if(finished){chime();$('#announcement').textContent=`Phase abgeschlossen. Nächste Phase: ${names[next]}.`;if(settings.auto)start();}
}
function tick(){if(!running)return;checkpoint();remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(remaining===0)advance(true);else render();}
$('#start').addEventListener('click',()=>{if(running){checkpoint();segmentStart=null;remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));running=false;render();}else start();});
$('#reset').addEventListener('click',()=>selectMode(mode));
$('#skip').addEventListener('click',()=>advance());
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>selectMode(button.dataset.mode)));
for(const key of ['focus','short','long']){const input=$(`#${key}-duration`);input.value=settings[key];input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isInteger(value)||value<1||value>180){input.value=settings[key];$('#settings-note').textContent='Bitte eine ganze Zahl von 1 bis 180 Minuten eingeben.';return;}settings[key]=value;save();if(mode===key)selectMode(mode);updateCycleNote();});}
$('#rounds').value=settings.rounds;
$('#rounds').addEventListener('change',()=>{
  const value=Number($('#rounds').value);
  if(!Number.isInteger(value)||value<1||value>12){$('#rounds').value=settings.rounds;$('#settings-note').textContent='Bitte eine ganze Zahl von 1 bis 12 Lerneinheiten eingeben.';return;}
  if(value!==settings.rounds){settings.rounds=value;cycleCompleted=0;save();updateSessions();}
  updateCycleNote();
});
$('#auto').checked=settings.auto;$('#auto').addEventListener('change',event=>{settings.auto=event.target.checked;save();});
function renderSound(){$('#sound').setAttribute('aria-pressed',String(settings.sound));$('#sound').setAttribute('aria-label',settings.sound?'Ton ausschalten':'Ton einschalten');$('#sound').textContent=settings.sound?'♪':'♩';}
$('#sound').addEventListener('click',()=>{settings.sound=!settings.sound;unlockAudio();save();renderSound();});
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!['INPUT','BUTTON','A'].includes(document.activeElement.tagName)){event.preventDefault();$('#start').click();}});
document.addEventListener('visibilitychange',tick);window.addEventListener('pagehide',checkpoint);setInterval(tick,250);renderSound();updateSessions();updateCycleNote();render();
