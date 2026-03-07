require("dotenv").config();

/* ================= UPTIME ================= */
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(process.env.PORT || 3000);
/* ========================================== */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const PREFIX = ";";
const STAFF_ROLE = "Tournament Hoster";
const MOD_ROLE = "Moderator";
const DEFAULT_NAME = "ShinTours Tournament";

const BANNER = "https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png";

const TICK = "<:TICK:1467892699578236998>";
const VS = "<:VS:1477014161484677150>";

/* ===== Ticket Panel Images ===== */

const TICKET_IMAGES = [
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807737877008464/Event_Background_Block_Dash_Rush_Teams.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807667366559906/Event_Background_StumbleQuick1.png",
"https://media.discordapp.net/attachments/1343286197346111558/1351125238611705897/Screenshot_1.png",
"https://cdn.discordapp.com/attachments/1478807590971506770/1478807724924866806/Event_Background_MHA_Generic.png"
];

const randomTicketImage = () =>
TICKET_IMAGES[Math.floor(Math.random()*TICKET_IMAGES.length)];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

let tournament = null;

/* ================= UTIL ================= */

const autoDelete = (msg) =>
  setTimeout(() => msg.delete().catch(() => {}), 2000);

const isStaff = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator) ||
  member.roles.cache.some(r => r.name === STAFF_ROLE);

const shuffle = (arr) =>
  [...arr].sort(() => Math.random() - 0.5);

const allFinished = () =>
  tournament && tournament.matches.every(m => m.winner);

/* ================= EMBEDS ================= */

function registrationEmbed() {
  return new EmbedBuilder()
    .setColor("#ff003c")
    .setTitle(`🏆 ${tournament.name}`)
    .setImage(BANNER)
    .setDescription(`
🎮 Mode: **1v1**
🌍 Server: **${tournament.server}**
🗺 Map: **${tournament.map}**
👥 Players: **${tournament.players.length}/${tournament.maxPlayers}**
🔓 Status: **OPEN**
`)
    .setTimestamp();
}

function registrationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("register")
      .setLabel("Register")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("unregister")
      .setLabel("Unregister")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("count")
      .setLabel(`👤 ${tournament.players.length}/${tournament.maxPlayers}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function bracketEmbed() {

  let desc = `🏆 ROUND ${tournament.round}\n\n`;

  tournament.matches.forEach((m, i) => {

    const p1 = m.p1.startsWith("BYE") ? m.p1 : `<@${m.p1}>`;
    const p2 = m.p2.startsWith("BYE") ? m.p2 : `<@${m.p2}>`;

    const title = m.winner ? `Match ${i + 1} ${TICK}` : `Match ${i + 1}`;

    desc += `${title}
${p1} ${VS} ${p2}
${m.winner ? "✔ COMPLETE" : "⏳ Pending"}

`;

  });

  return new EmbedBuilder()
    .setColor("#00ff88")
    .setTitle("📊 LIVE BRACKET")
    .setImage(BANNER)
    .setDescription(desc)
    .setTimestamp();
}

function controlRow() {

  const final = tournament.matches.length === 1;

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId(final ? "announce" : "next")
      .setLabel(final ? "Announce Winner 🏆" : "Next Round")
      .setStyle(final ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(!allFinished())

  );
}

/* ================= COMMANDS ================= */

client.on("messageCreate", async msg => {

  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (msg.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await msg.delete().catch(()=>{});
  }

  if (cmd === "ticketpanel" && args[0] === "add") {

    if (!isStaff(msg.member)) return;

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("🎫 ShinTours Support Center")
      .setDescription(`
Need help or want to apply for staff?

Click the button below to open a **private ticket**.

📌 Our team will assist you shortly.
`)
      .setImage(randomTicketImage())
      .setFooter({ text:"ShinTours Tournament Support" });

    const row = new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setEmoji("🎟️")
        .setStyle(ButtonStyle.Primary)

    );

    await msg.channel.send({ embeds:[embed], components:[row] });
    return;
  }

  if (cmd === "del") {
    tournament = null;
    const m = await msg.channel.send("Tournament deleted.");
    return autoDelete(m);
  }

  /* ===== TOURNAMENT CREATE ===== */

  if (cmd === "1v1") {

    if (!isStaff(msg.member)) return;

    const size = parseInt(args[0]);
    const server = args[1];
    const map = args[2];
    const name = args.slice(3).join(" ") || DEFAULT_NAME;

    if (!size || !server || !map) return;

    tournament = {
      name,
      maxPlayers: size,
      server,
      map,
      players: [],
      matches: [],
      round: 1,
      panelId: null,
      bracketId: null,
      byeCount: 1
    };

    const panel = await msg.channel.send({
      embeds:[registrationEmbed()],
      components:[registrationRow()]
    });

    tournament.panelId = panel.id;
  }

  if (!tournament) return;

  /* ===== START ===== */

  if (cmd === "start") {

    if (tournament.players.length < 2) return;

    tournament.matches = [];
    const shuffled = shuffle(tournament.players);

    if (shuffled.length % 2 !== 0) shuffled.push(`BYE${tournament.byeCount++}`);

    for (let i=0;i<shuffled.length;i+=2){

      tournament.matches.push({
        p1: shuffled[i],
        p2: shuffled[i+1],
        winner: null
      });

    }

    const bracket = await msg.channel.send({
      embeds:[bracketEmbed()],
      components:[controlRow()]
    });

    tournament.bracketId = bracket.id;

  }

  /* ===== ADD BYE ===== */

  if(cmd === "bye"){

    if(!isStaff(msg.member)) return;

    const bye = `BYE${tournament.byeCount++}`;
    tournament.players.push(bye);

    const m = await msg.channel.send(`Added **${bye}**`);
    autoDelete(m);

  }

  /* ===== QUAL ===== */

  if(cmd === "qual"){

    const input = args[0];

    if(!input) return;

    let match;

    if(input.toLowerCase().startsWith("bye")){

      match = tournament.matches.find(
        m => m.p1 === input.toUpperCase() || m.p2 === input.toUpperCase()
      );

      if(!match) return;

      match.winner = input.toUpperCase();

    }else{

      const user = msg.mentions.users.first();
      if(!user) return;

      match = tournament.matches.find(
        m => m.p1 === user.id || m.p2 === user.id
      );

      if(!match) return;

      match.winner = user.id;

    }

    const bracketMsg = await msg.channel.messages.fetch(tournament.bracketId);

    await bracketMsg.edit({
      embeds:[bracketEmbed()],
      components:[controlRow()]
    });

  }

});

/* ================= BUTTONS ================= */

client.on("interactionCreate", async i => {

if(!i.isButton()) return;

if(i.customId === "create_ticket"){

const channel = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{ id:i.guild.id, deny:[PermissionsBitField.Flags.ViewChannel]},
{ id:i.user.id, allow:[PermissionsBitField.Flags.ViewChannel]},
{
id:i.guild.roles.cache.find(r=>r.name===MOD_ROLE)?.id,
allow:[PermissionsBitField.Flags.ViewChannel]
}
]
});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("Close Ticket")
.setStyle(ButtonStyle.Danger)

);

channel.send({
content:`Ticket created by <@${i.user.id}>`,
components:[row]
});

return i.reply({content:"Ticket created!",ephemeral:true});

}

if(i.customId === "close_ticket"){

if(!isStaff(i.member)) return;

await i.reply({content:"Closing ticket...",ephemeral:true});

setTimeout(()=>i.channel.delete().catch(()=>{}),1500);

}

if(!tournament) return;

if(i.customId === "register"){

if(!tournament.players.includes(i.user.id) &&
tournament.players.length < tournament.maxPlayers){

tournament.players.push(i.user.id);

}

const panel = await i.channel.messages.fetch(tournament.panelId);

await panel.edit({
embeds:[registrationEmbed()],
components:[registrationRow()]
});

await i.deferUpdate();

}

if(i.customId === "unregister"){

tournament.players =
tournament.players.filter(p=>p !== i.user.id);

const panel = await i.channel.messages.fetch(tournament.panelId);

await panel.edit({
embeds:[registrationEmbed()],
components:[registrationRow()]
});

await i.deferUpdate();

}

if(i.customId === "next"){

const winners = tournament.matches.map(m=>m.winner);

tournament.round++;

tournament.matches=[];

for(let i=0;i<winners.length;i+=2){

tournament.matches.push({
p1:winners[i],
p2:winners[i+1],
winner:null
});

}

const bracket = await i.channel.messages.fetch(tournament.bracketId);

await bracket.edit({
embeds:[bracketEmbed()],
components:[controlRow()]
});

await i.deferUpdate();

}

if(i.customId === "announce"){

const winnerId = tournament.matches[0].winner;
if(!winnerId) return;

const user = await client.users.fetch(winnerId);

const embed = new EmbedBuilder()
.setColor("#ffd700")
.setTitle("🏆 TOURNAMENT WINNER 🏆")
.setThumbnail(user.displayAvatarURL({dynamic:true}))
.setDescription(`Congratulations <@${winnerId}>!`)
.setImage(BANNER);

await i.channel.send({embeds:[embed]});

tournament = null;

}

});

/* ================= WELCOME SYSTEM ================= */

client.on("guildMemberAdd", async (member) => {

const channel = member.guild.channels.cache.find(
c => c.name === "welcome"
);

if(!channel) return;

const created = member.user.createdAt;

const days = Math.floor(
(Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
);

const position =
member.guild.members.cache
.sort((a,b)=>a.joinedTimestamp-b.joinedTimestamp)
.map(m=>m.id)
.indexOf(member.id) + 1;

const embed = new EmbedBuilder()
.setColor("#9b59ff")
.setTitle(`Welcome ${member.user.username} 👋`)
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`Welcome **${member.user.username}** to 🏆 • **ShinosukeSG**! 🎉  
Have an awesome time with us!`)
.addFields(
{
name:"🆔 User ID",
value: member.id,
inline:false
},
{
name:"📅 Account Created",
value:`${created.toLocaleDateString()}  
(${days} days ago)`,
inline:false
},
{
name:"⏳ Account Age",
value:`${days} days`,
inline:true
},
{
name:"👑 Server Join Position",
value:`${position}th member`,
inline:true
},
{
name:"🎭 Display Name",
value: member.displayName,
inline:false
}
)
.setFooter({
text:`Join the fun • 🏆 • ShinosukeSG • ${member.guild.memberCount} members`
})
.setTimestamp();

channel.send({
content:`Welcome <@${member.id}> 👋`,
embeds:[embed]
});

});

client.login(process.env.TOKEN);

