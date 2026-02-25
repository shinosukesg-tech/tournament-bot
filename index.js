const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const PREFIX = ";";
const BANNER_URL = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png?ex=69a0940f&is=699f428f&hm=5d8bc";

let tournament = {
  mode: null,
  players: [],
  teams: [],
  matches: [],
  winners: [],
  started: false,
  round: 1,
  messageId: null
};

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function createMatchesFromTeams(teamList) {
  const matches = [];
  const shuffled = [...teamList];

  while (shuffled.length >= 2) {
    matches.push({
      team1: shuffled.shift(),
      team2: shuffled.shift()
    });
  }
  return matches;
}

function buildEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff99")
    .setImage(BANNER_URL)
    .setTitle(`🏆 XNZ ${tournament.mode?.toUpperCase()} TOURNAMENT`)
    .setDescription(`
🔥 Mode: **${tournament.mode?.toUpperCase()}**
👥 Registered: **${tournament.players.length}**
🏁 Status: **${tournament.started ? "Started" : "Waiting"}**
`);
}

function buildButtons(disableStart = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.started),

    new ButtonBuilder()
      .setCustomId("players")
      .setLabel(`Players: ${tournament.players.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disableStart || tournament.started)
  );
}

client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

/* ================= COMMANDS ================= */
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const cmd = msg.content.slice(PREFIX.length).toLowerCase();

  if (["1v1", "2v2", "3v3"].includes(cmd)) {

    if (!isAdmin(msg.member)) return msg.reply("Admin only.");

    tournament = {
      mode: cmd,
      players: [],
      teams: [],
      matches: [],
      winners: [],
      started: false,
      round: 1,
      messageId: null
    };

    const sent = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.messageId = sent.id;
  }
});

/* ================= BUTTON HANDLER ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  /* ===== REGISTER ===== */
  if (interaction.customId === "register") {

    if (tournament.started)
      return interaction.reply({ content: "Tournament already started.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const message = await interaction.channel.messages.fetch(tournament.messageId);

    await message.edit({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    return interaction.reply({
      content: "✅ Registered successfully!",
      ephemeral: true
    });
  }

  /* ===== START ===== */
  if (interaction.customId === "start") {

    if (!isAdmin(interaction.member))
      return interaction.reply({ content: "Only Administrator can start.", ephemeral: true });

    if (tournament.players.length < 2)
      return interaction.reply({ content: "Not enough players.", ephemeral: true });

    if (tournament.mode === "1v1") {
      tournament.teams = tournament.players.map(p => [p]);
    } else {
      tournament.teams = [];
      const size = tournament.mode === "2v2" ? 2 : 3;

      for (let i = 0; i < tournament.players.length; i += size) {
        tournament.teams.push(tournament.players.slice(i, i + size));
      }
    }

    tournament.matches = createMatchesFromTeams(tournament.teams);
    tournament.started = true;
    tournament.round = 1;

    const message = await interaction.channel.messages.fetch(tournament.messageId);

    await message.edit({
      embeds: [buildEmbed()],
      components: [buildButtons(true)]
    });

    interaction.reply("🔥 Tournament Started!");
  }
});

client.login(process.env.TOKEN)
