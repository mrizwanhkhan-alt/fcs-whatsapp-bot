const languages = new Map();

function setLanguage(number, language) {
    languages.set(number, language);
}

function getLanguage(number) {
    return languages.get(number);
}

function hasLanguage(number) {
    return languages.has(number);
}

function languageMenu() {
    return `🌍 Welcome to FCS Express Pakistan

Assalam-o-Alaikum!

Please select your preferred language.

براہِ کرم اپنی پسندیدہ زبان منتخب کریں۔

1️⃣ English
2️⃣ اردو`;
}

module.exports = {
    setLanguage,
    getLanguage,
    hasLanguage,
    languageMenu
};
