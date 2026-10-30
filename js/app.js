'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const T = {
    en: {
        home: 'Home',
        vehicle: 'Vehicle Editor',
        explorer: 'File Explorer',
        texture: 'Texture Editor',
        code: 'Code Editor',
        package: 'Package Creator',
        settings: 'Settings',
        import: 'Import archive (ZIP/RAR)',
        addf: 'Add files',
        newf: 'New file',
        open: 'Open',
        rename: 'Rename',
        move: 'Move',
        del: 'Delete',
        save: 'Save',
        find: 'Find next',
        replace: 'Replace',
        replall: 'Replace all',
        export: 'Export ZIP',
        intro: 'Import ZIP/RAR archives, edit files, textures and models, then export a package.'
    },
    ar: {
        home: 'الرئيسية',
        vehicle: 'محرر المركبات',
        explorer: 'مستكشف الملفات',
        texture: 'محرر الخامات',
        code: 'محرر الأكواد',
        package: 'منشئ الحزم',
        settings: 'الإعدادات',
        import: 'استيراد أرشيف ZIP/RAR',
        addf: 'إضافة ملفات',
        newf: 'ملف جديد',
        open: 'فتح',
        rename: 'إعادة تسمية',
        move: 'نقل',
        del: 'حذف',
        save: 'حفظ',
        find: 'بحث التالي',
        replace: 'استبدال',
        replall: 'استبدال الكل',
        export: 'تصدير ZIP',
        intro: 'استورد أرشيفات ZIP وRAR، وعدّل الملفات والخامات والمجسمات، ثم صدّر مشروعك.'
    }
};

let lang = localStorage.getItem('lang') || 'ar';

const TABS = [
    'home',
    'vehicle',
    'explorer',
    'texture',
    'code',
    'package',
    'settings'
];

const vfs = new Map();

let sel = null;
let cur = null;
let dirty = false;

const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');

const clean = p => p
    .split('/')
    .filter(x => x && x !== '.' && x !== '..')
    .join('/');

const ext = p => p.includes('.')
    ? p.split('.').pop().toLowerCase()
    : '';

const fmt = n => n > 1e6
    ? (n / 1e6).toFixed(1) + ' MB'
    : n > 1e3
        ? (n / 1e3).toFixed(1) + ' KB'
        : n + ' B';

const msg = (ar, en) => lang === 'ar' ? ar : en;

const log = (m, bad) => {
    const d = document.createElement('div');
    d.textContent = m;
    if (bad) d.className = 'err';
    $('#log').prepend(d);
};

const prog = (v, t) => {
    $('#bar').value = v;
    $('#bt').textContent = t || '';
};

const under = p => [...vfs.keys()]
    .filter(k => k === p || k.startsWith(p + '/'));

const roots = () => [...new Set(
    [...vfs.keys()].map(k => k.split('/')[0])
)];

function download(b, n) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = n;
    document.body.append(a);
    a.click();

    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 4000);
}

/* ---------- اللغة ---------- */

function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    $$('[data-i]').forEach(e => {
        const t = T[lang][e.dataset.i] || T.en[e.dataset.i];
        if (t) e.textContent = t;
    });
}

$('#nav').innerHTML = TABS.map(t =>
    `<button data-t="${t}" data-i="${t}"></button>`
).join('');

$('#nav').onclick = e => {
    const t = e.target.dataset.t;
    if (t) show(t);
};

$$('[data-l]').forEach(b => {
    b.onclick = () => {
        lang = b.dataset.l;
        localStorage.setItem('lang', lang);
        applyLang();
    };
});

function show(id) {
    $$('section').forEach(s => {
        s.hidden = s.id !== 'p-' + id;
    });

    $$('#nav button').forEach(b => {
        b.classList.toggle('on', b.dataset.t === id);
    });

    if (id === 'vehicle') vOpen();
    if (id === 'package') pkgList();

    scrollTo(0, 0);
}

/* ---------- الخطوط ---------- */

let FONTS = [];

