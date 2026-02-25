require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  REST,
  Routes
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Tournament storage (simple memory version)
let tournament = {
  name: "",
  players: [],
  matches: []
};

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash command (guild only for fast update)
  const commands = [
    {
      name: "tournament",
      description: "Create a tournament",
      options: [
        {
          name: "name",
          description: "Tournament name",
          type: 3,
          required: true
        }
      ]
    }
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ Slash command registered");
  } catch (err) {
    console.error(err);
  }
});

client.on("interactionCreate", async (interaction) => {

  // Slash Command
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "tournament") {

      tournament.name = interaction.options.getString("name");
      tournament.players = [];
      tournament.matches = [];

      const embed = new EmbedBuilder()
  .setTitle(`🏆 ${tournament.name}`)
  .setDescription(
    `👥 Players: 0/16
🌍 Region: INW OR ASIA
🎯 Mode: 1v1

Click below to register.`
  )
  .setColor("Gold")
  .setImage("https://cdn.discordapp.com/attachments/1471952333209604239/1476249775681835169/brave_screenshot_discord.com.png")
  .setFooter({ text: "SHINcups1" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("register")
          .setLabel("Register")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("unregister")
          .setLabel("Unregister")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("start")
          .setLabel("Start")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });
    }
  }

  // Buttons
  if (interaction.isButton()) {

    if (interaction.customId === "register") {
      if (!tournament.players.includes(interaction.user.id)) {
        tournament.players.push(interaction.user.id);
      }

      return interaction.reply({
        content: "✅ You are registered!",
        ephemeral: true
      });
    }

    if (interaction.customId === "unregister") {
      tournament.players = tournament.players.filter(
        id => id !== interaction.user.id
      );

      return interaction.reply({
        content: "❌ You are unregistered!",
        ephemeral: true
      });
    }

    if (interaction.customId === "start") {
      if (tournament.players.length < 2) {
        return interaction.reply({
          content: "❌ Not enough players!",
          ephemeral: true
        });
      }

      const shuffled = [...tournament.players].sort(
        () => 0.5 - Math.random()
      );

      tournament.matches = [];

      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          tournament.matches.push([shuffled[i], shuffled[i + 1]]);
        }
      }

      let matchText = "🏆 **Round 1 Matches**\n\n";

      tournament.matches.forEach((match, index) => {
        matchText += `Match ${index + 1}: <@${match[0]}> VS <@${match[1]}>\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`${tournament.name} - Round 1`)
        .setDescription(matchText)
        .setColor("Blue");

      return interaction.reply({
        embeds: [embed]
      });
    }
  }
});


client.login(process.env.TOKEN);
