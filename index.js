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
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.players.length >= tournament.maxPlayers),

    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("count")
      .setLabel(`Players: ${tournament.players.length}/${tournament.maxPlayers}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function bracketEmbed() {
  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {
    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    desc += `Match ${i + 1} ${m.winner ? TICK : ""}
${p1} ${VS} ${p2}

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

  /* ========= MODERATION ========= */

  if (cmd === "purge") {
    if (!isMod(msg.member)) return;
    const amount = parseInt(args[0]);
    if (!amount || amount > 100) return;
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
        }).catch(()=>{});
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

  /* ========= CODE ========= */

  if (cmd === "code") {
    const roomCode = args[0];
    const mentioned = msg.mentions.users.first();
    if (!roomCode || !mentioned) return;

    const match = tournament.matches.find(
      m => m.p1 === mentioned.id || m.p2 === mentioned.id
    );
    if (!match) return;

    const embed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("🎮 Room Code")
      .setDescription(`\`\`\`${roomCode}\`\`\``);

    for (const id of [match.p1, match.p2]) {
      if (!id.startsWith("BYE")) {
        await client.users.fetch(id)
          .then(u => u.send({ embeds: [embed] }))
          .catch(()=>{});
      }
    }
  }

  /* ========= 1V1 ========= */

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

  if (cmd === "bye") {
    let count = 1;
    while (tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(`BYE${count++}`);
    }
  }

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

  if (cmd === "qual") {
    const target = args[0];
    if (!target) return;

    let winner;

    if (target.toLowerCase().startsWith("bye")) {
      winner = target.toUpperCase();
    } else {
      const user = msg.mentions.users.first();
      if (!user) return;
      winner = user.id;
    }

    const match = tournament.matches.find(
      m => m.p1 === winner || m.p2 === winner
    );

    if (!match) return;

    match.winner = winner;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });
  }

  /* ========= TICKET PANEL ========= */

  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isMod(msg.member)) return;

    const channel = msg.mentions.channels.first();
    if (!channel) return;

    const categories = msg.guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .map(c => ({ label: c.name, value: c.id }))
      .slice(0, 25);

    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("Select Ticket Category")
      .addOptions(categories);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("🎫 Ticket Setup")
          .setDescription("Select category where tickets will be created.")
      ],
      components: [new ActionRowBuilder().addComponents(select)]
    });
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  if (i.isStringSelectMenu() && i.customId === "ticket_category_select") {
    ticketCategory = i.values[0];

    await i.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#00ff88")
          .setTitle("🎫 Support Ticket")
          .setDescription("If you want to apply for staff or any enquiry open a ticket.")
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

  if (i.isButton()) {

    if (i.customId === "register") {
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

    if (i.customId === "unregister") {
      tournament.players = tournament.players.filter(p => p !== i.user.id);

      const panel = await i.channel.messages.fetch(tournament.panelId);
      await panel.edit({
        embeds: [registrationEmbed()],
        components: [registrationRow()]
      });

      return i.deferUpdate();
    }

    if (i.customId === "next" && allFinished()) {
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

    if (i.customId === "announce" && allFinished()) {
      const winner = tournament.matches[0].winner;
      await i.channel.send(`🏆 Winner: ${winner.startsWith("BYE") ? winner : `<@${winner}>`}`);
      tournament = null;
    }

    if (i.customId === "create_ticket") {
      const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);
      if (!ticketCategory) return;

      const ticket = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: ticketCategory,
        permissionOverwrites: [
          { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: modRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      ticket.send(`Ticket created for ${i.user}`);
      return i.reply({ content: "Ticket Created!", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
