'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const T={ar:{n_home:'الرئيسية',n_vehicle:'السيارة',n_explorer:'ملفاتك',n_texture:'الخامات',n_code:'الكود',n_package:'حزمتك',n_settings:'الإعدادات'}};
const ICON={home:'🏠',vehicle:'🚗',explorer:'📁',texture:'🎨',code:'📝',package:'🎁',settings:'⚙️'};
let lang='ar';
const TABS=['home','vehicle','explorer','texture','code','package','settings'];
const vfs=new Map();let sel=null,cur=null,dirty=false;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const clean=p=>p.split('/').filter(x=>x&&x!=='.'&&x!=='..').join('/');
const ext=p=>p.includes('.')?p.split('.').pop().toLowerCase():'';
const fmt=n=>n>1e6?(n/1e6).toFixed(1)+' MB':n>1e3?(n/1e3).toFixed(1)+' KB':n+' B';
const log=(m,bad)=>{const d=document.createElement('div');d.textContent=m;if(bad)d.className='err';$('#log').prepend(d);while($('#log').children.length>6)$('#log').lastChild.remove()};
const prog=(v,t)=>{$('#bar').value=v;$('#bt').textContent=t||''};
const under=p=>[...vfs.keys()].filter(k=>k===p||k.startsWith(p+'/'));
const roots=()=>[...new Set([...vfs.keys()].map(k=>k.split('/')[0]))];
function download(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4e3)}

function applyLang(){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 $$('[data-i]').forEach(e=>{const t=T.ar[e.dataset.i];if(t)e.textContent=t})}
$('#nav').innerHTML=TABS.map(t=>`<button data-t="${t}"><span>${ICON[t]}</span><small data-i="n_${t}"></small></button>`).join('');
$('#nav').onclick=e=>{const t=e.target.closest('[data-t]');if(t)show(t.dataset.t)};
$$('[data-l]').forEach(b=>b.onclick=()=>{lang=b.dataset.l;localStorage.setItem('lang',lang);applyLang()});
function show(id){$$('section').forEach(s=>s.hidden=s.id!=='p-'+id);$$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
 if(id==='vehicle')vOpen();if(id==='package')pkgList();scrollTo(0,0)}

