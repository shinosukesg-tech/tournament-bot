

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
const BANNER_URL = "https://cdn.discordapp.com/attachments/1415778886285000876/1467953312702922960/Event_Background_EventDash.png?ex=69a0940f&is=699f428f&hm=5d8bcdb9d7e3a7a97b8cf1be27264a07134c6a252ed883e99ef5ddd413ffd1ab&";
const CHAMPION_ROLE_NAME = "Tournament Champion";

let tournament = {
  mode: null,
  players: [],
  teams: [],
  matches: [],
  winners: [],
  started: false,
  round: 1
};

/* ================= STAFF CHECK ================= */
function isStaff(member) {
  return member.permissions.has("Administrator");
}

/* ================= MATCH CREATION ================= */
function createMatchesFromTeams(teamList) {
  const matches = [];
  const shuffled = [...teamList];

  while (shuffled.length >= 2) {
    const t1 = shuffled.shift();
    const t2 = shuffled.shift();
    matches.push({ team1: t1, team2: t2 });
  }

  return matches;
}

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

/* ================= HELP ================= */
function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("🏆 Tournament System Commands")
    .setColor("#00ff99")
    .setImage(BANNER_URL)
    .setDescription(`
**🎮 Setup**
;1v1
;2v2
;3v3
;start
;qualify @player

**📝 Register**
(1v1 uses button)
;register2v2 @p1 @p2
;register3v3 @p1 @p2 @p3

**🔑 Match Code**
;code 1v1 CODE @player
;code 2v2 CODE @player
;code 3v3 CODE @player

;help
`);
}

/* ================= MESSAGE HANDLER ================= */
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "help")
    return msg.channel.send({ embeds: [helpEmbed()] });

  /* ===== CREATE TOURNAMENT ===== */
  if (["1v1", "2v2", "3v3"].includes(cmd)) {
    if (!isStaff(msg.member)) return msg.reply("Staff only.");

    tournament = {
      mode: cmd,
      players: [],
      teams: [],
      matches: [],
      winners: [],
      started: false,
      round: 1
    };

    if (cmd === "1v1") {
      const embed = new EmbedBuilder()
        .setTitle("🏆 1v1 Registration")
        .setColor("#00ff99")
        .setImage(BANNER_URL)
        .setDescription("Click to register.");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("register1v1")
          .setLabel("Register")
          .setStyle(ButtonStyle.Success)
      );

      return msg.channel.send({ embeds: [embed], components: [row] });
    }

    return msg.channel.send(`✅ ${cmd} Tournament Created.`);
  }

  /* ===== REGISTER 2V2 ===== */
  if (cmd === "register2v2" && tournament.mode === "2v2") {
    const players = msg.mentions.users.map(u => u.id);
    if (players.length !== 2) return msg.reply("Mention 2 players.");

    if (players.some(p => tournament.players.includes(p)))
      return msg.reply("One player already registered.");

    tournament.players.push(...players);
    tournament.teams.push(players);

    return msg.channel.send("✅ 2v2 Team Registered.");
  }

  /* ===== REGISTER 3V3 ===== */
  if (cmd === "register3v3" && tournament.mode === "3v3") {
    const players = msg.mentions.users.map(u => u.id);
    if (players.length !== 3) return msg.reply("Mention 3 players.");

    if (players.some(p => tournament.players.includes(p)))
      return msg.reply("One player already registered.");

    tournament.players.push(...players);
    tournament.teams.push(players);

    return msg.channel.send("✅ 3v3 Team Registered.");
  }

  /* ===== START ===== */
  if (cmd === "start") {
    if (!isStaff(msg.member)) return;

    if (tournament.mode === "1v1") {
      tournament.teams = tournament.players.map(p => [p]);
    }

    tournament.matches = createMatchesFromTeams(tournament.teams);
    tournament.started = true;
    tournament.winners = [];
    tournament.round = 1;

    return msg.channel.send(`🔥 Round 1 Started!`);
  }

  /* ===== QUALIFY + AUTO NEXT ROUND ===== */
  if (cmd === "qualify") {
    if (!isStaff(msg.member)) return;

    const user = msg.mentions.users.first();
    if (!user) return msg.reply("Mention player.");

    const matchIndex = tournament.matches.findIndex(m =>
      m.team1.includes(user.id) ||
      m.team2.includes(user.id)
    );

    if (matchIndex === -1)
      return msg.reply("Player not in active match.");

    const match = tournament.matches[matchIndex];

    const winningTeam = match.team1.includes(user.id)
      ? match.team1
      : match.team2;

    tournament.winners.push(winningTeam);
    tournament.matches.splice(matchIndex, 1);

    msg.channel.send(`✅ ${user} Qualified!`);

    if (tournament.matches.length === 0) {

      if (tournament.winners.length === 1) {

        const championTeam = tournament.winners[0];
        const championMentions = championTeam.map(id => `<@${id}>`).join(" ");

        const role = msg.guild.roles.cache.find(r => r.name === CHAMPION_ROLE_NAME);

        for (const id of championTeam) {
          const member = await msg.guild.members.fetch(id);
          if (role) await member.roles.add(role).catch(() => {});
        }

        const embed = new EmbedBuilder()
          .setTitle("🏆 TOURNAMENT CHAMPION 🏆")
          .setColor("#FFD700")
          .setImage(BANNER_URL)
          .setDescription(`
🔥 **CONGRATULATIONS!** 🔥

${championMentions}

You are the official Tournament Champion!
`);

        tournament.started = false;

        return msg.channel.send({ embeds: [embed] });
      }

      tournament.round++;
      tournament.matches = createMatchesFromTeams(tournament.winners);
      tournament.winners = [];

      msg.channel.send(`🔥 Round ${tournament.round} Started!`);
    }
  }
});

/* ===== 1V1 BUTTON ===== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "register1v1") {

    if (tournament.players.includes(interaction.user.id))
      return interaction.reply({ content: "Already registered.", ephemeral: true });

    tournament.players.push(interaction.user.id);

    return interaction.reply({
      content: "✅ Registered!",
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);


