const languages = new Map();


// Set customer language
function setLanguage(number, language) {

  languages.set(number, language);

}


// Get customer language
function getLanguage(number) {

  return languages.get(number);

}


// Check language selected
function hasLanguage(number) {

  return languages.has(number);

}


// First language selection menu
function languageMenu() {

  return `🌍 Welcome to FCS Express Pakistan

Assalam-o-Alaikum!

Please select your preferred language.

براہِ کرم اپنی پسندیدہ زبان منتخب کریں۔

1️⃣ English
2️⃣ اردو`;

}



// Main menu
function mainMenu(language) {


  if (language === "ur") {


    return `🇵🇰 ایف سی ایس ایکسپریس پاکستان میں خوش آمدید

السلام علیکم!

میں غلام قادر، آپ کا ایف سی ایس اسسٹنٹ ہوں۔

براہِ کرم نمبر منتخب کریں:

1️⃣ ایف سی ایس ایکسپریس کے بارے میں
2️⃣ ہمارا ملک گیر نیٹ ورک
3️⃣ ہماری سروسز
4️⃣ فرنچائز کے لیے درخواست دیں
5️⃣ جنرل سپلائر / وینڈر رجسٹریشن
6️⃣ ٹرانسپورٹ پارٹنر رجسٹریشن
7️⃣ ویئر ہاؤس رجسٹریشن
8️⃣ اکثر پوچھے جانے والے سوالات
9️⃣ ایف سی ایس ایکسپریس کیوں؟
🔟 رابطہ کریں`;

  }



  return `🇵🇰 Welcome to FCS Express Pakistan

Assalam-o-Alaikum!

I am Ghulam Qadir, your FCS Express Assistant.

Please reply with a number:

1️⃣ About FCS Express
2️⃣ Our Nationwide Network
3️⃣ Our Services
4️⃣ Apply for Franchise
5️⃣ General Supplier / Vendor Registration
6️⃣ Transport Partner Registration
7️⃣ Warehouse Registration
8️⃣ Frequently Asked Questions
9️⃣ Why Choose FCS Express
🔟 Contact Us`;

}




module.exports = {

  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu

};
