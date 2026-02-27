require("dotenv").config();

/* ================== EXPRESS UPTIME ================== */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot Alive"));
app.listen(process.env.PORT || 3000);
/* ==================================================== */

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
const BANNER =
  "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

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

/* ================= STATE ================= */

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator))
    return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function progressBar(done, total) {
  const size = 16;
  const percent = total === 0 ? 0 : done / total;
  const filled = Math.round(size * percent);
  const bar =
    "█".repeat(filled) + "░".repeat(size - filled);
  const percentage = Math.round(percent * 100);
  return `${bar}  ${percentage}%`;
}

/* ================= TOURNAMENT ================= */

function createTournament(size, server, map, channelId) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    round: 1,
    started: false,
    locked: false,
    channelId,
    panelId: null
  };
}

/* ===== BYE SYSTEM (NO AUTO LOSE) ===== */

function generateMatches(players) {
  const shuffled = shuffle(players);
  const size = nextPowerOfTwo(tournament.maxPlayers);

  let byeCount = 1;
  while (shuffled.length < size) {
    shuffled.push(`BYE${byeCount}`);
    byeCount++;
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
    .setTitle("🏆 SHINTOURS ESPORTS TOURNAMENT")
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server || "Not Set"}**
🗺 Map: **${tournament.map || "Not Set"}**
🔒 Status: **${tournament.locked ? "LOCKED" : "OPEN"}**
`)
    .setFooter({
      text: `Players: ${tournament.players.length}/${tournament.maxPlayers}`
    })
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 **ROUND ${tournament.round}**\n\n`;
  let completed = 0;

  tournament.matches.forEach((m, i) => {
    if (m.winner) completed++;

    const p1 =
      m.p1?.startsWith("BYE")
        ? `🤖 ${m.p1}`
        : `<@${m.p1}>`;

    const p2 =
      m.p2?.startsWith("BYE")
        ? `🤖 ${m.p2}`
        : `<@${m.p2}>`;

    const winner =
      m.winner && !m.winner.startsWith("BYE")
        ? `🏅 Winner: <@${m.winner}>`
        : m.winner?.startsWith("BYE")
        ? `🏅 Winner: 🤖 ${m.winner}`
        : "";

    desc += `**Match ${i + 1}**\n${p1} ⚔ ${p2}\n${winner}\n\n`;
  });

  desc += `📊 **Tournament Progress**\n${progressBar(
    completed,
    tournament.matches.length
  )}`;

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

function championEmbed(user) {
  return new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🏆 TOURNAMENT CHAMPION")
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setImage(BANNER)
    .setDescription(`👑 Congratulations <@${user.id}>!`)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  msg.delete().catch(() => {});

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    if (tournament) tournament = null;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");
    if (!size || !server || !map) return;

    tournament = createTournament(size, server, map, msg.channel.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (0/${size})`)
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

    tournament.panelId = panel.id;
    return;
  }

  if (!tournament) return;

  /* QUAL (USER OR BYE) */
  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    if (input.toUpperCase().startsWith("BYE")) {
      tournament.players.push(input.toUpperCase());
      msg.channel.send(`${input.toUpperCase()} qualified.`);
      return;
    }

    const user = msg.mentions.users.first();
    if (!user) return;

    if (!tournament.players.includes(user.id)) {
      tournament.players.push(user.id);
      msg.channel.send(`${user.username} qualified.`);
    }
  }

  /* WIN */
  if (cmd === "win") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    let winnerId;

    if (input.toUpperCase().startsWith("BYE")) {
      winnerId = input.toUpperCase();
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;
      winnerId = user.id;
    }

    const match = tournament.matches.find(
      m =>
        !m.winner &&
        (m.p1 === winnerId || m.p2 === winnerId)
    );

    if (!match) return;

    match.winner = winnerId;

    const winners = tournament.matches
      .filter(m => m.winner)
      .map(m => m.winner);

    if (winners.length === tournament.matches.length) {
      if (winners.length === 1) {
        if (winners[0].startsWith("BYE")) {
          msg.channel.send("🤖 BYE BOT WON THE TOURNAMENT.");
          tournament = null;
          return;
        }

        const champ = await msg.guild.members.fetch(winners[0]);
        await msg.channel.send({
          embeds: [championEmbed(champ.user)]
        });
        tournament = null;
        return;
      }

      tournament.round++;
      tournament.matches = generateMatches(winners);
    }

    const panel = await msg.channel.messages.fetch(
      tournament.panelId
    );
    await panel.edit({ embeds: [bracketEmbed()] });
  }

  /* DECORATED DM CODE */
  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const code = args[0];
    const user = msg.mentions.users.first();
    if (!code || !user) return;

    const match = tournament.matches.find(
      m =>
        !m.winner &&
        (m.p1 === user.id || m.p2 === user.id)
    );

    if (!match) return;

    for (const id of [match.p1, match.p2]) {
      if (!id || id.startsWith("BYE")) continue;

      const member = await msg.guild.members.fetch(id);

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("🎮 SHINTOURS MATCH ROOM")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`
━━━━━━━━━━━━━━━━━━
🏆 Tournament Match
🔑 Room Code: **${code}**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
━━━━━━━━━━━━━━━━━━
Good Luck 🔥
`)
        .setTimestamp();

      await member.send({ embeds: [embed] }).catch(() => {});
    }

    msg.channel.send("Match code sent.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );
      await interaction.reply({ content: "Unregistered.", ephemeral: true });
    } else {
      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "Registered.", ephemeral: true });
    }

    const panel = await interaction.channel.messages.fetch(
      tournament.panelId
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(
          `Register (${tournament.players.length}/${tournament.maxPlayers})`
        )
        .setStyle(ButtonStyle.Success),
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

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
