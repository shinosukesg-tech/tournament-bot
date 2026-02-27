require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const PREFIX = ";";
const STAFF_ROLE = "Tournament Staff";

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function generateMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1] || null,
      winner: null
    });
  }
  return matches;
}

function username(id, guild) {
  if (!id) return "BYE";
  if (id.startsWith("BYE")) return id;
  const member = guild.members.cache.get(id);
  return member ? member.user.username : "Unknown";
}

/* ================= EMBEDS ================= */

function registrationEmbed(guild) {
  return new EmbedBuilder()
    .setTitle("🏆 TOURNAMENT REGISTRATION")
    .setDescription("Click register to join.")
    .setColor("Blue")
    .setFooter({ text: `Players: ${tournament.players.length}` });
}

function bracketEmbed(guild) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ROUND ${tournament.round}`)
    .setColor("Green");

  let desc = "";

  tournament.matches.forEach((m, i) => {
    let p1 = username(m.p1, guild);
    let p2 = username(m.p2, guild);

    let status = "";
    if (m.winner) {
      status = "✅ Completed";
      if (m.winner === m.p1) {
        p1 += " ✅";
        if (m.p2) p2 += " ❌";
      } else {
        p2 += " ✅";
        p1 += " ❌";
      }
    }

    desc += `**Match ${i + 1}**\n${p1} vs ${p2 || "BYE"}\n${status}\n\n`;
  });

  embed.setDescription(desc || "No matches.");
  return embed;
}

/* ================= READY ================= */

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  setTimeout(() => msg.delete().catch(() => {}), 500);

  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setTitle("📘 Tournament Commands")
      .setColor("Purple")
      .setDescription(`
;start - Create tournament
;qual @user / BYE1 - Qualify winner
;win @user - Same as qual
;next - Force next round
;code CODE @user - Send match code
;del - Delete tournament
;help - Show help
`);
    return msg.channel.send({ embeds: [embed] });
  }

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    tournament = {
      players: [],
      matches: [],
      round: 1,
      started: false,
      locked: false,
      panelId: null
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`Players: 0`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("start_tournament")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    const panel = await msg.channel.send({
      embeds: [registrationEmbed(msg.guild)],
      components: [row]
    });

    tournament.panelId = panel.id;
  }

  if (!tournament) return;

  if (cmd === "del") {
    if (!isStaff(msg.member)) return;
    tournament = null;
    return msg.channel.send("Tournament deleted.");
  }

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return;
    if (!tournament.started) return;

    const mention = msg.mentions.members.first();
    let target = mention ? mention.id : args[0];

    if (!target) return;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === target || m.p2 === target)
    );

    if (!match) return;

    match.winner = target;

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed(msg.guild)] });
  }

  if (cmd === "next") {
    if (!isStaff(msg.member)) return;

    if (!tournament.matches.every(m => m.winner)) return;

    const winners = tournament.matches.map(m => m.winner);

    if (winners.length === 1) {
      msg.channel.send(`🏆 WINNER: ${username(winners[0], msg.guild)}`);
      tournament = null;
      return;
    }

    tournament.round++;
    tournament.matches = generateMatches(winners);

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed(msg.guild)] });
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;
    const code = args[0];
    const mention = msg.mentions.members.first();
    if (!code || !mention) return;

    mention.send(`🎮 Match Code: ${code}`).catch(() => {});
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.locked)
      return interaction.reply({ content: "Registration closed.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`Players: ${tournament.players.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("start_tournament")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    await panel.edit({
      embeds: [registrationEmbed(interaction.guild)],
      components: [row]
    });

    interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start_tournament") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "No permission.", ephemeral: true });

    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    tournament.started = true;
    tournament.locked = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [bracketEmbed(interaction.guild)],
      components: []
    });

    await interaction.editReply("Tournament Started ✅");
  }
});

client.login(process.env.TOKEN);
