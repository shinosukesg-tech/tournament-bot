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

/* ================= BOT READY ================= */

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
    if (!isStaff(message.member)) return message.reply("Staff only command.");

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
        .setDisabled(false)
    );

    await message.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  /* ============ CODE (DM EMBED) ============ */

  if (command === "code") {
    if (!isStaff(message.member)) return;

    const roomCode = args[0];
    const player = message.mentions.users.first();
    if (!roomCode || !player) return;

    if (!tournament) return;

    let opponent = null;

    for (const match of tournament.matches) {
      if (match.p1 === player.id) opponent = match.p2;
      if (match.p2 === player.id) opponent = match.p1;
    }

    if (!opponent || opponent.startsWith("BYE"))
      return message.reply("Opponent not found.");

    const opponentUser = await client.users.fetch(opponent);

    const codeEmbed = new EmbedBuilder()
      .setColor("#ff9900")
      .setTitle("🎮 Match Room Code")
      .setImage(BANNER)
      .setDescription(`
🏆 Tournament: ${tournament.name}

👥 Match:
${player} vs ${opponentUser}

🔑 Room Code:
\`${roomCode}\`

⚠️ Join quickly. Good luck!
`)
      .setTimestamp();

    await player.send({ embeds: [codeEmbed] });
    await opponentUser.send({ embeds: [codeEmbed] });

    message.reply("Room code sent in DM (Embed).");
  }

  /* ============ HELP ============ */

  if (command === "help") {
    message.reply(`
🏆 Tournament Commands

;start 8 EU Erangel Name
;qual @player
;code ROOMCODE @player
;BYE
;help
`);
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Registered: ${tournament.players.length}/${tournament.maxPlayers}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false)
    );

    await interaction.update({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }
});

client.login(process.env.TOKEN);
