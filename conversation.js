const conversations = new Map();

function get(number) {
  if (!conversations.has(number)) {
    conversations.set(number, []);
  }

  return conversations.get(number);
}

function set(number, history) {
  conversations.set(number, history);
}

function remove(number) {
  conversations.delete(number);
}

function clearAll() {
  conversations.clear();
}

module.exports = {
  get,
  set,
  remove,
  clearAll
};
