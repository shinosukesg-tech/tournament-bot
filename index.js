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
    let p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    let p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    if (m.winner) {
      if (m.winner === m.p1) {
        p1 += " ✅";
        p2 += " ❌";
      } else {
        p2 += " ✅";
        p1 += " ❌";
      }
    }

    desc += `**Match ${i + 1}**\n${p1}\nvs\n${p2}\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#00ff99")
    .setTitle("📋 Tournament Bracket")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

function controlButtons() {
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

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  /* ============ START ============ */

  if (command === "start") {
    if (!isStaff(message.member))
      return message.reply("Staff only command.");

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    if (!size || !server || !map || !name)
      return message.reply("Usage: ;start 8 EU Erangel TournamentName");

    tournament = {
      name,
      maxPlayers: size,
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      started: false
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Registered: 0/${size}`)
        .setStyle(ButtonStyle.Secondary)
    );

    return message.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  /* ============ QUALIFY ============ */

  if (command === "qual") {
    if (!isStaff(message.member)) return;
    if (!tournament) return;

    if (args[0] && args[0].toUpperCase().startsWith("BYE")) {
      const bye = args[0].toUpperCase();
      const match = tournament.matches.find(
        m => m.p1 === bye || m.p2 === bye
      );
      if (!match) return message.reply("BYE not found.");
      match.winner = bye;
      return message.reply("BYE Qualified ✅");
    }

    const player = message.mentions.users.first();
    if (!player) return message.reply("Mention player.");

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );

    if (!match) return message.reply("Player not found.");

    match.winner = player.id;

    return message.channel.send({
      content: `✅ ${player} qualified!`,
      embeds: [bracketEmbed()],
      components: [controlButtons()]
    });
  }

  /* ============ CODE ============ */

  if (command === "code") {
    if (!isStaff(message.member)) return;

    const roomCode = args[0];
    const player = message.mentions.users.first();
    if (!roomCode || !player) return;

    let opponent = null;

    for (const match of tournament.matches) {
      if (match.p1 === player.id) opponent = match.p2;
      if (match.p2 === player.id) opponent = match.p1;
    }

    if (!opponent || opponent.startsWith("BYE"))
      return message.reply("Opponent not found.");

    const opponentUser = await client.users.fetch(opponent);

    const embed = new EmbedBuilder()
      .setColor("#ff9900")
      .setTitle("🎮 Match Room Code")
      .setImage(BANNER)
      .setDescription(`
🏆 ${tournament.name}

👥 ${player} vs ${opponentUser}

🔑 Code: \`${roomCode}\`
`)
      .setTimestamp();

    await player.send({ embeds: [embed] });
    await opponentUser.send({ embeds: [embed] });

    return message.reply("Room code sent in DM (Embed).");
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
      return interaction.reply({ content: "Slots full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    return interaction.update({
      embeds: [registrationEmbed()],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("register")
            .setLabel(`Registered: ${tournament.players.length}/${tournament.maxPlayers}`)
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  if (interaction.customId === "next_round") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const winners = tournament.matches
      .filter(m => m.winner)
      .map(m => m.winner);

    if (winners.length < 2)
      return interaction.reply({ content: "Not enough winners.", ephemeral: true });

    tournament.round++;
    tournament.matches = generateMatches(winners);

    return interaction.channel.send({
      embeds: [bracketEmbed()],
      components: [controlButtons()]
    });
  }

  if (interaction.customId === "announce_winner") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const finalWinner = tournament.matches.find(m => m.winner)?.winner;
    if (!finalWinner) return;

    return interaction.channel.send(`🏆 TOURNAMENT CHAMPION: <@${finalWinner}>`);
  }
});

client.login(process.env.TOKEN);
