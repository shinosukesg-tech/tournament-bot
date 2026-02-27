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
    GatewayIntentBits.MessageContent
  ]
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

function generateMatches(players) {
  const shuffled = shuffle(players);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) {
    shuffled.push("BYE");
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

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    let p1 = m.p1 === "BYE" ? "🤖 BYE" : `<@${m.p1}>`;
    let p2 = m.p2 === "BYE" ? "🤖 BYE" : `<@${m.p2}>`;

    if (m.winner) {
      if (m.winner === m.p1) {
        p1 += " ✅";
        p2 += " ❌";
      } else {
        p2 += " ✅";
        p1 += " ❌";
      }
    }

    desc += `Match ${i + 1}\n${p1} ⚔ ${p2}\n\n`;
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
  msg.delete().catch(() => {});

  /* CREATE TOURNAMENT */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    if (!size || !server || !map || !name) return;

    tournament = {
      name,
      maxPlayers: size,
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      started: false,
      panelId: null,
      finalWinner: null
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle(`🏆 ${name}`)
      .setImage(BANNER)
      .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${server}**
🗺 Map: **${map}**
👥 Players: **0/${size}**
🔓 Status: **OPEN**
`);

    const panel = await msg.channel.send({ embeds: [embed], components: [row] });
    tournament.panelId = panel.id;
  }

  /* START */
  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    if (!tournament || tournament.started) return;

    if (tournament.players.length === 0)
      return msg.channel.send("No players registered.");

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    msg.channel.send("Tournament Started ✅");
  }

  /* QUALIFY */
  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;
    if (!tournament || !tournament.started) return;

    const matchNumber = parseInt(args[0]?.replace("r", ""));
    const user = msg.mentions.users.first();
    if (!matchNumber || !user) return;

    const match = tournament.matches[matchNumber - 1];
    if (!match) return;

    match.winner = user.id;

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed()] });

    /* FINAL ROUND */
    if (tournament.matches.length === 1) {
      tournament.finalWinner = user.id;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("announce_winner")
          .setLabel("🏆 ANNOUNCE WINNER")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("dismiss")
          .setLabel("Dismiss")
          .setStyle(ButtonStyle.Danger)
      );

      return msg.channel.send({
        content: `Final winner set to <@${user.id}>.\nClick ANNOUNCE WINNER to confirm.`,
        components: [row]
      });
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "register") {
    if (!tournament || tournament.started)
      return interaction.reply({ content: "Registration closed.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "Tournament full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle(`🏆 ${tournament.name}`)
      .setImage(BANNER)
      .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **OPEN**
`);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [embed] });

    interaction.reply({ content: "Registered ✅", ephemeral: true });
  }

  if (interaction.customId === "announce_winner") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    if (!tournament.finalWinner)
      return interaction.reply({ content: "No final winner set.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor("#ffd700")
      .setTitle("🏆 TOURNAMENT CHAMPION")
      .setImage(BANNER)
      .setDescription(`👑 Congratulations <@${tournament.finalWinner}>`)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    tournament = null;
    interaction.update({ components: [] });
  }

  if (interaction.customId === "dismiss") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    interaction.update({ components: [] });
  }
});

client.login(process.env.TOKEN);
