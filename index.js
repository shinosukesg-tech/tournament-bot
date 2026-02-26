require("dotenv").config();

/* ================= UPTIME SERVER ================= */
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
});
/* ================================================= */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

/* ================= STATE ================= */

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function progressBar(done, total) {
  const size = 10;
  const percent = done / total;
  const progress = Math.round(size * percent);
  return "🟩".repeat(progress) + "⬜".repeat(size - progress);
}

/* ================= TOURNAMENT ================= */

function createTournament(size, server, map) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    locked: false,
    channelId: null,
    messageId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

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
    .setColor("#5865F2")
    .setTitle("🏆 ShinTours 1v1 Tournament")
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.locked ? "Locked (Full)" : "Open"}**
`)
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 **Round ${tournament.round}**\n\n`;
  let completed = 0;

  tournament.matches.forEach((m, i) => {
    if (m.winner) completed++;
    const p1 = m.p1 ? `<@${m.p1}>` : "BYE";
    const p2 = m.p2 ? `<@${m.p2}>` : "BYE";
    const winner = m.winner ? ` ✅ <@${m.winner}>` : "";
    desc += `**Match ${i + 1}**\n${p1} vs ${p2}${winner}\n\n`;
  });

  desc += `Progress:\n${progressBar(completed, tournament.matches.length)}`;

  return new EmbedBuilder()
    .setColor("#00FFAA")
    .setTitle("📊 Live Bracket")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  // AUTO DELETE COMMAND MESSAGE
  setTimeout(() => msg.delete().catch(() => {}), 1500);

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* CREATE TOURNAMENT */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map) return;

    tournament = createTournament(size, server, map);
    tournament.channelId = msg.channel.id;

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

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.messageId = panel.id;
    return;
  }

  if (!tournament) return;

  /* SEND CODE TO ALL */
  if (cmd === "code") {
    if (!isStaff(msg.member)) return;
    const roomCode = args[0];
    if (!roomCode) return;

    for (const playerId of tournament.players) {
      try {
        const user = await client.users.fetch(playerId);

        const dmEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("🎮 Tournament Room Code")
          .setImage(BANNER)
          .setDescription(`
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**

🔐 Code:
\`\`\`${roomCode}\`\`\`
`)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`dismiss_${playerId}`)
            .setLabel("Dismiss")
            .setStyle(ButtonStyle.Secondary)
        );

        await user.send({ embeds: [dmEmbed], components: [row] });
      } catch {}
    }

    const confirm = await msg.channel.send("✅ Code sent to all players.");
    setTimeout(() => confirm.delete().catch(() => {}), 2000);
  }

  /* QUALIFY */
  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return;
    const mention = msg.mentions.users.first();
    if (!mention) return;

    for (const match of tournament.matches) {
      if ((match.p1 === mention.id || match.p2 === mention.id) && !match.winner) {
        match.winner = mention.id;
      }
    }

    const winners = tournament.matches.map(m => m.winner).filter(Boolean);

    if (winners.length === tournament.matches.length) {

      if (winners.length === 1) {
        const champ = await client.users.fetch(winners[0]);

        const championEmbed = new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle("🏆 SHINTOURS GRAND CHAMPION 🏆")
          .setThumbnail(champ.displayAvatarURL({ dynamic: true, size: 1024 }))
          .setImage(BANNER)
          .setDescription(`
👑 **Champion**
${champ}

🔥 Dominated all rounds!
`)
          .setTimestamp();

        await msg.channel.send({ embeds: [championEmbed] });
        tournament = null;
        return;
      }

      tournament.round++;
      tournament.matches = generateMatches(winners);
    }

    const bracketMsg = await client.channels.cache
      .get(tournament.channelId)
      .messages.fetch(tournament.messageId);

    bracketMsg.edit({ embeds: [bracketEmbed()] });
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  /* DISMISS DM */
  if (interaction.customId.startsWith("dismiss_")) {
    const ownerId = interaction.customId.split("_")[1];
    if (interaction.user.id !== ownerId)
      return interaction.reply({ content: "Not your message.", ephemeral: true });

    return interaction.message.delete().catch(() => {});
  }

  if (!tournament) return;

  /* REGISTER */
  if (interaction.customId === "register") {

    if (tournament.locked)
      return interaction.reply({ content: "🔒 Registration locked.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(id => id !== interaction.user.id);
      await interaction.reply({ content: "❌ Unregistered.", ephemeral: true });
    } else {
      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "✅ Registered!", ephemeral: true });

      if (tournament.players.length === tournament.maxPlayers)
        tournament.locked = true;
    }

    const panel = await interaction.channel.messages.fetch(tournament.messageId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(tournament.locked ? "Locked" : "Register")
        .setStyle(tournament.locked ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(tournament.locked),

      new ButtonBuilder()
        .setCustomId("start")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }

  /* START */
  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;
    if (tournament.started) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    await interaction.reply({ embeds: [bracketEmbed()] });
  }
});

client.login(process.env.DISCORD_TOKEN);
