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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

let tournament = null;
let ticketCategory = null;

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

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  /* ========= BYE FILL ========= */
  if (cmd === "bye") {
    if (!tournament) return;
    let count = 1;
    while (tournament.players.length < tournament.maxPlayers) {
      tournament.players.push(`BYE${count}`);
      count++;
    }
    const m = await msg.channel.send("BYE slots filled.");
    return autoDelete(m);
  }

  /* ========= QUAL BYE1 SUPPORT ========= */
  if (cmd === "qual" && args[0]?.toLowerCase().startsWith("bye")) {
    if (!tournament) return;

    const byeName = args[0].toUpperCase();

    const match = tournament.matches.find(
      m => m.p1 === byeName || m.p2 === byeName
    );

    if (!match) return;

    match.winner = byeName;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()],
      components: [controlRow()]
    });

    return;
  }

  /* ========= TICKET PANEL WITH CATEGORY SELECT ========= */
  if (cmd === "ticketpanel" && args[0] === "add") {
    if (!isMod(msg.member)) return;

    const channel = msg.mentions.channels.first();
    if (!channel) return;

    const categories = msg.guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .map(c => ({
        label: c.name,
        value: c.id
      }))
      .slice(0, 25);

    if (!categories.length) return;

    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("Select Ticket Category")
      .addOptions(categories);

    const row = new ActionRowBuilder().addComponents(select);

    channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("🎫 Ticket Setup")
          .setDescription("Select category where tickets should be created.")
      ],
      components: [row]
    });
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  /* ========= CATEGORY SELECT ========= */
  if (i.isStringSelectMenu() && i.customId === "ticket_category_select") {
    ticketCategory = i.values[0];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await i.update({
      embeds: [
        new EmbedBuilder()
          .setColor("#00ff88")
          .setTitle("✅ Ticket Category Set")
          .setDescription("Users can now create tickets.")
      ],
      components: [row]
    });
  }

  /* ========= CREATE TICKET ========= */
  if (i.isButton() && i.customId === "create_ticket") {

    if (!ticketCategory) return;

    const modRole = i.guild.roles.cache.find(r => r.name === MOD_ROLE);
    if (!modRole) return;

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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    ticket.send({
      content: `Ticket created for ${i.user}`,
      components: [row]
    });

    return i.reply({ content: "Ticket Created!", ephemeral: true });
  }

  /* ========= CLOSE TICKET ========= */
  if (i.isButton() && i.customId === "close_ticket") {
    if (!i.member.roles.cache.some(r => r.name === MOD_ROLE))
      return i.reply({ content: "Moderator Only!", ephemeral: true });

    await i.reply({ content: "Closing...", ephemeral: true });
    setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
  }
});

client.login(process.env.TOKEN);
