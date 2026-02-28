require("dotenv").config();

/* ================= UPTIME SERVER ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT);
/* ================================================= */

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

const parseTime = (time) => {
  const num = parseInt(time);
  if (time.endsWith("m")) return num * 60 * 1000;
  if (time.endsWith("h")) return num * 60 * 60 * 1000;
  if (time.endsWith("d")) return num * 24 * 60 * 60 * 1000;
  return null;
};

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} Online`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ================= PURGE ================= */
  if (cmd === "purge") {
    if (!isMod(msg.member)) return;
    const amount = parseInt(args[0]);
    if (!amount) return;
    await msg.channel.bulkDelete(amount, true).catch(()=>{});
    autoDelete(msg);
  }

  /* ================= MUTE ================= */
  if (cmd === "mute") {
    if (!isMod(msg.member)) return;

    const member = msg.mentions.members.first();
    const time = args[1];
    if (!member || !time) return;

    let mutedRole = msg.guild.roles.cache.find(r => r.name === "Muted");

    if (!mutedRole) {
      mutedRole = await msg.guild.roles.create({
        name: "Muted",
        permissions: []
      });

      msg.guild.channels.cache.forEach(channel => {
        channel.permissionOverwrites.edit(mutedRole, {
          SendMessages: false,
          AddReactions: false
        });
      });
    }

    await member.roles.add(mutedRole);

    const duration = parseTime(time);
    if (!duration) return;

    setTimeout(() => {
      member.roles.remove(mutedRole).catch(()=>{});
    }, duration);

    autoDelete(msg);
  }

  /* ================= BAN ================= */
  if (cmd === "ban") {
    if (!isMod(msg.member)) return;

    const member = msg.mentions.members.first();
    if (!member) return;

    await member.ban().catch(()=>{});
    autoDelete(msg);
  }

  /* ================= TICKET PANEL ================= */
  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isMod(msg.member)) return;

    const channel = msg.mentions.channels.first();
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("🎫 Support Ticket")
      .setDescription("Click the button below to create a private ticket.")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    channel.send({ embeds: [embed], components: [row] });
    autoDelete(msg);
  }

  /* ================= QUAL BYE ================= */
  if (cmd === "qual" && args[0]?.toLowerCase() === "bye") {
    if (!isStaff(msg.member)) return;
    if (!tournament) return;

    const match = tournament.matches.find(
      m => m.p1.startsWith("BYE") || m.p2.startsWith("BYE")
    );

    if (!match) return;

    match.winner = match.p1.startsWith("BYE")
      ? match.p2
      : match.p1;

    autoDelete(msg);
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  /* ================= CREATE TICKET ================= */
  if (interaction.customId === "create_ticket") {
    const guild = interaction.guild;
    const modRole = guild.roles.cache.find(r => r.name === MOD_ROLE);

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: modRole.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    channel.send({
      content: `Ticket created for ${interaction.user}`,
      components: [closeRow]
    });

    interaction.reply({ content: "Ticket created!", ephemeral: true });
  }

  /* ================= CLOSE TICKET ================= */
  if (interaction.customId === "close_ticket") {
    if (!interaction.member.roles.cache.some(r => r.name === MOD_ROLE)) {
      return interaction.reply({
        content: "Only Moderator can close tickets.",
        ephemeral: true
      });
    }

    await interaction.reply({ content: "Closing ticket...", ephemeral: true });

    setTimeout(() => {
      interaction.channel.delete().catch(()=>{});
    }, 2000);
  }
});

client.login(process.env.TOKEN);
