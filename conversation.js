const conversations = new Map();

function get(number) {
  return conversations.get(number);
}

function set(number, data) {
  conversations.set(number, data);
}

function remove(number) {
  conversations.delete(number);
}

module.exports = {
  get,
  set,
  remove
};
