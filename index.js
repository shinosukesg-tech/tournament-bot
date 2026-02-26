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
const BANNER = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= TOURNAMENT STATE ================= */

let tournament = null;

function createTournament() {
  return {
    maxPlayers: 8,
    server: "INW",
    players: [],
    round: 1,
    matches: [],
    started: false,
    panelId: null
  };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

/* ================= MATCH SYSTEM ================= */

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

function progress() {
  const total = tournament.matches.length;
  const finished = tournament.matches.filter(m => m.winner).length;
  return `${finished}/${total}`;
}

function bracketEmbed() {
  let desc = `🏆 **ShinTours Tournament**\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n`;
  desc += `📍 Server: ${tournament.server}\n`;
  desc += `🎯 Round: ${tournament.round}\n`;
  desc += `📊 Progress: ${progress()}\n`;
  desc += `━━━━━━━━━━━━━━━━━━\n\n`;

  tournament.matches.forEach((m, i) => {
    const status = m.winner ? "✅" : "⚔️";
    desc += `${status} **Match ${i + 1}**\n`;
    desc += m.p2
      ? `<@${m.p1}> vs <@${m.p2}>\n\n`
      : `<@${m.p1}> (BYE)\n\n`;
  });

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= PANEL ================= */

function panelEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Mode: **1v1**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🌍 Server: **${tournament.server}**
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

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild) return;
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  msg.delete().catch(() => {}); // AUTO DELETE COMMAND

  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#3498db")
          .setTitle("📘 ShinTours Help")
          .setDescription(`
;1v1 p8 s INW
;code 1234 @players
;qualify @player
;win @player
          `)
      ]
    });
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const pArg = args.find(a => a.startsWith("p"));
    const sIndex = args.indexOf("s");
    if (!pArg || sIndex === -1) return;

    tournament = createTournament();
    tournament.maxPlayers = parseInt(pArg.replace("p", ""));
    tournament.server = args[sIndex + 1];

    const panel = await msg.channel.send({
      embeds: [panelEmbed()],
      components: [panelButtons()]
    });

    tournament.panelId = panel.id;
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const code = args[0];
    const mentions = msg.mentions.users;
    if (!code || mentions.size === 0) return;

    const embed = new EmbedBuilder()
      .setColor("#00ffcc")
      .setTitle("🎮 Match Code")
      .setDescription(`Your Match Code:\n\n**${code}**`);

    for (const user of mentions.values()) {
      try { await user.send({ embeds: [embed] }); } catch {}
    }

    msg.channel.send("✅ Code sent.");
  }

  if (cmd === "win" || cmd === "qualify") {
    if (!isStaff(msg.member)) return;
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

    interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "unregister") {
    tournament.players = tournament.players.filter(
      id => id !== interaction.user.id
    );
    interaction.reply({ content: "Unregistered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member)) return;
    tournament.started = true;
    tournament.matches = createMatches(tournament.players);
    interaction.channel.send({ embeds: [bracketEmbed()] });
  }

  const panel = await interaction.channel.messages.fetch(tournament.panelId);
  panel.edit({ embeds: [panelEmbed()], components: [panelButtons()] });
});

/* ================= ROUND SYSTEM ================= */

async function updateBracket(channel) {
  const unfinished = tournament.matches.filter(m => !m.winner);
  if (unfinished.length > 0)
    return channel.send({ embeds: [bracketEmbed()] });

  const winners = tournament.matches.map(m => m.winner);

  if (winners.length === 1)
    return channel.send(`👑 Champion: <@${winners[0]}>`);

  tournament.round++;
  tournament.matches = createMatches(winners);
  channel.send({ embeds: [bracketEmbed()] });
}

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
