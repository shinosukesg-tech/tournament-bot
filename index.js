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

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
  const size = nextPowerOfTwo(shuffled.length);

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
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: 1v1
🌍 Server: ${tournament.server}
🗺 Map: ${tournament.map}
👥 Players: ${tournament.players.length}/${tournament.maxPlayers}
🔓 Status: OPEN
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

function nextRoundRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("next_round")
      .setLabel("Next Round")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("announce_winner")
      .setLabel("Announce Winner 🏆")
      .setStyle(ButtonStyle.Success)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  msg.delete().catch(() => {});

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const slots = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    tournament = {
      name,
      maxPlayers: slots,
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      started: false,
      channelId: msg.channel.id
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (0/${slots})`)
        .setStyle(ButtonStyle.Secondary)
    );

    return msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    return msg.channel.send({
      embeds: [bracketEmbed()],
      components: [nextRoundRow()]
    });
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return;

    if (args[0] && args[0].toUpperCase().startsWith("BYE")) {
      const bye = args[0].toUpperCase();
      const match = tournament.matches.find(
        m => m.p1 === bye || m.p2 === bye
      );
      if (!match) return;
      match.winner = bye;
      return msg.channel.send(`✅ ${bye} qualified.`);
    }

    const player = msg.mentions.users.first();
    if (!player) return;

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );
    if (!match) return;

    match.winner = player.id;

    return msg.channel.send(`✅ ${player} qualified.`);
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
    const opponent =
      opponentId.startsWith("BYE") ? null : await client.users.fetch(opponentId);

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle("🎮 MATCH ROOM DETAILS")
      .setImage(BANNER)
      .setDescription(`
🏆 ${tournament.name}
📊 Round ${tournament.round}

🔐 Room Code: \`${roomCode}\`
🌍 Server: ${tournament.server}
🗺 Map: ${tournament.map}

⚔ Opponent:
${opponent ? opponent.username : "🤖 BYE"}

🔥 Good Luck!
`)
      .setTimestamp();

    await player.send({ embeds: [embed] }).catch(() => {});
    if (opponent) await opponent.send({ embeds: [embed] }).catch(() => {});

    msg.channel.send("📩 Room code sent in DM.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Tournament started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (${tournament.players.length}/${tournament.maxPlayers})`)
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  if (interaction.customId === "next_round") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const winners = tournament.matches.filter(m => m.winner).map(m => m.winner);
    if (winners.length < tournament.matches.length)
      return interaction.reply({ content: "Matches pending.", ephemeral: true });

    if (winners.length === 1)
      return interaction.reply({ content: "Final reached. Use Announce Winner.", ephemeral: true });

    tournament.round++;
    tournament.matches = generateMatches(winners);

    await interaction.channel.send({
      embeds: [bracketEmbed()],
      components: [nextRoundRow()]
    });

    return interaction.reply({ content: "✅ Next round created.", ephemeral: true });
  }

  if (interaction.customId === "announce_winner") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const final = tournament.matches[0];
    if (!final.winner)
      return interaction.reply({ content: "Final not completed.", ephemeral: true });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ffd700")
          .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
          .setImage(BANNER)
          .setDescription(`<@${final.winner}> is the Champion!`)
      ]
    });
  }
});

client.login(process.env.TOKEN);
