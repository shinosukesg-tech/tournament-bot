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
;code ROOM @user
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

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    if (tournament.players.length < 2) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    return msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "bye") {
    if (!isStaff(msg.member)) return;
    tournament.players.push(`BYE${tournament.players.length + 1}`);
    return msg.channel.send("🤖 BYE added.");
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;

    const player = msg.mentions.users.first();
    const byeArg = args[0]?.toUpperCase();

    if (player) {
      const match = tournament.matches.find(
        m => m.p1 === player.id || m.p2 === player.id
      );
      if (!match) return;
      match.winner = player.id;
      return msg.channel.send(`✅ ${player} qualified.`);
    }

    if (byeArg && byeArg.startsWith("BYE")) {
      const match = tournament.matches.find(
        m => m.p1 === byeArg || m.p2 === byeArg
      );
      if (!match) return;
      match.winner = byeArg;
      return msg.channel.send(`🤖 ${byeArg} qualified.`);
    }
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
🏆 **${tournament.name}**
📊 Round: ${tournament.round}

🔐 Room Code: \`${roomCode}\`
🌍 Server: ${tournament.server}
🗺 Map: ${tournament.map}

⚔ Opponent:
${opponent ? opponent.username : "🤖 BYE"}

🔥 Good Luck & Play Fair!
`)
      .setTimestamp();

    await player.send({ embeds: [embed] }).catch(() => {});
    if (opponent) await opponent.send({ embeds: [embed] }).catch(() => {});

    return msg.channel.send("📩 Code sent in DM.");
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

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "Slots full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

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

    return interaction.update({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  if (interaction.customId === "next_round") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const winners = tournament.matches
      .filter(m => m.winner)
      .map(m => m.winner);

    if (winners.length < tournament.matches.length)
      return interaction.reply({ content: "Complete all matches.", ephemeral: true });

    if (winners.length === 1)
      return interaction.reply({ content: "Final reached.", ephemeral: true });

    tournament.round++;
    tournament.matches = generateMatches(winners);

    await interaction.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    return interaction.reply({ content: "Next round created.", ephemeral: true });
  }

  if (interaction.customId === "announce_winner") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const final = tournament.matches[0];
    if (!final?.winner)
      return interaction.reply({ content: "Final not decided.", ephemeral: true });

    const winner = final.winner.startsWith("BYE")
      ? final.winner
      : `<@${final.winner}>`;

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ffd700")
          .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
          .setImage(BANNER)
          .setDescription(`🎉 Winner:\n${winner}`)
          .setTimestamp()
      ]
    });
  }
});

client.login(process.env.TOKEN);
