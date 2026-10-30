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
        export: 'Export ZIP'
    },

    ar: {
        home: 'الرئيسية',
        vehicle: 'محرر السيارات',
        explorer: 'مستكشف الملفات',
        texture: 'محرر الخامات',
        code: 'محرر الأكواد',
        package: 'إنشاء الحزم',
        settings: 'الإعدادات',
        import: 'استيراد أرشيف ZIP / RAR',
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
        export: 'تصدير ZIP'
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

function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    $$('[data-i]').forEach(e => {
        const t = T[lang][e.dataset.i] || T.en[e.dataset.i];
        if (t) e.textContent = t;
    });

    $('#nav').innerHTML = TABS.map(t =>
        `<button data-t="${t}" data-i="${t}">${T[lang][t]}</button>`
    ).join('');
}
