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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= TOURNAMENT DATA ================= */

let tournament = null;

/* ================= UTIL ================= */

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const isMod = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === MOD_ROLE);

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(() => {});

  /* ========= CREATE TOURNAMENT ========= */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return;

    if (args.length < 4)
      return msg.channel.send("Usage: ;1v1 <size> <server> <map> <name>");

    const size = parseInt(args[0]);
    if (isNaN(size) || size < 2)
      return msg.channel.send("Invalid player size.");

    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ");

    tournament = {
      name,
      server,
      map,
      max: size,
      players: []
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
`)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("unregister")
        .setLabel("Unregister")
        .setStyle(ButtonStyle.Danger)
    );

    msg.channel.send({ embeds: [embed], components: [row] });
  }

  /* ========= TICKET PANEL ========= */
  if (cmd === "ticketpanel") {
    if (!isMod(msg.member)) return;

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🎫 Support & Applications")
      .setDescription("Select ticket category below:");

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_category")
        .setPlaceholder("Select Ticket Type")
        .addOptions([
          { label: "Support", value: "support" },
          { label: "Staff Application", value: "application" },
          { label: "Report Player", value: "report" }
        ])
    );

    msg.channel.send({ embeds: [embed], components: [menu] });
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  /* ========= REGISTER BUTTON ========= */
  if (i.isButton()) {

    if (i.customId === "register") {
      if (!tournament) return;

      if (tournament.players.includes(i.user.id))
        return i.reply({ content: "Already registered.", ephemeral: true });

      if (tournament.players.length >= tournament.max)
        return i.reply({ content: "Tournament Full.", ephemeral: true });

      tournament.players.push(i.user.id);
      return i.reply({ content: "Registered successfully!", ephemeral: true });
    }

    if (i.customId === "unregister") {
      if (!tournament) return;

      tournament.players = tournament.players.filter(p => p !== i.user.id);
      return i.reply({ content: "Unregistered.", ephemeral: true });
    }

    /* ========= CLAIM TICKET ========= */
    if (i.customId === "claim_ticket") {
      if (!isMod(i.member))
        return i.reply({ content: "Only moderators can claim.", ephemeral: true });

      await i.channel.setName(`claimed-${i.channel.name}`);
      return i.reply({ content: "Ticket claimed!", ephemeral: true });
    }

    /* ========= CLOSE TICKET ========= */
    if (i.customId === "close_ticket") {
      if (!isMod(i.member))
        return i.reply({ content: "Only moderators can close.", ephemeral: true });

      await i.reply({ content: "Closing ticket...", ephemeral: true });
      setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
    }
  }

  /* ========= CATEGORY SELECT ========= */
  if (i.isStringSelectMenu()) {
    if (i.customId === "ticket_category") {

      const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);
      if (!modRole)
        return i.reply({ content: "Moderator role missing.", ephemeral: true });

      const categoryName = i.values[0];

      let category = i.guild.channels.cache.find(
        c => c.name === categoryName && c.type === ChannelType.GuildCategory
      );

      if (!category) {
        category = await i.guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory
        });
      }

      const ticket = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
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
            .setDescription(`${i.user} please explain your issue.`)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("claim_ticket")
              .setLabel("Claim")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("close_ticket")
              .setLabel("Close")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      return i.reply({ content: "Ticket created!", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
