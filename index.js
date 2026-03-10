require("dotenv").config();
const express = require("express");
const {
    Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
    REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

/* ================= UPTIME ================= */
const app = express();
app.get("/", (req, res) => res.send("Bot Online!"));
app.listen(process.env.PORT || 3000, "0.0.0.0", () => console.log("Web server running."));

/* ================= DISCORD CLIENT ================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = "!";
const STAFF_ROLE = "Tournament Staff";
const MOD_ROLE = "Moderator";
const WELCOME_CHANNEL_ID = "1465234114318696498";

/* ================= ASSETS ================= */
const REG_IMG = "https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png";
const BRACKET_IMG = "https://cdn.discordapp.com/attachments/1471952333209604239/1480910254999994419/1000126239.png";
const TICKET_IMG = "https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png";
const FOOTER_IMG = "https://cdn.discordapp.com";

/* ================= DATA MANAGEMENT ================= */
const files = {
    tourney: "./tournament.json",
    welcome: "./welcome.json",
    ticket: "./ticket.json"
};

Object.values(files).forEach(f => { if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({})); });

function load(file) { return JSON.parse(fs.readFileSync(file)); }
function save(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function footer() {
    return { text: `ShinosukeSG | ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, iconURL: FOOTER_IMG };
}

const isStaff = (member) => member.roles.cache.some(r => [STAFF_ROLE, MOD_ROLE].includes(r.name)) || member.permissions.has(PermissionFlagsBits.Administrator);

/* ================= SLASH REGISTRATION ================= */
client.on("ready", async () => {
    const commands = [
        new SlashCommandBuilder().setName("help").setDescription("Show command list"),
        new SlashCommandBuilder()
            .setName("1v1")
            .setDescription("Create tournament panel")
            .addStringOption(o => o.setName("name").setDescription("Title").setRequired(true))
            .addStringOption(o => o.setName("server").setDescription("Server").setRequired(true))
            .addStringOption(o => o.setName("map").setDescription("Map").setRequired(true))
            .addStringOption(o => o.setName("reward1").setDescription("1st Place Reward").setRequired(true))
            .addStringOption(o => o.setName("reward2").setDescription("2nd Place Reward").setRequired(true))
            .addStringOption(o => o.setName("reward3").setDescription("3rd Place Reward").setRequired(true)),
        new SlashCommandBuilder().setName("start").setDescription("Start the tournament"),
        new SlashCommandBuilder()
            .setName("winner")
            .setDescription("Announce the winners")
            .addUserOption(o => o.setName("first").setDescription("1st Place").setRequired(true))
            .addUserOption(o => o.setName("second").setDescription("2nd Place").setRequired(true))
            .addUserOption(o => o.setName("third").setDescription("3rd Place").setRequired(true)),
        new SlashCommandBuilder().setName("ticket-panel").setDescription("Deploy ticket panel")
    ].map(c => c.toJSON());

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
    console.log(`Bot Ready: ${client.user.tag}`);
});

/* ================= AUTO WELCOME ================= */
client.on("guildMemberAdd", async member => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const diffDays = Math.ceil(Math.abs(new Date() - member.user.createdAt) / (1000 * 60 * 60 * 24));

    const welcomeEmbed = new EmbedBuilder()
        .setAuthor({ name: `Welcome @${member.user.username}` })
        .setTitle(`Welcome\n${member.user.username}\n👋`)
        .setDescription(`Welcome\n**${member.user.username}** to\n🏆 **${member.guild.name}**\nHave fun here!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 })) // Side Image PFP
        .setColor("#6E4AFF")
        .addFields(
            { name: "🆔 User ID", value: `${member.id}`, inline: false },
            { name: "📅 Account Created", value: `${member.user.createdAt.toDateString()}`, inline: false },
            { name: "⌛ Account Age", value: `${diffDays} days`, inline: false },
            { name: "🎭 Display Name", value: `${member.displayName}`, inline: false }
        );

    channel.send({ content: `Welcome <@${member.id}>`, embeds: [welcomeEmbed] });
    
    let wData = load(files.welcome);
    wData[member.id] = { tag: member.user.tag, joined: new Date() };
    save(files.welcome, wData);
});

/* ================= INTERACTION HANDLER ================= */
client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
        if (!isStaff(interaction.member) && interaction.commandName !== "help") return interaction.reply({ content: "Staff only!", ephemeral: true });

        if (interaction.commandName === "1v1") {
            const tourneyData = {
                name: interaction.options.getString("name"),
                server: interaction.options.getString("server"),
                map: interaction.options.getString("map"),
                rewards: [interaction.options.getString("reward1"), interaction.options.getString("reward2"), interaction.options.getString("reward3")],
                players: []
            };

            const embed = new EmbedBuilder()
                .setTitle(`🏆 ${tourneyData.name}`)
                .setImage(REG_IMG)
                .setColor("#6E4AFF")
                .addFields(
                    { name: "🌍 Server", value: tourneyData.server, inline: true },
                    { name: "🗺️ Map", value: tourneyData.map, inline: true },
                    { name: "💰 Rewards", value: `🥇 ${tourneyData.rewards[0]}\n🥈 ${tourneyData.rewards[1]}\n🥉 ${tourneyData.rewards[2]}` }
                )
                .setFooter(footer());

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("join_t").setLabel("Register Now").setStyle(ButtonStyle.Success).setEmoji("📝"));
            
            let tData = load(files.tourney);
            tData.current = tourneyData;
            save(files.tourney, tData);

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (interaction.commandName === "winner") {
            let tData = load(files.tourney).current || { rewards: ["N/A", "N/A", "N/A"] };
            const p1 = interaction.options.getUser("first");
            const p2 = interaction.options.getUser("second");
            const p3 = interaction.options.getUser("third");

            const embed = new EmbedBuilder()
                .setTitle("🏆 TOURNAMENT WINNERS")
                .setThumbnail(p1.displayAvatarURL())
                .setColor("#FFD700")
                .setDescription(`👑 **${p1.username}**\nReward: ${tData.rewards[0]}`)
                .addFields(
                    { name: "🥈 2nd Place", value: `${p2.username}\nReward: ${tData.rewards[1]}`, inline: true },
                    { name: "🥉 3rd Place", value: `${p3.username}\nReward: ${tData.rewards[2]}`, inline: true }
                )
                .setFooter(footer());

            return interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === "ticket-panel") {
            const embed = new EmbedBuilder().setTitle("Support").setImage(TICKET_IMG).setColor("#6E4AFF").setDescription("Click below to open a ticket.");
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("open_t").setLabel("Open Ticket").setStyle(ButtonStyle.Primary).setEmoji("🎫"));
            await interaction.reply({ content: "Deployed!", ephemeral: true });
            return interaction.channel.send({ embeds: [embed], components: [row] });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === "join_t") {
            let tData = load(files.tourney);
            if (!tData.current) return interaction.reply({ content: "No active tournament!", ephemeral: true });
            if (tData.current.players.includes(interaction.user.id)) return interaction.reply({ content: "Already registered!", ephemeral: true });
            tData.current.players.push(interaction.user.id);
            save(files.tourney, tData);
            return interaction.reply({ content: "Registered successfully!", ephemeral: true });
        }
        
        if (interaction.customId === "open_t") {
            const chan = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`, permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            let tkData = load(files.ticket);
            tkData[chan.id] = { owner: interaction.user.id, opened: new Date() };
            save(files.ticket, tkData);
            return interaction.reply({ content: `Ticket: ${chan}`, ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
