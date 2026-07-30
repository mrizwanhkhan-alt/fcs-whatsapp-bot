const OpenAI = require("openai");

const conversation = require("./conversation");
const config = require("./config");

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

async function getReply(number, userMessage) {
  let history = conversation.get(number) || [];

  history.push({
    role: "user",
    content: userMessage
  });

  const response = await client.responses.create({
    model: "gpt-5",
    input: history
  });

  const reply = response.output_text;

  history.push({
    role: "assistant",
    content: reply
  });

  if (history.length > 20) {
    history = history.slice(-20);
  }

  conversation.set(number, history);

  return reply;
}

module.exports = {
  getReply
};
