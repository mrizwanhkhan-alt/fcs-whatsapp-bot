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

میں غلام قادر، آپ کا فرنچائز ڈویلپمنٹ اسسٹنٹ ہوں۔

براہِ کرم نمبر منتخب کریں:

1️⃣ ایف سی ایس ایکسپریس کے بارے میں
2️⃣ ہمارا ملک گیر نیٹ ورک
3️⃣ ہماری سروسز
4️⃣ ایف سی ایس ایکسپریس کیوں؟
5️⃣ فرنچائز کا موقع
6️⃣ فرنچائز کے لیے درخواست دیں
7️⃣ اکثر پوچھے جانے والے سوالات
8️⃣ فرنچائز ٹیم سے رابطہ کریں`;

  }



  return `🇵🇰 Welcome to FCS Express Pakistan

Assalam-o-Alaikum!

I am Ghulam Qadir, your Franchise Development Assistant.

Please reply with a number:

1️⃣ About FCS Express
2️⃣ Our Nationwide Network
3️⃣ Our Services
4️⃣ Why Choose FCS Express
5️⃣ Franchise Opportunity
6️⃣ Apply for Franchise
7️⃣ Frequently Asked Questions
8️⃣ Contact Franchise Team`;

}




module.exports = {

  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu

};
