const applications = new Map();
const confirmations = new Map();


const questions = {

  en: [

    "What is your Full Name?",

    "What is your Father's Name?",

    "What is your Mobile Number?",

    "What is your CNIC Number?",

    "What is your Email Address? (Optional)",

    "Which Province are you applying from?\n\n1. Punjab\n2. Sindh\n3. KPK\n4. Balochistan\n5. AJK\n6. Gilgit Baltistan\n7. Islamabad",

    "Which City?",

    "Which Area / Tehsil?",

    "What is your Office / Shop Address?",

    "What is your Education?",

    "Please describe your Business Experience.",

    "Do you already have a shop or office? (Yes / No)",

    "Any additional comments? (Optional)"

  ],



  ur: [

    "آپ کا پورا نام کیا ہے؟",

    "آپ کے والد کا نام کیا ہے؟",

    "آپ کا موبائل نمبر کیا ہے؟",

    "آپ کا شناختی کارڈ نمبر کیا ہے؟",

    "آپ کا ای میل ایڈریس کیا ہے؟ (اختیاری)",

    "آپ کس صوبے سے درخواست دے رہے ہیں؟\n\n1. پنجاب\n2. سندھ\n3. خیبر پختونخوا\n4. بلوچستان\n5. آزاد کشمیر\n6. گلگت بلتستان\n7. اسلام آباد",

    "آپ کا شہر کون سا ہے؟",

    "آپ کا علاقہ / تحصیل کون سی ہے؟",

    "آپ کے دفتر / دکان کا مکمل پتہ کیا ہے؟",

    "آپ کی تعلیم کیا ہے؟",

    "اپنے کاروباری تجربے کے بارے میں بتائیں۔",

    "کیا آپ کے پاس پہلے سے دکان یا دفتر موجود ہے؟ (ہاں / نہیں)",

    "اگر کوئی اضافی معلومات دینا چاہتے ہیں تو لکھیں۔ (اختیاری)"

  ]

};



module.exports = {

  applications,

  confirmations,

  questions

};
