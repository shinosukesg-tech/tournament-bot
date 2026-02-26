const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials
} = require("discord.js");

/* ===== PREVENT DOUBLE INSTANCE ===== */
if (global.botRunning) {
  console.log("Bot already running. Stopping duplicate instance.");
  process.exit(1);
}
global.botRunning = true;

/* ===== CLIENT ===== */
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
const STAFF_ROLE = "Tournament Staff";
const BANNER_URL = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png?ex=69a0940f&is=699f428f&hm=5d8bcdb9d7e3a7a97b8cf1be27264a07134c6a252ed883e99ef5ddd413ffd1ab&";

/* ===== TOURNAMENT DATA ===== */
let tournament = null;

function createTournament() {
  return {
    mode: null,
    players: [],
    teams: [],
    matches: [],
    winners: [],
    started: false,
    round: 1,
    maxPlayers: 16,
    server: "INW",
    panelMessage: null
  };
}

/* ===== STAFF CHECK ===== */
function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

/* ===== EMBED ===== */
function buildEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinCups Tournament")
    .setDescription(`
🔥 **Mode:** ${tournament?.mode || "Not Selected"}
👥 **Registered:** ${tournament?.players.length || 0}/${tournament?.maxPlayers || 0}
🏁 **Status:** ${tournament?.started ? "Started" : "Waiting"}
🌍 **Server:** ${tournament?.server || "N/A"}
`)
    .setImage(BANNER_URL);
}

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(
        !tournament ||
        tournament.mode !== "1v1" ||
        tournament.started ||
        tournament.players.length >= tournament.maxPlayers
      ),

    new ButtonBuilder()
      .setCustomId("players")
      .setLabel(`Players: ${tournament?.players.length || 0}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!tournament || tournament.started)
  );
}

/* ===== DELETE OLD PANEL ===== */
async function deleteOldPanel(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  for (const msg of messages.values()) {
    if (
      msg.author.id === client.user.id &&
      msg.embeds.length &&
      msg.embeds[0].title === "🏆 ShinCups Tournament"
    ) {
      try { await msg.delete(); } catch {}
    }
  }
}

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

/* ================== MESSAGE HANDLER (ONLY ONE) ================== */
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX)) return;
  if (msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== HELP ===== */
  if (cmd === "help") {
    return msg.channel.send(`🏆 ShinCups Tournament Commands

;1v1 p<number> s <server>
;2v2
;3v3
;register 2v2 @player
;register 3v3 @p1 @p2
;win @player (Staff)
;qualify @player (Staff)
;code 1v1 <code> @player (Staff)
`);
  }

  /* ===== CREATE 1V1 ===== */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const pArg = args.find(a => a.startsWith("p"));
    const sIndex = args.indexOf("s");

    if (!pArg || sIndex === -1 || !args[sIndex + 1])
      return msg.reply("Use: ;1v1 p<number> s <server>");

    const playerCount = parseInt(pArg.replace("p", ""));
    const server = args[sIndex + 1];

    if (!playerCount || playerCount < 2)
      return msg.reply("Invalid player number.");

    await deleteOldPanel(msg.channel);

    tournament = createTournament();
    tournament.mode = "1v1";
    tournament.maxPlayers = playerCount;
    tournament.server = server;

    const panel = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.panelMessage = panel.id;
    return;
  }

  /* ===== CREATE 2V2 / 3V3 ===== */
  if (cmd === "2v2" || cmd === "3v3") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    await deleteOldPanel(msg.channel);

    tournament = createTournament();
    tournament.mode = cmd;

    const panel = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.panelMessage = panel.id;
    return;
  }

  /* ===== REGISTER 2V2 / 3V3 ===== */
  if (cmd === "register") {
    if (!tournament) return;

    const mode = args[0];
    if (mode !== tournament.mode) return;

    const required = mode === "2v2" ? 1 : 2;
    if (msg.mentions.users.size !== required)
      return msg.reply(`Mention ${required} teammate(s).`);

    const team = [msg.author.id, ...msg.mentions.users.map(u => u.id)];

    for (const id of team) {
      if (tournament.players.includes(id))
        return msg.reply("Player already registered.");
    }

    tournament.players.push(...team);
    tournament.teams.push(team);

    const panel = await msg.channel.messages.fetch(tournament.panelMessage);
    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    return msg.reply("Team Registered!");
  }
});

/* ================= BUTTON HANDLER ================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.mode !== "1v1")
      return interaction.reply({ content: "Button only for 1v1.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);
    tournament.teams.push([interaction.user.id]);

    const panel = await interaction.channel.messages.fetch(tournament.panelMessage);
    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    tournament.started = true;

    const panel = await interaction.channel.messages.fetch(tournament.panelMessage);
    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    return interaction.reply("🔥 Tournament Started!");
  }
});

/* ===== LOGIN ===== */
client.login(process.env.TOKEN);
