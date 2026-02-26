require("dotenv").config();

/* ================= UPTIME SERVER ================= */
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
});
/* ================================================= */

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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createTournament(size, server, map) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    started: false,
    panelId: null,
    channelId: null,
    totalMatches: 0,
    completedMatches: 0
  };
}

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1],
      winner: null,
      code: generateCode()
    });
  }

  return matches;
}

function progressBar() {
  const total = tournament.totalMatches;
  const done = tournament.completedMatches;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 10);
  return "🟩".repeat(percent) + "⬜".repeat(10 - percent);
}

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.started ? "Started" : "Open Registration"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function bracketEmbed() {
  let desc = `🏆 ShinTours Bracket\n━━━━━━━━━━━━━━━━━━\n`;

  tournament.matches.forEach((m, i) => {
    desc += `⚔️ Match ${i + 1}\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> (BYE)\n\n`;
    } else if (!m.winner) {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      desc += `🏆 <@${m.winner}>\n❌ ~~<@${loser}>~~\n\n`;
    }
  });

  desc += `━━━━━━━━━━━━━━━━━━\n📊 Progress:\n${progressBar()}\n`;

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  await msg.delete().catch(() => {});

  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#00ff88")
          .setTitle("📖 ShinTours Tournament Help")
          .setDescription(`
━━━━━━━━━━━━━━━━━━
;1v1 <players> <server> <map>
;code <roomcode> @player
;qual @player
;win @player
;del
━━━━━━━━━━━━━━━━━━
`)
          .setImage(BANNER)
      ]
    });
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("❌ No active tournament.");

    const roomCode = args[0];
    const mention = msg.mentions.users.first();

    if (!roomCode || !mention)
      return msg.channel.send("Usage: ;code <roomcode> @player");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match)
      return msg.channel.send("❌ Player not in active match.");

    const opponents = [];
    if (match.p1) opponents.push(match.p1);
    if (match.p2) opponents.push(match.p2);

    for (const id of opponents) {
      try {
        const user = await client.users.fetch(id);
        await user.send(`
🌍Region : ${tournament.server}
🗺Map : ${tournament.map}
🔒Room Code :

\`\`\`
${roomCode}
\`\`\`

⏳ You have 2 minutes to join.
`);
      } catch {}
    }

    msg.channel.send("✅ Room code sent to both opponents.");
  }

  /* --- Rest of your system remains EXACTLY SAME --- */
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