async function loadFonts() {
    try {
        FONTS = await (await fetch('fonts/fonts.json')).json();
    } catch {
        FONTS = [
            { name: 'Arial' },
            { name: 'Tahoma' },
            { name: 'Courier New' }
        ];
    }

    for (const f of FONTS) {
        if (f.file) {
            try {
                document.fonts.add(
                    await new FontFace(
                        f.name,
                        `url(${f.file})`
                    ).load()
                );
            } catch {
                log(
                    msg(
                        'ملف الخط غير موجود: ' + f.file,
                        'Font file missing: ' + f.file
                    ),
                    1
                );
            }
        }
    }

    $$('select.fp').forEach(s => {
        s.innerHTML = FONTS.map(f =>
            `<option style="font-family:'${f.name}'">${f.name}</option>`
        ).join('');

        const pv = () => {
            const p = s.parentNode.nextElementSibling;
            if (!p) return;

            p.style.fontFamily = `'${s.value}'`;
            p.textContent = 'BeamNG Cars Studio 0123 — ستوديو سيارات بيمإن جي';
        };

        s.addEventListener('change', pv);
        pv();
    });

    edStyle();
}

/* ---------- استيراد الأرشيفات ---------- */

async function importArchive(f) {
    let b = f.name.replace(/\.[^.]+$/, '');
    let n = 2;
    const b0 = b;

    while (roots().includes(b)) {
        b = b0 + ' (' + n++ + ')';
    }

    try {
        if (/\.rar$/i.test(f.name)) {
            await readRar(f, b);
        } else {
            await readZip(f, b);
        }

        log(msg(
            'تم استيراد ' + f.name + ' ← ' + b,
            'Imported ' + f.name + ' → ' + b
        ));
    } catch (e) {
        log(f.name + ': ' + e.message, 1);
    }

    prog(0);
    renderTree();
}

async function readZip(f, base) {
    const z = await JSZip.loadAsync(f);
    const es = Object.values(z.files).filter(e => !e.dir);
    let i = 0;

    for (const e of es) {
        const p = clean(e.name);

        if (p) {
            vfs.set(
                base + '/' + p,
                await e.async('uint8array')
            );
        }

        prog(++i / es.length, i + '/' + es.length);
    }
}

async function readRar(f, base) {
    let A;

    try {
        A = (await import('../vendor/libarchive/libarchive.js')).Archive;
    } catch {
        throw Error(
            msg(
                'استخراج RAR يحتاج إضافة مكتبة libarchive داخل vendor/libarchive/',
                'RAR needs vendor/libarchive/ (see README)'
            )
        );
    }

    A.init({
        workerUrl: 'vendor/libarchive/worker-bundle.js'
    });

    const a = await A.open(f);
    const o = await a.extractFiles();
    const q = [];

    (function w(x, p) {
        for (const k in x) {
            x[k] instanceof File
                ? q.push([p + k, x[k]])
                : w(x[k], p + k + '/');
        }
    })(o, '');

    let i = 0;

    for (const [p, fl] of q) {
        vfs.set(
            base + '/' + clean(p),
            new Uint8Array(await fl.arrayBuffer())
        );

        prog(++i / q.length, i + '/' + q.length);
    }
}

async function imps(inp) {
    for (const f of inp.files) {
        await importArchive(f);
    }

    inp.value = '';
}

$('#imp').onchange = async e => {
    await imps(e.target);
    show('explorer');
};

$('#imp2').onchange = e => imps(e.target);

/* ---------- مستكشف الملفات ---------- */

function renderTree() {
    const root = {};

    for (const p of [...vfs.keys()].sort()) {
        let n = root;
        const a = p.split('/');

        a.forEach((s, i) => {
            n = n[s] ??= (
                i === a.length - 1 ? null : {}
            );
        });
    }

    const mk = (o, pre) => {
        const ul = document.createElement('ul');

        for (const k of Object.keys(o).sort(
            (a, b) => (!o[a]) - (!o[b]) || a.localeCompare(b)
        )) {
            const p = pre + k;
            const li = document.createElement('li');

            if (o[k]) {
                const d = document.createElement('details');
                d.open = pre === '';

                const s = document.createElement('summary');
                s.textContent = '📁 ' + k;
                s.dataset.p = p;

                d.append(s, mk(o[k], p + '/'));
                li.append(d);
            } else {
                const b = document.createElement('div');

                b.className = 'f';
                b.textContent =
                    '📄 ' + k + ' (' + fmt(vfs.get(p).length) + ')';

                b.dataset.p = p;
                li.append(b);
            }

            ul.append(li);
        }

        return ul;
    };

    const t = $('#tree');

    t.replaceChildren(
        vfs.size
            ? mk(root, '')
            : Object.assign(
                document.createElement('div'),
                {
                    textContent: msg(
                        'فارغ. استورد أرشيفاً أو أضف ملفات.',
                        'Empty. Import an archive or add files.'
                    )
                }
            )
    );

    mark();
}

