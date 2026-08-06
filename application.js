const applications = new Map();
const confirmations = new Map();


const questions = {

  en: [
"Please Enter Your Complete Name",
    "What is your Full Name?",
"Please Enter Your Father's Complete Name",
  "Please Enter Your Mobile Number",

  "Please Enter Your CNIC Number (Format: 12345-1234567-1)",

"Please Enter Your Email Address (Optional)",
    "Which Province are you applying from?\n\n1. Punjab\n2. Sindh\n3. KPK\n4. Balochistan\n5. AJK\n6. Gilgit Baltistan\n7. Islamabad",

   "Please Enter Your City / District Name",
   "Please Enter Your Area / Tehsil / Town Committee Name",
   "Please Enter Your Business Address",

  "What is your Education?\n\n1. Primary\n2. Middle\n3. Matric\n4. Intermediate\n5. Graduate\n6. Masters",
  "Please select your Business Experience:\n\n1. No Experience\n2. Less than 1 Year\n3. 1-3 Years\n4. 3-5 Years\n5. More than 5 Years",
    "Do you already have a shop or office? (Yes / No)",

   "Additional Notes (Optional)",
  ],



  ur: [

 "براہِ کرم اپنا مکمل نام درج کریں۔",
   "براہِ کرم اپنے والد کا مکمل نام درج کریں۔",
   "براہِ کرم اپنا موبائل نمبر درج کریں۔",

  "براہِ کرم اپنا شناختی کارڈ نمبر درج کریں۔ (مثال: 12345-1234567-1)",
  "براہِ کرم اپنا ای میل ایڈریس درج کریں۔ (اختیاری)",
    "آپ کس صوبے سے درخواست دے رہے ہیں؟\n\n1. پنجاب\n2. سندھ\n3. خیبر پختونخوا\n4. بلوچستان\n5. آزاد کشمیر\n6. گلگت بلتستان\n7. اسلام آباد",

   "براہِ کرم اپنے شہر / ضلع کا نام درج کریں۔",
"براہِ کرم اپنے علاقے / تحصیل / ٹاؤن کمیٹی کا نام درج کریں۔",
 
  "براہِ کرم اپنے کاروباری پتے کی تفصیل درج کریں۔",
 "آپ کی تعلیم کیا ہے؟\n\n1. پرائمری\n2. مڈل\n3. میٹرک\n4. انٹرمیڈیٹ\n5. گریجویٹ\n6. ماسٹرز",
   "اپنے کاروباری تجربے کا انتخاب کریں:\n\n1. کوئی تجربہ نہیں\n2. 1 سال سے کم\n3. 1 سے 3 سال\n4. 3 سے 5 سال\n5. 5 سال سے زیادہ",
    "کیا آپ کے پاس پہلے سے دکان یا دفتر موجود ہے؟ (ہاں / نہیں)",

   "اضافی نوٹس (اختیاری)",
  ]

};



module.exports = {

  applications,

  confirmations,

  questions

};
