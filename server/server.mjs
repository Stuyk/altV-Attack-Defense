import * as alt from 'alt';
import chat from 'chat';
import * as utility from './utility.mjs';

/**
 * Summary:
 * Gamemode consists of two teams.
 * Blue team defends the site.
 * Red team is attacking the site.
 * Each round has 5 minutes.
 * The red team must stand in the checkpoint for 20 secs or kill the blue team.
 * 1 Life for All Players Per Round
 * 2 Weapons are picked per player on round start.
 * Red team can spawn vehicles to get there.
 * AutoShuffle teams after each round.
 */

const modelsToUse = ['mp_m_freemode_01', 'mp_m_freemode_01'];
const redTeam = []; // Red Team Members
const blueTeam = []; // Blue Team Members
var unassignedPlayers = []; // Players who die are assigned to this array.
var captureEnterTime = undefined; // The time when the player enters the capture point.
var roundStartTime = Date.now(); // Set the round start time; changes frequently.
var roundTimeModifier = 300000; // 5 Minutes
var restartingRound = false;

// Current Maps
var captureRotation = [
	{ // Dock Warehouse
		capturePoint: { 
			x: 135.4681396484375, 
			y: -3092.4130859375, 
			z: 5.892333984375 
		},
		redTeamSpawn: { 
			x: 284.05712890625, 
			y: -3160.918701171875, 
			z: 5.791259765625 
		}
	}, // Plaza
	{
		capturePoint: {
			x: 180.84396362304688,
        	y: -969.085693359375,
        	z: 29.5662841796875
		},
		redTeamSpawn: {
			x: 236.3208770751953,
			y: -751.5560302734375,
			z: 33.863037109375
		}
	},
	{ // Bus Station
		capturePoint: {
			x: 471.8241882324219,
			y: -584.3208618164062,
			z: 27.7464599609375
		},
		redTeamSpawn: {
			x: 381.6131896972656,
			y: -753.5472412109375,
			z: 28.5384521484375
		}
	},
	{ // Air Field
		capturePoint: {
			x: 2135.274658203125,
			y: 4779.25732421875,
			z: 40.956787109375
		},
		redTeamSpawn: {
			x: 2164.800048828125,
        	y: 4725.40234375,
        	z: 40.198486328125
		}
	}, // Biker Trailer Park
	{
		capturePoint: {
			x: 78.73846435546875,
			y: 3707.208740234375,
			z: 41.07470703125
		},
		redTeamSpawn: {
			x: 125.53845977783203,
			y: 3572.808837890625,
			z: 38.5303955078125
		}
	}, // Treatre
	{
		capturePoint: {
			x: 686.2944946289062,
        	y: 577.87255859375,
        	z: 130.4461669921875
		},
		redTeamSpawn: {
			x: 860.7042846679688,
			y:506.6115417480469,
			z:126.3474349975586
		}
	}
];

// Spawn Points and Such
var capturePoint = captureRotation[0].capturePoint;
var redTeamSpawn = captureRotation[0].redTeamSpawn;

// Capture Point Colshape
var capturePointShape = new alt.ColshapeCylinder(capturePoint.x, capturePoint.y, capturePoint.z - 1, 2, 5);

// Called on first join.
alt.on('playerConnect', (player) => {
	chat.broadcast(`${player.name} has joined the server.`);
	player.setDateTime(1, 1, 1, 12, 0, 0);
	player.setWeather(8);
	player.model = 'mp_m_freemode_01';
	alt.emitClient(player, 'loadModels', modelsToUse);
	alt.emitClient(player, 'setRoundTime', roundStartTime, roundTimeModifier);
	addToTeam(player);
});

// When the player leaves we remove them from the team.
alt.on('playerDisconnect', (player) => {
	removeFromTeam(player);
});

// Called when a player is eliminated from the match.
alt.on('playerDeath', (victim, attacker, weapon) => {
	unassignedPlayers.push(victim);
	removeFromTeam(victim);

	if (attacker !== null && attacker.constructor.name === "Player") {
		alt.emitClient(attacker, 'playAudio', 'playerkill');
	}

	if (victim.constructor.name === "Player" && attacker !== null && attacker.constructor.name === "Player") {
		alt.emitClient(null, 'killFeed', victim.name, attacker.name, victim.team);
		alt.emitClient(victim, 'enableSpectateMode');
	}

	// Red Team Dies
	if (redTeam.length <= 0) {
		resetRound();
		alt.emitClient(null, 'showWinScreen', 'blue');
		chat.broadcast(`Blue team has won the round.`);
		alt.emitClient(null, 'playAudio', 'bluewins');
		return;
	
	}
	
	if (blueTeam.length <= 0) {
		resetRound();
		alt.emitClient(null, 'showWinScreen', 'red');
		chat.broadcast(`Red team has won the round.`);
		alt.emitClient(null, 'playAudio', 'redwins');
		return;
	}
});