function mark() {
    $$('#tree [data-p]').forEach(e => {
        e.classList.toggle('on', e.dataset.p === sel);
    });

    $('#sel').textContent = sel
        ? msg('المحدد: ', 'Selected: ') + sel
        : '';
}

$('#tree').onclick = e => {
    const t = e.target.closest('[data-p]');

    if (t) {
        sel = t.dataset.p;
        mark();
    }
};

const need = () => sel || (
    log(msg('حدد ملفاً أو مجلداً أولاً', 'Select a file or folder first'), 1),
    0
);

const dest = () => !sel
    ? 'files'
    : vfs.has(sel)
        ? sel.split('/').slice(0, -1).join('/') || 'files'
        : sel;

$('#addf').onchange = async e => {
    const d = dest();

    for (const f of e.target.files) {
        vfs.set(
            d + '/' + clean(f.name),
            new Uint8Array(await f.arrayBuffer())
        );
    }

    log(msg(
        'تمت إضافة ' + e.target.files.length + ' ملف إلى ' + d,
        'Added ' + e.target.files.length + ' file(s) to ' + d
    ));

    e.target.value = '';
    renderTree();
};

$('#newf').onclick = () => {
    const n = clean(
        prompt(
            msg('مسار الملف الجديد', 'New file path'),
            dest() + '/new.txt'
        ) || ''
    );

    if (!n) return;

    if (vfs.has(n)) {
        return log(msg('الملف موجود مسبقاً', 'Already exists'), 1);
    }

    vfs.set(n, new Uint8Array());
    sel = n;
    renderTree();
};

function mv(to) {
    if (!need()) return;

    to = clean(to || '');

    if (!to || to === sel) return;

    if (to.startsWith(sel + '/')) {
        return log(
            msg('لا يمكن نقل المجلد إلى داخل نفسه', 'Cannot move into itself'),
            1
        );
    }

    const ks = under(sel);

    if (ks.some(k => vfs.has(to + k.slice(sel.length)))) {
        return log(
            msg('الملف الهدف موجود مسبقاً', 'Target already exists'),
            1
        );
    }

    for (const k of ks) {
        vfs.set(to + k.slice(sel.length), vfs.get(k));
        vfs.delete(k);
    }

    if (cur && ks.includes(cur)) {
        cur = to + cur.slice(sel.length);
        upd();
    }

    sel = to;
    renderTree();
}

