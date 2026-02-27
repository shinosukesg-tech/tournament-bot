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
  PermissionsBitField,
  SlashCommandBuilder
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
  return "█".repeat(filled) + "░".repeat(size - filled) + ` ${Math.round(percent * 100)}%`;
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

function generateMatches(players) {
  const shuffled = shuffle(players);
  const size = nextPowerOfTwo(tournament.maxPlayers);

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
    .setTitle("🏆 SHINTOURS ESPORTS TOURNAMENT")
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
🔒 Status: **${tournament.locked ? "LOCKED" : "OPEN"}**
`)
    .setTimestamp();
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;
  let completed = 0;

  tournament.matches.forEach((m, i) => {
    if (m.winner) completed++;

    const p1 = m.p1?.startsWith("BYE") ? `🤖 ${m.p1}` : `<@${m.p1}>`;
    const p2 = m.p2?.startsWith("BYE") ? `🤖 ${m.p2}` : `<@${m.p2}>`;

    const winner =
      m.winner
        ? m.winner.startsWith("BYE")
          ? `🏅 Winner: 🤖 ${m.winner}`
          : `🏅 Winner: <@${m.winner}>`
        : "";

    desc += `Match ${i + 1}\n${p1} ⚔ ${p2}\n${winner}\n\n`;
  });

  desc += `Progress:\n${progressBar(completed, tournament.matches.length)}`;

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

/* ================= READY EVENT ================= */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const slash = new SlashCommandBuilder()
    .setName("tournament")
    .setDescription("Create a 1v1 tournament")
    .addIntegerOption(opt =>
      opt.setName("size").setDescription("Max Players").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Server").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("map").setDescription("Map").setRequired(true)
    );

  await client.application.commands.set([slash]);
});

/* ================= SLASH ================= */

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "tournament") {
      if (!isStaff(interaction.member))
        return interaction.reply({ content: "No permission.", ephemeral: true });

      const size = interaction.options.getInteger("size");
      const server = interaction.options.getString("server");
      const map = interaction.options.getString("map");

      tournament = createTournament(size, server, map, interaction.channel.id);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("register")
          .setLabel(`Register (0/${size})`)
          .setStyle(ButtonStyle.Success)
      );

      const panel = await interaction.reply({
        embeds: [registrationEmbed()],
        components: [row],
        fetchReply: true
      });

      tournament.panelId = panel.id;
    }
  }

  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.started)
      return interaction.reply({ content: "Tournament started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      tournament.players = tournament.players.filter(id => id !== interaction.user.id);
      await interaction.reply({ content: "Unregistered.", ephemeral: true });
    } else {
      tournament.players.push(interaction.user.id);
      await interaction.reply({ content: "Registered.", ephemeral: true });
    }

    const panel = await interaction.channel.messages.fetch(tournament.panelId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel(`Register (${tournament.players.length}/${tournament.maxPlayers})`)
        .setStyle(ButtonStyle.Success)
    );

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [row]
    });
  }
});

/* ================= PREFIX COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* HELP */
  if (cmd === "help") {
    return msg.channel.send(`
🏆 Tournament Commands

;qual @user / BYE1
;win @user / BYE1
;code <roomcode> @user
;start
;del
    `);
  }

  if (!tournament) return;

  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    tournament.started = true;
    tournament.matches = generateMatches(tournament.players);

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed()], components: [] });
  }

  if (cmd === "del") {
    if (!isStaff(msg.member)) return;
    tournament = null;
    return msg.channel.send("Tournament deleted.");
  }

  if (cmd === "qual") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    if (input.toUpperCase().startsWith("BYE")) {
      tournament.players.push(input.toUpperCase());
      return msg.channel.send(`${input.toUpperCase()} qualified.`);
    }

    const user = msg.mentions.users.first();
    if (!user) return;

    tournament.players.push(user.id);
    msg.channel.send(`${user.username} qualified.`);
  }

  if (cmd === "win") {
    if (!isStaff(msg.member)) return;

    const input = args[0];
    if (!input) return;

    const winnerId =
      input.toUpperCase().startsWith("BYE")
        ? input.toUpperCase()
        : msg.mentions.users.first()?.id;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === winnerId || m.p2 === winnerId)
    );

    if (!match) return;

    match.winner = winnerId;

    const panel = await msg.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [bracketEmbed()] });
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const code = args[0];
    const user = msg.mentions.users.first();
    if (!code || !user) return;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === user.id || m.p2 === user.id)
    );

    if (!match) return;

    for (const id of [match.p1, match.p2]) {
      if (id.startsWith("BYE")) continue;

      const member = await msg.guild.members.fetch(id);

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("🎮 MATCH ROOM")
        .setDescription(`Room Code: **${code}**`)
        .setTimestamp();

      await member.send({ embeds: [embed] }).catch(() => {});
    }

    msg.channel.send("Code sent.");
  }
});

client.login(process.env.DISCORD_TOKEN);
