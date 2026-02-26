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
const STAFF_ROLE_NAME = "Tournament Staff";
const BANNER_URL = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png?ex=69a0940f&is=699f428f&hm=5d8bc";

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
    messageId: null,
    maxPlayers: 16,
    server: "INW"
  };
}

let tournament = resetTournament();

/* ================= STAFF CHECK ================= */

function isStaff(member) {
  return member.roles.cache.some(r => r.name === STAFF_ROLE_NAME);
}

/* ================= EMBED ================= */

function buildEmbed() {
  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("🏆 ShinCups Tournament")
    .setDescription(`
🔥 **Mode:** ${tournament.mode || "Not Selected"}
👥 **Registered:** ${tournament.players.length}/${tournament.maxPlayers}
🏁 **Status:** ${tournament.started ? "Started" : "Waiting"}
🌍 **Server:** ${tournament.server}
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
        tournament.players.length >= tournament.maxPlayers ||
        tournament.mode !== "1v1"
      ),

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

  tournament.matches.forEach((m, i) => {
    channel.send(
      `Match ${i + 1}: ${m.team1.map(id => `<@${id}>`).join(" & ")} vs ${m.team2.map(id => `<@${id}>`).join(" & ")}`
    );
  });
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`${client.user.tag} Online`);
});

/* ================= COMMANDS ================= */

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ===== HELP ===== */

  if (cmd === "help") {
    return msg.channel.send(`
🏆 **ShinCups Tournament Commands**

🎮 Create 1v1:
;1v1 p<number> s <server>

👥 Create 2v2:
;2v2

👥 Create 3v3:
;3v3

🧑‍🤝‍🧑 Register 2v2:
;register 2v2 @player

🧑‍🤝‍🧑 Register 3v3:
;register 3v3 @player1 @player2

🏆 Report Win (Staff):
;win @player

✅ Qualify (Staff):
;qualify @player

🎮 Send Code (Staff):
;code 1v1 12345 @player
`);
  }

  /* ===== CREATE 1V1 ===== */

  if (cmd === "1v1") {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    const pArg = args.find(a => a.startsWith("p"));
    const sIndex = args.indexOf("s");

    if (!pArg || sIndex === -1 || !args[sIndex + 1])
      return msg.reply("Use: ;1v1 p<number> s <server>");

    const maxPlayers = parseInt(pArg.slice(1));
    const server = args[sIndex + 1];

    if (!maxPlayers || maxPlayers < 2)
      return msg.reply("Invalid player number.");

    const messages = await msg.channel.messages.fetch({ limit: 20 });
    messages.forEach(async (m) => {
      if (
        m.author.id === client.user.id &&
        m.embeds[0]?.title?.includes("ShinCups Tournament")
      ) {
        try { await m.delete(); } catch {}
      }
    });

    tournament = resetTournament();
    tournament.mode = "1v1";
    tournament.maxPlayers = maxPlayers;
    tournament.server = server;

    const panel = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.messageId = panel.id;
  }

  /* ===== CREATE 2V2 / 3V3 ===== */

  if (["2v2", "3v3"].includes(cmd)) {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    tournament = resetTournament();
    tournament.mode = cmd;

    const panel = await msg.channel.send({
      embeds: [buildEmbed()],
      components: [buildButtons()]
    });

    tournament.messageId = panel.id;
  }

  /* ===== REGISTER 2V2 / 3V3 ===== */

  if (cmd === "register") {
    const mode = args[0];
    if (!["2v2", "3v3"].includes(mode))
      return;

    if (tournament.mode !== mode)
      return msg.reply("Wrong tournament mode.");

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

    const panel = await msg.channel.messages.fetch(tournament.messageId);
    await panel.edit({ embeds: [buildEmbed()], components: [buildButtons()] });

    msg.reply("Team Registered!");
  }

  /* ===== WIN ===== */

  if (cmd === "win") {
    if (!isStaff(msg.member))
      return msg.reply("Staff only.");

    const mention = msg.mentions.users.first();
    if (!mention) return msg.reply("Mention winner.");

    const team = tournament.teams.find(t => t.includes(mention.id));
    if (!team) return msg.reply("Not found.");

    tournament.winners.push(team);

    if (tournament.winners.length === tournament.matches.length)
      generateNextRound(msg.channel);
  }

  /* ===== QUALIFY ===== */

  if (cmd === "qualify") {
    if (!isStaff(msg.member))
      return msg.reply("Staff only.");

    const mention = msg.mentions.users.first();
    if (!mention) return;

    const team = tournament.teams.find(t => t.includes(mention.id));
    if (!team) return;

    tournament.winners.push(team);
    msg.channel.send(`✅ Qualified: ${team.map(id => `<@${id}>`).join(" & ")}`);

    if (tournament.winners.length === tournament.matches.length)
      generateNextRound(msg.channel);
  }

  /* ===== CODE ===== */

  if (cmd === "code") {
    if (!isStaff(msg.member))
      return msg.reply("Staff only.");

    const mode = args[0];
    const code = args[1];
    const mention = msg.mentions.users.first();

    if (!code || !mention) return;

    const team = tournament.teams.find(t => t.includes(mention.id));
    if (!team) return;

    for (const id of team) {
      const user = await client.users.fetch(id);
      await user.send(`🎮 Match Code: **${code}**`).catch(() => {});
    }

    msg.delete().catch(() => {});
    msg.channel.send("✅ Code Sent.");
  }
});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const panel = await interaction.channel.messages.fetch(tournament.messageId);

  if (interaction.customId === "register") {
    if (tournament.mode !== "1v1")
      return interaction.reply({ content: "Button only for 1v1.", ephemeral: true });

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

    tournament.matches.forEach((m, i) => {
      interaction.channel.send(
        `Match ${i + 1}: ${m.team1.map(id => `<@${id}>`).join(" & ")} vs ${m.team2.map(id => `<@${id}>`).join(" & ")}`
      );
    });
  }
});

client.login(process.env.TOKEN);