$('#ren').onclick = () => {
    if (!need()) return;

    const a = sel.split('/');
    const n = prompt(
        msg('الاسم الجديد', 'New name'),
        a.pop()
    );

    if (n) {
        mv([...a, n.replace(/\//g, '_')].join('/'));
    }
};

$('#mov').onclick = () => {
    if (need()) {
        mv(prompt(
            msg('المسار الكامل الجديد', 'New full path'),
            sel
        ));
    }
};

$('#del').onclick = () => {
    if (!need()) return;

    const ks = under(sel);

    if (!confirm(msg(
        `هل تريد حذف ${ks.length} ملف داخل "${sel}"؟`,
        `Delete ${ks.length} file(s) under "${sel}"?`
    ))) return;

    ks.forEach(k => vfs.delete(k));

    if (cur && ks.includes(cur)) {
        cur = null;
        dirty = false;
        $('#ta').value = '';
        upd();
    }

    sel = null;
    renderTree();
};

$('#open').onclick = () => {
    if (!need()) return;

    if (!vfs.has(sel)) {
        return log(msg('حدد ملفاً', 'Select a file'), 1);
    }

    const e = ext(sel);

    if (/^(png|jpe?g)$/.test(e)) {
        openTex(sel);
    } else if (e === 'dds') {
        log(msg(
            'ملفات DDS غير مدعومة حالياً، وسيتم الاحتفاظ بها دون تعديل.',
            'DDS is not supported in this version (file is preserved untouched).'
        ), 1);
    } else if (e === 'dae') {
        show('vehicle');
    } else {
        openText(sel);
    }
};

/* ---------- محرر الأكواد ---------- */

function hl(t, e) {
    const lua = e === 'lua';

    const kw = /^(lua|cs)$/.test(e)
        ? 'function|local|end|if|then|else|elseif|for|while|do|return|nil|true|false|and|or|not|class|public|private|static|void|var|new|using|namespace'
        : 'true|false|null';

    const re = new RegExp(
        '(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/' +
        (lua ? '|--.*' : '') +
        ')|("(?:\\\\.|[^"\\\\\\n])*")|(\\b-?\\d+\\.?\\d*\\b)|\\b(' +
        kw +
        ')\\b|([{}\\[\\]])',
        'g'
    );

    return esc(t).replace(
        re,
        (m, c, s, n, k, p) =>
            c ? `<span class=c>${c}</span>`
                : s ? `<span class=s>${s}</span>`
                    : n ? `<span class=n>${n}</span>`
                        : k ? `<span class=k>${k}</span>`
                            : `<span class=p>${p}</span>`
    );
}

function lint(t, e) {
    if (!/^(json|jbeam)$/.test(e) || t.length > 1e6) {
        return null;
    }

    const s = t
        .replace(
            /\/\*[\s\S]*?\*\/|\/\/.*/g,
            m => m.replace(/[^\n]/g, ' ')
        )
        .replace(
            /([\]}"\del])([ \t]*\r?\n\s*)(["\[{\-\d])/g,
            '$1,$2$3'
        )
        .replace(/,(\s*[}\]])/g, ' $1');

    try {
        JSON.parse(s);
    } catch (x) {
        const m = /position (\d+)/.exec(x.message);
        const l = /line (\d+)/.exec(x.message);

        return {
            line: l
                ? +l[1]
                : m
                    ? s.slice(0, +m[1]).split('\n').length
                    : 0,
            msg: x.message.slice(0, 100)
        };
    }

    return null;
}

function upd() {
    const t = $('#ta').value;
    const e = ext(cur || '');
    const err = lint(t, e);

    $('#hl').innerHTML =
        (t.length > 4e5 ? esc(t) : hl(t, e)) + '\n';

    $('#gut').innerHTML = t.split('\n').map((_, i) =>
        `<div${err && err.line === i + 1 ? ' class=bad' : ''}>${i + 1}</div>`
    ).join('');

    $('#lint').textContent = err
        ? msg(
            `⚠ السطر ${err.line || '?'}: ${err.msg} (قد يسمح JBeam بصياغة مرنة، راجع السطر المحدد)`,
            `⚠ line ${err.line || '?'}: ${err.msg} (JBeam allows loose syntax; check the marked line)`
        )
        : /^(json|jbeam)$/.test(e)
            ? msg('✓ الصياغة سليمة', '✓ syntax OK')
            : '';

    $('#cf').textContent = (cur || '—') + (dirty ? ' •' : '');
}

function openText(p) {
    if (dirty && !confirm(msg(
        'التغييرات غير المحفوظة ستُفقد. هل تريد المتابعة؟',
        'Unsaved changes in the open file will be lost. Continue?'
    ))) return;

    cur = p;
    $('#ta').value = new TextDecoder().decode(vfs.get(p));
    dirty = false;

    upd();
    show('code');
}

let tm;
const ta = $('#ta');

ta.oninput = () => {
    dirty = true;
    clearTimeout(tm);
    tm = setTimeout(upd, 120);
};

ta.onscroll = () => {
    $('#hl').style.transform =
        `translate(${-ta.scrollLeft}px,${-ta.scrollTop}px)`;

    $('#gut').style.transform =
        `translateY(${-ta.scrollTop}px)`;
};

ta.onkeydown = e => {
    if (e.key === 'Tab') {
        e.preventDefault();

        ta.setRangeText(
            '  ',
            ta.selectionStart,
            ta.selectionEnd,
            'end'
        );

        ta.oninput();
    } else if (e.key === 'Enter') {
        e.preventDefault();

        const v = ta.value;
        const s = ta.selectionStart;
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const ind = /^[ \t]*/.exec(v.slice(ls, s))[0];
        const pc = v[s - 1];

        ta.setRangeText(
            '\n' + ind + (pc === '{' || pc === '[' ? '  ' : ''),
            s,
            ta.selectionEnd,
            'end'
        );

        ta.oninput();
    }
};

$('#save').onclick = () => {
    if (!cur) {
        return log(msg('لا يوجد ملف مفتوح', 'No file open'), 1);
    }

    vfs.set(cur, new TextEncoder().encode(ta.value));
    dirty = false;

    upd();
    renderTree();

    log(msg('تم حفظ ' + cur, 'Saved ' + cur));
};

$('#fn').onclick = () => {
    const f = $('#fi').value;
    if (!f) return;

    const v = ta.value;
    let i = v.indexOf(f, ta.selectionEnd);

    if (i < 0) i = v.indexOf(f);

    if (i < 0) {
        return log(msg('لم يتم العثور على النص', 'Not found'), 1);
    }

    ta.focus();
    ta.setSelectionRange(i, i + f.length);
};

$('#rp').onclick = () => {
    const f = $('#fi').value;

    if (f && ta.value.slice(
        ta.selectionStart,
        ta.selectionEnd
    ) === f) {
        ta.setRangeText(
            $('#ri').value,
            ta.selectionStart,
            ta.selectionEnd,
            'end'
        );

        ta.oninput();
    }

    $('#fn').click();
};

$('#ra').onclick = () => {
    const f = $('#fi').value;
    if (!f) return;

    const n = ta.value.split(f).length - 1;

    ta.value = ta.value.split(f).join($('#ri').value);
    dirty = true;

    upd();

    log(msg(
        'تم استبدال ' + n + ' مرة',
        n + ' replacement(s)'
    ));
};

function edStyle() {
    const w = $('#edw');

    w.style.setProperty('--fs', $('#efs').value + 'px');
    w.style.setProperty('--tc', $('#ecol').value);
    w.style.textAlign = $('#eal').value;

    $('#hl').style.fontFamily =
        ta.style.fontFamily =
            `'${$('#efont').value}',monospace`;
}

['#efont', '#efs', '#ecol', '#eal'].forEach(s => {
    $(s).addEventListener('input', edStyle);
    $(s).addEventListener('change', edStyle);
});

/* ---------- محرر الخامات ---------- */

const cv = $('#cv');
const cx = cv.getContext('2d');

let base = null;
let bp = null;
let L = [];
let si = -1;
let drag = null;

function openTex(p) {
    const e = ext(p);

    const u = URL.createObjectURL(
        new Blob(
            [vfs.get(p)],
            {
                type: e === 'png'
                    ? 'image/png'
                    : 'image/jpeg'
            }
        )
    );

    const im = new Image();

    im.onload = () => {
        base = im;
        bp = p;
        L = [];
        si = -1;

        cv.width = im.width;
        cv.height = im.height;

        URL.revokeObjectURL(u);

        $('#tf').textContent =
            `${p} (${im.width}×${im.height})`;

        draw();
        show('texture');
    };

    im.onerror = () => {
        log(msg('تعذر فتح الصورة', 'Cannot decode image'), 1);
    };

    im.src = u;
}

function draw() {
    cx.clearRect(0, 0, cv.width, cv.height);

    if (base) cx.drawImage(base, 0, 0);

    L.forEach((l, i) => {
        cx.save();

        cx.translate(l.x, l.y);
        cx.rotate(l.r * Math.PI / 180);

        if (l.t === 't') {
            cx.font = `${l.s}px '${l.f}'`;
            cx.fillStyle = l.c;
            cx.textAlign = 'center';
            cx.textBaseline = 'middle';

            cx.fillText(l.v, 0, 0);

            l.w = cx.measureText(l.v).width;
            l.h = l.s;
        } else {
            l.w = l.s;
            l.h = l.s * l.im.height / l.im.width;

            cx.drawImage(
                l.im,
                -l.w / 2,
                -l.h / 2,
                l.w,
                l.h
            );
        }

        if (i === si) {
            cx.strokeStyle = '#E6A23C';
            cx.lineWidth = Math.max(2, cv.width / 300);

            cx.strokeRect(
                -l.w / 2,
                -l.h / 2,
                l.w,
                l.h
            );
        }

        cx.restore();
    });
}

function sync() {
    const l = L[si];
    if (!l) return;

    if (l.t === 't') {
        $('#tt').value = l.v;
        $('#tc').value = l.c;
        $('#tfont').value = l.f;
    }

    $('#ts').value = l.s;
    $('#tr').value = l.r;
}

const pt = e => {
    const r = cv.getBoundingClientRect();

    return [
        (e.clientX - r.left) * cv.width / r.width,
        (e.clientY - r.top) * cv.height / r.height
    ];
};

cv.onpointerdown = e => {
    const [x, y] = pt(e);

    si = -1;

    for (let i = L.length - 1; i >= 0; i--) {
        const l = L[i];
        const a = -l.r * Math.PI / 180;

        const dx = x - l.x;
        const dy = y - l.y;

        const rx = dx * Math.cos(a) - dy * Math.sin(a);
        const ry = dx * Math.sin(a) + dy * Math.cos(a);

        if (
            Math.abs(rx) <= l.w / 2 &&
            Math.abs(ry) <= l.h / 2
        ) {
            si = i;
            drag = [dx, dy];

            cv.setPointerCapture(e.pointerId);
            break;
        }
    }

    sync();
    draw();
};

cv.onpointermove = e => {
    if (drag && L[si]) {
        const [x, y] = pt(e);

        L[si].x = x - drag[0];
        L[si].y = y - drag[1];

        draw();
    }
};

cv.onpointerup = () => drag = null;

const needT = () => base || (
    log(
        msg(
            'افتح صورة PNG أو JPG من مستكشف الملفات أولاً',
            'Open a PNG/JPG texture from File Explorer first'
        ),
        1
    ),
    0
);

$('#atx').onclick = () => {
    if (!needT()) return;

    L.push({
        t: 't',
        v: $('#tt').value || 'Text',
        x: cv.width / 2,
        y: cv.height / 2,
        s: Math.round(cv.width / 10),
        r: 0,
        c: $('#tc').value,
        f: $('#tfont').value
    });

    si = L.length - 1;

    sync();
    draw();
};

$('#aim').onchange = e => {
    const f = e.target.files[0];

    if (!f || !needT()) return;

    const im = new Image();

    im.onload = () => {
        L.push({
            t: 'i',
            im,
            x: cv.width / 2,
            y: cv.height / 2,
            s: cv.width / 3,
            r: 0
        });

        si = L.length - 1;

        sync();
        draw();
    };

    im.onerror = () => {
        log(msg('تعذر فتح الصورة', 'Cannot decode image'), 1);
    };

    im.src = URL.createObjectURL(f);
    e.target.value = '';
};

$('#dl').onclick = () => {
    if (L[si]) {
        L.splice(si, 1);
        si = -1;
        draw();
    }
};

[
    ['#tt', 'v'],
    ['#tc', 'c'],
    ['#tfont', 'f'],
    ['#ts', 's'],
    ['#tr', 'r']
].forEach(([id, k]) => {
    $(id).addEventListener('input', () => {
        const l = L[si];
        if (!l) return;

        if (k === 's' || k === 'r') {
            l[k] = +$(id).value;
        } else if (l.t === 't') {
            l[k] = $(id).value;
        }

        draw();
    });
});

async function expTex(save) {
    if (!needT()) return;

    const p = si;
    si = -1;

    draw();

    const png = ext(bp) === 'png';

    const b = await new Promise(r =>
        cv.toBlob(
            r,
            png ? 'image/png' : 'image/jpeg',
            .95
        )
    );

    si = p;
    draw();

    if (!b) {
        return log(
            msg(
                'فشل تصدير الصورة، ربما حجمها كبير جداً',
                'Export failed (image too large for this browser?)'
            ),
            1
        );
    }

    if (save) {
        vfs.set(
            bp,
            new Uint8Array(await b.arrayBuffer())
        );

        renderTree();

        log(msg(
            'تم حفظ الخامة داخل المشروع: ' + bp,
            'Texture written to ' + bp + (png ? '' : ' (re-encoded JPEG)')
        ));
    } else {
        download(b, bp.split('/').pop());
    }
}

$('#tsave').onclick = () => expTex(true);
$('#tdl').onclick = () => expTex(false);

/* ---------- المركبات والمجسمات ---------- */

function vOpen() {
    const ds = [...vfs.keys()].filter(k => ext(k) === 'dae');

    $('#dae').innerHTML = ds.map(d =>
        `<option>${esc(d)}</option>`
    ).join('') || '<option value="">لا توجد ملفات DAE</option>';

    const inf = [...vfs.keys()].filter(k =>
        /(^|\/)info\.json$/.test(k)
    );

    const j = [...vfs.keys()].filter(k =>
        ext(k) === 'jbeam'
    ).length;

    let h = '';

    for (const k of inf) {
        try {
            const o = JSON.parse(
                new TextDecoder().decode(vfs.get(k))
            );

            if (o.Name || o.Brand) {
                h += `<div>🚗 <b>${esc(String(o.Brand || ''))} ${esc(String(o.Name || ''))}</b> <span class=muted>${esc(k)}</span></div>`;
            }
        } catch {}
    }

    $('#vinfo').innerHTML =
        (h || msg(
            'لم يتم العثور على info.json للمركبة.',
            'No vehicle info.json detected.'
        )) +
        `<div class=muted>${j} ملف JBEAM، ${ds.length} ملف DAE</div>`;

    if (V.t) V.t.rs();
}

async function V() {
    if (V.t) return V.t;

    const [t, o, c] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/loaders/ColladaLoader.js')
    ]);

    const cv = $('#v3');

    const r = new t.WebGLRenderer({
        canvas: cv,
        antialias: true
    });

    const s = new t.Scene();

    s.background = new t.Color(0x191B20);

    s.add(
        new t.HemisphereLight(0xffffff, 0x222233, 1.6)
    );

    const d = new t.DirectionalLight(0xffffff, 1.5);

    d.position.set(5, 10, 7);

    s.add(
        d,
        new t.GridHelper(20, 20, 0x30333A, 0x30333A)
    );

    const cam = new t.PerspectiveCamera(45, 1, .05, 3000);
    const ctl = new o.OrbitControls(cam, cv);

    const rs = () => {
        const w = cv.clientWidth;
        const h = cv.clientHeight;

        if (!w || !h) return;

        r.setSize(w, h, false);

        cam.aspect = w / h;
        cam.updateProjectionMatrix();
    };

    addEventListener('resize', rs);

    r.setAnimationLoop(() => {
        if (cv.clientWidth) {
            ctl.update();
            r.render(s, cam);
        }
    });

    V.t = {
        t,
        s,
        cam,
        ctl,
        Loader: c.ColladaLoader,
        g: null,
        rs
    };

    rs();

    return V.t;
}

