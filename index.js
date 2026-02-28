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
  ChannelType,
  StringSelectMenuBuilder
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

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const shuffle = (arr) =>
  [...arr].sort(() => Math.random() - 0.5);

const allFinished = () =>
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
`)
    .setTimestamp();
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
      .setCustomId("count")
      .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
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
${p1} ${VS} ${p2}
${m.winner ? TICK + " COMPLETE" : "⏳ Pending"}

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
      .setLabel(final ? "Winner Announce 🏆" : "Next Round")
      .setStyle(final ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(!allFinished())
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  await msg.delete().catch(()=>{});

  /* ===== START ===== */
  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    if (tournament) return msg.channel.send("Tournament already running.");

    const max = parseInt(args[0]);
    if (!max) return msg.channel.send("Usage: ;start <players>");

    tournament = {
      name: "Tournament",
      server: "Custom",
      map: "Default",
      maxPlayers: max,
      players: [],
      matches: [],
      round: 1,
      panelId: null,
      bracketId: null
    };

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    tournament.panelId = panel.id;
  }

  /* ===== BEGIN BRACKET ===== */
  if (cmd === "begin") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return;

    let players = shuffle(tournament.players);

    if (players.length % 2 !== 0) {
      players.push("BYE1");
    }

    tournament.matches = [];

    for (let i = 0; i < players.length; i += 2) {
      tournament.matches.push({
        p1: players[i],
        p2: players[i + 1],
        winner: null
      });
    }

    const bracket = await msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    tournament.bracketId = bracket.id;
  }

  /* ===== QUAL (WITH BYE SUPPORT) ===== */
  if (cmd === "qual") {
    if (!tournament) return;

    const input = args[0];

    if (input && input.toLowerCase().startsWith("bye")) {
      const match = tournament.matches.find(
        m => m.p1 === input || m.p2 === input
      );
      if (!match) return;

      match.winner = input;
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;

      const match = tournament.matches.find(
        m => m.p1 === user.id || m.p2 === user.id
      );
      if (!match) return;

      match.winner = user.id;
    }

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  /* ===== TICKET PANEL ===== */
  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isStaff(msg.member)) return;

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎫 Support & Staff Application")
      .setDescription("For Staff Application and support, Create a ticket with the button below<:shinchan_sips:1465048892876783820>");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    msg.channel.send({ embeds: [embed], components: [row] });
  }

});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  /* REGISTER */
  if (i.customId === "register") {
    if (!tournament) return i.reply({ content: "No tournament.", ephemeral: true });

    if (!tournament.players.includes(i.user.id) &&
        tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(i.user.id);
    }

    const panel = await i.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    return i.deferUpdate();
  }

  /* UNREGISTER */
  if (i.customId === "unregister") {
    if (!tournament) return i.reply({ content: "No tournament.", ephemeral: true });

    tournament.players = tournament.players.filter(p => p !== i.user.id);

    const panel = await i.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    return i.deferUpdate();
  }

  /* NEXT ROUND */
  if (i.customId === "next") {
    const winners = tournament.matches.map(m => m.winner);
    tournament.round++;
    tournament.matches = [];

    for (let x = 0; x < winners.length; x += 2) {
      tournament.matches.push({
        p1: winners[x],
        p2: winners[x + 1],
        winner: null
      });
    }

    const bracket = await i.channel.messages.fetch(tournament.bracketId);
    await bracket.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    return i.deferUpdate();
  }

  /* ANNOUNCE */
  if (i.customId === "announce") {
    const winnerId = tournament.matches[0].winner;
    const winnerUser = await client.users.fetch(winnerId);

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🏆 TOURNAMENT WINNER 🏆")
      .setThumbnail(winnerUser.displayAvatarURL({ dynamic: true }))
      .setImage(BANNER)
      .setDescription(`🎉 Congratulations <@${winnerId}>`);

    await i.channel.send({ embeds: [embed] });

    tournament = null;

    return i.deferUpdate();
  }

  /* CREATE TICKET */
  if (i.customId === "create_ticket") {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: i.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: i.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: i.guild.roles.cache.find(r => r.name === MOD_ROLE)?.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    channel.send(`Ticket created by <@${i.user.id}>`);
    return i.reply({ content: "Ticket created!", ephemeral: true });
  }

});

client.login(process.env.TOKEN);