alt.on('chatIntercept', (player, msg) => {
	if(player.team === 'red')
		chat.broadcast(`{FF0000}${player.name} {FFFFFF}: ${msg}`);
	else 
		chat.broadcast(`{0000FF}${player.name} {FFFFFF}: ${msg}`);
});

// ushort actualDamage = 65536 - damage;
alt.on('playerDamage', (victim, attacker, damage, weapon) => {
	const actualDamage = 65536 - damage;
	if (victim.constructor.name !== "Player" || attacker.constructor.name !== "Player") {
		return;
	}
	
	if (attacker.team === undefined) {
		return;
	}
	
	// Prevent team killing.
	if (victim.team === attacker.team) {
		victim.health += actualDamage;
		return;
	}
});

// Called when the player enters the capture point.
alt.on('entityEnterColshape', (colshape, entity) => {
	if (roundStartTime === undefined)
		return;
	
	if (entity.team !== 'red')
		return;

	if (captureEnterTime !== undefined)
		return;

	captureEnterTime = Date.now();
	chat.broadcast(`{FF0000}${entity.name}{FFFFFF} is capturing the point.`)
});

// Caled when the player leaves the capture point.
alt.on('entityLeaveColshape', (colshape, entity) => {
	if (roundStartTime === undefined)
		return;
	
	if (entity.team !== 'red')
		return;

	var isSomeoneInsideStill = false;

	redTeam.forEach((teamMember) => {
		if (colshape.isEntityIn(teamMember)) {
			isSomeoneInsideStill = true;
		}
	});

	// Reset capture time.
	if (!isSomeoneInsideStill) {
		captureEnterTime = undefined;	
		chat.broadcast(`{FF0000}Nobody; {FFFFFF}is currently capturing the point.`);
		alt.emitClient(null, 'playAudio', 'capturefailed');
	}
});

// load weapons for a player
alt.onClient('loadWeapons', (player, weaponHashes) => {
	player.removeAllWeapons();
	
	var parsedArray = JSON.parse(weaponHashes);
	
	if (!Array.isArray(parsedArray))
		return;

	parsedArray.forEach((wep) => {
		player.giveWeapon(wep, 999, true);
	});
});

/**
 * Autoselect a team for a player.
 * @param player 
 */
function addToTeam(player) {
	alt.emitClient(player, 'showCapturePoint', capturePoint);
	
	if (redTeam.length <= blueTeam.length) {
		player.team = 'red';
		redTeam.push(player);
		handleRedSpawn(player);
		alt.emitClient(player, 'setRedClothes');

		redTeam.forEach((redMember) => {
			if (redMember === player) {
				chat.send(redMember, `You have joined the {FF0000}red team`);
				return;
			}
			
			chat.send(redMember, `${player.name} has joined your {FF0000}team`);
		});
	} else {
		player.team = 'blue';
		blueTeam.push(player);
		handleBlueSpawn(player);
		alt.emitClient(player, 'setBlueClothes');

		blueTeam.forEach((blueMember) => {
			if (blueMember === player) {
				chat.send(blueMember, `You have joined the {0000FF}blue team`);
				return;
			}

			chat.send(blueMember, `${player.name} has joined your {0000FF}team`);
		});
	}

	updateAlivePlayers();
}

/**
 * Auto remove a player from a team.
 * @param player 
 */
function removeFromTeam(player) {
	if (player.constructor.name === "Player") {
		if (player.team === 'red') {
			var pos = utility.RandomPosAround(redTeamSpawn, 3);
			player.pos = pos;
		} else {
			var pos = utility.RandomPosAround(capturePoint, 3);
			player.pos = pos;
		}
	}
	
	if (player.team === 'red') {
		let index = redTeam.findIndex(x => x === player);
		if (index !== -1) {
			redTeam.splice(index, 1);
			updateTeams();
		}
	}

	if (player.team === 'blue') {
		let index = blueTeam.findIndex(x => x === player);

		if (index !== -1) {
			blueTeam.splice(index, 1);
			updateTeams();
		}
	}
}

/**
 * Called to spawn a red team member.
 * @param player 
 */
function handleRedSpawn(player) {
	var pos = utility.RandomPosAround(redTeamSpawn, 5);
	player.spawn(pos.x, pos.y, pos.z, 100);
	player.model = modelsToUse[1]; // Ballas Model
	player.health = 200;
	alt.emitClient(player, 'chooseWeapons');
}

/**
 * Called to spawn a blue team member.
 * @param player 
 */
function handleBlueSpawn(player) {
	var pos = utility.RandomPosAround(capturePoint, 5);
	player.spawn(pos.x, pos.y, pos.z, 100);
	player.model = modelsToUse[0]; // Grove Model
	player.health = 200;
	alt.emitClient(player, 'chooseWeapons');
}

/**
 * Update the client-side team member array; to display their current
 * team members.
 */
