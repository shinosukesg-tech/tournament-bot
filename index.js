const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
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

/* ================= UTIL ================= */

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

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
      .setDisabled(
        tournament.started ||
        tournament.players.length >= MAX_PLAYERS ||
        tournament.mode !== "1v1"
      ),

    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tournament.started),

    new ButtonBuilder()
      .setCustomId("start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(tournament.started)
  );
}

function createMatches(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const matches = [];
  while (shuffled.length >= 2) {
    matches.push({
      team1: shuffled.shift(),
      team2: shuffled.shift()
    });
  }
  return matches;
}

function generateNextRound(channel) {
  if (tournament.winners.length === 1) {
    channel.send(
      `🏆 **Champion:** ${tournament.winners[0]
        .map(id => `<@${id}>`)
        .join(" & ")}`
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
      `Match ${i + 1}: ${match.team1
        .map(id => `<@${id}>`)
        .join(" & ")} vs ${match.team2
        .map(id => `<@${id}>`)
        .join(" & ")}`
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

  /* ===== CREATE TOURNAMENT (NO DUPLICATE FIX) ===== */

  if (["1v1", "2v2", "3v3"].includes(cmd)) {
    if (!isAdmin(msg.member)) return msg.reply("Admin only.");

    // delete old panel if exists
    if (tournament.messageId) {
      try {
        const oldMsg = await msg.channel.messages.fetch(
          tournament.messageId
        );
        await oldMsg.delete();
      } catch (err) {}
    }

    tournament = resetTournament();
    tournament.mode = cmd;

    const sent = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.messageId = sent.id;
  }

  /* ===== TEAM REGISTRATION ===== */

  if (cmd === "team") {
    if (!["2v2", "3v3"].includes(tournament.mode))
      return msg.reply("Only for 2v2 or 3v3.");

    const required = tournament.mode === "2v2" ? 1 : 2;

    if (msg.mentions.users.size !== required)
      return msg.reply(`Mention ${required} teammate(s).`);

    const team = [msg.author.id, ...msg.mentions.users.map(u => u.id)];

    for (const id of team) {
      if (tournament.players.includes(id))
        return msg.reply("A player already registered.");
    }

    tournament.players.push(...team);
    tournament.teams.push(team);

    const message = await msg.channel.messages.fetch(
      tournament.messageId
    );
    await message.edit({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    msg.reply("Team Registered!");
  }

  /* ===== WIN REPORT ===== */

  if (cmd === "win") {
    const mention = msg.mentions.users.first();
    if (!mention) return msg.reply("Mention winner.");

    const team = tournament.teams.find(t =>
      t.includes(mention.id)
    );
    if (!team) return msg.reply("Player not found.");

    tournament.winners.push(team);

    if (tournament.winners.length === tournament.matches.length) {
      generateNextRound(msg.channel);
    }
  }

  /* ===== DM CODE SYSTEM ===== */

  if (cmd === "code") {
    if (!isAdmin(msg.member)) return msg.reply("Admin only.");

    const mode = args[0];
    const code = args[1];
    const mention = msg.mentions.users.first();

    if (!["1v1", "2v2", "3v3"].includes(mode))
      return msg.reply("Invalid mode.");

    if (!code) return msg.reply("Provide code.");
    if (!mention) return msg.reply("Mention player.");

    const team = tournament.teams.find(t =>
      t.includes(mention.id)
    );
    if (!team) return msg.reply("Team not found.");

    for (const id of team) {
      const user = await client.users.fetch(id);
      await user
        .send(
          `🎮 Match Code: **${code}**
🏆 Mode: ${mode.toUpperCase()}
🔥 Good Luck!`
        )
        .catch(() => {});
    }

    msg.delete().catch(() => {});
    msg.channel.send("✅ Code sent to team.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const message = await interaction.channel.messages.fetch(
    tournament.messageId
  );

  if (interaction.customId === "register") {
    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({
        content: "Already registered.",
        ephemeral: true
      });

    tournament.players.push(interaction.user.id);
    tournament.teams.push([interaction.user.id]);

    await message.edit({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    interaction.reply({ content: "Registered!", ephemeral: true });
  }

  if (interaction.customId === "unregister") {
    tournament.players = tournament.players.filter(
      p => p !== interaction.user.id
    );
    tournament.teams = tournament.teams.filter(
      t => !t.includes(interaction.user.id)
    );

    await message.edit({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    interaction.reply({
      content: "Unregistered.",
      ephemeral: true
    });
  }

  if (interaction.customId === "start") {
    if (!isAdmin(interaction.member))
      return interaction.reply({
        content: "Admin only.",
        ephemeral: true
      });

    if (tournament.teams.length < 2)
      return interaction.reply({
        content: "Not enough teams.",
        ephemeral: true
      });

    tournament.started = true;
    tournament.matches = createMatches(tournament.teams);

    await message.edit({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    interaction.reply("🔥 Tournament Started!");

    tournament.matches.forEach((match, i) => {
      interaction.channel.send(
        `Match ${i + 1}: ${match.team1
          .map(id => `<@${id}>`)
          .join(" & ")} vs ${match.team2
          .map(id => `<@${id}>`)
          .join(" & ")}`
      );
    });
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
