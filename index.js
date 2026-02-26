require("dotenv").config();

/* ================= EXPRESS ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);
/* =========================================== */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Staff";
const BANNER =
  "https://media.discordapp.net/attachments/1343286197346111558/1350446868064374845/Event_Background_BlockDash.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function generateProgressBar(done, total) {
  const percent = Math.floor((done / total) * 10);
  return "🟩".repeat(percent) + "⬜".repeat(10 - percent);
}

function createMatches(players) {
  const matches = [];
  for (let i = 0; i < players.length; i += 2) {
    matches.push({
      p1: players[i],
      p2: players[i + 1] || null,
      winner: null
    });
  }
  return matches;
}

/* ================= EMBEDS ================= */

function helpEmbed() {
  return new EmbedBuilder()
    .setColor("#3498db")
    .setTitle("📖 Tournament Help")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
;1v1 <players> <server> <map>
;code <roomcode> @player
;qual @player
;win @player
;del
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament")
    .setDescription(`
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**

👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.started ? "Started" : "Open Registration"}**
`)
    .setImage(BANNER);
}

function bracketEmbed() {
  let text = "";

  tournament.matches.forEach((m, i) => {
    text += `⚔️ Match ${i + 1}\n`;

    if (!m.p2) {
      text += `🆓 <@${m.p1}> (BYE) ✅\n\n`;
    } else if (!m.winner) {
      text += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      text += `🏆 <@${m.winner}> ✅\n❌ ~~<@${loser}>~~\n\n`;
    }
  });

  text += `\n📊 Progress:\n${generateProgressBar(
    tournament.completed,
    tournament.totalMatches
  )}`;

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setTitle("🏆 Tournament Bracket")
    .setDescription(text)
    .setImage(BANNER);
}

function winnerEmbed(winnerId) {
  return new EmbedBuilder()
    .setColor("Gold")
    .setTitle("🎉 TOURNAMENT WINNER 🎉")
    .setDescription(`🏆 Congratulations <@${winnerId}> 🏆`)
    .setImage(BANNER);
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  await msg.delete().catch(() => {});

  if (cmd === "help") {
    return msg.channel.send({ embeds: [helpEmbed()] });
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (tournament) return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map)
      return msg.channel.send("Usage: ;1v1 <players> <server> <map>");

    tournament = {
      maxPlayers: size,
      server,
      map,
      players: [],
      matches: [],
      started: false,
      messageId: null,
      channelId: msg.channel.id,
      totalMatches: 0,
      completed: 0
    };

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("register")
            .setLabel("Register")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("start")
            .setLabel("Start")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });

    tournament.messageId = panel.id;
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament) return msg.channel.send("❌ No tournament.");

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const message = await channel.messages.fetch(tournament.messageId);
      await message.delete().catch(() => {});
    } catch {}

    tournament = null;
    msg.channel.send("🗑 Tournament deleted.");
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("❌ No active tournament.");

    const roomCode = args[0];
    const mention = msg.mentions.users.first();
    if (!roomCode || !mention)
      return msg.channel.send("Usage: ;code <roomcode> @player");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("❌ Player not in active match.");

    const players = [match.p1, match.p2].filter(Boolean);

    for (const id of players) {
      try {
        const user = await client.users.fetch(id);
        const embed = new EmbedBuilder()
          .setColor("#00ff88")
          .setTitle("🔒 Match Room Code")
          .setDescription(`
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**

🔒 Code:
\`\`\`
${roomCode}
\`\`\`

⏳ You have 2 minutes to join.
`);
        await user.send({ embeds: [embed] });
      } catch {}
    }

    msg.channel.send("✅ Code sent to both opponents.");
  }

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return msg.channel.send("❌ Staff only.");
    if (!tournament || !tournament.started)
      return msg.channel.send("❌ No active tournament.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.channel.send("Mention a player.");

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === mention.id || m.p2 === mention.id)
    );

    if (!match) return msg.channel.send("❌ Player not in active match.");

    if (match.winner)
      return msg.channel.send("⚠️ Winner already declared.");

    match.winner = mention.id;
    tournament.completed++;

    const winners = tournament.matches
      .filter(m => m.winner)
      .map(m => m.winner);

    if (winners.length === tournament.matches.length) {
      if (winners.length === 1) {
        msg.channel.send({ embeds: [winnerEmbed(winners[0])] });
        tournament = null;
        return;
      }

      tournament.matches = createMatches(winners);
      tournament.totalMatches = tournament.matches.length;
      tournament.completed = 0;
    }

    msg.channel.send({ embeds: [bracketEmbed()] });
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament)
    return interaction.reply({ content: "No tournament.", ephemeral: true });

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );
      await interaction.reply({ content: "Unregistered.", ephemeral: true });
    } else {
      if (tournament.players.length >= tournament.maxPlayers)
        return interaction.reply({ content: "Tournament full.", ephemeral: true });

      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "Registered.", ephemeral: true });
    }

    const channel = await client.channels.fetch(tournament.channelId);
    const message = await channel.messages.fetch(tournament.messageId);
    await message.edit({ embeds: [registrationEmbed()] });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);
    tournament.totalMatches = tournament.matches.length;
    tournament.completed = 0;

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
