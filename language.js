// ==============================
// MAIN MENU OPTIONS
// ==============================

const lang = getLanguage(customerNumber);


if (hasLanguage(customerNumber)) {


  if (text === "1") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "ایف سی ایس ایکسپریس پاکستان کا ایک قابل اعتماد لاجسٹکس نیٹ ورک بنا رہا ہے۔"

      : "FCS Express is building Pakistan's trusted logistics network."

    );

    return;

  }



  if (text === "2") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "ہمارا ملک گیر نیٹ ورک NDCs، RDCs، سٹی ہبز اور سروس پوائنٹس پر مشتمل ہے۔"

      : "Our nationwide network includes NDCs, RDCs, City Hubs and Service Points across Pakistan."

    );

    return;

  }



  if (text === "3") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "ہماری سروسز میں ایکسپریس ڈلیوری، کارپوریٹ لاجسٹکس، ای کامرس ڈلیوری اور COD شامل ہیں۔"

      : "Our services include Express Delivery, Corporate Logistics, E-commerce Delivery and COD."

    );

    return;

  }



  if (text === "4") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "ایف سی ایس ایکسپریس جدید ٹیکنالوجی کے ساتھ قابل اعتماد لاجسٹکس حل فراہم کرتا ہے۔"

      : "FCS Express provides reliable technology-driven logistics solutions."

    );

    return;

  }



  if (text === "5") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "ایف سی ایس ایکسپریس فرنچائز نیٹ ورک کا حصہ بنیں اور پاکستان کے بڑھتے ہوئے لاجسٹکس نیٹ ورک کے ساتھ ترقی کریں۔"

      : "Join FCS Express Franchise Network and become part of Pakistan's growing logistics future."

    );

    return;

  }



  if (text === "7") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "اکثر پوچھے جانے والے سوالات کے لیے ہماری فرنچائز ٹیم آپ کی رہنمائی کرے گی۔"

      : "Frequently Asked Questions will be available here. Our franchise team will guide you."

    );

    return;

  }



  if (text === "8") {

    sendWhatsAppMessage(
      customerNumber,

      lang === "ur"

      ? "فرنچائز ٹیم سے رابطہ کریں:\nواٹس ایپ: 03326237178"

      : "Contact Franchise Team:\nWhatsApp: 03326237178"

    );

    return;

  }

}
