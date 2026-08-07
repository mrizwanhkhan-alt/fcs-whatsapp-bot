const suppliers = new Map();

const supplierQuestions = {

  en: [

    "What is your Company / Supplier Name?",

    "What is your Contact Person Name?",

    "What is your Mobile / WhatsApp Number?",

    `Select your Province / Region:

1️⃣ Punjab
2️⃣ Sindh
3️⃣ Khyber Pakhtunkhwa (KPK)
4️⃣ Balochistan
5️⃣ Azad Jammu & Kashmir (AJK)
6️⃣ Gilgit-Baltistan
7️⃣ Islamabad Capital Territory`,

    "Which City are you operating from?",

    "What is your CNIC Number?",

    "What is your Government Licence / Registration Number?",

    `Select Supplier Category:

1️⃣ Printing Material
2️⃣ Packaging Material
3️⃣ Courier Supplies
4️⃣ Uniforms / Clothing
5️⃣ Stationery
6️⃣ IT Equipment
7️⃣ Furniture
8️⃣ Vehicle / Transport Supplies
9️⃣ Other`,

    "Please provide details of your past projects / previous work.",

    "Any further additional details?"
  ],

  ur: [

    "آپ کی کمپنی / سپلائر کا نام کیا ہے؟",

    "رابطہ شخص کا نام کیا ہے؟",

    "آپ کا موبائل / واٹس ایپ نمبر کیا ہے؟",

    `اپنا صوبہ / علاقہ منتخب کریں:

1️⃣ پنجاب
2️⃣ سندھ
3️⃣ خیبر پختونخوا
4️⃣ بلوچستان
5️⃣ آزاد جموں و کشمیر
6️⃣ گلگت بلتستان
7️⃣ اسلام آباد`,

    "آپ کس شہر میں کام کر رہے ہیں؟",

    "آپ کا شناختی کارڈ نمبر کیا ہے؟",

    "آپ کا سرکاری لائسنس / رجسٹریشن نمبر کیا ہے؟",

    `سپلائر کی کیٹیگری منتخب کریں:

1️⃣ پرنٹنگ میٹریل
2️⃣ پیکیجنگ میٹریل
3️⃣ کورئیر سپلائز
4️⃣ یونیفارم / کپڑے
5️⃣ اسٹیشنری
6️⃣ آئی ٹی سامان
7️⃣ فرنیچر
8️⃣ گاڑیوں / ٹرانسپورٹ سپلائز
9️⃣ دیگر`,

    "اپنے سابقہ پروجیکٹس / کام کی تفصیلات فراہم کریں۔",

    "مزید اضافی معلومات؟"
  ]
};

module.exports = {
  suppliers,
  supplierQuestions
};
