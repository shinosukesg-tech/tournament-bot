const fs = require("fs");

let gems = {};

if (fs.existsSync("./gems.json")) {
  gems = JSON.parse(fs.readFileSync("./gems.json"));
}

function save() {
  fs.writeFileSync("./gems.json", JSON.stringify(gems, null, 2));
}

function get(id) {
  if (!gems[id]) gems[id] = 0;
  return gems[id];
}

function add(id, amount) {
  if (!gems[id]) gems[id] = 0;
  gems[id] += amount;
  save();
}

module.exports = { get, add };
