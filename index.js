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
const BANNER = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png";

/* ================= SAFE EXECUTION LOCK ================= */
const processed = new Set();

/* ================= TOURNAMENT SYSTEM ================= */

let tournament = null;

function createTournament() {
  return {
    mode: "1v1",
    server: "INW",
    maxPlayers: 8,
    players: [],
    round: 1,
    matches: [],
    winners: [],
    started: false,
    panelMessage: null
  };
}

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE);
}

/* ================= BRACKET CREATION ================= */

function createMatches(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const matches = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      matches.push({
        p1: shuffled[i],
        p2: shuffled[i + 1],
        winner: null
      });
    } else {
      // BYE
      matches.push({
        p1: shuffled[i],
        p2: null,
        winner: shuffled[i]
      });
    }
  }

  return matches;
}

/* ================= PROGRESS BAR ================= */

function getProgressBar() {
  const total = tournament.matches.length;
  const finished = tournament.matches.filter(m => m.winner).length;

  return `Progress: ${finished}/${total}`;
}

/* ================= BRACKET EMBED ================= */

function buildBracketEmbed() {
  let desc = `🏆 **Tour - 1V1**\n`;
  desc += `Round ${tournament.round}\n`;
  desc += `Map: BlockDash\n\n`;
  desc += getProgressBar() + "\n\n";

  tournament.matches.forEach((match, index) => {
    const finished = match.winner ? "✅" : "⚔️";

    desc += `${finished} Match #${index + 1}\n`;

    if (match.p2) {
      desc += `<@${match.p1}> ⚔️ <@${match.p2}>\n\n`;
    } else {
      desc += `<@${match.p1}> (BYE)\n\n`;
    }
  });

  return new EmbedBuilder()
    .setColor("#8e44ad")
    .setDescription(desc)
    .setImage(BANNER);
}

/* ================= PANEL ================= */

function buildPanel() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinCups Tournament")
    .setDescription(`
Mode: 1v1
Players: ${tournament.players.length}/${tournament.maxPlayers}
Server: ${tournament.server}
Status: ${tournament.started ? "Started" : "Waiting"}
`)
    .setImage(BANNER);
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

  if (processed.has(msg.id)) return;
  processed.add(msg.id);
  setTimeout(() => processed.delete(msg.id), 3000);

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  /* HELP */
  if (cmd === "help") {
    return msg.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#3498db")
          .setTitle("📖 ShinCups Help")
          .setDescription(`
;1v1 p<number> s <server>
;qualify @player
;win @player
`)
      ]
    });
  }

  /* CREATE 1V1 */
  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const pArg = args.find(a => a.startsWith("p"));
    const sIndex = args.indexOf("s");

    if (!pArg || sIndex === -1) {
      return msg.reply("Use: ;1v1 p8 s INW");
    }

    tournament = createTournament();
    tournament.maxPlayers = parseInt(pArg.replace("p", ""));
    tournament.server = args[sIndex + 1];

    const panel = await msg.channel.send({
      embeds: [buildPanel()],
      components: [buildButtons()]
    });

    tournament.panelMessage = panel.id;
    return;
  }

  /* WIN COMMAND */
  if (cmd === "win") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");
    if (!tournament || !tournament.started) return;

    const player = msg.mentions.users.first();
    if (!player) return;

    const match = tournament.matches.find(
      m => !m.winner && (m.p1 === player.id || m.p2 === player.id)
    );

    if (!match) return msg.reply("Match not found or already finished.");

    match.winner = player.id;
    tournament.winners.push(player.id);

    await msg.channel.send(`🏆 <@${player.id}> won the match!`);

    await updateBracket(msg.channel);
  }

  /* QUALIFY COMMAND */
  if (cmd === "qualify") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const player = msg.mentions.users.first();
    if (!player) return;

    tournament.winners.push(player.id);
    await msg.channel.send(`✅ <@${player.id}> qualified.`);

    await updateBracket(msg.channel);
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
    await panel.edit({ embeds: [buildPanel()], components: [buildButtons()] });

    return interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    if (tournament.players.length < 2)
      return interaction.reply({ content: "Not enough players.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.players);

    await interaction.channel.send({ embeds: [buildBracketEmbed()] });

    return interaction.reply({ content: "Tournament started!", ephemeral: true });
  }
});

/* ================= ROUND UPDATE ================= */

async function updateBracket(channel) {
  const total = tournament.matches.length;
  const finished = tournament.matches.filter(m => m.winner).length;

  if (finished === total) {
    if (tournament.winners.length === 1) {
      return channel.send(`👑 Champion: <@${tournament.winners[0]}>`);
    }

    tournament.round++;
    tournament.matches = createMatches(tournament.winners);
    tournament.winners = [];

    return channel.send({ embeds: [buildBracketEmbed()] });
  }

  return channel.send({ embeds: [buildBracketEmbed()] });
}

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
