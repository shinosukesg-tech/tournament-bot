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

function createTournament(size, server, map, name, channelId) {
  return {
    name,
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    channelId,
    panelId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle(players);
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
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **OPEN**
`)
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {

    let p1 = m.p1.startsWith("BYE") ? `🤖 ${m.p1}` : `<@${m.p1}>`;
    let p2 = m.p2.startsWith("BYE") ? `🤖 ${m.p2}` : `<@${m.p2}>`;

    if (m.winner) {
      if (m.winner === m.p1) {
        p1 += " ✅";
        p2 += " ❌";
      } else {
        p2 += " ✅";
        p1 += " ❌";
      }
    }

    desc += `Match ${i + 1}
${p1} ⚔ ${p2}
${m.winner ? "✔ COMPLETE" : "⏳ Pending"}

`;
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

  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("🏆 TOURNAMENT COMMANDS")
          .setImage(BANNER)
          .setDescription(`
\`\`\`
;1v1 slots server map name
;start
;bye
;qual @user
;qual bye1
;del
\`\`\`
`)
      ]
    });
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return;
    tournament = null;
    return msg.channel.send("🗑 Tournament deleted.");
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    if (!size || !server || !map || !name) return;

    tournament = createTournament(size, server, map, name, msg.channel.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`👤 0/${size}`)
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

  if (cmd === "bye") {
    if (!isStaff(msg.member)) return;

    let count = 1;
    while (tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(`BYE${count++}`);
    }

    const panel = await msg.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });

    return;
  }

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    if (tournament.started) return;

    if (tournament.players.length < 2)
      return msg.channel.send("Need at least 2 players.");

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    return;
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;
    if (!tournament.started) return;

    let winnerId = null;

    const mentioned = msg.mentions.users.first();
    if (mentioned) winnerId = mentioned.id;
    else if (args[0]?.toLowerCase().startsWith("bye"))
      winnerId = args[0].toUpperCase();

    if (!winnerId) return;

    const match = tournament.matches.find(
      m => m.p1 === winnerId || m.p2 === winnerId
    );

    if (!match) return;

    match.winner = winnerId;

    const panel = await msg.channel.messages.fetch(tournament.panelId);

    if (tournament.matches.every(m => m.winner)) {

      if (tournament.matches.length === 1) {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("announce")
            .setLabel("🏆 ANNOUNCE WINNER")
            .setStyle(ButtonStyle.Success)
        );

        await panel.edit({ embeds: [bracketEmbed()], components: [row] });

      } else {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("NEXT ROUND")
            .setStyle(ButtonStyle.Primary)
        );

        await panel.edit({ embeds: [bracketEmbed()], components: [row] });
      }

    } else {
      await panel.edit({ embeds: [bracketEmbed()] });
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "Tournament full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });

    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "next") {

    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = generateMatches(winners);

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }

  if (interaction.customId === "announce") {

    const champion = tournament.matches[0].winner;

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle("🏆 TOURNAMENT CHAMPION")
          .setImage(BANNER)
          .setDescription(
            champion.startsWith("BYE")
              ? `🤖 ${champion}`
              : `<@${champion}>`
          )
      ],
      components: []
    });

    tournament = null;
  }
});

client.login(process.env.TOKEN);
