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

  "What is your Education?\n\n1. Primary\n2. Middle\n3. Matric\n4. Intermediate\n5. Graduate\n6. Masters",
  "Please select your Business Experience:\n\n1. No Experience\n2. Less than 1 Year\n3. 1-3 Years\n4. 3-5 Years\n5. More than 5 Years",
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

 "آپ کی تعلیم کیا ہے؟\n\n1. پرائمری\n2. مڈل\n3. میٹرک\n4. انٹرمیڈیٹ\n5. گریجویٹ\n6. ماسٹرز",
   "اپنے کاروباری تجربے کا انتخاب کریں:\n\n1. کوئی تجربہ نہیں\n2. 1 سال سے کم\n3. 1 سے 3 سال\n4. 3 سے 5 سال\n5. 5 سال سے زیادہ",
    "کیا آپ کے پاس پہلے سے دکان یا دفتر موجود ہے؟ (ہاں / نہیں)",

    "اگر کوئی اضافی معلومات دینا چاہتے ہیں تو لکھیں۔ (اختیاری)"

  ]

};



module.exports = {

  applications,

  confirmations,

  questions

};
