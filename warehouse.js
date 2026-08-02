const warehouses = new Map();


const warehouseQuestions = {

  en: [

    "What is your Name / Company Name?",

    "What is your Contact Person Name?",

    "What is your Mobile / WhatsApp Number?",

    "Which City are you operating from?",

    "Which Province are you operating from?",

    "What is your CNIC Number?",

    "What is your Government Registration / Licence Number?",

    `Select Facility Type:

1️⃣ Warehouse

2️⃣ Truck Adda

3️⃣ Both Warehouse & Truck Adda`,

    `Select Facility Category:

1️⃣ General Storage Warehouse

2️⃣ E-commerce Fulfillment Warehouse

3️⃣ Cold Storage

4️⃣ Industrial / Commercial Warehouse

5️⃣ Open Yard / Truck Parking

6️⃣ Other`,

    "What are the available space and capacity details?",

    "How many trucks can be accommodated?",

    "Is loading / unloading facility available?",

    "What is the complete location address?",

    "Please provide details of previous projects / existing clients.",

    "Any further additional details?"

  ],



  ur: [

    "آپ کا نام / کمپنی کا نام کیا ہے؟",

    "رابطہ شخص کا نام کیا ہے؟",

    "آپ کا موبائل / واٹس ایپ نمبر کیا ہے؟",

    "آپ کس شہر میں کام کر رہے ہیں؟",

    "آپ کس صوبے میں کام کر رہے ہیں؟",

    "آپ کا شناختی کارڈ نمبر کیا ہے؟",

    "آپ کا سرکاری رجسٹریشن / لائسنس نمبر کیا ہے؟",

    `سہولت کی قسم منتخب کریں:

1️⃣ ویئر ہاؤس

2️⃣ ٹرک اڈہ

3️⃣ دونوں ویئر ہاؤس اور ٹرک اڈہ`,

    `سہولت کی کیٹیگری منتخب کریں:

1️⃣ جنرل اسٹوریج ویئر ہاؤس

2️⃣ ای کامرس فل فلمنٹ ویئر ہاؤس

3️⃣ کولڈ اسٹوریج

4️⃣ انڈسٹریل / کمرشل ویئر ہاؤس

5️⃣ اوپن یارڈ / ٹرک پارکنگ

6️⃣ دیگر`,

    "دستیاب جگہ اور گنجائش کی تفصیلات کیا ہیں؟",

    "کتنے ٹرک کھڑے کرنے کی گنجائش ہے؟",

    "کیا لوڈنگ / ان لوڈنگ کی سہولت موجود ہے؟",

    "مکمل مقام کا پتہ کیا ہے؟",

    "سابقہ پروجیکٹس / موجودہ کلائنٹس کی تفصیلات فراہم کریں۔",

    "مزید اضافی معلومات؟"

  ]

};



module.exports = {

  warehouses,

  warehouseQuestions

};
