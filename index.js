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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

let tournament = null;

/* ================= UTIL ================= */

const autoDelete = (msg) =>
  setTimeout(() => msg.delete().catch(() => {}), 1500);

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const isMod = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === MOD_ROLE);

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
    const p1 = `<@${m.p1}>`;
    const p2 = `<@${m.p2}>`;

    const matchTitle = m.winner
      ? `Match ${i + 1} ${TICK}`
      : `Match ${i + 1}`;

    desc += `${matchTitle}
${p1} ${VS} ${p2}
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

function controlRow() {
  const final = tournament.matches.length === 1;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(final ? "announce" : "next")
      .setLabel(final ? "Announce Winner 🏆" : "Next Round")
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

  /* ========= DECORATED HELP ========= */
  if (cmd === "help") {
    const m = await msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff003c")
          .setTitle("🏆 TOURNAMENT CONTROL PANEL")
          .setDescription(`
🎮 **Tournament**
;1v1 size server map name
;start
;qual @player
;qual bye
;code ROOMCODE @player
;del

🛡 **Moderation**
;purge <amount>
;mute @user 1h
;ban @user

🎫 **Tickets**
;ticketpanel add #channel
`)
          .setTimestamp()
      ]
    });
    return autoDelete(m);
  }

  /* ========= MODERATION ========= */

  if (cmd === "purge") {
    if (!isMod(msg.member)) return;
    const amount = parseInt(args[0]);
    if (!amount) return;
    await msg.channel.bulkDelete(amount, true).catch(()=>{});
  }

  if (cmd === "ban") {
    if (!isMod(msg.member)) return;
    const member = msg.mentions.members.first();
    if (!member) return;
    await member.ban().catch(()=>{});
  }

  if (cmd === "mute") {
    if (!isMod(msg.member)) return;

    const member = msg.mentions.members.first();
    const time = args[1];
    if (!member || !time) return;

    let muted = msg.guild.roles.cache.find(r => r.name === "Muted");
    if (!muted) {
      muted = await msg.guild.roles.create({ name: "Muted" });
      msg.guild.channels.cache.forEach(c => {
        c.permissionOverwrites.edit(muted, {
          SendMessages: false,
          AddReactions: false
        });
      });
    }

    await member.roles.add(muted);

    const ms =
      time.endsWith("m") ? parseInt(time) * 60000 :
      time.endsWith("h") ? parseInt(time) * 3600000 :
      time.endsWith("d") ? parseInt(time) * 86400000 : null;

    if (!ms) return;

    setTimeout(() => {
      member.roles.remove(muted).catch(()=>{});
    }, ms);
  }

  /* ========= TICKET PANEL ========= */

  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isMod(msg.member)) return;
    const channel = msg.mentions.channels.first();
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("🎫 SUPPORT TICKET")
      .setDescription("Click below to create a private ticket.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    channel.send({ embeds: [embed], components: [row] });
  }

  /* ========= TOURNAMENT (UNTOUCHED) ========= */

  if (cmd === "del") {
    if (!tournament) return;
    tournament = null;
    const m = await msg.channel.send("Tournament deleted.");
    return autoDelete(m);
  }

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");
    if (!size || !server || !map || !name) return;

    tournament = {
      name,
      maxPlayers: size,
      server,
      map,
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

  if (!tournament) return;

  if (cmd === "start") {
    tournament.matches = [];
    const shuffled = shuffle(tournament.players);
    for (let i = 0; i < shuffled.length; i += 2) {
      tournament.matches.push({
        p1: shuffled[i],
        p2: shuffled[i + 1],
        winner: null
      });
    }

    const bracket = await msg.channel.send({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    tournament.bracketId = bracket.id;
  }

  if (cmd === "qual" && args[0]?.toLowerCase() === "bye") {
    const match = tournament.matches.find(
      m => m.p1.startsWith("BYE") || m.p2.startsWith("BYE")
    );
    if (!match) return;

    match.winner = match.p1.startsWith("BYE")
      ? match.p2
      : match.p1;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "qual") {
    const user = msg.mentions.users.first();
    if (!user) return;

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );
    if (!match) return;

    match.winner = user.id;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  if (cmd === "code") {
    if (!isStaff(msg.member)) return;

    const room = args[0];
    const user = msg.mentions.users.first();
    if (!room || !user) return;

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );
    if (!match) return;

    const opponentId =
      match.p1 === user.id ? match.p2 : match.p1;

    const embed = new EmbedBuilder()
      .setColor("#ff003c")
      .setTitle("🎮 MATCH ROOM")
      .setImage(BANNER)
      .setDescription(`
🏆 ${tournament.name}
Round ${tournament.round}

\`\`\`${room}\`\`\`
🌍 ${tournament.server}
🗺 ${tournament.map}
`);

    await user.send({ embeds: [embed] }).catch(()=>{});
    const opponent = await client.users.fetch(opponentId);
    await opponent.send({ embeds: [embed] }).catch(()=>{});
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  /* ========= TICKET BUTTONS ========= */

  if (i.customId === "create_ticket") {
    const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);
    if (!modRole) return;

    const ticket = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: modRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    ticket.send({ content: `Ticket created for ${i.user}`, components: [row] });

    return i.reply({ content: "Ticket Created!", ephemeral: true });
  }

  if (i.customId === "close_ticket") {
    if (!i.member.roles.cache.some(r => r.name === MOD_ROLE))
      return i.reply({ content: "Moderator Only!", ephemeral: true });

    await i.reply({ content: "Closing...", ephemeral: true });
    setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
  }

  /* ========= TOURNAMENT BUTTONS (UNTOUCHED) ========= */

  if (!tournament) return;

  if (i.customId === "register") {
    if (tournament.players.includes(i.user.id)) return;
    if (tournament.players.length >= tournament.maxPlayers) return;

    tournament.players.push(i.user.id);

    const panel = await i.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    await i.deferUpdate();
  }

  if (i.customId === "unregister") {
    tournament.players = tournament.players.filter(p => p !== i.user.id);

    const panel = await i.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    await i.deferUpdate();
  }

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

    await i.deferUpdate();
  }

  if (i.customId === "announce") {
    const winnerId = tournament.matches[0].winner;
    const user = await client.users.fetch(winnerId);

    const embed = new EmbedBuilder()
      .setColor("#ffd700")
      .setTitle("🏆 TOURNAMENT WINNER 🏆")
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(`Congratulations <@${winnerId}>!`)
      .setImage(BANNER);

    await i.channel.send({ embeds: [embed] });
    tournament = null;
  }
});

client.login(process.env.TOKEN);
