require("dotenv").config();
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
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1350446868064374845/Event_Background_BlockDash.png?ex=69a0e667&is=699f94e7&hm=10ab2164394c100bf27486a0ca4704b70df77cd768bbbf60710956c6f6739260&";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= STATE ================= */

let tournament = null;

function createTournament(mode = "1v1") {
  return {
    mode,
    maxPlayers: 8,
    server: "INW",
    players: [],
    teams: [],
    round: 1,
    matches: [],
    started: false,
    panelId: null,
    bracketId: null
  };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

/* ================= MATCH LOGIC ================= */

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
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

function bracketEmbed() {
  const total = tournament.matches.length;
  const finished = tournament.matches.filter(m => m.winner).length;

  const percent = total === 0 ? 0 : Math.floor((finished / total) * 100);
  const filled = Math.floor(percent / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  let desc = `🏆 **ShinTours Tournament**\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `📍 Server: ${tournament.server}\n`;
  desc += `🎯 Round: ${tournament.round}\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n\n`;

  tournament.matches.forEach((m, i) => {
    desc += `${m.winner ? "✅" : "⚔️"} **Match ${i + 1}**\n`;

    if (!m.p2) {
      desc += `🏆 **<@${m.p1}>** (BYE)\n\n`;
      return;
    }

    if (!m.winner) {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    } else {
      const loser = m.p1 === m.winner ? m.p2 : m.p1;
      desc += `🏆 **<@${m.winner}>**\n`;
      desc += `❌ ~~<@${loser}>~~\n\n`;
    }
  });

  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `📊 Progress\n`;
  desc += `\`${bar}\` ${percent}%`;

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= PANELS ================= */

function panelEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament (1v1)")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🌍 Server: **${tournament.server}**
📌 Status: **${tournament.started ? "Started" : "Open"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function teamPanelEmbed() {
  const teamSize = tournament.mode === "2v2" ? 2 : 3;
  const teams = tournament.teams.length;
  const players = teams * teamSize;
  const remaining = tournament.maxPlayers - teams;

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle(`🏆 ShinTours Tournament (${tournament.mode})`)
    .setDescription(`
━━━━━━━━━━━━━━━━━━
👥 Teams: **${teams}/${tournament.maxPlayers}**
🎮 Players Joined: **${players}**
📉 Remaining Slots: **${remaining}**
📌 Status: **${tournament.started ? "Started" : "Open"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function panelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.started),

    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(tournament.started),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tournament.started)
  );
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild) return;
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  msg.delete().catch(() => {});

  if (["1v1","2v2","3v3","code","qualify","win"].includes(cmd)) {
    if (!isStaff(msg.member)) return;
  }

  if (cmd === "1v1") {
    tournament = createTournament("1v1");

    const panel = await msg.channel.send({
      embeds: [panelEmbed()],
      components: [panelButtons()]
    });

    tournament.panelId = panel.id;
  }

  if (cmd === "2v2" || cmd === "3v3") {
    tournament = createTournament(cmd);

    const panel = await msg.channel.send({
      embeds: [teamPanelEmbed()],
      components: [panelButtons()]
    });

    tournament.panelId = panel.id;
  }

  if (cmd === "qualify" || cmd === "win") {
    if (!tournament || !tournament.started) return;

    const player = msg.mentions.users.first();
    if (!player) return;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === player.id || m.p2 === player.id)
    );
    if (!match) return;

    match.winner = player.id;
    updateBracket(msg.channel);
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (!tournament.players.includes(interaction.user.id))
      tournament.players.push(interaction.user.id);
  }

  if (interaction.customId === "unregister") {
    tournament.players =
      tournament.players.filter(id => id !== interaction.user.id);
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    const bracketMsg = await interaction.channel.send({
      embeds: [bracketEmbed()]
    });

    tournament.bracketId = bracketMsg.id;
  }

  const panel = await interaction.channel.messages.fetch(tournament.panelId);

  await panel.edit({
    embeds: [
      tournament.mode === "1v1"
        ? panelEmbed()
        : teamPanelEmbed()
    ],
    components: [panelButtons()]
  });

  interaction.reply({ content: "Updated.", ephemeral: true });
});

/* ================= ROUND SYSTEM ================= */

async function updateBracket(channel) {

  const unfinished = tournament.matches.filter(m => !m.winner);

  if (unfinished.length > 0) {
    const msg = await channel.messages.fetch(tournament.bracketId);
    return msg.edit({ embeds: [bracketEmbed()] });
  }

  const winners = tournament.matches.map(m => m.winner);

  const old = await channel.messages.fetch(tournament.bracketId);
  await old.delete().catch(() => {});

  if (winners.length === 1)
    return channel.send(`👑 Champion: <@${winners[0]}>`);

  tournament.round++;
  tournament.matches = createMatches(winners);

  const newMsg = await channel.send({
    embeds: [bracketEmbed()]
  });

  tournament.bracketId = newMsg.id;
}

client.login(process.env.TOKEN);
