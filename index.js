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
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator))
    return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function progressBar(done, total) {
  const size = 12;
  const percent = total === 0 ? 0 : done / total;
  const progress = Math.round(size * percent);
  return "🟩".repeat(progress) + "⬜".repeat(size - progress);
}

/* ================= TOURNAMENT ================= */

function createTournament(size, server, map) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    locked: false,
    channelId: null,
    messageId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle(players);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

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
    .setColor("#5865F2")
    .setTitle("🏆 ShinTours 1v1 Tournament")
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.locked ? "Locked" : "Open"}**
`)
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 **Round ${tournament.round}**\n\n`;
  let completed = 0;

  tournament.matches.forEach((m, i) => {
    if (m.winner) completed++;
    const p1 = m.p1 ? `<@${m.p1}>` : "BYE";
    const p2 = m.p2 ? `<@${m.p2}>` : "BYE";
    const winner = m.winner ? ` ✅ <@${m.winner}>` : "";

    desc += `**Match ${i + 1}**\n${p1} vs ${p2}${winner}\n\n`;
  });

  desc += `Progress:\n${progressBar(
    completed,
    tournament.matches.length
  )}`;

  return new EmbedBuilder()
    .setColor("#00FFAA")
    .setTitle("📊 Live Bracket")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  // Instant delete
  msg.delete().catch(() => {});

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* CREATE TOURNAMENT */
  if (cmd === "1v1") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map)
      return msg.channel.send(
        "Usage: ;1v1 <players> <server> <map>"
      );

    tournament = createTournament(size, server, map);
    tournament.channelId = msg.channel.id;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.messageId = panel.id;
    return;
  }

  if (!tournament) return;

  /* WIN COMMAND */
  if (cmd === "win") {
    if (!isStaff(msg.member)) return;

    const user = msg.mentions.users.first();
    if (!user) return;

    for (const match of tournament.matches) {
      if (
        (match.p1 === user.id || match.p2 === user.id) &&
        !match.winner
      ) {
        match.winner = user.id;
      }
    }

    const winners = tournament.matches
      .map(m => m.winner)
      .filter(Boolean);

    if (winners.length === tournament.matches.length) {
      if (winners.length === 1) {
        await msg.channel.send(
          `🏆 Champion: <@${winners[0]}>`
        );
        tournament = null;
        return;
      }

      tournament.round++;
      tournament.matches = generateMatches(winners);
    }

    const panel = await msg.channel.messages.fetch(
      tournament.messageId
    );

    await panel.edit({ embeds: [bracketEmbed()] });
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.locked)
      return interaction.reply({
        content: "🔒 Registration locked.",
        ephemeral: true
      });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );
      await interaction.reply({
        content: "❌ Unregistered.",
        ephemeral: true
      });
    } else {
      tournament.players.push(interaction.user.id);
      await interaction.reply({
        content: "✅ Registered!",
        ephemeral: true
      });

      if (tournament.players.length >= tournament.maxPlayers)
        tournament.locked = true;
    }

    const panel = await interaction.channel.messages.fetch(
      tournament.messageId
    );

    await panel.edit({
      embeds: [registrationEmbed()]
    });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({
        content: "Staff only.",
        ephemeral: true
      });

    if (tournament.started) return;

    tournament.started = true;
    tournament.matches = generateMatches(
      tournament.players
    );

    await interaction.reply({
      embeds: [bracketEmbed()]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
