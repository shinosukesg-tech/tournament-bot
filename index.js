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
  ],
  partials: ["CHANNEL"]
});

/* ================= STATE ================= */

let tournament = null;

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function createTournament(size) {
  return {
    maxPlayers: size,
    players: [],
    matches: [],
    round: 1,
    started: false,
    panelId: null,
    bracketId: null
  };
}

/* ================= MATCH SYSTEM ================= */

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i];
    const p2 = shuffled[i + 1];

    if (p1 && !p2) matches.push({ p1, p2: null, winner: p1 });
    else if (!p1 && p2) matches.push({ p1: p2, p2: null, winner: p2 });
    else matches.push({ p1, p2, winner: null });
  }

  return matches;
}

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Mode: **1v1**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.started ? "Started" : "Open Registration"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🏆 ShinTours Help")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 **Commands**
━━━━━━━━━━━━━━━━━━

\`;1v1 <players>\`  
Create tournament

\`;code <room> @p1 @p2\`  
Send private match code

\`;win @player\`  
Mark winner

\`;qualify @player\`  
Same as win

\`;del\`  
Delete tournament

\`;help\`  
Show this menu

━━━━━━━━━━━━━━━━━━
👮 Staff required for:
1v1 • code • win • qualify • del
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function progressBar() {
  const total = tournament.matches.length;
  const done = tournament.matches.filter(m => m.winner).length;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const filled = Math.floor(percent / 10);
  return `\`${"█".repeat(filled)}${"░".repeat(10 - filled)}\` ${percent}%`;
}

function bracketEmbed() {
  let desc = `🏆 **ShinTours Tournament Bracket**\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `🎯 Round ${tournament.round}\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `⚔️ **Match ${i + 1}**\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> (BYE)\n\n`;
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

  desc += `━━━━━━━━━━━━━━━━━━\n📊 Progress\n`;
  desc += progressBar();

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

function buttons() {
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

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  msg.delete().catch(() => {});

  if (cmd === "help") {
    return msg.channel.send({ embeds: [helpEmbed()] });
  }

  /* ===== DELETE TOURNAMENT ===== */
  if (cmd === "del") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (!tournament)
      return msg.channel.send("⚠️ No active tournament.");

    try {
      if (tournament.panelId) {
        const panelMsg = await msg.channel.messages.fetch(tournament.panelId).catch(() => null);
        if (panelMsg) await panelMsg.delete().catch(() => {});
      }

      if (tournament.bracketId) {
        const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId).catch(() => null);
        if (bracketMsg) await bracketMsg.delete().catch(() => {});
      }
    } catch (err) {
      console.log(err);
    }

    tournament = null;
    return msg.channel.send("🗑️ Tournament deleted successfully.");
  }

  /* ===== CREATE ===== */
  if (cmd === "1v1") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (tournament && !tournament.started)
      return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]) || 8;
    tournament = createTournament(size);

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [buttons()]
    });

    tournament.panelId = panel.id;
  }

  /* ===== PRIVATE CODE ===== */
  if (cmd === "code") {
    if (!tournament?.started || !isStaff(msg.member)) return;

    const room = args[0];
    const p1 = msg.mentions.users.at(0);
    const p2 = msg.mentions.users.at(1);

    if (!room || !p1 || !p2)
      return msg.channel.send("Usage: ;code ROOM @p1 @p2");

    try {
      await p1.send(`🏆 Match Code: \`${room}\`\nOpponent: <@${p2.id}>`);
      await p2.send(`🏆 Match Code: \`${room}\`\nOpponent: <@${p1.id}>`);
      msg.channel.send("✅ Code sent privately.");
    } catch {
      msg.channel.send("⚠️ Cannot DM players.");
    }
  }

  /* ===== WIN / QUALIFY ===== */
  if (cmd === "win" || cmd === "qualify") {
    if (!tournament?.started || !isStaff(msg.member)) return;

    const player = msg.mentions.users.first();
    if (!player) return;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === player.id || m.p2 === player.id)
    );

    if (!match) return;

    match.winner = player.id;
    updateBracket(msg.channel);
  }
});

/* (Rest of your file remains unchanged — button handler + round system) */

client.login(process.env.DISCORD_TOKEN);
