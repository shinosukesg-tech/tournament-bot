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

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function createTournament(size, server) {
  return {
    maxPlayers: size,
    server,
    players: [],
    matches: [],
    round: 1,
    started: false,
    panelId: null,
    bracketId: null
  };
}

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
🌍 Server: **${tournament.server}**
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
;1v1 <players> <server>
;code <room> @p1 @p2
;del
;help
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function progressBar() {
  const total = tournament.matches.length;
  const done = tournament.matches.filter(m => m.winner).length;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const filled = Math.floor(percent / 10);
  return \`█\`.repeat(filled) + \`░\`.repeat(10 - filled) + \` ${percent}%\`;
}

function bracketEmbed() {
  let desc = `🏆 **ShinTours Tournament Bracket**\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `🌍 Server: ${tournament.server}\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `⚔️ Match ${i + 1}\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> (BYE)\n\n`;
      return;
    }

    if (!m.winner)
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      desc += `🏆 **<@${m.winner}>**\n`;
      desc += `❌ ~~<@${loser}>~~\n\n`;
    }
  });

  desc += `━━━━━━━━━━━━━━━━━━\n📊 ${progressBar()}`;

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
      .setDisabled(tournament?.started),
    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(tournament?.started),
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tournament?.started)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (msg.deletable) msg.delete().catch(() => {});

  if (cmd === "help")
    return msg.channel.send({ embeds: [helpEmbed()] });

  if (cmd === "1v1") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (tournament !== null)
      return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]);
    const server = args.slice(1).join(" ");

    if (!size || !server)
      return msg.channel.send("Usage: ;1v1 <players> <server>");

    tournament = createTournament(size, server);

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [buttons()]
    });

    tournament.panelId = panel.id;
  }

  if (cmd === "del") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    tournament = null;
    return msg.channel.send("🗑️ Tournament deleted.");
  }

  if (cmd === "code") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    const roomCode = args[0];
    const mentions = msg.mentions.users;

    if (!roomCode || mentions.size < 2)
      return msg.channel.send("Usage: ;code <room> @p1 @p2");

    mentions.forEach(async user => {
      try {
        await user.send(`
🌍 Region : ${tournament.server}
🔒 Room Code :

\`\`\`
${roomCode}
\`\`\`

⏳ You have 2 minutes to join.
        `);
      } catch {}
    });

    msg.channel.send("📩 Code sent.");
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return interaction.reply({ content: "No tournament.", ephemeral: true });

  await interaction.deferUpdate();

  if (interaction.customId === "register") {
    if (!tournament.players.includes(interaction.user.id) &&
        tournament.players.length < tournament.maxPlayers)
      tournament.players.push(interaction.user.id);
  }

  if (interaction.customId === "unregister") {
    tournament.players = tournament.players.filter(id => id !== interaction.user.id);
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;
    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    const bracket = await interaction.channel.send({
      embeds: [bracketEmbed()]
    });

    tournament.bracketId = bracket.id;
  }

  const panel = await interaction.channel.messages.fetch(tournament.panelId).catch(() => null);
  if (panel)
    await panel.edit({
      embeds: [registrationEmbed()],
      components: [buttons()]
    });
});

client.login(process.env.DISCORD_TOKEN);
