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

const isMod = (m) =>
  m.permissions.has(PermissionsBitField.Flags.Administrator) ||
  m.roles.cache.some(r => r.name === MOD_ROLE);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  /* ========= HELP ========= */
  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("📖 Tournament Bot Commands")
          .setImage(BANNER)
          .setDescription(`
🏆 **Tournament**
;1v1 <size> <server> <map> <name>
;start
;bye
;qual @user
;qual bye1
;code <roomcode> @player

🛡 **Moderation**
;ban @user
;mute @user 10m
;purge 20

🎫 **Tickets**
;ticketpanel add #channel
`)
      ]
    });
  }

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
      winners: []
    };

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle(`🏆 ${name}`)
      .setImage(BANNER)
      .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${server}**
🗺 Map: **${map}**
👥 Players: **0/${size}**
🔓 Status: **OPEN**
`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("register").setLabel("Register").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unregister").setLabel("Unregister").setStyle(ButtonStyle.Danger)
    );

    const panel = await msg.channel.send({ embeds: [embed], components: [row] });
    tournament.panel = panel.id;
  }

  /* ========= START ========= */
  if (cmd === "start") {
    if (!isStaff(msg.member) || !tournament) return;
    if (tournament.players.length < 2) return;

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
  }

  /* ========= QUAL ========= */
  if (cmd === "qual") {
    if (!isStaff(msg.member) || !tournament) return;

    const user = msg.mentions.users.first();
    const bye = args[0]?.toLowerCase().startsWith("bye");

    const winner = bye ? args[0].toUpperCase() : user?.id;
    if (!winner) return;

    const match = tournament.matches.find(m => m.p1 === winner || m.p2 === winner);
    if (!match) return;

    match.winner = winner;
    tournament.winners.push(winner);

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracket);
    await bracketMsg.edit({ embeds: [buildBracket()] });
  }

  /* ========= NEXT ROUND ========= */
  if (cmd === "next") {
    if (!isStaff(msg.member) || !tournament) return;
    if (!tournament.matches.every(m => m.winner)) return;

    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = [];

    for (let i = 0; i < winners.length; i += 2) {
      tournament.matches.push({
        p1: winners[i],
        p2: winners[i + 1] || "BYE",
        winner: null
      });
    }

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracket);
    await bracketMsg.edit({ embeds: [buildBracket()] });
  }

  /* ========= ANNOUNCE ========= */
  if (cmd === "announce") {
    if (!isStaff(msg.member) || !tournament) return;
    if (tournament.matches.length !== 1) return;

    const winnerId = tournament.matches[0].winner;
    if (!winnerId) return;

    const user = await client.users.fetch(winnerId);

    await msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("Gold")
          .setTitle("🏆 TOURNAMENT WINNER")
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setDescription(`👑 Congratulations <@${winnerId}>!`)
      ]
    });

    tournament = null;
  }

});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isButton() || !tournament) return;

  if (i.customId === "register") {
    if (tournament.players.includes(i.user.id)) 
      return i.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(i.user.id);
    updatePanel(i);
    i.reply({ content: "Registered!", ephemeral: true });
  }

  if (i.customId === "unregister") {
    tournament.players = tournament.players.filter(p => p !== i.user.id);
    updatePanel(i);
    i.reply({ content: "Unregistered!", ephemeral: true });
  }
});

/* ================= FUNCTIONS ================= */

function buildBracket() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    desc += `Match ${i+1}
${p1} ${VS} ${p2}
${m.winner ? `Winner: ${m.winner.startsWith("BYE") ? m.winner : `<@${m.winner}>`} ${TICK}` : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc);
}

async function updatePanel(i) {
  const panel = await i.channel.messages.fetch(tournament.panel);

  const embed = new EmbedBuilder()
    .setColor("#ff003c")
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.max}**
🔓 Status: **OPEN**
`);

  panel.edit({ embeds: [embed] });
}

client.login(process.env.TOKEN);