function fit(o) {
    const v = V.t;
    const t = v.t;

    if (v.g) v.s.remove(v.g);

    v.g = o;
    v.s.add(o);

    const b = new t.Box3().setFromObject(o);

    v.c = b.getCenter(new t.Vector3());

    const z = b.getSize(new t.Vector3());

    v.d = Math.max(z.x, z.y, z.z) * 1.8 || 5;

    view('iso');
}

function view(k) {
    const v = V.t;

    if (!v || !v.c) return;

    const o = {
        front: [0, 0, 1],
        rear: [0, 0, -1],
        side: [1, 0, 0],
        top: [0, 1, .001],
        iso: [.8, .5, .8]
    }[k];

    const c = v.c;

    v.ctl.target.copy(c);

    v.cam.position.set(
        c.x + o[0] * v.d,
        c.y + o[1] * v.d,
        c.z + o[2] * v.d
    );

    v.ctl.update();
}

$$('.vb').forEach(b => {
    b.onclick = () => view(b.dataset.v);
});

async function placeholder() {
    try {
        const v = await V();
        const t = v.t;
        const g = new t.Group();

        const m = new t.MeshBasicMaterial({
            color: 0xE6A23C,
            wireframe: true
        });

        const add = (geo, x, y, z, rx) => {
            const q = new t.Mesh(geo, m);

            q.position.set(x, y, z);

            if (rx) q.rotation.x = Math.PI / 2;

            g.add(q);
        };

        add(new t.BoxGeometry(4.2, .7, 1.8), 0, .65, 0);
        add(new t.BoxGeometry(2.2, .6, 1.6), -.2, 1.25, 0);

        for (const x of [-1.3, 1.3]) {
            for (const z of [-.9, .9]) {
                add(
                    new t.CylinderGeometry(.35, .35, .25, 16),
                    x,
                    .35,
                    z,
                    1
                );
            }
        }

        fit(g);
        $('#vph').hidden = false;

    } catch (e) {
        log(
            msg(
                'تعذر تشغيل عارض المجسمات: ' + e.message,
                '3D unavailable: ' + e.message
            ),
            1
        );
    }
}

