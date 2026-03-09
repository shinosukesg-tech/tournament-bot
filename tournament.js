const fs = require("fs")

const FILE = "./tournament.json"

let data = {
players: [],
matches: [],
winners: [],
completedMatches: [],
round: 1,
maxPlayers: 16,
serverName: "Unknown",
mapName: "Unknown",
prizeName: "Unknown"
}

function load(){

if(fs.existsSync(FILE)){
data = JSON.parse(fs.readFileSync(FILE))
}

}

function save(){

fs.writeFileSync(FILE, JSON.stringify(data,null,2))

}

function reset(maxPlayers,server,map,prize){

data.players=[]
data.matches=[]
data.winners=[]
data.completedMatches=[]
data.round=1
data.maxPlayers=maxPlayers

data.serverName=server
data.mapName=map
data.prizeName=prize

save()

}

function register(userId){

if(data.players.includes(userId)) return false
if(data.players.length>=data.maxPlayers) return false

data.players.push(userId)

save()
return true

}

function unregister(userId){

data.players=data.players.filter(p=>p!==userId)

save()

}

function start(){

let shuffled=[...data.players].sort(()=>Math.random()-0.5)

data.matches=[]
data.completedMatches=[]

for(let i=0;i<shuffled.length;i+=2){

if(shuffled[i+1]){

data.matches.push({
p1:shuffled[i],
p2:shuffled[i+1]
})

}else{

data.matches.push({
p1:shuffled[i],
p2:"BYE"
})

}

}

save()

}

function addWinner(userId,matchIndex){

if(!data.completedMatches.includes(matchIndex)){

data.completedMatches.push(matchIndex)
data.winners.push(userId)

save()

}

}

function nextRound(){

let list=[...data.winners]

data.winners=[]
data.matches=[]
data.completedMatches=[]
data.round++

for(let i=0;i<list.length;i+=2){

if(list[i+1]){

data.matches.push({
p1:list[i],
p2:list[i+1]
})

}else{

data.matches.push({
p1:list[i],
p2:"BYE"
})

}

}

save()

}

load()

module.exports = {
data,
load,
save,
reset,
register,
unregister,
start,
addWinner,
nextRound
}
