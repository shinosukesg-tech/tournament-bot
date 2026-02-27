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

const TICK = "<:TICK:1467892699578236998>";
const CROSS = "<:CROSS:1467892662337278062>";

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

/* ================= READY ================= */
client.once("clientReady", () => {
  console.log(`${client.user.tag} is online`);
});

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
    panelId: null,
    bracketMessageId: null,
    eliminated: []
  };
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
  const matches = [];

  if (shuffled.length % 2 !== 0) {
    shuffled.push(`BYE${Date.now()}`);
  }

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

    let title = `Match ${i + 1}`;

    if (m.winner) {
      title += ` ${TICK}`;

      if (m.winner === m.p1) {
        p1 += ` ${TICK}`;
        if (!m.p2.startsWith("BYE")) p2 += ` ${CROSS}`;
      } else {
        p2 += ` ${TICK}`;
        if (!m.p1.startsWith("BYE")) p1 += ` ${CROSS}`;
      }
    }

    desc += `${title}
${p1} ⚔ ${p2}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

function controlRow() {
  const isFinal = tournament.matches.length === 1;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(isFinal ? "announce_winner" : "next_round")
      .setLabel(isFinal ? "Announce Winner 🏆" : "Next Round")
      .setStyle(isFinal ? ButtonStyle.Success : ButtonStyle.Primary)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  if (!msg.content.startsWith(PREFIX)) {
    if (!msg.embeds.length) {
      setTimeout(() => msg.delete().catch(()=>{}), 1500);
    }
    return;
  }

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  if (!tournament) return;

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    const bracket = await msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    tournament.bracketMessageId = bracket.id;
    return;
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  // REGISTER = PUBLIC
  if (interaction.customId === "register") {

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered", ephemeral: true });

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "Tournament full", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("register")
            .setLabel("Register")
            .setStyle(ButtonStyle.Success)
            .setDisabled(tournament.players.length >= tournament.maxPlayers),
          new ButtonBuilder()
            .setCustomId("count")
            .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      ]
    });

    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  // STAFF ONLY BUTTONS
  if (!isStaff(interaction.member)) {
    return interaction.reply({
      content: "Only Tournament Hoster can use this button.",
      ephemeral: true
    });
  }

  if (interaction.customId === "next_round") {
    const winners = tournament.matches.filter(m => m.winner).map(m => m.winner);
    tournament.round++;
    tournament.matches = generateMatches(winners);

    return interaction.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (interaction.customId === "announce_winner") {

    const finalMatch = tournament.matches[0];
    if (!finalMatch.winner)
      return interaction.reply({ content: "Final not completed", ephemeral: true });

    const winner = await client.users.fetch(finalMatch.winner);

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#ffd700")
          .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
          .setThumbnail(winner.displayAvatarURL({ dynamic: true }))
          .setDescription(`🥇 <@${winner.id}>`)
          .setImage(BANNER)
      ]
    });

    tournament = null;
    return interaction.reply({ content: "Winner announced", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