$('#ph').onclick = placeholder;

$('#ld').onclick = async () => {
    const p = $('#dae').value;

    if (!p) {
        return log(msg('لم يتم تحميل ملف DAE', 'No .dae file loaded'), 1);
    }

    try {
        const v = await V();

        const sc = new v.Loader().parse(
            new TextDecoder().decode(vfs.get(p)),
            ''
        ).scene;

        sc.traverse(o => {
            if (o.isMesh) {
                o.material = new v.t.MeshStandardMaterial({
                    color: 0x9aa0aa,
                    flatShading: true,
                    side: v.t.DoubleSide
                });
            }
        });

        fit(sc);

        $('#vph').hidden = true;

        log(msg(
            'تم تحميل المجسم: ' + p,
            'Loaded ' + p
        ));

    } catch (e) {
        log(msg(
            'تعذر تحميل المجسم: ' + e.message + '، سيتم عرض مجسم تجريبي.',
            'Cannot load model: ' + e.message + ' — showing placeholder'
        ), 1);

        placeholder();
    }
};

/* ---------- إنشاء الحزم ---------- */

function pkgList() {
    const d = $('#rl');

    d.replaceChildren();

    if (!vfs.size) {
        d.textContent = msg(
            'لم يتم تحميل أي ملفات بعد.',
            'Nothing loaded yet.'
        );
    }

    for (const r of roots()) {
        const l = document.createElement('label');
        const i = document.createElement('input');

        i.type = 'checkbox';
        i.checked = true;
        i.value = encodeURIComponent(r);

        l.append(
            i,
            ` ${r} (${under(r).length} ${msg('ملفات', 'files')})`
        );

        d.append(l);
    }
}

