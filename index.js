require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = ";";

let tournament = null;

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= CREATE TOUR ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "createtour") {
    if (tournament) return msg.reply("Tournament already exists.");

    const name = args.join(" ") || "Tournament";

    tournament = {
      name,
      players: [],
      started: false,
      round: 1,
      matches: [],
      channelId: msg.channel.id
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("unregister")
        .setLabel("Unregister")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    return msg.channel.send({
      embeds: [buildLobby()],
      components: [row]
    });
  }

  /* ================= QUALIFY ================= */

  if (cmd === "qualify") {
    if (!tournament || !tournament.started)
      return msg.reply("No active tournament.");

    const player = msg.mentions.users.first();
    if (!player) return msg.reply("Mention player.");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === player.id || m.p2 === player.id)
    );

    if (!match) return msg.reply("Match not found.");

    match.winner = player.id;

    return checkNextRound(msg.channel);
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  const userId = interaction.user.id;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (!tournament.players.includes(userId))
      tournament.players.push(userId);

    return interaction.update({
      embeds: [buildLobby()]
    });
  }

  if (interaction.customId === "unregister") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    tournament.players = tournament.players.filter(p => p !== userId);

    return interaction.update({
      embeds: [buildLobby()]
    });
  }

  if (interaction.customId === "start") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (tournament.players.length < 2)
      return interaction.reply({ content: "Need at least 2 players.", ephemeral: true });

    tournament.started = true;
    createMatches(tournament.players);

    return interaction.update({
      embeds: [buildBracket()],
      components: []
    });
  }
});

/* ================= MATCH SYSTEM ================= */

function createMatches(players) {
  tournament.matches = [];

  for (let i = 0; i < players.length; i += 2) {
    tournament.matches.push({
      p1: players[i],
      p2: players[i + 1] || null,
      winner: players[i + 1] ? null : players[i]
    });
  }
}

async function checkNextRound(channel) {
  const unfinished = tournament.matches.filter(m => !m.winner);

  if (unfinished.length > 0)
    return channel.send({ embeds: [buildBracket()] });

  const winners = tournament.matches.map(m => m.winner);

  if (winners.length === 1)
    return sendFinalWinner(channel, winners[0]);

  tournament.round++;
  createMatches(winners);

  return channel.send({ embeds: [buildBracket()] });
}

/* ================= LOBBY EMBED ================= */

function buildLobby() {
  return new EmbedBuilder()
    .setColor("Blue")
    .setTitle(`🏆 ${tournament.name}`)
    .setDescription(
      `Players Registered: **${tournament.players.length}**\n\n` +
      (tournament.players.length
        ? tournament.players.map(p => `<@${p}>`).join("\n")
        : "No players yet.")
    );
}

/* ================= BRACKET ================= */

function buildBracket() {
  const total = tournament.matches.length;
  const finished = tournament.matches.filter(m => m.winner).length;

  const progress =
    "🟩".repeat(finished) + "⬜".repeat(total - finished);

  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle(`🏆 ${tournament.name}`)
    .setDescription(
      `Round ${tournament.round}\n\n` +
      `Progress: ${progress} (${finished}/${total})\n\n` +
      tournament.matches
        .map((m, i) => {
          const status = m.winner ? "✅" : "⚔️";
          return (
            `Match ${i + 1} ${status}\n` +
            `<@${m.p1}> vs ${m.p2 ? `<@${m.p2}>` : "BYE"}`
          );
        })
        .join("\n\n")
    );
}

/* ================= FINAL WINNER (LIKE YOUR IMAGE) ================= */

async function sendFinalWinner(channel, championId) {
  const embed = new EmbedBuilder()
    .setColor("Gold")
    .setTitle("🏆 Tournament Winners! 🏆")
    .setDescription(
      `Congratulations to <@${championId}> for winning the tournament! 🎉\n\n` +
      `🏆 Final Rankings 🏆\n` +
      `🥇 <@${championId}>\n` +
      `🥈 Runner-up\n` +
      `🥉 Semi Finalist\n` +
      `🎖️ Participants\n\n` +
      `👑 Prizes 👑\n` +
      `🥇 1st: 100\n` +
      `🥈 2nd: 50\n` +
      `🥉 3rd: 0\n` +
      `🎖️ 4th: 0`
    );

  tournament = null;

  return channel.send({ embeds: [embed] });
}

client.login(process.env.TOKEN);
