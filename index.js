require("dotenv").config();

/* ================= EXPRESS (UPTIME) ================= */
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
  ButtonStyle
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Staff";

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

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1] || null,
      winner: null,
      code: generateCode()
    });
  }

  return matches;
}

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("Green")
    .setTitle("🏆 Tournament Registration")
    .setDescription(
      `Players: ${tournament.players.length}/${tournament.maxPlayers}\nStatus: ${
        tournament.started ? "Started" : "Open"
      }`
    );
}

function bracketEmbed() {
  let text = "";

  tournament.matches.forEach((m, i) => {
    text += `Match ${i + 1}\n`;

    if (!m.p2) {
      text += `🆓 <@${m.p1}> (BYE)\n\n`;
    } else if (!m.winner) {
      text += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      text += `🏆 <@${m.winner}>\n\n`;
    }
  });

  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle("🏆 Tournament Bracket")
    .setDescription(text);
}

function mainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  await msg.delete().catch(() => {});

  if (cmd === "help") {
    return msg.channel.send(
      "`;1v1 <players>`\n`;code <roomcode> @player`\n`;qual @player`\n`;win @player`\n`;del`"
    );
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.channel.send("Staff only.");
    if (tournament) return msg.channel.send("Tournament already exists.");

    const size = parseInt(args[0]);
    if (!size) return msg.channel.send("Usage: ;1v1 <players>");

    tournament = {
      maxPlayers: size,
      players: [],
      matches: [],
      started: false,
      messageId: null,
      channelId: msg.channel.id
    };

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [mainButtons()]
    });

    tournament.messageId = panel.id;
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return msg.channel.send("Staff only.");
    if (!tournament) return msg.channel.send("No tournament.");

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const message = await channel.messages.fetch(tournament.messageId);
      await message.delete().catch(() => {});
    } catch {}

    tournament = null;
    msg.channel.send("Tournament deleted.");
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return msg.channel.send("Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("No active tournament.");

    const roomCode = args[0];
    const mention = msg.mentions.users.first();
    if (!roomCode || !mention)
      return msg.channel.send("Usage: ;code <roomcode> @player");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("Player not in active match.");

    const both = [match.p1, match.p2].filter(Boolean);

    for (const id of both) {
      try {
        const user = await client.users.fetch(id);
        await user.send(
          `Room Code: ${roomCode}\nYou have 2 minutes to join.`
        );
      } catch {}
    }

    msg.channel.send("Code sent to both players.");
  }

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return msg.channel.send("Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("No active tournament.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.channel.send("Mention a player.");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("Player not in active match.");

    match.winner = mention.id;

    msg.channel.send(`<@${mention.id}> qualified.`);
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament)
    return interaction.reply({ content: "No tournament.", ephemeral: true });

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );

      await interaction.reply({
        content: "You have unregistered.",
        ephemeral: true
      });
    } else {
      if (tournament.players.length >= tournament.maxPlayers)
        return interaction.reply({ content: "Full.", ephemeral: true });

      tournament.players.push(interaction.user.id);

      await interaction.reply({
        content: "Registered.",
        ephemeral: true
      });
    }

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const message = await channel.messages.fetch(tournament.messageId);
      await message.edit({ embeds: [registrationEmbed()] });
    } catch {}
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
