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
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const MOD_ROLE = "Moderator";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const TICK = "<:TICK:1467892699578236998>";
const VS = "<:VS:1477014161484677150>";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

let tournament = null;

/* ================= UTIL ================= */

const isStaff = (m) =>
  m.permissions.has(PermissionsBitField.Flags.Administrator) ||
  m.roles.cache.some(r => r.name === STAFF_ROLE);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  /* ========= CREATE TOURNAMENT ========= */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    if (!size || !server || !map || !name) return;

    tournament = {
      name,
      server,
      map,
      max: size,
      players: [],
      matches: [],
      round: 1,
      panel: null,
      bracket: null,
      status: "OPEN"
    };

    const panel = await msg.channel.send({
      embeds: [buildPanel()],
      components: [buildButtons()]
    });

    tournament.panel = panel.id;
  }

  /* ========= START ========= */
  if (cmd === "start") {
    if (!isStaff(msg.member) || !tournament) return;
    if (tournament.players.length < 2) return;

    tournament.status = "STARTED";

    const shuffled = shuffle(tournament.players);
    tournament.matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      tournament.matches.push({
        p1: shuffled[i],
        p2: shuffled[i + 1] || "BYE",
        winner: null
      });
    }

    const bracket = await msg.channel.send({ embeds: [buildBracket()] });
    tournament.bracket = bracket.id;

    updatePanelMessage(true);
  }

  /* ========= BYE ========= */
  if (cmd === "bye") {
    if (!isStaff(msg.member) || !tournament) return;

    const lastMatch = tournament.matches.find(m => m.p2 === "BYE" && !m.winner);
    if (!lastMatch) return;

    lastMatch.winner = lastMatch.p1;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracket);
    await bracketMsg.edit({ embeds: [buildBracket()] });
  }

});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isButton() || !tournament) return;

  if (tournament.status !== "OPEN")
    return i.reply({ content: "Tournament already started.", ephemeral: true });

  if (i.customId === "register") {
    if (tournament.players.includes(i.user.id))
      return i.reply({ content: "Already registered.", ephemeral: true });

    if (tournament.players.length >= tournament.max)
      return i.reply({ content: "Tournament full.", ephemeral: true });

    tournament.players.push(i.user.id);
    updatePanelMessage();
    return i.reply({ content: "Registered!", ephemeral: true });
  }

  if (i.customId === "unregister") {
    tournament.players = tournament.players.filter(p => p !== i.user.id);
    updatePanelMessage();
    return i.reply({ content: "Unregistered!", ephemeral: true });
  }
});

/* ================= FUNCTIONS ================= */

function buildPanel() {
  return new EmbedBuilder()
    .setColor("#ff003c")
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.max}**
🔓 Status: **${tournament.status}**
`);
}

function buildButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled || tournament.players.length >= tournament.max),
    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

async function updatePanelMessage(disableAll = false) {
  if (!tournament.panel) return;

  const channel = await client.channels.fetch(tournament.channelId || null).catch(()=>null);
  const guild = client.guilds.cache.first();
  const msgChannel = guild.channels.cache.find(c => c.messages);

  try {
    const panelMsg = await msgChannel.messages.fetch(tournament.panel);
    await panelMsg.edit({
      embeds: [buildPanel()],
      components: [buildButtons(disableAll)]
    });
  } catch {}
}

function buildBracket() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1 === "BYE" ? "BYE" : `<@${m.p1}>`;
    const p2 = m.p2 === "BYE" ? "BYE" : `<@${m.p2}>`;

    desc += `Match ${i+1}\n${p1} ${VS} ${p2}\n`;
    desc += m.winner
      ? `Winner: ${m.winner === "BYE" ? "BYE" : `<@${m.winner}>`} ${TICK}\n\n`
      : "⏳ Pending\n\n";
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc);
}

client.login(process.env.TOKEN);
