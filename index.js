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
${p1} ${VS} ${p2}
${m.winner ? `Winner: ${m.winner.startsWith("BYE") ? m.winner : `<@${m.winner}>`} ${TICK}` : "⏳ Pending"}

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
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📖 Tournament Bot Commands")
      .setImage(BANNER)
      .addFields(
        { name: "🏆 Tournament", value: "`;1v1 <size> <server> <map> <name>`\n`;start`\n`;bye`\n`;qual @user`\n`;qual bye1`\n`;code <roomcode> @player`", inline: false },
        { name: "🛡 Moderation", value: "`;ban @user`\n`;mute @user 10m`\n`;purge 20`", inline: false },
        { name: "🎫 Tickets", value: "`;ticketpanel add #channel`", inline: false }
      )
      .setTimestamp();

    return msg.channel.send({ embeds: [embed] });
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
    msg.channel.send(`🔨 ${user.user.tag} has been banned.`);
  }

  /* ========= MUTE ========= */
  if (cmd === "mute") {
    if (!isMod(msg.member)) return;

    const member = msg.mentions.members.first();
    const time = args[1];
    if (!member || !time) return;

    let muted = msg.guild.roles.cache.find(r => r.name === "Muted");
    if (!muted) {
      muted = await msg.guild.roles.create({ name: "Muted", permissions: [] });
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

    msg.channel.send(`🔇 ${member.user.tag} muted for ${time}`);
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

    if (i.customId === "create_ticket") {
      const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);
      if (!modRole)
        return i.reply({ content: "Moderator role not found.", ephemeral: true });

      const ticket = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: ticketCategory || null,
        permissionOverwrites: [
          { id: i.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: modRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      await ticket.send({
        embeds: [
          new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🎫 Ticket Opened")
            .setDescription(`${i.user} please describe your issue.`)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("close_ticket")
              .setLabel("Close Ticket")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return i.reply({ content: "✅ Ticket Created!", ephemeral: true });
    }

    if (i.customId === "close_ticket") {
      if (!isMod(i.member))
        return i.reply({ content: "Only Moderator can close tickets.", ephemeral: true });

      await i.reply({ content: "Closing ticket...", ephemeral: true });
      setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
    }
  }
});

client.login(process.env.TOKEN);
