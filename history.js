// Store timestamped running segments; a checkpoint updates the same segment.
const HistoryTracker = (() => {
  const key = 'leise-history-v1';
  let records = [], lastSavedSecond = -1;
  let month = new Date(); month = new Date(month.getFullYear(), month.getMonth(), 1);
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  let selected = dateKey(new Date());
  const status = text => document.querySelector('#history-status').textContent = text;
  function valid(record) {
    return record && typeof record.id === 'string' && record.id.length <= 100 &&
      ['focus','short','long'].includes(record.mode) && Number.isSafeInteger(record.start) &&
      Number.isSafeInteger(record.end) && record.start >= 0 && record.end > record.start &&
      record.end-record.start <= 180*60*1000 && record.end <= Date.now()+60000;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(saved) || !saved.every(valid)) throw Error();
    records = saved;
  } catch { status('Verlauf konnte nicht geladen werden. Vorhandene Daten werden nicht automatisch überschrieben.'); }
  let storageBlocked = false;
  // Never silently overwrite unreadable stored history.
  try { const raw = localStorage.getItem(key); if(raw) {const saved=JSON.parse(raw);storageBlocked=!Array.isArray(saved)||!saved.every(valid);} } catch {storageBlocked=true;}
  function persist() {
    if(storageBlocked) return;
    try { localStorage.setItem(key, JSON.stringify(records)); }
    catch {status('Speichern nicht möglich. Bitte exportiere ein Backup, bevor du die Seite schließt.');}
  }
  function totals() {
    const days = {};
    for (const record of records) {
      let cursor = record.start;
      while (cursor < record.end) {
        const date = new Date(cursor);
        const midnight = new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime();
        const end = Math.min(record.end,midnight), key = dateKey(date);
        days[key] ??= {focus:0,pause:0};
        days[key][record.mode==='focus'?'focus':'pause'] += end-cursor;
        cursor = end;
      }
    }
    return days;
  }
  const hours = ms => `${(ms/3600000).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} Std.`;
  function description(key, data) {
    const [year,month,day]=key.split('-').map(Number);
    return `${new Date(year,month-1,day).toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'})}: ${hours(data.focus)} Lernen · ${hours(data.pause)} Pausen`;
  }
  function render() {
    const days = totals(), grid=document.querySelector('#calendar-days');
    document.querySelector('#calendar-month').textContent=month.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
    grid.replaceChildren();
    const offset=(month.getDay()+6)%7, length=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let i=0;i<offset;i++) {const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');grid.append(blank);}
    let focus=0,pause=0;
    for(let day=1;day<=length;day++) {
      const key=dateKey(new Date(month.getFullYear(),month.getMonth(),day)), data=days[key]||{focus:0,pause:0};
      focus+=data.focus;pause+=data.pause;
      const button=document.createElement('button');button.type='button';button.textContent=day;
      button.className='calendar-day';button.title=description(key,data);button.setAttribute('aria-label',button.title);
      button.setAttribute('aria-pressed',String(key===selected));
      if(key===dateKey(new Date()))button.setAttribute('aria-current','date');
      if(data.focus)button.classList.add('has-focus');if(data.pause)button.classList.add('has-pause');
      const show=()=>{document.querySelector('#day-details').textContent=description(key,data);};
      button.addEventListener('mouseenter',show);button.addEventListener('focus',show);
      button.addEventListener('click',()=>{selected=key;render();});grid.append(button);
    }
    document.querySelector('#day-details').textContent=description(selected,days[selected]||{focus:0,pause:0});
    document.querySelector('#month-summary').textContent=`Diesen Monat: ${hours(focus)} Lernen · ${hours(pause)} Pausen`;
  }
  for(const [id,delta] of [['previous-month',-1],['next-month',1]])document.querySelector('#'+id).addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+delta,1);selected=dateKey(month);render();});
  document.querySelector('#export-history').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({version:1,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=`leise-backup-${dateKey(new Date())}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('Backup exportiert. Bewahre die Datei an einem sicheren Ort auf.');
  });
  document.querySelector('#import-history').addEventListener('click',()=>document.querySelector('#history-file').click());
  document.querySelector('#history-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>5*1024*1024)throw Error();
      const data=JSON.parse(await file.text());
      if(data.version!==1||!Array.isArray(data.records)||data.records.length>50000||!data.records.every(valid))throw Error();
      const merged=new Map(records.map(record=>[record.id,record]));
      for(const record of data.records){const old=merged.get(record.id);if(old&&(old.start!==record.start||old.mode!==record.mode))throw Error();if(!old||record.end>old.end)merged.set(record.id,{id:record.id,start:record.start,end:record.end,mode:record.mode});}
      if(storageBlocked) {status('Import nicht möglich: Der vorhandene lokale Verlauf ist nicht lesbar.');return;}
      records=[...merged.values()];persist();render();status('Backup importiert. Vorhandene Einträge wurden zusammengeführt.');
    } catch {status('Ungültiges Backup. Bitte eine Leise-JSON-Datei bis 5 MB auswählen.');}
    finally {event.target.value='';}
  });
  render();
  return {
    newId:()=>globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    record(id,start,end,mode) {
      if(end<=start)return;
      const existing=records.find(record=>record.id===id);
      if(existing)existing.end=Math.max(existing.end,end);else records.push({id,start,end,mode});
      const second=Math.floor(end/1000);
      if(second!==lastSavedSecond){lastSavedSecond=second;persist();
        // Keep keyboard focus stable while the timer runs.
        const focused=document.activeElement;
        if(!document.querySelector('#calendar-days').contains(focused))render();
      } else persist();
    }
  };
})();
