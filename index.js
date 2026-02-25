const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

const prefix = ";";
const HOST_ROLE_NAME = "Tournament Host";

let tournament = {
  mode: null,
  teamSize: 1,
  teams: [],
  matches: [],
  started: false,
  round: 1
};

let panelMessage = null;

/* ================= PERMISSION CHECK ================= */

function isStaff(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.some(r => r.name === HOST_ROLE_NAME)
  );
}

/* ================= CREATE TOURNAMENT ================= */

function createTournament(mode) {
  tournament = {
    mode,
    teamSize: parseInt(mode[0]),
    teams: [],
    matches: [],
    started: false,
    round: 1
  };
}

/* ================= GENERATE MATCHES ================= */

function generateMatches() {
  const shuffled = [...tournament.teams].sort(() => Math.random() - 0.5);
  tournament.matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    if (!shuffled[i + 1]) break;

    tournament.matches.push({
      team1: shuffled[i],
      team2: shuffled[i + 1]
    });
  }
}

/* ================= ADVANCE ROUND ================= */

function advanceRound(channel) {
  if (tournament.teams.length <= 1) {
    const winner = tournament.teams[0];
    channel.send(`🏆 TOURNAMENT WINNER: <@${winner[0]}>`);
    tournament.started = false;
    return;
  }

  tournament.round++;
  generateMatches();
  announceMatches(channel);
}

/* ================= ANNOUNCE MATCHES ================= */

function announceMatches(channel) {
  let msg = `\n🏆 ROUND ${tournament.round}\n`;

  tournament.matches.forEach((m, i) => {
    msg += `Match ${i + 1}: `;
    msg += `${m.team1.map(id => `<@${id}>`).join(", ")}`;
    msg += ` vs `;
    msg += `${m.team2.map(id => `<@${id}>`).join(", ")}`;
    msg += `\n`;
  });

  channel.send(msg);
}

/* ================= REGISTRATION PANEL ================= */

async function sendPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${tournament.mode || "No"} Tournament`)
    .setDescription(`👥 Registered Teams: ${tournament.teams.length}`)
    .setColor("Gold");

  const buttons = [];

  if (tournament.mode === "1v1") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("register1v1")
        .setLabel("Register")
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId("counter")
      .setLabel(`Teams: ${tournament.teams.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success)
  );

  const row = new ActionRowBuilder().addComponents(buttons);

  if (!panelMessage) {
    panelMessage = await channel.send({ embeds: [embed], components: [row] });
  } else {
    await panelMessage.edit({ embeds: [embed], components: [row] });
  }
}

/* ================= MESSAGE COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* CREATE TOURNAMENT */
  if (cmd === "tournament") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const mode = args[0];
    if (!["1v1", "2v2", "3v3"].includes(mode))
      return msg.reply("Use 1v1 / 2v2 / 3v3");

    createTournament(mode);
    return sendPanel(msg.channel);
  }

  /* REGISTER 2v2 */
  if (cmd === "register2v2") {
    if (tournament.mode !== "2v2") return msg.reply("No 2v2 active.");
    if (tournament.started) return msg.reply("Tournament started.");

    if (msg.mentions.users.size !== 2)
      return msg.reply("Mention 2 players.");

    const ids = [...msg.mentions.users.values()].map(u => u.id);

    if (ids.some(id => tournament.teams.flat().includes(id)))
      return msg.reply("Player already registered.");

    tournament.teams.push(ids);
    await sendPanel(msg.channel);
    return msg.channel.send("✅ 2v2 Team Registered.");
  }

  /* REGISTER 3v3 */
  if (cmd === "register3v3") {
    if (tournament.mode !== "3v3") return msg.reply("No 3v3 active.");
    if (tournament.started) return msg.reply("Tournament started.");

    if (msg.mentions.users.size !== 3)
      return msg.reply("Mention 3 players.");

    const ids = [...msg.mentions.users.values()].map(u => u.id);

    if (ids.some(id => tournament.teams.flat().includes(id)))
      return msg.reply("Player already registered.");

    tournament.teams.push(ids);
    await sendPanel(msg.channel);
    return msg.channel.send("✅ 3v3 Team Registered.");
  }

  /* QUALIFY */
  if (cmd === "qualify") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");
    if (!tournament.started) return msg.reply("Tournament not started.");

    const user = msg.mentions.users.first();
    if (!user) return msg.reply("Mention player.");

    const match = tournament.matches.find(m =>
      m.team1.includes(user.id) || m.team2.includes(user.id)
    );

    if (!match) return msg.reply("Player not in match.");

    const winningTeam =
      match.team1.includes(user.id) ? match.team1 : match.team2;

    tournament.teams = tournament.teams.filter(team =>
      team !== match.team1 && team !== match.team2
    );

    tournament.teams.push(winningTeam);

    advanceRound(msg.channel);
  }
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "register1v1") {

    if (tournament.mode !== "1v1")
      return interaction.reply({ content: "No 1v1 active.", ephemeral: true });

    if (tournament.started)
      return interaction.reply({ content: "Tournament started.", ephemeral: true });

    if (tournament.teams.flat().includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.teams.push([interaction.user.id]);

    await interaction.reply({ content: "Registered!", ephemeral: true });
    return sendPanel(interaction.channel);
  }

  if (interaction.customId === "start") {

    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    if (tournament.teams.length < 2)
      return interaction.reply({ content: "Not enough teams.", ephemeral: true });

    tournament.started = true;
    generateMatches();
    announceMatches(interaction.channel);

    return interaction.reply({ content: "Tournament Started!", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
