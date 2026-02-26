require("dotenv").config();

/* ================= UPTIME SERVER ================= */
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
});
/* ================================================= */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Staff";
const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1350446868064374845/Event_Background_BlockDash.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= STATE ================= */

let tournament = null;

/* ================= UTIL ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function createTournament(size, server, map) {
  return {
    maxPlayers: size,
    server,
    map,
    players: [],
    matches: [],
    started: false,
    panelId: null,
    channelId: null
  };
}

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const size = nextPowerOfTwo(shuffled.length);

  while (shuffled.length < size) shuffled.push(null);

  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i];
    const p2 = shuffled[i + 1];

    if (p1 && !p2)
      matches.push({ p1, p2: null, winner: p1 }); // BYE
    else
      matches.push({ p1, p2, winner: null });
  }

  return matches;
}

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinTours Tournament")
    .setDescription(`
━━━━━━━━━━━━━━━━━━
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
📌 Status: **${tournament.started ? "Started" : "Open Registration"}**
━━━━━━━━━━━━━━━━━━
`)
    .setImage(BANNER);
}

function bracketEmbed() {
  let desc = `🏆 ShinTours Bracket\n━━━━━━━━━━━━━━━━━━\n`;

  tournament.matches.forEach((m, i) => {
    desc += `⚔️ Match ${i + 1}\n`;

    if (!m.p2) {
      desc += `🆓 <@${m.p1}> (BYE)\n\n`;
    } else {
      desc += `<@${m.p1}> vs <@${m.p2}>\n\n`;
    }
  });

  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= BUTTONS ================= */

function mainButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register_btn")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("start_btn")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
  );
}

function unregisterConfirmButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_unregister_btn")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger)
  );
}

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  await msg.delete().catch(() => {});

  if (cmd === "1v1") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (tournament)
      return msg.channel.send("⚠️ Tournament already exists.");

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args.slice(2).join(" ");

    if (!size || !server || !map)
      return msg.channel.send("Usage: ;1v1 <players> <server> <map>");

    tournament = createTournament(size, server, map);

    const panel = await msg.channel.send({
      embeds: [registrationEmbed()],
      components: [mainButtons()]
    });

    tournament.panelId = panel.id;
    tournament.channelId = msg.channel.id;
  }

  if (cmd === "del") {
    if (!isStaff(msg.member))
      return msg.channel.send("❌ Staff only.");

    if (!tournament)
      return msg.channel.send("❌ No tournament running.");

    try {
      const channel = await client.channels.fetch(tournament.channelId);
      const panel = await channel.messages.fetch(tournament.panelId);
      await panel.delete().catch(() => {});
    } catch {}

    tournament = null;

    return msg.channel.send("🗑 Tournament deleted successfully.");
  }
});

/* ================= BUTTON HANDLER (SINGLE LISTENER) ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (!tournament)
    return interaction.reply({ content: "❌ No tournament running.", ephemeral: true });

  /* REGISTER */
  if (interaction.customId === "register_btn") {

    if (tournament.started)
      return interaction.reply({ content: "❌ Tournament already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You are already registered.\nDo you want to unregister?",
        components: [unregisterConfirmButton()],
        ephemeral: true
      });
    }

    if (tournament.players.length >= tournament.maxPlayers)
      return interaction.reply({ content: "❌ Tournament full.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    await interaction.reply({
      content: "✅ Successfully registered!",
      ephemeral: true
    });

    const channel = await client.channels.fetch(tournament.channelId);
    const panel = await channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [mainButtons()]
    });
  }

  /* CONFIRM UNREGISTER */
  if (interaction.customId === "confirm_unregister_btn") {

    tournament.players = tournament.players.filter(
      id => id !== interaction.user.id
    );

    await interaction.update({
      content: "✅ You have been unregistered.",
      components: [],
      embeds: []
    });

    const channel = await client.channels.fetch(tournament.channelId);
    const panel = await channel.messages.fetch(tournament.panelId);

    await panel.edit({
      embeds: [registrationEmbed()],
      components: [mainButtons()]
    });
  }

  /* START */
  if (interaction.customId === "start_btn") {

    if (!isStaff(interaction.member))
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    await interaction.update({
      embeds: [bracketEmbed()],
      components: []
    });
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
