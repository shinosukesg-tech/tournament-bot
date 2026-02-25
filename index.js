const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const PREFIX = ";";

const BANNER = "https://cdn.discordapp.com/attachments/1471952333209604239/1476249775681835169/brave_screenshot_discord.com.png";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// TOURNAMENT STATE
// =========================
let tournament = {
  mode: null,
  teams: [],
  matches: [],
  started: false,
  round: 1
};

// =========================
// UTILS
// =========================
function createEmbed(title, description, color = "Gold", fields = []) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .addFields(fields)
    .setColor(color)
    .setImage(BANNER);
}

function resetTournament() {
  tournament = {
    mode: null,
    teams: [],
    matches: [],
    started: false,
    round: 1
  };
}

function generateMatches() {
  const shuffled = [...tournament.teams].sort(() => 0.5 - Math.random());
  tournament.matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    tournament.matches.push({
      t1: shuffled[i],
      t2: shuffled[i + 1] || { name: "BYE" },
      winner: null
    });
  }
}

function sendRound(channel) {
  let text = "";
  tournament.matches.forEach((m, i) => {
    text += `Match ${i + 1}: ${m.t1.name} vs ${m.t2.name}\n`;
  });

  channel.send({
    embeds: [
      createEmbed(
        `🏆 Round ${tournament.round}`,
        text,
        "Gold",
        [
          { name: "🎮 Mode", value: tournament.mode, inline: true },
          { name: "👥 Teams Remaining", value: `${tournament.teams.length}`, inline: true }
        ]
      )
    ]
  });
}

function checkRoundComplete(channel) {
  if (!tournament.matches.every(m => m.winner)) return;

  const winners = tournament.matches.map(m =>
    tournament.teams.find(t => t.name === m.winner)
  );

  if (winners.length === 1) {
    channel.send({
      embeds: [
        createEmbed(
          "🏆 TOURNAMENT CHAMPION 🏆",
          `👑 **${winners[0].name}** wins the tournament!`,
          "Purple",
          [
            { name: "🎮 Mode", value: tournament.mode, inline: true },
            { name: "🏁 Total Rounds", value: `${tournament.round}`, inline: true }
          ]
        )
      ]
    });
    return resetTournament();
  }

  tournament.round++;
  tournament.teams = winners;
  generateMatches();
  sendRound(channel);
}

// =========================
// SLASH COMMANDS REGISTER
// =========================
const slashCommands = [
  new SlashCommandBuilder()
    .setName("tournament")
    .setDescription("Register a team")
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("1v1 / 2v2 / 3v3")
        .setRequired(true)
        .addChoices(
          { name: "1v1", value: "1v1" },
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" }
        ))
    .addUserOption(o => o.setName("player1").setRequired(true))
    .addUserOption(o => o.setName("player2"))
    .addUserOption(o => o.setName("player3")),

  new SlashCommandBuilder().setName("players").setDescription("Show teams"),
  new SlashCommandBuilder().setName("start").setDescription("Start tournament"),
  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Report winner")
    .addIntegerOption(o => o.setName("match").setRequired(true))
    .addStringOption(o => o.setName("winner").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rematch")
    .setDescription("Reset a match")
    .addIntegerOption(o => o.setName("match").setRequired(true)),
  new SlashCommandBuilder().setName("end").setDescription("Reset tournament")
].map(cmd => cmd.toJSON());

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });

  console.log("✅ Slash commands registered.");
});

