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
const VS = "<:VS:1477014161484677150>";

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

function autoDelete(message) {
  setTimeout(() => {
    message.delete().catch(() => {});
  }, 1500);
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function generateMatches(players) {
  const shuffled = shuffle(players);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({ p1: shuffled[i], p2: shuffled[i + 1], winner: null });
  }
  return matches;
}

function allFinished() {
  return tournament.matches.every(m => m.winner);
}

/* ================= EMBEDS ================= */

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1.startsWith("BYE") ? `🤖 ${m.p1}` : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? `🤖 ${m.p2}` : `<@${m.p2}>`;

    const matchTitle = m.winner
      ? `Match ${i + 1} ${TICK}`
      : `Match ${i + 1}`;

    desc += `${matchTitle}
${p1} ${VS} ${p2}
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

function controlRow() {
  const isFinal = tournament.matches.length === 1;

  if (isFinal) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("announce")
        .setLabel("Announce Winner 🏆")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!allFinished())
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next Round")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!allFinished())
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  if (cmd === "help") {
    const m = await msg.channel.send(`
**Tournament Commands**
;1v1 size server map name
;bye
;start
;qual @player
;code CODE @player
;del
`);
    autoDelete(m);
  }

  if (cmd === "del") {
    if (!tournament) return;
    tournament = null;
    const m = await msg.channel.send("Tournament deleted.");
    autoDelete(m);
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    tournament = {
      name,
      maxPlayers: size,
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      bracketId: null
    };

    const m = await msg.channel.send("Tournament created.");
    autoDelete(m);
  }

  if (!tournament) return;

  if (cmd === "start") {
    tournament.matches = generateMatches(tournament.players);

    const bracketMsg = await msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    tournament.bracketId = bracketMsg.id;
  }

  if (cmd === "qual") {
    const user = msg.mentions.users.first();
    if (!user) return;

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );
    if (!match) return;

    match.winner = user.id;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const roomCode = args[0];
    const player = msg.mentions.users.first();
    if (!roomCode || !player) return;

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );
    if (!match) return;

    const opponentId = match.p1 === player.id ? match.p2 : match.p1;

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle("🎮 MATCH ROOM DETAILS")
      .setImage(BANNER)
      .setDescription(`
🏆 **${tournament.name}**
📊 Round **${tournament.round}**

🔐 Room Code:
\`\`\`${roomCode}\`\`\`

🌍 ${tournament.server}
🗺 ${tournament.map}
`)
      .setTimestamp();

    await player.send({ embeds: [embed] }).catch(()=>{});
    if (!opponentId.startsWith("BYE")) {
      const opponent = await client.users.fetch(opponentId);
      await opponent.send({ embeds: [embed] }).catch(()=>{});
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "next") {
    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = generateMatches(winners);

    const bracketMsg = await interaction.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    await interaction.deferUpdate();
  }

  if (interaction.customId === "announce") {
    const winnerId = tournament.matches[0].winner;
    if (!winnerId) return;

    const user = await client.users.fetch(winnerId);

    const embed = new EmbedBuilder()
      .setColor("#ffd700")
      .setTitle("🏆 TOURNAMENT WINNER 🏆")
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(`Congratulations <@${winnerId}>!`)
      .setImage(BANNER)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    tournament = null;
  }
});

client.login(process.env.TOKEN);
