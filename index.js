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

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const isMod = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === MOD_ROLE);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const allFinished = () =>
  tournament &&
  tournament.matches.length > 0 &&
  tournament.matches.every(m => m.winner);

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
`);
}

function registrationRow() {
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
      .setCustomId("counter")
      .setLabel(`Players: ${tournament.players.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    desc += `Match ${i + 1}
${p1} 🆚 ${p2}
${m.winner ? `Winner: ${m.winner.startsWith("BYE") ? m.winner : `<@${m.winner}>`} ✅` : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc);
}

function controlRow() {
  const final = tournament.matches.length === 1;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(final ? "announce" : "next")
      .setLabel(final ? "Announce Winner 🏆" : "Next Round")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!allFinished())
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

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
      maxPlayers: size,
      players: [],
      matches: [],
      round: 1,
      bracketMessage: null
    };

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    tournament.panelMessage = panel.id;
  }

  /* ========= START ========= */
  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return msg.reply("No tournament created.");
    if (tournament.players.length < 2)
      return msg.reply("Not enough players.");

    const shuffled = shuffle(tournament.players);
    tournament.matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      tournament.matches.push({
        p1: shuffled[i],
        p2: shuffled[i + 1] || `BYE${i}`,
        winner: null
      });
    }

    const bracketMsg = await msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    tournament.bracketMessage = bracketMsg.id;
  }

  /* ========= QUAL ========= */
  if (cmd === "qual") {
    if (!isStaff(msg.member) || !tournament) return;

    const mention = msg.mentions.users.first();
    const arg = args[0];

    let winnerId = null;

    if (mention) winnerId = mention.id;
    else if (arg && arg.toLowerCase().startsWith("bye"))
      winnerId = arg.toUpperCase();

    if (!winnerId) return;

    const match = tournament.matches.find(
      m => (m.p1 === winnerId || m.p2 === winnerId) && !m.winner
    );

    if (!match) return;

    match.winner = winnerId;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketMessage);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  /* ========= CODE ========= */
  if (cmd === "code") {
    if (!isStaff(msg.member) || !tournament) return;

    const roomCode = args[0];
    const mentioned = msg.mentions.users.first();

    if (!roomCode) return;

    let match;

    if (mentioned) {
      match = tournament.matches.find(
        m => m.p1 === mentioned.id || m.p2 === mentioned.id
      );
    }

    if (!match) return msg.reply("Match not found.");

    const p1 = await client.users.fetch(match.p1).catch(()=>null);
    const p2 = match.p2.startsWith("BYE")
      ? null
      : await client.users.fetch(match.p2).catch(()=>null);

    if (p1) p1.send(`🎮 Your Room Code: **${roomCode}**`);
    if (p2) p2.send(`🎮 Your Room Code: **${roomCode}**`);

    msg.channel.send("Room code sent to both players.");
  }

});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  if (!i.isButton()) return;

  /* REGISTER */
  if (i.customId === "register") {
    if (!tournament) return i.reply({ content: "No tournament.", ephemeral: true });

    if (!tournament.players.includes(i.user.id))
      tournament.players.push(i.user.id);

    await i.update({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });
  }

  /* UNREGISTER */
  if (i.customId === "unregister") {
    tournament.players = tournament.players.filter(p => p !== i.user.id);

    await i.update({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });
  }

  /* NEXT */
  if (i.customId === "next") {
    if (!isStaff(i.member) || !allFinished()) return;

    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = [];

    for (let x = 0; x < winners.length; x += 2) {
      tournament.matches.push({
        p1: winners[x],
        p2: winners[x + 1] || `BYE${x}`,
        winner: null
      });
    }

    await i.update({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  /* ANNOUNCE */
  if (i.customId === "announce") {
    if (!isStaff(i.member)) return;

    const winnerId = tournament.matches[0].winner;
    const winnerUser = await client.users.fetch(winnerId);

    await i.update({
      embeds: [
        new EmbedBuilder()
          .setColor("Gold")
          .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
          .setThumbnail(winnerUser.displayAvatarURL({ size: 512 }))
          .setImage(winnerUser.displayAvatarURL({ size: 1024 }))
          .setDescription(`👑 Congratulations <@${winnerUser.id}>!`)
      ],
      components: []
    });

    tournament = null;
  }
});

client.login(process.env.TOKEN);
