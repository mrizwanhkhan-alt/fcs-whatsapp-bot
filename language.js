
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

function mainMenu(language) {

  if (language === "ur") {
    return `🇵🇰 FCS EXPRESS PAKISTAN

السلام علیکم!

میں غلام قادر، آپ کا FCS Express ورچوئل اسسٹنٹ ہوں۔

براہِ کرم مطلوبہ سروس کا نمبر منتخب کریں:

1️⃣ کمپنی کا تعارف
2️⃣ ہمارا ملک گیر نیٹ ورک
3️⃣ ہماری خدمات
4️⃣ فری فرنچائز
5️⃣ سٹی بزنس سینٹر
6️⃣ ٹینڈرز اور وینڈر مواقع
7️⃣ کیریئر اور ملازمتیں
8️⃣ اکثر پوچھے جانے والے سوالات
9️⃣ رابطہ اور معاونت
🔟 ایف سی ایس ایکسپریس کیوں منتخب کریں؟

🌐 www.fcsexpress.com.pk`;
  }

  return `🇵🇰 FCS EXPRESS PAKISTAN

Assalam-o-Alaikum!

I am Ghulam Qadir, your FCS Express Virtual Assistant.

Please select the required service:

1️⃣ About FCS Express
2️⃣ Our Nationwide Network
3️⃣ Our Services
4️⃣ Free Franchise
5️⃣ City Business Center
6️⃣ Tenders & Vendor Opportunities
7️⃣ Career & Jobs
8️⃣ Frequently Asked Questions
9️⃣ Contact & Support
🔟 Why Choose FCS Express?

🌐 www.fcsexpress.com.pk`;
}

module.exports = {
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu
};