$('#pk').onclick = async () => {
    if (dirty) {
        return log(
            msg(
                'احفظ الملف المفتوح أولاً، لأن التغييرات غير المحفوظة لن تدخل في الحزمة.',
                'Save the open file first (unsaved edits would be left out).'
            ),
            1
        );
    }

    const rs = $$('#rl input:checked').map(i =>
        decodeURIComponent(i.value)
    );

    if (!rs.length) {
        return log(
            msg('حدد مصدراً واحداً على الأقل', 'Select at least one source'),
            1
        );
    }

    const flat = $('#flat').checked;
    const z = new JSZip();
    const seen = new Set();

    let ow = 0;

    for (const r of rs) {
        for (const p of under(r)) {
            const q = flat
                ? p.slice(r.length + 1)
                : p;

            if (!q) continue;

            if (seen.has(q)) ow++;

            seen.add(q);

            z.file(q, vfs.get(p), {
                binary: true
            });
        }
    }

    try {
        const b = await z.generateAsync(
            {
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            },
            m => prog(
                m.percent / 100,
                Math.round(m.percent) + '%'
            )
        );

        download(
            b,
            ($('#pn').value || 'package') + '.zip'
        );

        log(msg(
            `تم إنشاء الحزمة: ${seen.size} ملف${ow ? `، وتم استبدال ${ow} ملف` : ''}`,
            `Package: ${seen.size} files${ow ? `, ${ow} overwritten by later sources` : ''}`
        ));

    } catch (e) {
        log(msg(
            'فشل التصدير: ' + e.message,
            'Export failed: ' + e.message
        ), 1);
    }

    prog(0);
};

/* ---------- رسائل الأخطاء ---------- */

addEventListener('beforeunload', e => {
    if (vfs.size) {
        e.preventDefault();
        e.returnValue = '';
    }
});

addEventListener('error', e => {
    log(
        msg('خطأ: ', 'Error: ') + e.message,
        1
    );
});

addEventListener('unhandledrejection', e => {
    log(
        msg('خطأ: ', 'Error: ') +
        (e.reason && e.reason.message || e.reason),
        1
    );
});

/* ---------- تشغيل الموقع ---------- */

applyLang();
show('home');
renderTree();
loadFonts();