// =========================
// CORE LOGIC FUNCTION
// =========================
function registerTeam(mode, players, channel) {

  if (tournament.started)
    return channel.send("Tournament already started!");

  if (!tournament.mode) tournament.mode = mode;
  if (tournament.mode !== mode)
    return channel.send(`Tournament already set to ${tournament.mode}`);

  for (const team of tournament.teams) {
    for (const p of players) {
      if (team.players.includes(p.id))
        return channel.send("One of these players is already registered.");
    }
  }

  const teamName = players.map(p => p.username).join(" & ");

  tournament.teams.push({
    name: teamName,
    players: players.map(p => p.id)
  });

  channel.send({
    embeds: [
      createEmbed(
        "🎫 Team Registered",
        `**${teamName}** joined!`,
        "Green",
        [
          { name: "🎮 Mode", value: tournament.mode, inline: true },
          { name: "👥 Total Teams", value: `${tournament.teams.length}`, inline: true }
        ]
      )
    ]
  });
}

// =========================
// PREFIX COMMANDS
// =========================
client.on("messageCreate", async message => {

  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "tournament") {
    const mode = args[0];
    if (!["1v1", "2v2", "3v3"].includes(mode))
      return message.reply("Usage: ;tournament 1v1|2v2|3v3 @players");

    const mentions = [...message.mentions.users.values()];
    return registerTeam(mode, mentions, message.channel);
  }

  if (cmd === "players") {
    if (!tournament.teams.length) return message.reply("No teams.");
    const list = tournament.teams.map((t,i)=>`${i+1}. ${t.name}`).join("\n");
    return message.channel.send({ embeds: [createEmbed("👥 Teams", list, "Blue")]});
  }

  if (cmd === "start") {
    if (tournament.teams.length < 2)
      return message.reply("Not enough teams.");
    tournament.started = true;
    tournament.round = 1;
    generateMatches();
    return sendRound(message.channel);
  }

  if (cmd === "report") {
    const matchNum = parseInt(args[0]);
    const winner = args.slice(1).join(" ");
    const match = tournament.matches[matchNum - 1];
    if (!match) return message.reply("Invalid match.");
    match.winner = winner;
    return checkRoundComplete(message.channel);
  }

  if (cmd === "rematch") {
    const matchNum = parseInt(args[0]);
    const match = tournament.matches[matchNum - 1];
    if (!match) return message.reply("Invalid match.");
    match.winner = null;
    return message.channel.send("🔁 Match reset.");
  }

  if (cmd === "end") {
    resetTournament();
    return message.channel.send("🏁 Tournament reset.");
  }

});

// =========================
// SLASH COMMANDS
// =========================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "tournament") {
    const mode = interaction.options.getString("mode");
    const players = [
      interaction.options.getUser("player1"),
      interaction.options.getUser("player2"),
      interaction.options.getUser("player3")
    ].filter(Boolean);

    registerTeam(mode, players, interaction.channel);
    return interaction.reply({ content: "Team registered!", ephemeral: true });
  }

  if (interaction.commandName === "players") {
    if (!tournament.teams.length)
      return interaction.reply("No teams.");

    const list = tournament.teams.map((t,i)=>`${i+1}. ${t.name}`).join("\n");

    return interaction.reply({
      embeds: [createEmbed("👥 Teams", list, "Blue")]
    });
  }

  if (interaction.commandName === "start") {
    tournament.started = true;
    tournament.round = 1;
    generateMatches();
    sendRound(interaction.channel);
    return interaction.reply({ content: "Tournament started!", ephemeral: true });
  }

  if (interaction.commandName === "report") {
    const matchNum = interaction.options.getInteger("match");
    const winner = interaction.options.getString("winner");
    const match = tournament.matches[matchNum - 1];
    if (!match) return interaction.reply("Invalid match.");
    match.winner = winner;
    checkRoundComplete(interaction.channel);
    return interaction.reply({ content: "Winner recorded!", ephemeral: true });
  }

  if (interaction.commandName === "rematch") {
    const matchNum = interaction.options.getInteger("match");
    const match = tournament.matches[matchNum - 1];
    if (!match) return interaction.reply("Invalid match.");
    match.winner = null;
    return interaction.reply("🔁 Match reset.");
  }

  if (interaction.commandName === "end") {
    resetTournament();
    return interaction.reply("🏁 Tournament reset.");
  }

});

client.login(TOKEN);
