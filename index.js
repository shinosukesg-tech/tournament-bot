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

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await msg.delete().catch(()=>{});

  if (cmd === "1v1") {

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

  if (cmd === "qual") {

    if (!tournament) return;

    const input = args[0];

    if (input && input.toLowerCase().startsWith("bye")) {

      const match = tournament.matches.find(
        m => m.p1 === input || m.p2 === input
      );

      if (!match) return;

      match.winner = input;

      const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
      await bracketMsg.edit({
        embeds: [bracketEmbed()]
      });

      return;
    }

    const user = msg.mentions.users.first();
    if (!user) return;

    const match = tournament.matches.find(
      m => m.p1 === user.id || m.p2 === user.id
    );
    if (!match) return;

    match.winner = user.id;

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);
    await bracketMsg.edit({
      embeds: [bracketEmbed()]
    });
  }
});

/* ================= BUTTON FIX (IMPORTANT) ================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;
  if (!tournament) return interaction.reply({ content: "No tournament.", ephemeral: true });

  /* REGISTER */
  if (interaction.customId === "register") {

    if (!tournament.players.includes(interaction.user.id) &&
        tournament.players.length < tournament.maxPlayers) {

      tournament.players.push(interaction.user.id);

      const panel = await interaction.channel.messages.fetch(tournament.panelId);
      await panel.edit({
        embeds: [registrationEmbed()],
        components: [registrationRow()]
      });
    }

    return interaction.deferUpdate();
  }

  /* UNREGISTER FIXED */
  if (interaction.customId === "unregister") {

    tournament.players = tournament.players.filter(
      p => p !== interaction.user.id
    );

    const panel = await interaction.channel.messages.fetch(tournament.panelId);
    await panel.edit({
      embeds: [registrationEmbed()],
      components: [registrationRow()]
    });

    return interaction.deferUpdate();
  }

});

client.login(process.env.TOKEN);
