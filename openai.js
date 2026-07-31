const OpenAI = require("openai");

const config = require("./config");
const conversation = require("./conversation");

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

async function getReply(number, userMessage) {
  try {
    let history = conversation.get(number) || [];

    history.push({
      role: "user",
      content: userMessage
    });

    const messages = [
      {
        role: "system",
        content: `You are the official AI Assistant of FCS Express Pakistan.

Your job is ONLY to assist customers regarding FCS Express.

You can help with:
- Shipment Tracking
- Courier Services
- Pickup Requests
- Franchise Opportunities
- Corporate Logistics
- Customer Support

If the customer asks anything unrelated to FCS Express, politely reply:

"I'm here to assist you with FCS Express services. How may I help you today?"

Never say you are ChatGPT or OpenAI.

Reply in Urdu if the customer writes in Urdu.
Reply in English if the customer writes in English.`
      ...history
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: 0.7
    });

    const reply =
      response.choices[0].message.content || "I'm sorry, I couldn't generate a reply.";

    history.push({
      role: "assistant",
      content: reply
    });

    if (history.length > 20) {
      history = history.slice(-20);
    }

    conversation.set(number, history);

    return reply;
  } catch (error) {
    console.error("OpenAI Error:", error);

    return "Sorry, I'm temporarily unavailable. Please try again shortly.";
  }
}

module.exports = {
  getReply
};
