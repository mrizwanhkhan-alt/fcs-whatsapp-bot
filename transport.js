const transports = new Map();


const transportQuestions = {

  en: [

    "What is your Company / Transport Name?",

    "What is your Contact Person Name?",

    "What is your Mobile / WhatsApp Number?",

    "Which City are you operating from?",

    "Which Province are you operating from?",

    "What is your CNIC Number?",

    "What is your Government Registration / Licence Number?",


    `Select Partner Type:

1️⃣ Transport Company

2️⃣ Fleet Owner

3️⃣ Truck / Cargo Provider

4️⃣ Car / Van Provider

5️⃣ Other`,


    `Select One or More Vehicle Types Available:

1️⃣ Car

2️⃣ Van

3️⃣ Bike

4️⃣ Loader Rickshaw

5️⃣ Suzuki / Pickup

6️⃣ Shehzore / Mazda

7️⃣ Truck

8️⃣ Container

9️⃣ Other

(You can enter multiple numbers, example: 1,5,7)`,



    "How many vehicles are available?",


    "What are your operating routes / areas?",


    "Please provide details of previous projects / existing clients.",


    "Any further additional details?"

  ],




  ur: [

    "آپ کی کمپنی / ٹرانسپورٹ کا نام کیا ہے؟",

    "رابطہ شخص کا نام کیا ہے؟",

    "آپ کا موبائل / واٹس ایپ نمبر کیا ہے؟",

    "آپ کس شہر میں کام کر رہے ہیں؟",

    "آپ کس صوبے میں کام کر رہے ہیں؟",

    "آپ کا شناختی کارڈ نمبر کیا ہے؟",

    "آپ کا سرکاری رجسٹریشن / لائسنس نمبر کیا ہے؟",


    `پارٹنر کی قسم منتخب کریں:

1️⃣ ٹرانسپورٹ کمپنی

2️⃣ فلیٹ اونر

3️⃣ ٹرک / کارگو فراہم کنندہ

4️⃣ کار / وین فراہم کنندہ

5️⃣ دیگر`,


    `دستیاب گاڑیوں کی ایک یا ایک سے زیادہ اقسام منتخب کریں:

1️⃣ کار

2️⃣ وین

3️⃣ بائیک

4️⃣ لوڈر رکشہ

5️⃣ سوزوکی / پک اپ

6️⃣ شہزور / مزدا

7️⃣ ٹرک

8️⃣ کنٹینر

9️⃣ دیگر

(ایک سے زیادہ نمبر لکھ سکتے ہیں، مثال: 1,5,7)`,



    "دستیاب گاڑیوں کی تعداد کتنی ہے؟",


    "آپ کن روٹس / علاقوں میں کام کرتے ہیں؟",


    "سابقہ پروجیکٹس / موجودہ کلائنٹس کی تفصیلات فراہم کریں۔",


    "مزید اضافی معلومات؟"

  ]

};



module.exports = {

  transports,

  transportQuestions

};
