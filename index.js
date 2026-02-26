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

/* ================= CONFIG ================= */

const BANNER =
  "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

/* ================= STATE ================= */

let tournament = null;

/* ================= UTIL ================= */

function shuffle(arr) {
  return arr.sort(() => 0.5 - Math.random());
}

function registrationBar(current, total) {
  const size = 18;
  const filled = total === 0 ? 0 : Math.round((current / total) * size);
  return `\`\`\`
${"🟩".repeat(filled)}${"⬛".repeat(size - filled)}
\`\`\``;
}

function matchProgressBar(done, total) {
  const size = 12;
  const filled = total === 0 ? 0 : Math.round((done / total) * size);
  return `\`${"█".repeat(filled)}${"░".repeat(size - filled)}\``;
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
  const matches = [];

  while (shuffled.length > 0) {
    const p1 = shuffled.shift();
    const p2 = shuffled.shift() || "BYE";

    matches.push({ p1, p2, winner: null });
  }

  return matches;
}

/* ================= EMBEDS ================= */

function mainEmbed() {
  return new EmbedBuilder()
    .setColor("#2B2D31")
    .setTitle("🏆 ShinTours Professional 1v1 Tournament")
    .setImage(BANNER)
    .setDescription(`
**Server:** ${tournament.server}
**Map:** ${tournament.map}

**Registered Players:** ${tournament.players.length}
`)
    .addFields({
      name: "📊 Registration Progress",
      value: registrationBar(
        tournament.players.length,
        tournament.players.length === 0
          ? 1
          : tournament.players.length
      ),
    })
    .setFooter({ text: "Professional Tournament System" })
    .setTimestamp();
}

function bracketEmbed() {
  let completed = tournament.matches.filter(m => m.winner).length;
  let total = tournament.matches.length;

  let desc = `### 🏁 ROUND ${tournament.round}\n`;
  desc += `Progress: ${matchProgressBar(completed, total)} (${completed}/${total})\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `**Match ${i + 1}**\n`;
    desc += `• <@${m.p1}> vs ${
      m.p2 === "BYE" ? "BYE" : `<@${m.p2}>`
    }\n`;
    desc += `• Winner: ${
      m.winner ? `✅ <@${m.winner}>` : "⏳ Pending"
    }\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("📊 Live Tournament Bracket")
    .setImage(BANNER)
    .setDescription(desc)
    .setFooter({ text: "Auto Updating Bracket System" })
    .setTimestamp();
}

/* ================= LOGIC ================= */

async function autoBYE(channel) {
  for (const match of tournament.matches) {
    if (match.p2 === "BYE" && !match.winner) {
      match.winner = match.p1;

      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("🎉 BYE Advancement")
        .setDescription(`<@${match.p1}> advances automatically.`)
        .setTimestamp();

      channel.send({ embeds: [embed] });
    }
  }
}

async function updateBracket() {
  if (!tournament.bracketMessage) return;

  await tournament.bracketMessage.edit({
    embeds: [bracketEmbed()],
  });
}

async function checkRound(channel) {
  if (tournament.matches.some(m => !m.winner)) return;

  const winners = tournament.matches.map(m => m.winner);

  if (winners.length === 1) {
    const championId = winners[0];
    const user = await client.users.fetch(championId);

    const championEmbed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏆 TOURNAMENT CHAMPION")
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setImage(BANNER)
      .setDescription(`👑 Congratulations <@${championId}>`)
      .setTimestamp();

    await channel.send({ embeds: [championEmbed] });

    tournament = null;
    return;
  }

  tournament.round++;
  tournament.matches = generateMatches(winners);

  await autoBYE(channel);
  await updateBracket();
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} Online`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(";")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

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
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await message.channel.send({
      embeds: [mainEmbed()],
      components: [row],
    });

    tournament.mainMessage = msg;
  }

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
    await checkRound(message.channel);
  }

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

    for (let id of team) {
      const user = await client.users.fetch(id);

      const embed = new EmbedBuilder()
        .setColor("#2B2D31")
        .setTitle("🎮 Match Lobby Details")
        .setImage(BANNER)
        .setDescription(`
**Server:** ${tournament.server}
**Map:** ${tournament.map}

🔒 Code:
\`\`\`${code}\`\`\`

⏳ You have 2 minutes to join.
`)
        .setTimestamp();

      user.send({ embeds: [embed] });
    }

    message.channel.send(
      `🎮 Code Sent To: ${team.map(id => `<@${id}>`).join(" ")}`
    );
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Registration closed.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    await tournament.mainMessage.edit({
      embeds: [mainEmbed()],
    });

    interaction.reply({ content: "Registered successfully.", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    await autoBYE(interaction.channel);

    tournament.bracketMessage = await interaction.channel.send({
      embeds: [bracketEmbed()],
    });

    await tournament.mainMessage.edit({
      embeds: [mainEmbed()],
      components: [],
    });

    interaction.reply({ content: "Tournament started.", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