function updateTeams() {
	if (redTeam.length >= 1) {
		redTeam.forEach((redMember) => {
			if (redMember.constructor.name !== "Player")
				return;
	
			alt.emitClient(redMember, 'setTeamMembers', redTeam);
		});
	}

	if (blueTeam.length >= 1) {
		blueTeam.forEach((blueMember) => {
			if (blueMember.constructor.name !== "Player")
				return;
	
			alt.emitClient(blueMember, 'setTeamMembers', blueTeam);
		});
	}

	unassignedPlayers.forEach((player) => {
		if (player.constructor.name !== "Player")
			return;
		
		if (player.team === 'red') {
			alt.emitClient(player, 'aliveTeamMembers', redTeam, 'red');
		} else {
			alt.emitClient(player, 'aliveTeamMembers', blueTeam, 'blue');
		}
	});

	updateAlivePlayers();
}

/**
 * Update alive players with their currently available team.
 */
function updateAlivePlayers() {
	blueTeam.forEach((player) => {
		if (player.constructor.name !== "Player")
			return;
		
		alt.emitClient(player, 'aliveTeamMembers', blueTeam, 'blue');
	});

	redTeam.forEach((player) => {
		if (player.constructor.name !== "Player")
			return;
		
		alt.emitClient(player, 'aliveTeamMembers', redTeam, 'red');
	});
}

function shuffle(array) {
	let counter = array.length;
  
	while (counter > 0) {
	  let index = Math.floor(Math.random() * counter);
  
	  counter--;
  
	  let temp = array[counter];
	  array[counter] = array[index];
	  array[index] = temp;
	}
  
	return array;
}


// Called to reset the round; and start a new one.
function resetRound() {
	if (restartingRound)
		return;

	restartingRound = true;
	
	roundStartTime = undefined;
	alt.emitClient(null, 'setRoundTime', undefined);
	alt.emitClient(null, 'updateCaptureTime', undefined);
	alt.emitClient(null, 'disableControls', true);
	alt.emitClient(null, 'setupCamera', capturePoint);
	captureEnterTime = undefined;
	
	alt.Player.all.forEach((target) => {
		if (target.constructor.name !== "Player")
			return;
		
		removeFromTeam(target);
	});

	// Clear red team.
	while(redTeam.length >= 1) {
		removeFromTeam(redTeam.pop());
	}

	// Clear blue team.
	while(blueTeam.length >= 1) {
		removeFromTeam(blueTeam.pop());
	}

	// Change Map
	var firstMap = captureRotation.shift();
	captureRotation.push(firstMap);

	redTeamSpawn = captureRotation[0].redTeamSpawn;
	capturePoint = captureRotation[0].capturePoint;

	// Round Reset
	setTimeout(() => {
		// Setup New Point
		capturePointShape.destroy();
		capturePointShape = new alt.ColshapeCylinder(capturePoint.x, capturePoint.y, capturePoint.z - 1, 2, 5);

		// Update Local Point
		alt.emitClient(null, 'showCapturePoint', capturePoint);

		roundStartTime = Date.now();
		alt.emitClient(null, 'setRoundTime', roundStartTime, roundTimeModifier);
		
		var lastShuffle = alt.Player.all;
		for(var i = 0; i < 10; i++) {
			lastShuffle = shuffle(lastShuffle);
		}
		
		lastShuffle.forEach((target) => {
			if (target.constructor.name !== "Player")
				return;
			
			addToTeam(target);
		});

		unassignedPlayers = [];
		restartingRound = false;
	}, 5000);
}

// Interval for Capturing
setInterval(() => {
	if (roundStartTime === undefined)
		return;
	
	if (captureEnterTime === undefined) {
		alt.emitClient(null, 'updateCaptureTime', undefined);
		return;
	}

	if (captureEnterTime + 15000 > Date.now()) {
		alt.emitClient(null, 'updateCaptureTime', captureEnterTime + 15000);
		return;
	}

	resetRound();
	alt.emitClient(null, 'showWinScreen', 'red');
	alt.emitClient(null, 'playAudio', 'redwins');
	chat.broadcast(`Red team has won the round.`);
}, 500);

// Weather / Date Updater
setInterval(() => {
	alt.Player.all.forEach((player) => {
		if (player.constructor.name !== "Player")
			return;
		
		player.setDateTime(1, 1, 1, 12, 0, 0);
		player.setWeather(8);
	});
}, 60000);

// Round Timer
setInterval(() => {
	if (roundStartTime === undefined)
		return;

	if (Date.now() < roundStartTime + roundTimeModifier)
		return;

	resetRound();
	chat.broadcast(`Blue team has won the round.`);
	alt.emitClient(null, 'playAudio', 'bluewins');
	alt.emitClient(null, 'showWinScreen', 'blue');
}, 5000);

chat.registerCmd('players', (player, arg) => {
	chat.send(player, `{FFFF00}Players In-Game`);
	alt.Player.all.forEach((target) => {
		chat.send(player, `${target.name}`)
	});
});