/* ---------- fonts ---------- */
let FONTS=[];
async function loadFonts(){try{const r=await fetch('fonts/fonts.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  let t=(await r.text()).replace(/^\uFEFF/,'').replace(/\/\/.*|\/\*[\s\S]*?\*\//g,'').replace(/,(\s*[}\]])/g,'$1');let j=JSON.parse(t);if(!Array.isArray(j))j=j.fonts;
  FONTS=j.filter(f=>f&&f.name)}catch(e){log('ما قدرت أقرأ fonts/fonts.json ('+e.message+') — بستخدم خطوط الجهاز. تأكد إن الملف داخل مجلد fonts وإن الموقع شغال من رابط https مو من ملفات الجهاز.',1)}
 if(!FONTS.length)FONTS=[{name:'Arial'},{name:'Tahoma'},{name:'Courier New'}];
 for(const f of FONTS)if(f.file){try{document.fonts.add(await new FontFace(f.name,`url(${f.file})`).load())}catch{log('ملف الخط مو موجود أو خربان: '+f.file+' (تأكد من الاسم وحالة الأحرف)',1)}}
 $$('select.fp').forEach(s=>{s.innerHTML=FONTS.map(f=>`<option style="font-family:'${f.name}'">${f.name}</option>`).join('');
  const pv=()=>{const p=s.parentNode.querySelector('.fprev');if(!p)return;p.style.fontFamily=`'${s.value}'`;p.textContent='BeamNG Cars Studio 0123 — ستوديو سيارات بيمإن جي'};
  s.addEventListener('change',pv);pv()});edStyle()}

/* ---------- archives ---------- */
async function importArchive(f){let b=f.name.replace(/\.[^.]+$/,''),n=2;const b0=b;while(roots().includes(b))b=b0+' ('+n++ +')';
 try{if(/\.rar$/i.test(f.name))await readRar(f,b);else await readZip(f,b);log('تم حط '+f.name+' → '+b)}catch(e){log(f.name+': '+e.message,1)}
 prog(0);renderTree()}
async function readZip(f,base){const z=await JSZip.loadAsync(f),es=Object.values(z.files).filter(e=>!e.dir);let i=0;
 for(const e of es){const p=clean(e.name);if(p)vfs.set(base+'/'+p,await e.async('uint8array'));prog(++i/es.length,i+'/'+es.length)}}
async function readRar(f,base){let A;try{A=(await import('../vendor/libarchive/libarchive.js')).Archive}catch{throw Error('فك RAR يبي مجلد vendor/libarchive (شوف README)')}
 A.init({workerUrl:'vendor/libarchive/worker-bundle.js'});const a=await A.open(f),o=await a.extractFiles(),q=[];
 (function w(x,p){for(const k in x)x[k] instanceof File?q.push([p+k,x[k]]):w(x[k],p+k+'/')})(o,'');let i=0;
 for(const[p,fl]of q){vfs.set(base+'/'+clean(p),new Uint8Array(await fl.arrayBuffer()));prog(++i/q.length,i+'/'+q.length)}}
async function imps(inp){for(const f of inp.files)await importArchive(f);inp.value=''}
$('#imp').onchange=async e=>{await imps(e.target);show('explorer')};$('#imp2').onchange=e=>imps(e.target);

/* ---------- explorer ---------- */
const OPEN=new Map();
function renderTree(){const root={};for(const p of [...vfs.keys()].sort()){let n=root;const a=p.split('/');a.forEach((s,i)=>{n=n[s]??=(i===a.length-1?null:{})})}
 const mk=(o,pre)=>{const ul=document.createElement('ul');for(const k of Object.keys(o).sort((a,b)=>(!o[a])-(!o[b])||a.localeCompare(b))){const p=pre+k,li=document.createElement('li');
  if(o[k]){const d=document.createElement('details');d.open=OPEN.has(p)?OPEN.get(p):pre.split('/').length<=3;d.ontoggle=()=>OPEN.set(p,d.open);const s=document.createElement('summary');s.textContent='📁 '+k;s.dataset.p=p;d.append(s,mk(o[k],p+'/'));li.append(d)}
  else{const b=document.createElement('div');b.className='f';b.textContent='📄 '+k+'  ('+fmt(vfs.get(p).length)+')';b.dataset.p=p;li.append(b)}
  ul.append(li)}return ul};
 const t=$('#tree');t.replaceChildren(vfs.size?mk(root,''):Object.assign(document.createElement('div'),{textContent:'ما فيه ملفات للحين. حط مود أو ضيف ملفات.'}));mark()}
function mark(){$$('#tree [data-p]').forEach(e=>e.classList.toggle('on',e.dataset.p===sel));$('#sel').textContent=sel?'المحدد: '+sel:''}
$('#tree').onclick=e=>{const t=e.target.closest('[data-p]');if(t){sel=t.dataset.p;mark()}};
const need=()=>sel||(log('حدد ملف أو مجلد أول',1),0);
const dest=()=>!sel?'files':vfs.has(sel)?sel.split('/').slice(0,-1).join('/')||'files':sel;
$('#addf').onchange=async e=>{const d=dest();for(const f of e.target.files)vfs.set(d+'/'+clean(f.name),new Uint8Array(await f.arrayBuffer()));log('انضاف '+e.target.files.length+' ملف في '+d);e.target.value='';renderTree()};
$('#newf').onclick=()=>{const n=clean(prompt('مسار الملف الجديد',dest()+'/new.txt')||'');if(!n)return;if(vfs.has(n))return log('موجود من قبل',1);vfs.set(n,new Uint8Array());sel=n;renderTree()};
function mv(to){if(!need())return;to=clean(to||'');if(!to||to===sel)return;if(to.startsWith(sel+'/'))return log('ما تقدر تنقله داخل نفسه',1);
 const ks=under(sel);if(ks.some(k=>vfs.has(to+k.slice(sel.length))))return log('المكان هذا فيه ملف بنفس الاسم',1);
 for(const k of ks){vfs.set(to+k.slice(sel.length),vfs.get(k));vfs.delete(k)}
 if(cur&&ks.includes(cur)){cur=to+cur.slice(sel.length);upd()}sel=to;renderTree()}
$('#ren').onclick=()=>{if(!need())return;const a=sel.split('/'),n=prompt('الاسم الجديد',a.pop());if(n)mv([...a,n.replace(/\//g,'_')].join('/'))};
$('#mov').onclick=()=>{if(need())mv(prompt('المسار الكامل الجديد',sel))};
$('#del').onclick=()=>{if(!need())return;const ks=under(sel);if(!confirm(`تبي تمسح ${ks.length} ملف داخل "${sel}"؟`))return;
 ks.forEach(k=>vfs.delete(k));if(cur&&ks.includes(cur)){cur=null;dirty=false;$('#ta').value='';upd()}sel=null;renderTree()};
$('#open').onclick=()=>{if(!need())return;if(!vfs.has(sel))return log('حدد ملف',1);const e=ext(sel);
 if(/^(png|jpe?g)$/.test(e))openTex(sel);else if(e==='dds')log('ملفات DDS ما تنفتح الحين (تبقى زي ما هي بدون تعديل).',1);
 else if(e==='dae')show('vehicle');else openText(sel)};

/* ---------- code editor ---------- */
function hl(t,e){const lua=e==='lua',kw=/^(lua|cs)$/.test(e)?'function|local|end|if|then|else|elseif|for|while|do|return|nil|true|false|and|or|not|class|public|private|static|void|var|new|using|namespace':'true|false|null';
 const re=new RegExp('(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/'+(lua?'|--.*':'')+')|("(?:\\\\.|[^"\\\\\\n])*")|(\\b-?\\d+\\.?\\d*\\b)|\\b('+kw+')\\b|([{}\\[\\]])','g');
 return esc(t).replace(re,(m,c,s,n,k,p)=>c?`<span class=c>${c}</span>`:s?`<span class=s>${s}</span>`:n?`<span class=n>${n}</span>`:k?`<span class=k>${k}</span>`:`<span class=p>${p}</span>`)}
function lint(t,e){if(!/^(json|jbeam)$/.test(e)||t.length>3e6)return null;
 const re=/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|-?\d+\.?\d*(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]|[\s\S]/gy;
 let ln=1,S=[],root=false,m;const er=(msg,line)=>({line,msg}),done=()=>{const p=S[S.length-1];if(p)p.s='a';else root=true};
 while((m=re.exec(t))){const x=m[0],l=ln;ln+=(x.match(/\n/g)||[]).length;if(/^(\s|\/\/|\/\*)/.test(x))continue;
  const p=S[S.length-1];if(!p&&root)return er('محتوى زائد بعد نهاية الملف',l);
  const okv=!p||p.t==='a'||p.s==='v';
  if(x==='{'||x==='['){if(!okv)return er(p.s==='c'?'متوقع «:» بعد اسم الحقل':'قوس غير متوقع',l);S.push({t:x==='{'?'o':'a',s:x==='{'?'k':'v',l})}
  else if(x==='}'||x===']'){if(!p||(x==='}')!==(p.t==='o'))return er(`القوس «${x}» ما يطابق اللي قبله`,l);if(p.t==='o'&&(p.s==='c'||p.s==='v'))return er('قيمة أو «:» ناقصة قبل الإغلاق',l);S.pop();done()}
  else if(x===':'){if(!p||p.t!=='o'||p.s!=='c')return er('«:» في غير مكانها',l);p.s='v'}
  else if(x===','){if(!p||(p.t==='o'&&p.s!=='a'))return er('فاصلة في غير مكانها',l);if(p.t==='o')p.s='k'}
  else if(x[0]==='"'&&p&&p.t==='o'&&(p.s==='k'||p.s==='a'))p.s='c';
  else if(x.length>1&&x[0]==='"'||/^(-?\d|true$|false$|null$)/.test(x)){if(!okv)return er(p.s==='c'?'متوقع «:» بعد اسم الحقل':'قيمة في غير مكانها',l);done()}
  else return er(x==='"'?'نص غير مغلق (ينقصه «"»)':x==='/'?'تعليق غير مغلق':`رمز غير متوقع «${x}»`,l)}
 if(S.length)return er('قوس غير مغلق «'+(S[S.length-1].t==='o'?'{':'[')+'»',S[S.length-1].l);return null}

let PLAIN=false;
const isBin=u=>{const n=Math.min(u.length,4000);for(let i=0;i<n;i++)if(u[i]===0)return true;return false};

function upd(){const t=$('#ta').value,e=ext(cur||''),big=PLAIN||t.length>6e4;$('#edw').classList.toggle('plain',big);const t0=performance.now();
 if(!big){$('#hl').innerHTML=hl(t,e)+'\n';if(performance.now()-t0>150)PLAIN=true}
 const n=t.split('\n').length;$('#gut').textContent=Array.from({length:n},(_,i)=>i+1).join('\n');
 const err=t.length>3e5?null:lint(t,e),g=$('#gerr');g.style.display=err&&err.line?'block':'none';if(err&&err.line)g.style.top=`calc(10px + ${err.line-1} * var(--fs) * 1.5)`;
 $('#lint').textContent=err?`⚠ سطر ${err.line||'?'}: ${err.msg}`:big&&/^(json|jbeam)$/.test(e)?'(ملف كبير: التلوين طافي عشان يخف الجهاز)':/^(json|jbeam)$/.test(e)?'✓ ما فيه أخطاء':'';
 $('#cf').textContent=(cur||'—')+(dirty?' •':'')}

/* ---------- تم إصلاح فتح الملفات النصية ---------- */
function openText(p){
 const u=vfs.get(p);
 const e=ext(p);

 const textExt=/^(jbeam|json|lua|txt|js|css|html|xml|ini|cfg|csv|md|py|cs|cpp|h|hpp|yaml|yml)$/i;

 if(!textExt.test(e)&&isBin(u))
  return log('هذا الملف مو نص (ثنائي) وما ينفتح بالمحرر. الصور من «افتح» بالخامات، والـ DAE من صفحة السيارة.',1);

 if(u.length>2.5e6)
  return log('الملف كبير مرة ('+fmt(u.length)+') وما ينفتح بالمحرر.',1);

 if(dirty&&!confirm('فيه تعديلات ما انحفظت وراح تروح. تكمّل؟'))return;

 if(u.length<4e4)PLAIN=false;
 cur=p;
 dirty=false;
 show('code');
 $('#cf').textContent=p;
 $('#lint').textContent='⏳ جاري فتح الملف…';
 $('#ta').value='';
 $('#gut').textContent='';
 $('#hl').textContent='';

 setTimeout(()=>{
  try{
   ta.value=new TextDecoder('utf-8',{fatal:false}).decode(u);
   ta.scrollTop=ta.scrollLeft=0;
   upd();
  }catch(err){
   log('ما قدرت أقرأ الملف كنص: '+err.message,1);
  }
 },40);
}

let tm;const ta=$('#ta');
ta.oninput=()=>{dirty=true;clearTimeout(tm);tm=setTimeout(upd,120)};
ta.onscroll=()=>{$('#hl').style.transform=`translate(${-ta.scrollLeft}px,${-ta.scrollTop}px)`;$('#gin').style.transform=`translateY(${-ta.scrollTop}px)`};
ta.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();ta.setRangeText('  ',ta.selectionStart,ta.selectionEnd,'end');ta.oninput()}
 else if(e.key==='Enter'){e.preventDefault();const v=ta.value,s=ta.selectionStart,ls=v.lastIndexOf('\n',s-1)+1,ind=/^[ \t]*/.exec(v.slice(ls,s))[0],pc=v[s-1];
  ta.setRangeText('\n'+ind+(pc==='{'||pc==='['?'  ':''),s,ta.selectionEnd,'end');ta.oninput()}};
$('#save').onclick=()=>{if(!cur)return log('ما فيه ملف مفتوح',1);vfs.set(cur,new TextEncoder().encode(ta.value));dirty=false;upd();renderTree();log('انحفظ '+cur)};
$('#fn').onclick=()=>{const f=$('#fi').value;if(!f)return;const v=ta.value;let i=v.indexOf(f,ta.selectionEnd);if(i<0)i=v.indexOf(f);if(i<0)return log('ما لقيته',1);ta.focus();ta.setSelectionRange(i,i+f.length)};
$('#rp').onclick=()=>{const f=$('#fi').value;if(f&&ta.value.slice(ta.selectionStart,ta.selectionEnd)===f){ta.setRangeText($('#ri').value,ta.selectionStart,ta.selectionEnd,'end');ta.oninput()}$('#fn').click()};
$('#ra').onclick=()=>{const f=$('#fi').value;if(!f)return;const n=ta.value.split(f).length-1;ta.value=ta.value.split(f).join($('#ri').value);dirty=true;upd();log(n+' مكان انبدل')};
function edStyle(){const w=$('#edw');w.style.setProperty('--fs',$('#efs').value+'px');w.style.setProperty('--tc',$('#ecol').value);w.style.textAlign=$('#eal').value;
 $('#hl').style.fontFamily=ta.style.fontFamily=`'${$('#efont').value}',monospace`}
['#efont','#efs','#ecol','#eal'].forEach(s=>{$(s).addEventListener('input',edStyle);$(s).addEventListener('change',edStyle)});

/* ---------- texture editor ---------- */
const cv=$('#cv'),cx=cv.getContext('2d');let base=null,bp=null,L=[],si=-1,drag=null;
function openTex(p){const e=ext(p),u=URL.createObjectURL(new Blob([vfs.get(p)],{type:e==='png'?'image/png':'image/jpeg'})),im=new Image();
 im.onload=()=>{base=im;bp=p;L=[];si=-1;cv.width=im.width;cv.height=im.height;URL.revokeObjectURL(u);$('#tf').textContent=`${p} (${im.width}×${im.height})`;draw();show('texture')};
 im.onerror=()=>log('ما قدرت أقرأ الصورة',1);im.src=u}
function draw(){cx.clearRect(0,0,cv.width,cv.height);if(base)cx.drawImage(base,0,0);
 L.forEach((l,i)=>{cx.save();cx.translate(l.x,l.y);cx.rotate(l.r*Math.PI/180);
  if(l.t==='t'){cx.font=`${l.s}px '${l.f}'`;cx.fillStyle=l.c;cx.textAlign='center';cx.textBaseline='middle';cx.fillText(l.v,0,0);l.w=cx.measureText(l.v).width;l.h=l.s}
  else{l.w=l.s;l.h=l.s*l.im.height/l.im.width;cx.drawImage(l.im,-l.w/2,-l.h/2,l.w,l.h)}
  if(i===si){cx.strokeStyle='#E6A23C';cx.lineWidth=Math.max(2,cv.width/300);cx.strokeRect(-l.w/2,-l.h/2,l.w,l.h)}cx.restore()})}
function sync(){const l=L[si];if(!l)return;if(l.t==='t'){$('#tt').value=l.v;$('#tc').value=l.c;$('#tfont').value=l.f}$('#ts').value=l.s;$('#tr').value=l.r}
const pt=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]};
cv.onpointerdown=e=>{const[x,y]=pt(e);si=-1;for(let i=L.length-1;i>=0;i--){const l=L[i],a=-l.r*Math.PI/180,dx=x-l.x,dy=y-l.y,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
 if(Math.abs(rx)<=l.w/2&&Math.abs(ry)<=l.h/2){si=i;drag=[dx,dy];cv.setPointerCapture(e.pointerId);break}}sync();draw()};
cv.onpointermove=e=>{if(drag&&L[si]){const[x,y]=pt(e);L[si].x=x-drag[0];L[si].y=y-drag[1];draw()}};cv.onpointerup=()=>drag=null;
const needT=()=>base||(log('افتح صورة PNG/JPG من «ملفاتك» أول',1),0);
$('#atx').onclick=()=>{if(!needT())return;L.push({t:'t',v:$('#tt').value||'نص',x:cv.width/2,y:cv.height/2,s:Math.round(cv.width/10),r:0,c:$('#tc').value,f:$('#tfont').value});si=L.length-1;sync();draw()};
$('#aim').onchange=e=>{const f=e.target.files[0];if(!f||!needT())return;const im=new Image();im.onload=()=>{L.push({t:'i',im,x:cv.width/2,y:cv.height/2,s:cv.width/3,r:0});si=L.length-1;sync();draw()};im.onerror=()=>log('ما قدرت أقرأ الصورة',1);im.src=URL.createObjectURL(f);e.target.value=''};
$('#dl').onclick=()=>{if(L[si]){L.splice(si,1);si=-1;draw()}};
[['#tt','v'],['#tc','c'],['#tfont','f'],['#ts','s'],['#tr','r']].forEach(([id,k])=>$(id).addEventListener('input',()=>{const l=L[si];if(!l)return;if(k==='s'||k==='r')l[k]=+$(id).value;else if(l.t==='t')l[k]=$(id).value;draw()}));
async function expTex(save){if(!needT())return;const p=si;si=-1;draw();const png=ext(bp)==='png',b=await new Promise(r=>cv.toBlob(r,png?'image/png':'image/jpeg',.95));si=p;draw();
 if(!b)return log('فشل التصدير (الصورة كبيرة على المتصفح؟)',1);
 if(save){vfs.set(bp,new Uint8Array(await b.arrayBuffer()));renderTree();log('انحفظت الخامة في '+bp+(png?'':' (أُعيد ترميز JPEG)'))}else download(b,bp.split('/').pop())}
$('#tsave').onclick=()=>expTex(true);$('#tdl').onclick=()=>expTex(false);

/* ---------- vehicle / 3D ---------- */
function vOpen(){const ds=[...vfs.keys()].filter(k=>ext(k)==='dae');$('#dae').innerHTML=ds.map(d=>`<option>${esc(d)}</option>`).join('')||'<option value="">(ما فيه ملفات dae)</option>';
 const inf=[...vfs.keys()].filter(k=>/(^|\/)info\.json$/.test(k)),j=[...vfs.keys()].filter(k=>ext(k)==='jbeam').length;let h='';
 for(const k of inf){const t=new TextDecoder().decode(vfs.get(k)),g=n=>(new RegExp('"'+n+'"\\s*:\\s*"([^"]*)"').exec(t)||[])[1]||'';
  if(g('Name')||g('Brand'))h+=`<div>🚗 <b>${esc(g('Brand'))} ${esc(g('Name'))}</b> ${g('Body Style')?'· '+esc(g('Body Style')):''} ${g('Author')?'· '+esc(g('Author')):''}<br><span class=muted>${esc(k)}</span></div>`}
 $('#vinfo').innerHTML=(h||'ما لقيت info.json للسيارة.')+`<div class=muted>${j} ملف jbeam، ${ds.length} ملف dae</div>`;if(V.t)V.t.rs()}
async function V(){if(V.t)return V.t;const[t,o,c]=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/loaders/ColladaLoader.js')]);
 const cv=$('#v3'),r=new t.WebGLRenderer({canvas:cv,antialias:true}),s=new t.Scene();s.background=new t.Color(0x191B20);s.add(new t.HemisphereLight(0xffffff,0x222233,1.6));
 const d=new t.DirectionalLight(0xffffff,1.5);d.position.set(5,10,7);s.add(d,new t.GridHelper(20,20,0x30333A,0x30333A));
 const cam=new t.PerspectiveCamera(45,1,.05,3000),ctl=new o.OrbitControls(cam,cv);
 const rs=()=>{const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()};addEventListener('resize',rs);
 r.setAnimationLoop(()=>{if(cv.clientWidth){ctl.update();r.render(s,cam)}});V.t={t,s,cam,ctl,Loader:c.ColladaLoader,g:null,rs};rs();return V.t}
function fit(o){const v=V.t,t=v.t;if(v.g)v.s.remove(v.g);v.g=o;v.s.add(o);const b=new t.Box3().setFromObject(o);v.c=b.getCenter(new t.Vector3());const z=b.getSize(new t.Vector3());v.d=Math.max(z.x,z.y,z.z)*1.8||5;view('iso')}
function view(k){const v=V.t;if(!v||!v.c)return;const o={front:[0,0,1],rear:[0,0,-1],side:[1,0,0],top:[0,1,.001],iso:[.8,.5,.8]}[k],c=v.c;v.ctl.target.copy(c);v.cam.position.set(c.x+o[0]*v.d,c.y+o[1]*v.d,c.z+o[2]*v.d);v.ctl.update()}
$$('.vb').forEach(b=>b.onclick=()=>view(b.dataset.v));
async function placeholder(){try{const v=await V(),t=v.t,g=new t.Group(),m=new t.MeshBasicMaterial({color:0xE6A23C,wireframe:true}),add=(geo,x,y,z,rx)=>{const q=new t.Mesh(geo,m);q.position.set(x,y,z);if(rx)q.rotation.x=Math.PI/2;g.add(q)};
 add(new t.BoxGeometry(4.2,.7,1.8),0,.65,0);add(new t.BoxGeometry(2.2,.6,1.6),-.2,1.25,0);for(const x of[-1.3,1.3])for(const z of[-.9,.9])add(new t.CylinderGeometry(.35,.35,.25,16),x,.35,z,1);
 fit(g);$('#vph').hidden=false}catch(e){log('المعاينة 3D ما تشتغل: '+e.message,1)}}
$('#ph').onclick=placeholder;
$('#ld').onclick=async()=>{const p=$('#dae').value;if(!p)return log('ما فيه ملف dae',1);
 try{const v=await V(),sc=new v.Loader().parse(new TextDecoder().decode(vfs.get(p)),'').scene;
  sc.traverse(o=>{if(o.isMesh)o.material=new v.t.MeshStandardMaterial({color:0x9aa0aa,flatShading:true,side:v.t.DoubleSide})});fit(sc);$('#vph').hidden=true;log('انحمّل '+p)}
 catch(e){log('ما قدرت أحمّل الموديل: '+e.message+' — بعرض لك شكل توضيحي',1);placeholder()}};

/* ---------- package ---------- */
function pkgList(){const d=$('#rl');d.replaceChildren();if(!vfs.size)d.textContent='ما حطيت شي للحين.';
 for(const r of roots()){const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.checked=true;i.value=encodeURIComponent(r);l.append(i,` ${r} (${under(r).length} ملف)`);d.append(l)}}
$('#pk').onclick=async()=>{if(dirty)return log('احفظ الملف المفتوح أول (التعديلات اللي ما انحفظت ما بتدخل الحزمة).',1);
 const rs=$$('#rl input:checked').map(i=>decodeURIComponent(i.value));if(!rs.length)return log('حدد مصدر واحد على الأقل',1);
 const flat=$('#flat').checked,z=new JSZip(),seen=new Set();let ow=0;
 for(const r of rs)for(const p of under(r)){const q=flat?p.slice(r.length+1):p;if(!q)continue;if(seen.has(q))ow++;seen.add(q);z.file(q,vfs.get(p),{binary:true})}
 try{const b=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},m=>prog(m.percent/100,Math.round(m.percent)+'%'));
  download(b,($('#pn').value||'package')+'.zip');log(`الحزمة: ${seen.size} ملف${ow?`، ${ow} انبدلوا بملفات بعدهم`:''}`)}catch(e){log('فشل التصدير: '+e.message,1)}prog(0)};

addEventListener('beforeunload',e=>{if(vfs.size){e.preventDefault();e.returnValue=''}});
addEventListener('error',e=>log('خطأ: '+e.message,1));addEventListener('unhandledrejection',e=>log('خطأ: '+(e.reason&&e.reason.message||e.reason),1));
applyLang();show('home');renderTree();loadFonts();

document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)show(g.dataset.go)});
