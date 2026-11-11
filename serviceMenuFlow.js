"use strict";

const { createHmac, randomUUID, timingSafeEqual } = require("node:crypto");

// Keep the published display order independent of the bot's existing routing.
const services = [
  ["1", "About FCS Express", "کمپنی کا تعارف",
    "FCS Express is a logistics and transport company. Our business areas include parcel delivery, e-commerce, freight, corporate logistics and distribution.",
    "ایف سی ایس ایکسپریس ایک لاجسٹکس اور ٹرانسپورٹ کمپنی ہے۔ ہماری خدمات میں پارسل ڈیلیوری، ای کامرس، فریٹ، کارپوریٹ لاجسٹکس اور ڈسٹری بیوشن شامل ہیں۔"],
  ["3", "Our Services", "ہماری خدمات",
    "Parcel collection and delivery, e-commerce logistics, cash on delivery (COD), freight, warehousing, corporate logistics and nationwide distribution.",
    "پارسل کلیکشن اور ڈیلیوری، ای کامرس لاجسٹکس، کیش آن ڈیلیوری، فریٹ، ویئر ہاؤسنگ، کارپوریٹ لاجسٹکس اور ملک گیر ڈسٹری بیوشن۔"],
  ["2", "Nationwide Network", "ملک گیر نیٹ ورک",
    "Explore the FCS Express distribution network and service points across Pakistan.",
    "پاکستان بھر میں ایف سی ایس ایکسپریس کے ڈسٹری بیوشن نیٹ ورک اور سروس پوائنٹس کی تفصیلات دیکھیں۔"],
  ["4", "Free Franchise", "فری فرنچائز",
    "Continue in chat for the FCS Express Free Franchise application.",
    "ایف سی ایس ایکسپریس فری فرنچائز کی درخواست کے لیے چیٹ میں آگے بڑھیں۔"],
  ["5", "City Business Center", "سٹی بزنس سینٹر",
    "Continue in chat for the City Business Center application.",
    "سٹی بزنس سینٹر کی درخواست کے لیے چیٹ میں آگے بڑھیں۔"],
  ["6", "Tenders", "ٹینڈرز",
    "Continue in chat to view tender and vendor opportunities.",
    "ٹینڈرز اور وینڈر مواقع دیکھنے کے لیے چیٹ میں آگے بڑھیں۔"],
  ["7", "Careers", "ملازمتیں",
    "Continue in chat to start the job application process.",
    "ملازمت کی درخواست شروع کرنے کے لیے چیٹ میں آگے بڑھیں۔"],
  ["8", "FAQs", "اکثر پوچھے جانے والے سوالات",
    "Continue in chat to view frequently asked questions.",
    "اکثر پوچھے جانے والے سوالات دیکھنے کے لیے چیٹ میں آگے بڑھیں۔"],
  ["9", "Contact & Support", "رابطہ اور معاونت",
    "042 3246 2221\ninfo@fcsexpress.com.pk\nwww.fcsexpress.com.pk",
    "042 3246 2221\ninfo@fcsexpress.com.pk\nwww.fcsexpress.com.pk"],
  ["11", "Talk to our representative", "نمائندے سے بات کریں",
    "Continue in chat to request the WhatsApp call button.",
    "واٹس ایپ کال کا بٹن حاصل کرنے کے لیے چیٹ میں آگے بڑھیں۔"]
];

function makeFlow(language, banner, icons) {
  const urdu = language === "ur";
  const list = services.map((service, index) => {
    const title = service[urdu ? 2 : 1];
    return {
      id: `service_${index + 1}`,
      "main-content": { title: `${index + 1}. ${title}` },
      start: { image: icons[index] },
      "on-click-action": {
        name: "navigate", next: { name: "SERVICE", type: "screen" },
        payload: { service: String(index + 1), heading: title, detail: service[urdu ? 4 : 3] }
      }
    };
  });

  return {
    version: "7.1",
    routing_model: { MENU: ["SERVICE"], SERVICE: [] },
    screens: [{
      id: "MENU", title: "FCS Express", data: {},
      layout: { type: "SingleColumnLayout", children: [
        { type: "Image", src: banner, height: 150, "scale-type": "contain", "alt-text": "FCS Express Pakistan" },
        { type: "TextHeading", text: urdu ? "سروس منتخب کریں" : "Tap a service" },
        { type: "NavigationList", name: "services", "list-items": list }
      ] }
    }, {
      id: "SERVICE", title: urdu ? "ایف سی ایس خدمات" : "FCS Express Service", terminal: true, success: true,
      data: {
        service: { type: "string", __example__: "1" },
        heading: { type: "string", __example__: list[0]["on-click-action"].payload.heading },
        detail: { type: "string", __example__: list[0]["on-click-action"].payload.detail }
      },
      layout: { type: "SingleColumnLayout", children: [
        { type: "TextHeading", text: "${data.heading}" },
        { type: "TextBody", text: "${data.detail}" },
        { type: "Footer", label: urdu ? "چیٹ میں جاری رکھیں" : "Continue in chat",
          "on-click-action": { name: "complete", payload: { service: "${data.service}" } } }
      ] }
    }]
  };
}

