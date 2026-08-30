// Simulación mínima de los servicios de Apps Script para probar la lógica.
global.console = console;
let SHEETS = {};
function Sheet(name){ this.name=name; this.rows=[]; }
Sheet.prototype.getLastRow=function(){return this.rows.length;};
Sheet.prototype.getLastColumn=function(){return this.rows.reduce((m,r)=>Math.max(m,r.length),0);};
Sheet.prototype.appendRow=function(r){this.rows.push(r.slice());};
Sheet.prototype.setFrozenRows=function(){return this;};
Sheet.prototype.setColumnWidth=function(){return this;};
Sheet.prototype.getRange=function(r,c,nr,nc){
  const sh=this; nr=nr||1; nc=nc||1;
  return {
    getValues(){ const out=[]; for(let i=0;i<nr;i++){ const row=sh.rows[r-1+i]||[]; const o=[]; for(let j=0;j<nc;j++) o.push(row[c-1+j]===undefined?'':row[c-1+j]); out.push(o);} return out; },
    setValues(v){ for(let i=0;i<v.length;i++){ while(sh.rows.length<r+i) sh.rows.push([]); for(let j=0;j<v[i].length;j++) sh.rows[r-1+i][c-1+j]=v[i][j]; } return this; },
    setValue(v){ while(sh.rows.length<r) sh.rows.push([]); sh.rows[r-1][c-1]=v; return this; },
    setFontWeight(){return this;}, setBackground(){return this;}
  };
};
global.SpreadsheetApp={ getActiveSpreadsheet:()=>({
  getSheetByName:n=>SHEETS[n]||null,
  insertSheet:n=>(SHEETS[n]=new Sheet(n)),
  getSpreadsheetTimeZone:()=>'America/Mexico_City'
}), flush(){}};
let ACTIVE_EMAIL='eduwin@ea.mx';
global.Session={
  getScriptTimeZone:()=>'America/Mexico_City',
  getActiveUser:()=>({getEmail:()=>ACTIVE_EMAIL})
};
global.__setActiveEmail=(email)=>{ ACTIVE_EMAIL=email||''; };
let uuidN=0;
global.Utilities={
  getUuid:()=>'id-'+(++uuidN),
  formatDate:(d,tz,f)=>{
    const p=n=>String(n).padStart(2,'0');
    const s=f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1)).replace('dd',p(d.getDate()))
      .replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes())).replace('ss',p(d.getSeconds()));
    return s.replace(/'/g,'');
  },
  newBlob:(b,t,n)=>({b,t,n}),
  base64Decode:s=>Buffer.from(s,'base64')
};
global.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})};
global.MAILS=[];
global.MailApp={sendEmail:(to,subj,body,opt)=>{MAILS.push({to,subj,cc:opt&&opt.cc});}};
global.ScriptApp={getService:()=>({getUrl:()=>'https://script.google.com/app'}),getProjectTriggers:()=>[]};
let FILES=0;
const folder={ getId:()=>'folder-1', getFoldersByName:()=>({hasNext:()=>false,next:()=>folder}),
  createFolder:()=>folder,
  createFile:b=>({getId:()=>'file-'+(++FILES), getName:()=>b.n, getUrl:()=>'https://drive/'+b.n}) };
global.DriveApp={ createFolder:()=>folder, getFolderById:()=>folder };