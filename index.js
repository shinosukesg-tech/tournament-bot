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
let ticketCategory = null;

/* ================= UTIL ================= */

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const isMod = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === MOD_ROLE);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const allFinished = () =>
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
      .setStyle(ButtonStyle.Danger)
  );
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    desc += `Match ${i + 1}
${p1}  🆚  ${p2}
${m.winner ? `Winner: ${m.winner.startsWith("BYE") ? m.winner : `<@${m.winner}>`} ✅` : "⏳ Pending"}

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
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!allFinished())
  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

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
          .addFields(
            { name: "🏆 Tournament", value: "`;1v1 <size> <server> <map> <name>`\n`;start`\n`;qual @user`\n`;qual bye1`", inline: false },
            { name: "🛡 Moderation", value: "`;ban @user`\n`;mute @user 10m`\n`;purge 20`", inline: false },
            { name: "🎫 Tickets", value: "`;ticketpanel add #channel`", inline: false }
          )
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
    if (!isStaff(msg.member) || !tournament) return;
    if (tournament.players.length < 2) return;

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

  /* ========= PURGE ========= */
  if (cmd === "purge") {
    if (!isMod(msg.member)) return;
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) return;
    await msg.channel.bulkDelete(amount, true).catch(()=>{});
  }

  /* ========= BAN ========= */
  if (cmd === "ban") {
    if (!isMod(msg.member)) return;
    const user = msg.mentions.members.first();
    if (!user) return;
    await user.ban().catch(()=>{});
    msg.channel.send(`🔨 ${user.user.tag} banned.`);
  }

  /* ========= MUTE ========= */
  if (cmd === "mute") {
    if (!isMod(msg.member)) return;
    const member = msg.mentions.members.first();
    const time = args[1];
    if (!member || !time) return;

    let muted = msg.guild.roles.cache.find(r => r.name === "Muted");
    if (!muted)
      muted = await msg.guild.roles.create({ name: "Muted", permissions: [] });

    await member.roles.add(muted);

    const ms =
      time.endsWith("m") ? parseInt(time) * 60000 :
      time.endsWith("h") ? parseInt(time) * 3600000 :
      time.endsWith("d") ? parseInt(time) * 86400000 : null;

    if (!ms) return;

    setTimeout(() => member.roles.remove(muted).catch(()=>{}), ms);
  }

  /* ========= TICKET PANEL ========= */
  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isMod(msg.member)) return;
    const channel = msg.mentions.channels.first();
    if (!channel) return;

    channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("🎫 Support & Applications")
          .setDescription("For Staff Application and support, Create a ticket with the button below")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("create_ticket")
            .setLabel("Create Ticket")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  if (i.isButton()) {

    /* REGISTER */
    if (i.customId === "register") {
      if (!tournament) return i.reply({ content: "No active tournament.", ephemeral: true });
      if (tournament.players.includes(i.user.id))
        return i.reply({ content: "Already registered.", ephemeral: true });
      if (tournament.players.length >= tournament.maxPlayers)
        return i.reply({ content: "Tournament full.", ephemeral: true });

      tournament.players.push(i.user.id);
      await i.update({ embeds: [registrationEmbed()], components: [registrationRow()] });
    }

    /* UNREGISTER */
    if (i.customId === "unregister") {
      tournament.players = tournament.players.filter(p => p !== i.user.id);
      await i.update({ embeds: [registrationEmbed()], components: [registrationRow()] });
    }

    /* NEXT ROUND */
    if (i.customId === "next") {
      if (!isStaff(i.member) || !allFinished()) return;

      const winners = tournament.matches.map(m => m.winner);
      tournament.round++;
      tournament.matches = [];

      for (let i = 0; i < winners.length; i += 2) {
        tournament.matches.push({
          p1: winners[i],
          p2: winners[i + 1] || `BYE${i}`,
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

      const finalMatch = tournament.matches[0];
      const winnerUser = await client.users.fetch(finalMatch.winner);

      await i.update({
        embeds: [
          new EmbedBuilder()
            .setColor("Gold")
            .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
            .setThumbnail(winnerUser.displayAvatarURL({ size: 512 }))
            .setImage(winnerUser.displayAvatarURL({ size: 1024 }))
            .setDescription(`👑 Congratulations <@${winnerUser.id}>!\n\nYou are the champion of **${tournament.name}**`)
        ],
        components: []
      });

      tournament = null;
    }

    /* CREATE TICKET */
    if (i.customId === "create_ticket") {
      const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);
      if (!modRole) return i.reply({ content: "Moderator role not found.", ephemeral: true });

      const ticket = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: modRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      await ticket.send({
        embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("🎫 Ticket Opened")],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("close_ticket")
              .setLabel("Close Ticket")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      i.reply({ content: "Ticket Created!", ephemeral: true });
    }

    /* CLOSE TICKET */
    if (i.customId === "close_ticket") {
      if (!isMod(i.member))
        return i.reply({ content: "Only Moderator can close tickets.", ephemeral: true });

      await i.reply({ content: "Closing...", ephemeral: true });
      setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
    }
  }
});

client.login(process.env.TOKEN);
