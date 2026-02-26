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
const MAX_PLAYERS = 16;
const REGION = "INW OR ASIA";
const BANNER_URL = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png?ex=69a0940f&is=699f428f&hm=5d8bc";
const STAFF_ROLE_NAME = "Tournament Staff";

/* ================= DATA ================= */

function resetTournament() {
  return {
    mode: null,
    players: [],
    teams: [],
    matches: [],
    winners: [],
    started: false,
    round: 1,
    messageId: null
  };
}

let tournament = resetTournament();

/* ================= STAFF CHECK ================= */

function isStaff(member) {
  return member.roles.cache.some(role => role.name === STAFF_ROLE_NAME);
}

/* ================= EMBED ================= */

function buildEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinCups Tournament")
    .setDescription(`
🔥 **Mode:** ${tournament.mode ? tournament.mode.toUpperCase() : "Not Selected"}
👥 **Registered:** ${tournament.players.length}/${MAX_PLAYERS}
🏁 **Status:** ${tournament.started ? "Started" : "Waiting"}
🌍 **Region:** ${REGION}
`)
    .setImage(BANNER_URL);
}

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success)
      .setDisabled(tournament.started || tournament.players.length >= MAX_PLAYERS),

    new ButtonBuilder()
      .setCustomId("players")
      .setLabel(`Players: ${tournament.players.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tournament.started)
  );
}

/* ================= MATCH LOGIC ================= */

function createMatches(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const matches = [];
  while (shuffled.length >= 2) {
    matches.push({ team1: shuffled.shift(), team2: shuffled.shift() });
  }
  return matches;
}

function generateNextRound(channel) {
  if (tournament.winners.length === 1) {
    channel.send(
      `🏆 **Champion:** ${tournament.winners[0].map(id => `<@${id}>`).join(" & ")}`
    );
    tournament.started = false;
    return;
  }

  tournament.round++;
  tournament.teams = tournament.winners;
  tournament.winners = [];
  tournament.matches = createMatches(tournament.teams);

  channel.send(`🔥 **Round ${tournament.round} Started!**`);

  tournament.matches.forEach((match, i) => {
    channel.send(
      `Match ${i + 1}: ${match.team1.map(id => `<@${id}>`).join(" & ")} vs ${match.team2.map(id => `<@${id}>`).join(" & ")}`
    );
  });
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} is online.`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== CREATE TOURNAMENT ===== */

  if (["1v1", "2v2", "3v3"].includes(cmd)) {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const messages = await msg.channel.messages.fetch({ limit: 20 });
    messages.forEach(async (m) => {
      if (
        m.author.id === client.user.id &&
        m.embeds.length > 0 &&
        m.embeds[0].title &&
        m.embeds[0].title.includes("ShinCups Tournament")
      ) {
        try { await m.delete(); } catch {}
      }
    });

    tournament = resetTournament();
    tournament.mode = cmd;

    const sent = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.messageId = sent.id;
  }

  /* ===== TEAM REGISTER ===== */

  if (cmd === "team") {
    if (!["2v2", "3v3"].includes(tournament.mode))
      return msg.reply("Only for 2v2 or 3v3.");

    const required = tournament.mode === "2v2" ? 1 : 2;
    if (msg.mentions.users.size !== required)
      return msg.reply(`Mention ${required} teammate(s).`);

    const team = [msg.author.id, ...msg.mentions.users.map(u => u.id)];

    for (const id of team) {
      if (tournament.players.includes(id))
        return msg.reply("Player already registered.");
    }

    tournament.players.push(...team);
    tournament.teams.push(team);

    const panel = await msg.channel.messages.fetch(tournament.messageId);
    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    msg.reply("Team Registered!");
  }

  /* ===== WIN (STAFF ONLY) ===== */

  if (cmd === "win") {
    if (!isStaff(msg.member))
      return msg.reply("Only Tournament Staff can report wins.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.reply("Mention winner.");

    const team = tournament.teams.find(t => t.includes(mention.id));
    if (!team) return msg.reply("Player not found.");

    tournament.winners.push(team);

    if (tournament.winners.length === tournament.matches.length) {
      generateNextRound(msg.channel);
    }
  }

  /* ===== QUALIFY (STAFF ONLY) ===== */

  if (cmd === "qualify") {
    if (!isStaff(msg.member))
      return msg.reply("Only Tournament Staff can qualify players.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.reply("Mention player.");

    const team = tournament.teams.find(t => t.includes(mention.id));
    if (!team) return msg.reply("Player not found.");

    tournament.winners.push(team);

    msg.channel.send(
      `✅ Team Qualified: ${team.map(id => `<@${id}>`).join(" & ")}`
    );

    if (tournament.winners.length === tournament.matches.length) {
      generateNextRound(msg.channel);
    }
  }

  /* ===== DM CODE (STAFF ONLY) ===== */

  if (cmd === "code") {
    if (!isStaff(msg.member))
      return msg.reply("Only Tournament Staff can send codes.");

    const mode = args[0];
    const code = args[1];
    const mention = msg.mentions.users.first();

    if (!["1v1", "2v2", "3v3"].includes(mode))
      return msg.reply("Invalid mode.");
    if (!code) return msg.reply("Provide code.");
    if (!mention) return msg.reply("Mention player.");

    const team = tournament.teams.find(t => t.includes(mention.id));
    if (!team) return msg.reply("Team not found.");

    for (const id of team) {
      const user = await client.users.fetch(id);
      await user.send(
        `🎮 Match Code: **${code}**
🏆 Mode: ${mode.toUpperCase()}
🔥 Good Luck!`
      ).catch(() => {});
    }

    msg.delete().catch(() => {});
    msg.channel.send("✅ Code sent to team.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const panel = await interaction.channel.messages.fetch(tournament.messageId);

  if (interaction.customId === "register") {
    if (tournament.mode !== "1v1")
      return interaction.reply({ content: "Use ;team for 2v2/3v3.", ephemeral: true });

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);
    tournament.teams.push([interaction.user.id]);

    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "start") {
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    if (tournament.teams.length < 2)
      return interaction.reply({ content: "Not enough teams.", ephemeral: true });

    tournament.started = true;
    tournament.matches = createMatches(tournament.teams);

    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    interaction.reply("🔥 Tournament Started!");

    tournament.matches.forEach((match, i) => {
      interaction.channel.send(
        `Match ${i + 1}: ${match.team1.map(id => `<@${id}>`).join(" & ")} vs ${match.team2.map(id => `<@${id}>`).join(" & ")}`
      );
    });
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
