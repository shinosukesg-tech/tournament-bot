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
    panelId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
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

function controlRow() {
  const buttons = [];

  if (tournament.matches.length > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("next_round")
        .setLabel("Next Round")
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId("announce_winner")
      .setLabel("Announce Winner 🏆")
      .setStyle(ButtonStyle.Success)
  );

  return new ActionRowBuilder().addComponents(buttons);
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  msg.delete().catch(() => {});

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

    return msg.channel.send("🤖 All remaining slots filled with BYE players.");
  }

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    return msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    let winnerId;

    if (input.toLowerCase().startsWith("bye")) {
      winnerId = input.toUpperCase();
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;
      winnerId = user.id;
    }

    const match = tournament.matches.find(
      m => m.p1 === winnerId || m.p2 === winnerId
    );

    if (!match) return msg.channel.send("Player not found in this round.");

    match.winner = winnerId;

    return msg.channel.send("✅ Winner updated.");
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const roomCode = args[0];
    const player = msg.mentions.users.first();
    if (!roomCode || !player) return;

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );

    if (!match) return msg.channel.send("Match not found.");

    const opponentId = match.p1 === player.id ? match.p2 : match.p1;

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle("🎮 MATCH ROOM DETAILS")
      .setImage(BANNER)
      .setDescription(`
🏆 **${tournament.name}**
📊 Round: ${tournament.round}

🔐 Room Code: \`${roomCode}\`
🌍 Server: ${tournament.server}
🗺 Map: ${tournament.map}

🔥 Good Luck!
`)
      .setTimestamp();

    await player.send({ embeds: [embed] }).catch(() => {});

    if (!opponentId.startsWith("BYE")) {
      const opponent = await client.users.fetch(opponentId);
      await opponent.send({ embeds: [embed] }).catch(() => {});
    }

    return msg.channel.send("📩 Room code sent to both players.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id)) {
      return interaction.reply({ content: "Already registered.", ephemeral: true });
    }

    if (tournament.players.length >= tournament.maxPlayers) {
      return interaction.reply({ content: "Slots full.", ephemeral: true });
    }

    tournament.players.push(interaction.user.id);
    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "next_round") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "Staff only.", ephemeral: true });
    }

    const winners = tournament.matches.map(m => m.winner).filter(Boolean);

    if (winners.length !== tournament.matches.length) {
      return interaction.reply({ content: "All matches not completed.", ephemeral: true });
    }

    tournament.round++;
    tournament.matches = generateMatches(winners);

    await interaction.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    return interaction.reply({ content: "Next round created.", ephemeral: true });
  }

  if (interaction.customId === "announce_winner") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "Staff only.", ephemeral: true });
    }

    const finalMatch = tournament.matches[0];
    if (!finalMatch.winner) {
      return interaction.reply({ content: "Final not decided.", ephemeral: true });
    }

    const winnerText = finalMatch.winner.startsWith("BYE")
      ? `🤖 ${finalMatch.winner}`
      : `<@${finalMatch.winner}>`;

    await interaction.channel.send(`🏆 TOURNAMENT CHAMPION: ${winnerText}`);

    return interaction.reply({ content: "Winner announced!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
