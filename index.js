const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const prefix = ";";

const IMAGE_URL =
  "https://cdn.discordapp.com/attachments/1471952333209604239/1476249775681835169/brave_screenshot_discord.com.png?ex=69a0703d&is=699f1ebd&hm=6d406c9e0afc71eaa13d789fad08e88caa8c0010007afd9aa307f20959895aaa";

let tournament = {
  active: false,
  mode: null,
  players: [],
  winners: [],
};

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // CREATE TOURNAMENT
  if (command === "tournament") {
    const mode = args[0];

    if (!["1v1", "2v2", "3v3"].includes(mode))
      return message.reply("❌ Use: ;tournament 1v1 / 2v2 / 3v3");

    tournament = {
      active: true,
      mode: mode,
      players: [],
      winners: [],
    };

    return message.channel.send(
      `🔥 **${mode} Tournament Created!**\nType ;join to participate.`
    );
  }

  // JOIN
  if (command === "join") {
    if (!tournament.active)
      return message.reply("❌ No active tournament.");

    if (tournament.players.includes(message.author.id))
      return message.reply("⚠ You already joined.");

    tournament.players.push(message.author.id);

    return message.channel.send(
      `✅ ${message.author} joined!\n👥 Total Players: ${tournament.players.length}`
    );
  }

  // PLAYERS
  if (command === "players") {
    if (!tournament.active)
      return message.reply("❌ No active tournament.");

    const playerList = tournament.players
      .map((id) => `<@${id}>`)
      .join("\n");

    return message.channel.send(
      `👥 **Players (${tournament.players.length})**\n${playerList || "None"}`
    );
  }

  // START
  if (command === "start") {
    if (!tournament.active)
      return message.reply("❌ No active tournament.");

    if (tournament.players.length < 2)
      return message.reply("❌ Not enough players.");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Tournament Started!")
      .setDescription(
        `Mode: ${tournament.mode}\nPlayers: ${tournament.players.length}`
      )
      .setImage(IMAGE_URL)
      .setColor("Blue");

    return message.channel.send({ embeds: [embed] });
  }

  // CODE SYSTEM
  if (command === "code") {
    const mode = args[0];
    const mentions = message.mentions.users;

    if (!["1v1", "2v2", "3v3"].includes(mode))
      return message.reply("❌ Use: ;code 1v1 @player");

    if (mode === "1v1" && mentions.size !== 1)
      return message.reply("❌ 1v1 needs 1 opponent.");

    if (mode === "2v2" && mentions.size !== 2)
      return message.reply("❌ 2v2 needs 2 players.");

    if (mode === "3v3" && mentions.size !== 3)
      return message.reply("❌ 3v3 needs 3 players.");

    const embed = new EmbedBuilder()
      .setTitle(`🎮 Match Code Created (${mode})`)
      .setDescription(
        `Host: ${message.author}\nPlayers:\n${[
          message.author,
          ...mentions.values(),
        ]
          .map((u) => u.toString())
          .join("\n")}`
      )
      .setImage(IMAGE_URL)
      .setColor("Green");

    return message.channel.send({ embeds: [embed] });
  }

  // WINNER
  if (command === "winner") {
    const winner = message.mentions.users.first();
    if (!winner) return message.reply("❌ Mention the winner.");

    tournament.winners.push(winner.id);

    const embed = new EmbedBuilder()
      .setTitle("🏆 Match Winner!")
      .setDescription(`🎉 Congratulations ${winner}!`)
      .setImage(IMAGE_URL)
      .setColor("Gold");

    return message.channel.send({ embeds: [embed] });
  }

  // REMATCH
  if (command === "rematch") {
    return message.channel.send("🔁 Rematch requested! Get ready!");
  }

  // END
  if (command === "end") {
    tournament = {
      active: false,
      mode: null,
      players: [],
      winners: [],
    };

    return message.channel.send("🛑 Tournament ended.");
  }
});

client.login(process.env.DISCORD_TOKEN);
