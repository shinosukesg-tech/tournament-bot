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

const TICK = "<:TICK:1467892699578236998>";
const CROSS = "<:CROSS:1467892662337278062>";

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

function autoDelete(message) {
  setTimeout(() => {
    message.delete().catch(() => {});
  }, 1500);
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
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
    channelId,
    panelId: null
  };
}

function generateMatches(players) {
  const shuffled = shuffle([...players]);
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
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **OPEN**
`)
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {

    let p1 = m.p1?.startsWith("BYE") ? `🤖 ${m.p1}` : `<@${m.p1}>`;
    let p2 = m.p2?.startsWith("BYE") ? `🤖 ${m.p2}` : `<@${m.p2}>`;

    if (m.winner) {
      if (m.winner === m.p1) {
        p1 += ` ${TICK}`;
        p2 += ` ${CROSS}`;
      } else {
        p2 += ` ${TICK}`;
        p1 += ` ${CROSS}`;
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

/* ================= BUTTON ROWS ================= */

function panelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("count")
      .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function controlRow() {
  if (tournament.matches.length === 1) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("announce_winner")
        .setLabel("Announce Winner 🏆")
        .setStyle(ButtonStyle.Success)
    );
  }
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("next_round")
      .setLabel("Next Round")
      .setStyle(ButtonStyle.Primary)
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");
    if (!size || !server || !map || !name) return;

    tournament = createTournament(size, server, map, name, msg.channel.id);

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [panelRow()]
    });

    tournament.panelId = panel.id;
  }

  if (!tournament) return;

  if (cmd === "bye") {
    if (!isStaff(msg.member)) return;

    let count = 1;
    while (tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(`BYE${count++}`);
    }

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [registrationEmbed()], components: [panelRow()] });
  }

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    let winnerId;

    if (input.toLowerCase().startsWith("bye")) {
      winnerId = input.toUpperCase();
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;
      winnerId = user.id;
    }

    const match = tournament.matches.find(
      m => m.p1 === winnerId || m.p2 === winnerId
    );
    if (!match) return;

    match.winner = winnerId;

    msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const roomCode = args[0];
    const player = msg.mentions.users.first();
    if (!roomCode || !player) return;

    const match = tournament.matches.find(
      m => m.p1 === player.id || m.p2 === player.id
    );
    if (!match) return;

    const opponentId = match.p1 === player.id ? match.p2 : match.p1;

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle("🎮 MATCH ROOM DETAILS")
      .setImage(BANNER)
      .setDescription(`
🏆 **${tournament.name}**
📊 Round **${tournament.round}**

🔐 Room Code:
\`\`\`${roomCode}\`\`\`

🌍 ${tournament.server}
🗺 ${tournament.map}
`)
      .setTimestamp();

    await player.send({ embeds: [embed] }).catch(()=>{});
    if (!opponentId.startsWith("BYE")) {
      const opponent = await client.users.fetch(opponentId);
      await opponent.send({ embeds: [embed] }).catch(()=>{});
    }
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id)) {
      const m = await interaction.reply({ content: "Already registered", ephemeral: false });
      autoDelete(await interaction.fetchReply());
      return;
    }

    if (tournament.players.length >= tournament.maxPlayers) {
      await interaction.reply({ content: "Tournament full", ephemeral: false });
      autoDelete(await interaction.fetchReply());
      return;
    }

    tournament.players.push(interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [registrationEmbed()], components: [panelRow()] });

    await interaction.reply({ content: "Registered!", ephemeral: false });
    autoDelete(await interaction.fetchReply());
  }

  if (interaction.customId === "unregister") {
    tournament.players = tournament.players.filter(p => p !== interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [registrationEmbed()], components: [panelRow()] });

    await interaction.reply({ content: "Unregistered!", ephemeral: false });
    autoDelete(await interaction.fetchReply());
  }
});

client.login(process.env.TOKEN);