function signToken(number, value) {
  return createHmac("sha256", process.env.META_APP_SECRET)
    .update(`fcs-service-menu:${number}:${value}`).digest("hex");
}

function menuFlow(number, language) {
  const flowId = process.env[language === "ur" ? "FCS_SERVICE_FLOW_UR_ID" : "FCS_SERVICE_FLOW_EN_ID"];
  if (!/^\d+$/.test(flowId || "") || !process.env.META_APP_SECRET) return null;

  const token = `${language}.${Date.now()}.${randomUUID()}`;
  return {
    type: "flow",
    body: { text: language === "ur" ? "ایف سی ایس سروسز دیکھنے کے لیے مینیو کھولیں۔" : "Open the menu to choose an FCS Express service." },
    action: {
      name: "flow",
      parameters: {
        flow_message_version: "3", flow_id: flowId, flow_token: `${token}.${signToken(number, token)}`,
        flow_cta: language === "ur" ? "مینیو کھولیں" : "Open FCS Menu",
        flow_action: "navigate", flow_action_payload: { screen: "MENU" }
      }
    }
  };
}

function menuList(language) {
  const urdu = language === "ur";
  const locale = urdu ? "ur" : "en";
  const icons = ["ℹ️", "📦", "🌐", "🤝", "🏢", "📋", "💼", "❓", "📩", "☎️"];
  return {
    type: "list",
    header: { type: "text", text: "🔴 FCS Express Pakistan" },
    body: { text: urdu ? "آپ کو کس سروس کی ضرورت ہے؟ فہرست سے منتخب کریں۔" : "How can we help? Choose a service from the menu." },
    action: {
      button: urdu ? "🔴 سروسز دیکھیں" : "🔴 View services",
      sections: [{
        rows: services.map((service, index) => {
          const title = index === 7 && urdu ? "عام سوالات"
            : index === 9 && !urdu ? "Talk to our team"
            : service[urdu ? 2 : 1];
          return { id: `fcs_service_${locale}_${index + 1}`, title: `${icons[index]} ${title}` };
        })
      }]
    }
  };
}

function listSelection(interactive) {
  if (interactive?.type !== "list_reply") return null;
  const match = /^fcs_service_(en|ur)_([1-9]|10)$/.exec(interactive.list_reply?.id);
  if (!match) return null;
  return { language: match[1], option: services[Number(match[2]) - 1][0] };
}

const completedFlows = new Map();

function menuSelection(number, interactive) {
  if (interactive?.type !== "nfm_reply" || !process.env.META_APP_SECRET) return null;
  try {
    const { flow_token: token, service } = JSON.parse(interactive.nfm_reply?.response_json);
    const match = /^(en|ur)\.(\d{13})\.[a-f0-9-]{36}\.([a-f0-9]{64})$/.exec(token);
    if (!match || typeof service !== "string" || !/^(?:[1-9]|10)$/.test(service)) return null;
    const [, language, issuedAt, signature] = match;
    const now = Date.now();
    const expires = Number(issuedAt) + 24 * 60 * 60 * 1000;
    if (Number(issuedAt) > now || expires < now) return null;
    const expected = signToken(number, token.slice(0, token.lastIndexOf(".")));
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) return null;
    if (completedFlows.has(token)) return null;
    completedFlows.set(token, expires);
    for (const [key, expiry] of completedFlows) {
      if (expiry >= now && completedFlows.size <= 10000) break;
      completedFlows.delete(key);
    }
    return { language, option: services[Number(service) - 1][0] };
  } catch {
    return null;
  }
}

module.exports = { makeFlow, menuFlow, menuList, menuSelection, listSelection };
