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

/* ================= GLOBAL ================= */

let tournament = null;

/* ================= UTIL ================= */

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const isMod = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === MOD_ROLE);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ========= CREATE ========= */
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

    await msg.channel.send({ embeds: [embed], components: [row] });
  }

  /* ========= START ========= */
  if (cmd === "start") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return msg.reply("No tournament created.");

    const shuffled = shuffle(tournament.players);
    tournament.matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      tournament.matches.push({
        p1: shuffled[i],
        p2: shuffled[i + 1] || "BYE",
        winner: shuffled[i + 1] ? null : shuffled[i]
      });
    }

    const bracket = await msg.channel.send({
      embeds: [buildBracket()],
      components: [controlButtons()]
    });

    tournament.bracketMessage = bracket.id;
  }

  /* ========= CODE ========= */
  if (cmd === "code") {
    if (!isStaff(msg.member) || !tournament) return;

    const roomCode = args[0];
    const user = msg.mentions.users.first();
    if (!roomCode || !user) return;

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );

    if (!match) return;

    const p1 = await client.users.fetch(match.p1);
    const p2 = match.p2 === "BYE" ? null : await client.users.fetch(match.p2);

    if (p1) p1.send(`🎮 Room Code: ${roomCode}`);
    if (p2) p2.send(`🎮 Room Code: ${roomCode}`);

    msg.channel.send("Room code sent.");
  }

  /* ========= TICKET PANEL ========= */
  if (cmd === "ticketpanel" && args[0] === "add") {

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎫 Support & Applications")
      .setDescription(
`For Staff Application and support, Create a ticket with the button below<:shinchan_sips:1465048892876783820>`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await msg.channel.send({ embeds: [embed], components: [row] });
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  /* REGISTER */
  if (i.customId === "register") {
    if (!tournament) return i.reply({ content: "No tournament.", ephemeral: true });
    if (!tournament.players.includes(i.user.id))
      tournament.players.push(i.user.id);
    return i.reply({ content: "Registered!", ephemeral: true });
  }

  /* CREATE TICKET */
  if (i.customId === "create_ticket") {

    const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);

    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
        { id: modRole.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim_ticket").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    channel.send({
      content: `${i.user} | ${modRole}`,
      embeds: [new EmbedBuilder().setTitle("🎫 Ticket Opened").setDescription("Support will be with you shortly.")],
      components: [row]
    });

    i.reply({ content: "Ticket created!", ephemeral: true });
  }

  /* CLAIM */
  if (i.customId === "claim_ticket") {
    if (!isMod(i.member)) return;
    i.channel.send(`Ticket claimed by ${i.user}`);
  }

  /* CLOSE */
  if (i.customId === "close_ticket") {
    if (!isMod(i.member)) return;
    await i.reply("Closing ticket...");
    setTimeout(() => i.channel.delete(), 3000);
  }

  /* NEXT ROUND */
  if (i.customId === "next_round") {
    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = [];

    for (let x = 0; x < winners.length; x += 2) {
      tournament.matches.push({
        p1: winners[x],
        p2: winners[x + 1] || "BYE",
        winner: null
      });
    }

    await i.update({ embeds: [buildBracket()], components: [controlButtons()] });
  }

  /* ANNOUNCE */
  if (i.customId === "announce_winner") {
    const winnerId = tournament.matches[0].winner;
    const winnerUser = await client.users.fetch(winnerId);

    await i.update({
      embeds: [
        new EmbedBuilder()
          .setColor("Gold")
          .setTitle("🏆 TOURNAMENT WINNER 🏆")
          .setThumbnail(winnerUser.displayAvatarURL({ size: 512 }))
          .setImage(winnerUser.displayAvatarURL({ size: 1024 }))
          .setDescription(`👑 Congratulations <@${winnerUser.id}>!`)
      ],
      components: []
    });

    tournament = null;
  }
});

/* ================= BRACKET ================= */

function buildBracket() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1 === "BYE" ? "BYE" : `<@${m.p1}>`;
    const p2 = m.p2 === "BYE" ? "BYE" : `<@${m.p2}>`;

    desc += `Match ${i + 1}
${p1} 🆚 ${p2}
${m.winner ? `Winner: <@${m.winner}> ✅` : "⏳ Pending"}

`;
  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc);
}

function controlButtons() {
  const final = tournament.matches.length === 1;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(final ? "announce_winner" : "next_round")
      .setLabel(final ? "Announce Winner 🏆" : "Next Round")
      .setStyle(ButtonStyle.Primary)
  );
}

client.login(process.env.TOKEN);
