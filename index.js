const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials
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
const STAFF_ROLE = "Tournament Staff";
const BANNER_URL = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png";

/* ================= DUPLICATE PROTECTION ================= */
const processedMessages = new Set();

/* ================= TOURNAMENT DATA ================= */
let tournament = null;

function createTournament() {
  return {
    mode: "1v1",
    players: [],
    winners: [],
    started: false,
    round: 1,
    maxPlayers: 8,
    server: "INW",
    panelMessage: null
  };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinCups Tournament")
    .setDescription(`
🔥 **Mode:** 1v1
👥 **Players:** ${tournament.players.length}/${tournament.maxPlayers}
🏁 **Status:** ${tournament.started ? "Started" : "Waiting"}
🌍 **Server:** ${tournament.server}
🔢 **Round:** ${tournament.round}
`)
    .setImage(BANNER_URL);
}

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.started || tournament.players.length >= tournament.maxPlayers),
    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tournament.started)
  );
}

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= MESSAGE HANDLER ================= */
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  /* HARD LOCK */
  if (processedMessages.has(msg.id)) return;
  processedMessages.add(msg.id);
  setTimeout(() => processedMessages.delete(msg.id), 4000);

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  /* ===== HELP ===== */
  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#00ff88")
          .setTitle("📖 ShinCups Tournament Help")
          .setDescription(`
;1v1 p<number> s <server> → Create tournament
Register Button → Join 1v1
Start Button → Staff starts bracket
;qualify @player → Move winner to next round
`)
          .setImage(BANNER_URL)
      ]
    });
  }

  /* ===== CREATE 1V1 ===== */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const pArg = args.find(a => a.startsWith("p"));
    const sIndex = args.indexOf("s");

    if (!pArg || sIndex === -1 || !args[sIndex + 1])
      return msg.reply("Use: ;1v1 p<number> s <server>");

    tournament = createTournament();
    tournament.maxPlayers = parseInt(pArg.replace("p", ""));
    tournament.server = args[sIndex + 1];

    const panel = await msg.channel.send({
      embeds: [buildPanelEmbed()],
      components: [buildButtons()]
    });

    tournament.panelMessage = panel.id;
    return;
  }

  /* ===== QUALIFY ===== */
  if (cmd === "qualify") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");
    if (!tournament || !tournament.started)
      return msg.reply("Tournament not started.");

    const player = msg.mentions.users.first();
    if (!player) return msg.reply("Mention a player.");

    if (!tournament.players.includes(player.id))
      return msg.reply("Player not in tournament.");

    if (tournament.winners.includes(player.id))
      return msg.reply("Already qualified.");

    tournament.winners.push(player.id);
    await msg.channel.send(`✅ <@${player.id}> advanced.`);

    /* AUTO NEXT ROUND */
    if (tournament.winners.length === tournament.players.length / 2) {
      tournament.players = [...tournament.winners];
      tournament.winners = [];
      tournament.round++;

      if (tournament.players.length === 1) {
        return msg.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#ffd700")
              .setTitle("🏆 Champion")
              .setDescription(`🎉 Congratulations <@${tournament.players[0]}>!`)
          ]
        });
      }

      generateBracket(msg.channel);
    }
    return;
  }
});

/* ================= BUTTON HANDLER ================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!tournament) return;

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    const panel = await interaction.channel.messages.fetch(tournament.panelMessage);
    await panel.edit({ embeds: [buildPanelEmbed()], components: [buildButtons()] });

    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    if (tournament.players.length < 2)
      return interaction.reply({ content: "Not enough players.", ephemeral: true });

    tournament.started = true;

    await generateBracket(interaction.channel);

    const panel = await interaction.channel.messages.fetch(tournament.panelMessage);
    await panel.edit({ embeds: [buildPanelEmbed()], components: buildButtons() });

    return interaction.reply({ content: "Tournament Started!", ephemeral: true });
  }
});

/* ================= BRACKET FUNCTION ================= */
async function generateBracket(channel) {
  const shuffled = [...tournament.players].sort(() => Math.random() - 0.5);

  let text = "";
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      text += `Match ${i / 2 + 1}:\n<@${shuffled[i]}> vs <@${shuffled[i + 1]}>\n\n`;
    }
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor("#ff9900")
        .setTitle(`🎯 Round ${tournament.round} Bracket`)
        .setDescription(text)
    ]
  });
}

/* ================= LOGIN ================= */
client.login(process.env.TOKEN);
