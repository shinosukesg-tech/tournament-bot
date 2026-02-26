/* ===== RENDER FREE JUGAAD (DO NOT REMOVE) ===== */
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Web server running on port " + PORT);
});
/* ===== END RENDER JUGAAD ===== */

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Staff";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1350446868064374845/Event_Background_BlockDash.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= TOURNAMENT STATE ================= */

let tournament = null;
let commandLock = false;

function createTournament(playerCount) {
  return {
    maxPlayers: playerCount,
    server: "INW",
    players: [],
    round: 1,
    matches: [],
    started: false,
    panelId: null,
    bracketId: null
  };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

/* ================= BRACKET SYSTEM ================= */

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const bracketSize = nextPowerOfTwo(shuffled.length);
  const byesNeeded = bracketSize - shuffled.length;

  for (let i = 0; i < byesNeeded; i++) {
    shuffled.push(null);
  }

  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i];
    const p2 = shuffled[i + 1];

    if (p1 && !p2) {
      matches.push({ p1, p2: null, winner: p1 });
    } else if (!p1 && p2) {
      matches.push({ p1: p2, p2: null, winner: p2 });
    } else {
      matches.push({ p1, p2, winner: null });
    }
  }

  return matches;
}

/* ================= EMBEDS ================= */

function panelEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament (1v1)")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🌍 Server: **${tournament.server}**
📌 Status: **${tournament.started ? "Started" : "Open"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function bracketEmbed() {
  const total = tournament.matches.length;
  const finished = tournament.matches.filter(m => m.winner).length;

  const percent = total === 0 ? 0 : Math.floor((finished / total) * 100);
  const filled = Math.floor(percent / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  let desc = `🏆 **ShinTours Tournament**\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `🎯 Round: ${tournament.round}\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `${m.winner ? "✅" : "⚔️"} **Match ${i + 1}**\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> receives a **BYE**\n`;
      desc += `🏆 **Auto Qualified**\n\n`;
      return;
    }

    if (!m.winner) {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      desc += `🏆 **<@${m.winner}>**\n`;
      desc += `❌ ~~<@${loser}>~~\n\n`;
    }
  });

  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `📊 Progress\n`;
  desc += `\`${bar}\` ${percent}%`;

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

function panelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.started),

    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(tournament.started),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tournament.started)
  );
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= LOGIN SAFE CHECK ================= */

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing in Render Environment Variables!");
} else {
  client.login(process.env.TOKEN);
}
