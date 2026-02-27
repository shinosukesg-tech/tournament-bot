require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

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
const STAFF_ROLE = "Tournament Hoster";

let tournament = null;

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

/* ================= READY ================= */

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== HELP EMBED ===== */
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📘 Tournament Bot Help")
      .setDescription(`
\`;1v1 <playercount> <server> <map>\`
Create tournament panel

\`;start\`
Start tournament bracket

\`;bye\`
Fill empty slots with BYE1, BYE2...

\`;qual <player/bye>\`
Qualify winner manually

\`;code <roomcode> @player\`
Send room code to both opponents

\`;del\`
Delete running tournament
`);

    return message.channel.send({ embeds: [embed] });
  }

  /* ===== CREATE ===== */
  if (cmd === "1v1") {
    if (!isStaff(message.member)) return;

    const maxPlayers = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    tournament = {
      maxPlayers,
      server,
      map,
      players: [],
      matches: [],
      currentRound: 1,
      bracketMessage: null
    };

    return message.channel.send("Tournament created.");
  }

  /* ===== START ===== */
  if (cmd === "start") {
    if (!isStaff(message.member)) return;
    if (!tournament) return;

    createBracket(message.channel);
  }

  /* ===== BYE ===== */
  if (cmd === "bye") {
    if (!isStaff(message.member)) return;
    if (!tournament) return;

    let count = 1;
    while (tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(`BYE${count}`);
      count++;
    }

    message.channel.send("BYE slots filled");
  }

  /* ===== QUAL ===== */
  if (cmd === "qual") {
    if (!isStaff(message.member)) return;
    if (!tournament) return;

    const name = args[0];
    if (!name) return;

    const match = tournament.matches.find(
      m =>
        m.p1 === name ||
        m.p2 === name ||
        (m.p1.startsWith("BYE") && m.p1.toLowerCase() === name.toLowerCase()) ||
        (m.p2.startsWith("BYE") && m.p2.toLowerCase() === name.toLowerCase())
    );

    if (!match) return;

    match.winner = name;

    updateBracket(message.channel);
  }

  /* ===== DELETE ===== */
  if (cmd === "del") {
    tournament = null;
    message.channel.send("Tournament deleted");
  }
});

/* ================= FUNCTIONS ================= */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createBracket(channel) {
  tournament.matches = [];

  const shuffled = shuffle([...tournament.players]);

  for (let i = 0; i < shuffled.length; i += 2) {
    tournament.matches.push({
      p1: shuffled[i],
      p2: shuffled[i + 1],
      winner: null
    });
  }

  sendBracket(channel);
}

function allFinished() {
  return tournament.matches.every(m => m.winner);
}

async function sendBracket(channel) {
  let desc = "";

  tournament.matches.forEach((m, i) => {
    desc += `**Match ${i + 1}**\n${m.p1} vs ${m.p2}\n\n`;
  });

  const embed = new EmbedBuilder()
    .setColor("Orange")
    .setTitle(`Round ${tournament.currentRound}`)
    .setDescription(desc);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next Round")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true)
  );

  const msg = await channel.send({
    embeds: [embed],
    components: [row]
  });

  tournament.bracketMessage = msg;
}

async function updateBracket(channel) {
  let desc = "";

  tournament.matches.forEach((m, i) => {
    const status = m.winner ? "✅ Finished" : "⏳ Pending";
    desc += `**Match ${i + 1}**\n${m.p1} vs ${m.p2}\n${status}\n\n`;
  });

  const embed = new EmbedBuilder()
    .setColor("Orange")
    .setTitle(`Round ${tournament.currentRound}`)
    .setDescription(desc);

  const isFinal = tournament.matches.length === 1;
  const finished = allFinished();

  const button = new ButtonBuilder()
    .setCustomId(isFinal ? "announce" : "next")
    .setLabel(isFinal ? "Announce Winner 🏆" : "Next Round")
    .setStyle(ButtonStyle.Success)
    .setDisabled(!finished);

  const row = new ActionRowBuilder().addComponents(button);

  await tournament.bracketMessage.edit({
    embeds: [embed],
    components: [row]
  });
}

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "next") {
    const winners = tournament.matches.map(m => m.winner);
    tournament.currentRound++;

    tournament.matches = [];
    for (let i = 0; i < winners.length; i += 2) {
      tournament.matches.push({
        p1: winners[i],
        p2: winners[i + 1],
        winner: null
      });
    }

    updateBracket(interaction.channel);
    interaction.deferUpdate();
  }

  if (interaction.customId === "announce") {
    const winner = tournament.matches[0].winner;
    const user = await client.users.fetch(winner);

    const embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏆 TOURNAMENT WINNER 🏆")
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(`Congratulations ${winner}!`)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    tournament = null;
  }
});

client.login(process.env.TOKEN);
