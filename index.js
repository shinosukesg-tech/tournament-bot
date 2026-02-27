require("dotenv").config();

/* ================= UPTIME ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(process.env.PORT || 3000);
/* ========================================== */

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
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

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
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/* ================= CREATE ================= */

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
  const size = nextPowerOfTwo(players.length || 1);

  let bye = 1;
  while (shuffled.length < size) {
    shuffled.push(`BYE${bye++}`);
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
🔓 Status: **${tournament.locked ? "LOCKED" : "OPEN"}**
`)
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

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // delete ONLY normal command message
  msg.delete().catch(() => {});

  /* CREATE */
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
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`0/${size}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.panelId = panel.id;
    return;
  }

  if (!tournament) return;

  /* DELETE TOURNAMENT */
  if (cmd === "del") {
    if (!isStaff(msg.member)) return;
    tournament = null;
    return;
  }

  /* START */
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

  /* QUAL */
  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;
    if (tournament.started) return;

    const input = args[0];
    if (!input) return;

    const upper = input.toUpperCase();

    if (upper.startsWith("BYE")) {
      if (!tournament.players.includes(upper))
        tournament.players.push(upper);
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;
      if (!tournament.players.includes(user.id))
        tournament.players.push(user.id);
    }

    const panel = await msg.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`${tournament.players.length}/${tournament.maxPlayers}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });
    return;
  }

  /* WIN */
  if (cmd === "win") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    const winner =
      input.toUpperCase().startsWith("BYE")
        ? input.toUpperCase()
        : msg.mentions.users.first()?.id;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === winner || m.p2 === winner)
    );
    if (!match) return;

    match.winner = winner;

    // check round complete
    if (tournament.matches.every(m => m.winner)) {
      const winners = tournament.matches.map(m => m.winner);

      if (winners.length === 1) {
        tournament = null;
        return;
      }

      tournament.round++;
      tournament.matches = generateMatches(winners);
    }

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed()] });
    return;
  }

  /* CODE */
  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const code = args[0];
    const user = msg.mentions.users.first();
    if (!code || !user) return;

    const match = tournament.matches.find(
      m =>
        !m.winner &&
        (m.p1 === user.id || m.p2 === user.id)
    );
    if (!match) return;

    for (const id of [match.p1, match.p2]) {
      if (id.startsWith("BYE")) continue;

      const member = await msg.guild.members.fetch(id);

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("🎮 MATCH ROOM")
        .setDescription(`
Room Code: **${code}**
Server: **${tournament.server}**
Map: **${tournament.map}**
`)
        .setTimestamp();

      await member.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );
    } else {
      tournament.players.push(interaction.user.id);
    }

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`${tournament.players.length}/${tournament.maxPlayers}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });

    await interaction.deferUpdate();
  }
});

client.login(process.env.DISCORD_TOKEN);
