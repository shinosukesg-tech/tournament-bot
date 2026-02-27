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
    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    let result = "";
    if (m.winner) {
      result = `\nWinner: ${m.winner.startsWith("BYE") ? m.winner : `<@${m.winner}>`} ✅`;
    }

    desc += `Match ${i + 1}\n${p1} 🆚 ${p2}${result}\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("📋 Tournament Bracket")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

function codeDMEmbed(code, opponentTag) {
  return new EmbedBuilder()
    .setColor("#ff9900")
    .setTitle("🎮 Match Room Code")
    .setImage(BANNER)
    .setDescription(`
🏷 Opponent: ${opponentTag}
🔑 Room Code: **${code}**

⚠ Join quickly & play fair.
`)
    .setTimestamp();
}

/* ================= EVENTS ================= */

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== START ===== */
  if (cmd === "start") {
    if (!isStaff(message.member)) return;

    tournament = {
      name: "Custom Tournament",
      server: "India",
      map: "Random",
      maxPlayers: 16,
      players: [],
      matches: [],
      round: 1
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  /* ===== QUALIFY ===== */
  if (cmd === "qual") {
    if (!isStaff(message.member)) return;
    if (!tournament) return;

    if (args[0] && args[0].toUpperCase().startsWith("BYE")) {
      const bye = args[0].toUpperCase();
      const match = tournament.matches.find(m => m.p1 === bye || m.p2 === bye);
      if (!match) return message.reply("BYE not found.");
      match.winner = bye;
      return message.reply("✅ BYE qualified.");
    }

    const user = message.mentions.users.first();
    if (!user) return message.reply("Mention a player.");

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );

    if (!match) return message.reply("Player not found in bracket.");

    match.winner = user.id;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("announce")
        .setLabel("🏆 Announce Winner")
        .setStyle(ButtonStyle.Success)
    );

    await message.reply({
      content: "Winner set. Click announce button.",
      components: [row]
    });
  }

  /* ===== CODE (DM EMBED) ===== */
  if (cmd === "code") {
    if (!isStaff(message.member)) return;
    if (!tournament) return;

    const code = args[0];
    const user = message.mentions.users.first();
    if (!code || !user) return message.reply("Usage: ;code ROOMCODE @player");

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );
    if (!match) return message.reply("Match not found.");

    const opponentId = match.p1 === user.id ? match.p2 : match.p1;
    if (opponentId.startsWith("BYE")) return message.reply("Opponent is BYE.");

    const opponent = await client.users.fetch(opponentId);

    await user.send({ embeds: [codeDMEmbed(code, opponent.tag)] });
    await opponent.send({ embeds: [codeDMEmbed(code, user.tag)] });

    message.reply("📩 Room code sent via DM embed.");
  }
});

/* ===== BUTTONS ===== */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "register") {
    if (!tournament) return interaction.reply({ content: "No tournament.", ephemeral: true });
    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);
    interaction.update({ embeds: [registrationEmbed()] });

    if (tournament.players.length === tournament.maxPlayers) {
      tournament.matches = generateMatches(tournament.players);
      await interaction.followUp({ embeds: [bracketEmbed()] });
    }
  }

  if (interaction.customId === "announce") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const finalWinner = tournament.matches.find(m => m.winner);
    if (!finalWinner)
      return interaction.reply({ content: "No winner set.", ephemeral: true });

    const winnerId = finalWinner.winner;

    const embed = new EmbedBuilder()
      .setColor("#ffd700")
      .setTitle("🏆 TOURNAMENT CHAMPION")
      .setImage(BANNER)
      .setDescription(`Congratulations <@${winnerId}> 🎉`)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: "Champion announced.", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
