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
const BANNER_URL = "https://cdn.discordapp.com/attachments/1471952333209604239/1476249775681835169/brave_screenshot_discord.com.png?ex=69a0703d&is=699f1ebd&hm=6d406c9e0afc71eaa13d789fad08e88caa8c0010007afd9aa307f20959895aaa";
const MAX_TEAMS = 16;

let panelMessage = null;

let tournament = {
  mode: null,
  teamSize: 1,
  teams: [],
  matches: [],
  started: false,
  round: 1
};

/* ================= STAFF CHECK ================= */

function isStaff(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.some(r => r.name === HOST_ROLE_NAME)
  );
}

/* ================= CREATE ================= */

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

/* ================= PANEL ================= */

async function sendPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 Shin TOURS • ${tournament.mode || "NO"} TOURNAMENT`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎮 Mode: ${tournament.mode || "None"}\n` +
      `👥 Registered: ${tournament.teams.length}/${MAX_TEAMS}\n` +
      `🔥 Status: ${tournament.started ? "LIVE" : "OPEN"}\n` +
      `━━━━━━━━━━━━━━━━━━`
    )
    .setColor("#FFD700")
    .setImage(BANNER_URL)
    .setFooter({ text: "XNZ Tours Automated Tournament System" });

  const buttons = [];

  if (tournament.mode === "1v1" && !tournament.started) {
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

  if (!panelMessage)
    panelMessage = await channel.send({ embeds: [embed], components: [row] });
  else
    await panelMessage.edit({ embeds: [embed], components: [row] });
}

/* ================= BOT FILL ================= */

function fillWithBots() {
  let count = 1;
  while (tournament.teams.length < MAX_TEAMS) {
    const team = [];
    for (let i = 0; i < tournament.teamSize; i++)
      team.push(`BOT_${count}_${i}`);
    tournament.teams.push(team);
    count++;
  }
}

/* ================= MATCH SYSTEM ================= */

function generateMatches() {
  const shuffled = [...tournament.teams].sort(() => Math.random() - 0.5);
  tournament.matches = [];

  for (let i = 0; i < shuffled.length; i += 2)
    tournament.matches.push({
      team1: shuffled[i],
      team2: shuffled[i + 1]
    });
}

function announceMatches(channel) {
  let msg = `\n🏆 ROUND ${tournament.round}\n\n`;
  tournament.matches.forEach((m, i) => {
    const t1 = m.team1.map(p => p.startsWith("BOT") ? p : `<@${p}>`).join(", ");
    const t2 = m.team2.map(p => p.startsWith("BOT") ? p : `<@${p}>`).join(", ");
    msg += `Match ${i + 1}: ${t1} 🆚 ${t2}\n`;
  });
  channel.send(msg);
}

function advanceRound(channel) {
  if (tournament.teams.length <= 1) {
    const winner = tournament.teams[0]
      .map(p => p.startsWith("BOT") ? p : `<@${p}>`)
      .join(", ");
    channel.send(`🏆 WINNER: ${winner}`);
    tournament.started = false;
    return;
  }

  tournament.round++;
  generateMatches();
  announceMatches(channel);
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* CREATE */
  if (cmd === "tournament") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");
    const mode = args[0];
    if (!["1v1", "2v2", "3v3"].includes(mode))
      return msg.reply("Use 1v1 / 2v2 / 3v3");
    createTournament(mode);
    return sendPanel(msg.channel);
  }

  /* REGISTER 2v2 */
  if (cmd === "register2v2" && tournament.mode === "2v2") {
    if (tournament.started) return msg.reply("Started.");
    if (msg.mentions.users.size !== 2) return msg.reply("Mention 2 players.");
    const ids = [...msg.mentions.users.values()].map(u => u.id);
    if (ids.some(id => tournament.teams.flat().includes(id)))
      return msg.reply("Player already registered.");
    tournament.teams.push(ids);
    sendPanel(msg.channel);
  }

  /* REGISTER 3v3 */
  if (cmd === "register3v3" && tournament.mode === "3v3") {
    if (tournament.started) return msg.reply("Started.");
    if (msg.mentions.users.size !== 3) return msg.reply("Mention 3 players.");
    const ids = [...msg.mentions.users.values()].map(u => u.id);
    if (ids.some(id => tournament.teams.flat().includes(id)))
      return msg.reply("Player already registered.");
    tournament.teams.push(ids);
    sendPanel(msg.channel);
  }

  /* QUALIFY */
  if (cmd === "qualify") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");
    const user = msg.mentions.users.first();
    if (!user) return msg.reply("Mention player.");

    const match = tournament.matches.find(m =>
      m.team1.includes(user.id) || m.team2.includes(user.id)
    );
    if (!match) return msg.reply("Player not in match.");

    const winner = match.team1.includes(user.id)
      ? match.team1
      : match.team2;

    tournament.teams = tournament.teams.filter(t =>
      t !== match.team1 && t !== match.team2
    );

    tournament.teams.push(winner);
    advanceRound(msg.channel);
  }

  /* CODE */
  if (cmd === "code") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const mode = args[0];
    const roomCode = args[1];
    const user = msg.mentions.users.first();

    if (!["1v1", "2v2", "3v3"].includes(mode))
      return msg.reply("Usage: ;code 3v3 12345 @player");

    if (!roomCode) return msg.reply("Provide room code.");
    if (!user) return msg.reply("Mention player.");

    const team = tournament.teams.find(t => t.includes(user.id));
    if (!team) return msg.reply("Player not registered.");

    const embed = new EmbedBuilder()
      .setTitle("🎟️ MATCH ROOM CODE")
      .setDescription(
        `━━━━━━━━━━━━━━━━━━\n` +
        `🎮 Mode: ${mode}\n\n` +
        `🔑 ROOM CODE: \`${roomCode}\`\n` +
        `━━━━━━━━━━━━━━━━━━`
      )
      .setColor("#00FFAA")
      .setImage(BANNER_URL);

    for (const id of team) {
      if (!id.startsWith("BOT")) {
        try {
          const member = await msg.guild.members.fetch(id);
          await member.send({ embeds: [embed] });
        } catch {}
      }
    }

    await msg.delete().catch(() => {});
    const confirm = await msg.channel.send("✅ Code sent via DM.");
    setTimeout(() => confirm.delete().catch(() => {}), 5000);
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "register1v1") {
    if (tournament.started)
      return interaction.reply({ content: "Started.", ephemeral: true });

    if (tournament.teams.flat().includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.teams.push([interaction.user.id]);
    await interaction.reply({ content: "Registered!", ephemeral: true });
    sendPanel(interaction.channel);
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    if (tournament.teams.length < 2)
      return interaction.reply({ content: "Not enough teams.", ephemeral: true });

    fillWithBots();
    tournament.started = true;
    generateMatches();
    announceMatches(interaction.channel);

    interaction.reply({ content: "Tournament Started!", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
