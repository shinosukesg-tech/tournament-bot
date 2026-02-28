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
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.players.length >= tournament.maxPlayers),
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

  /* ========= MODERATION ========= */

  if (cmd === "purge") {
    if (!isMod(msg.member)) return;
    const amount = parseInt(args[0]);
    if (!amount || amount > 100) return;
    await msg.channel.bulkDelete(amount, true).catch(()=>{});
  }

  if (cmd === "mute") {
    if (!isMod(msg.member)) return;
    const member = msg.mentions.members.first();
    const time = args[1];
    if (!member || !time) return;

    let muted = msg.guild.roles.cache.find(r => r.name === "Muted");
    if (!muted) muted = await msg.guild.roles.create({ name: "Muted" });

    await member.roles.add(muted);

    const ms =
      time.endsWith("m") ? parseInt(time) * 60000 :
      time.endsWith("h") ? parseInt(time) * 3600000 : null;

    if (!ms) return;
    setTimeout(() => member.roles.remove(muted).catch(()=>{}), ms);
  }

  /* ========= TICKET PANEL ========= */

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

  /* ========= TOURNAMENT ========= */

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

  if (cmd === "qual" && args[0]?.toLowerCase().startsWith("bye")) {
    const bye = args[0].toUpperCase();
    const match = tournament.matches.find(m => m.p1 === bye || m.p2 === bye);
    if (!match) return;
    match.winner = bye;
  }

  if (cmd === "code") {
    const roomCode = args[0];
    const mentioned = msg.mentions.users.first();
    if (!roomCode || !mentioned) return;

    const match = tournament.matches.find(
      m => m.p1 === mentioned.id || m.p2 === mentioned.id
    );
    if (!match) return;

    const opponent1 = match.p1.startsWith("BYE") ? null : match.p1;
    const opponent2 = match.p2.startsWith("BYE") ? null : match.p2;

    const embed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("🎮 Room Code")
      .setDescription(`Room Code: **${roomCode}**`);

    if (opponent1) await client.users.fetch(opponent1).then(u=>u.send({embeds:[embed]})).catch(()=>{});
    if (opponent2) await client.users.fetch(opponent2).then(u=>u.send({embeds:[embed]})).catch(()=>{});
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {

  if (i.isButton() && i.customId === "register") {
    if (tournament.players.includes(i.user.id)) 
      return i.reply({ content: "Already registered.", ephemeral: true });

    if (tournament.players.length >= tournament.maxPlayers)
      return i.reply({ content: "Tournament Full.", ephemeral: true });

    tournament.players.push(i.user.id);

    const panel = await i.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [registrationEmbed()], components: [registrationRow()] });

    return i.reply({ content: "Registered!", ephemeral: true });
  }

  if (i.isButton() && i.customId === "unregister") {
    tournament.players = tournament.players.filter(p => p !== i.user.id);

    const panel = await i.channel.messages.fetch(tournament.panelId);
    await panel.edit({ embeds: [registrationEmbed()], components: [registrationRow()] });

    return i.reply({ content: "Unregistered!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
