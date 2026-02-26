require("dotenv").config();

/* ================= UPTIME ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(process.env.PORT || 3000);
/* ========================================== */

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

/* ===== YOUR BANNER ===== */
const BANNER =
  "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

/* ===== TOURNAMENT STATE ===== */
let tournament = null;

/* ================= UTIL ================= */

function shuffle(arr) {
  return arr.sort(() => 0.5 - Math.random());
}

function progressBar(current, total) {
  const size = 14;
  const filled = Math.round((current / total) * size);
  return `\`${"█".repeat(filled)}${"░".repeat(size - filled)}\``;
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
  const matches = [];

  while (shuffled.length > 0) {
    const p1 = shuffled.shift();
    const p2 = shuffled.shift() || "BYE";

    matches.push({
      p1,
      p2,
      winner: null,
    });
  }

  return matches;
}

function buildMainEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours 1v1 Tournament")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Mode: 1v1  
🌍 Server: ${tournament.server}  
🗺 Map: ${tournament.map}  
👥 Players: ${tournament.players.length}/${tournament.maxPlayers}  
📌 Status: ${tournament.started ? "Ongoing" : "Open Registration"}
━━━━━━━━━━━━━━━━━━
`)
    .addFields({
      name: "📊 Registration Progress",
      value: progressBar(tournament.players.length, tournament.maxPlayers),
    })
    .setImage(BANNER)
    .setTimestamp();
}

function buildBracketEmbed() {
  let desc = `🏁 **Round ${tournament.round}**\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `**Match ${i + 1}**\n`;

    desc += `🆚 <@${m.p1}> vs ${
      m.p2 === "BYE" ? "BYE" : `<@${m.p2}>`
    }\n`;

    desc += `🏆 Winner: ${
      m.winner ? `✅ <@${m.winner}>` : "Pending"
    }\n\n`;
  });

  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle("🔥 Live Tournament Bracket")
    .setDescription(desc)
    .setImage(BANNER);
}

async function updateBracket() {
  if (!tournament.bracketMessage) return;

  await tournament.bracketMessage.edit({
    embeds: [buildBracketEmbed()],
  });
}

function autoAdvanceIfBYE() {
  tournament.matches.forEach(m => {
    if (m.p2 === "BYE" && !m.winner) {
      m.winner = m.p1;
    }
  });
}

async function checkRoundCompletion(channel) {
  if (tournament.matches.some(m => !m.winner)) return;

  const winners = tournament.matches.map(m => m.winner);

  if (winners.length === 1) {
    const championId = winners[0];

    const user = await client.users.fetch(championId);

    const championEmbed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏆 TOURNAMENT CHAMPION")
      .setDescription(`👑 Congratulations <@${championId}>`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await channel.send({ embeds: [championEmbed] });

    tournament = null;
    return;
  }

  // Next round
  tournament.round++;
  tournament.matches = generateMatches(winners);
  autoAdvanceIfBYE();

  await updateBracket();
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} Online`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(";")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* CREATE TOURNAMENT */
  if (cmd === "1v1") {
    const server = args[0];
    const map = args[1];

    if (!server || !map)
      return message.reply("Usage: ;1v1 <server> <map>");

    if (tournament)
      return message.reply("Tournament already running.");

    tournament = {
      server,
      map,
      players: [],
      maxPlayers: 8,
      started: false,
      matches: [],
      round: 1,
      mainMessage: null,
      bracketMessage: null,
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("Start")
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({
      embeds: [buildMainEmbed()],
      components: [row],
    });

    tournament.mainMessage = msg;
  }

  /* QUALIFY */
  if (cmd === "qual") {
    if (!tournament) return;

    const user = message.mentions.users.first();
    if (!user) return message.reply("Mention a player.");

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );

    if (!match) return message.reply("Match not found.");

    match.winner = user.id;

    await updateBracket();
    await checkRoundCompletion(message.channel);
  }

  /* MATCH CODE */
  if (cmd === "code") {
    if (!tournament) return;

    const code = args[0];
    const player = message.mentions.users.first();
    if (!code || !player)
      return message.reply("Usage: ;code <code> @player");

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );

    if (!match) return message.reply("Match not found.");

    const team = [match.p1];
    if (match.p2 !== "BYE") team.push(match.p2);

    message.channel.send(
      `🎮 Match Code: **${code}**\n${team.map(id => `<@${id}>`).join(" ")}`
    );

    for (let id of team) {
      const user = await client.users.fetch(id);

      user.send(
`🌍 Server: ${tournament.server}
🗺 Map: ${tournament.map}
🔒 Code:
\`\`\`${code}\`\`\`

You have 2 minutes to join.`
      );
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Registration closed.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    await tournament.mainMessage.edit({
      embeds: [buildMainEmbed()],
    });

    interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);
    autoAdvanceIfBYE();

    tournament.bracketMessage = await interaction.channel.send({
      embeds: [buildBracketEmbed()],
    });

    await tournament.mainMessage.edit({
      embeds: [buildMainEmbed()],
      components: [],
    });

    interaction.reply({ content: "Tournament Started!", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
