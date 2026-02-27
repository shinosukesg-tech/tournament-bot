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
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function createTournament(size, server, map, name, channelId) {
  return {
    name,
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
      p2: shuffled[i + 1] || null,
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
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **${tournament.locked ? "LOCKED" : "OPEN"}**
`)
    .setTimestamp();
}

function bracketEmbed() {
  if (!tournament.matches.length) {
    return new EmbedBuilder()
      .setColor("#ffaa00")
      .setTitle("No matches generated.");
  }

  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {

    let p1 = m.p1?.startsWith("BYE") ? `🤖 ${m.p1}` : `<@${m.p1}>`;
    let p2 = m.p2
      ? m.p2.startsWith("BYE")
        ? `🤖 ${m.p2}`
        : `<@${m.p2}>`
      : "—";

    if (m.winner) {
      if (m.winner === m.p1) {
        p1 += " ✅";
        if (m.p2) p2 += " ❌";
      } else {
        if (m.p2) p2 += " ✅";
        p1 += " ❌";
      }
    }

    desc += `Match ${i + 1}
${p1} ⚔ ${p2}
${m.winner ? "✔ COMPLETE" : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  msg.delete().catch(() => {});

  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("🏆 TOURNAMENT COMMANDS")
      .setImage(BANNER)
      .setDescription(`
\`\`\`
;1v1 (slots) (server) (map) (name)
;qual r(matchNumber) @user/BYE1
;win @user
;code ROOMCODE @user
;del
\`\`\`
Use START button to begin.
`)
      .setTimestamp();

    return msg.channel.send({ embeds: [embed] });
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return;
    tournament = null;
    return msg.channel.send("🗑 Tournament deleted.");
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");
    if (!size || !server || !map || !name) return;

    tournament = createTournament(size, server, map, name, msg.channel.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`👤 0/${size}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId("start_tournament")
        .setLabel("START")
        .setStyle(ButtonStyle.Danger)
    );

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [row]
    });

    tournament.panelId = panel.id;
    return;
  }

  if (!tournament || !tournament.started) return;

  if (cmd === "qual" || cmd === "win") {
    if (!isStaff(msg.member)) return;

    let winnerId = null;
    let match = null;

    if (cmd === "qual") {
      const matchNumber = parseInt(args[0]?.replace("r", ""));
      if (!matchNumber) return;

      match = tournament.matches[matchNumber - 1];
      if (!match) return;

      if (args[1]?.toUpperCase().startsWith("BYE")) {
        winnerId = args[1].toUpperCase();
      } else {
        winnerId = msg.mentions.users.first()?.id;
      }
    }

    if (cmd === "win") {
      const user = msg.mentions.users.first();
      if (!user) return;

      match = tournament.matches.find(
        m => !m.winner && (m.p1 === user.id || m.p2 === user.id)
      );
      if (!match) return;

      winnerId = user.id;
    }

    if (!winnerId || !match) return;

    match.winner = winnerId;

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed()], components: [] });

    const allDone = tournament.matches.every(m => m.winner);

    if (allDone) {

      if (tournament.matches.length === 1) {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("announce_winner")
            .setLabel("🏆 ANNOUNCE CHAMPION")
            .setStyle(ButtonStyle.Success)
        );

        await panel.edit({
          embeds: [bracketEmbed()],
          components: [row]
        });

      } else {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("next_round")
            .setLabel("NEXT ROUND")
            .setStyle(ButtonStyle.Primary)
        );

        await panel.edit({
          embeds: [bracketEmbed()],
          components: [row]
        });
      }
    }
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;
    if (!tournament || !tournament.started) return;

    const roomCode = args[0];
    const user = msg.mentions.users.first();
    if (!roomCode || !user) return;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === user.id || m.p2 === user.id)
    );
    if (!match) return;

    for (const id of [match.p1, match.p2]) {
      if (!id || id.startsWith("BYE")) continue;

      const member = await msg.guild.members.fetch(id);

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("🎮 MATCH ROOM")
        .setDescription(`
🔑 Room Code:
\`\`\`${roomCode}\`\`\`
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
Good Luck 🔥
`)
        .setTimestamp();

      await member.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Tournament started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(id => id !== interaction.user.id);
    } else {
      if (tournament.players.length >= tournament.maxPlayers)
        return interaction.reply({ content: "Slots full.", ephemeral: true);

      tournament.players.push(interaction.user.id);
    }

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("count")
        .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId("start_tournament")
        .setLabel("START")
        .setStyle(ButtonStyle.Danger)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });

    await interaction.reply({ content: "Updated.", ephemeral: true });
  }

  if (interaction.customId === "start_tournament") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "No permission.", ephemeral: true });

    if (tournament.started)
      return interaction.reply({ content: "Already started.", ephemeral: true });

    if (tournament.players.length === 0)
      return interaction.reply({ content: "No players registered.", ephemeral: true });

    tournament.started = true;
    tournament.locked = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    return interaction.reply({ content: "Tournament Started ✅", ephemeral: true });
  }

  if (interaction.customId === "next_round") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "No permission.", ephemeral: true });

    const winners = tournament.matches.map(m => m.winner);

    tournament.round++;
    tournament.matches = generateMatches(winners);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [bracketEmbed()],
      components: []
    });

    return interaction.reply({ content: "Next Round Generated ✅", ephemeral: true });
  }

  if (interaction.customId === "announce_winner") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "No permission.", ephemeral: true });

    const winner = tournament.matches[0].winner;

    const embed = new EmbedBuilder()
      .setColor("#ffd700")
      .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
      .setImage(BANNER)
      .setDescription(`👑 Congratulations <@${winner}>!\n\nYou are the official champion of **${tournament.name}**`)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    tournament = null;

    return interaction.reply({ content: "Champion Announced ✅", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
