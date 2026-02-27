require("dotenv").config();

/* ================== EXPRESS UPTIME ================== */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);
/* ==================================================== */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const BANNER =
  "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator))
    return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/* ================= TOURNAMENT ================= */

function createTournament(size, server, map, channelId) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    locked: false,
    channelId,
    panelId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle(players);
  const size = nextPowerOfTwo(tournament.maxPlayers);

  let byeCount = 1;
  while (shuffled.length < size) {
    shuffled.push(`BYE${byeCount++}`);
  }

  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1],
      winner: null
    });
  }

  return matches;
}

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#ff003c")
    .setTitle("🏆 SHINTOURS ESPORTS TOURNAMENT")
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
🔒 Status: **${tournament.locked ? "LOCKED" : "OPEN"}**
`)
    .setFooter({
      text: `Players: ${tournament.players.length}/${tournament.maxPlayers}`
    })
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1?.startsWith("BYE") ? `🤖 ${m.p1}` : `<@${m.p1}>`;
    const p2 = m.p2?.startsWith("BYE") ? `🤖 ${m.p2}` : `<@${m.p2}>`;

    const winner =
      m.winner
        ? m.winner.startsWith("BYE")
          ? `🏅 Winner: 🤖 ${m.winner}`
          : `🏅 Winner: <@${m.winner}>`
        : "";

    desc += `Match ${i + 1}\n${p1} ⚔ ${p2}\n${winner}\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* CREATE TOURNAMENT */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");
    if (!size || !server || !map) return;

    tournament = createTournament(size, server, map, msg.channel.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (0/${size})`)
        .setStyle(ButtonStyle.Success)
    );

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.panelId = panel.id;
    return;
  }

  if (!tournament) return;

  /* START COMMAND */
  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    tournament.started = true;
    tournament.locked = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    return;
  }

  /* QUAL COMMAND FIXED */
  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return msg.channel.send("Usage: ;qual @user or ;qual BYE1");

    const upper = input.toUpperCase();

    if (upper.startsWith("BYE")) {
      if (!tournament.players.includes(upper)) {
        tournament.players.push(upper);
        msg.channel.send(`${upper} qualified.`);
      }
    } else {
      const user = msg.mentions.users.first();
      if (!user) return msg.channel.send("Mention a user.");

      if (!tournament.players.includes(user.id)) {
        tournament.players.push(user.id);
        msg.channel.send(`${user.username} qualified.`);
      }
    }

    // Update register button count
    const panel = await msg.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (${tournament.players.length}/${tournament.maxPlayers})`)
        .setStyle(ButtonStyle.Success)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });

    return;
  }
});

/* ================= BUTTON ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Tournament started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(id => id !== interaction.user.id);
      await interaction.reply({ content: "Unregistered.", ephemeral: true });
    } else {
      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "Registered.", ephemeral: true });
    }

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (${tournament.players.length}/${tournament.maxPlayers})`)
        .setStyle(ButtonStyle.Success)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
