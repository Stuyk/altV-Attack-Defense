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

// Current Maps
var captureRotation = [
	{
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
	},
	{
		capturePoint: {
			x: -115.68791198730469,
			y: -2366.32080078125,
			z: 13.778076171875 
		},
		redTeamSpawn: {
			x: -280.4175720214844,
			y: -2411.472412109375,
			z: 5.993408203125
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
	alt.emitClient(attacker, 'playAudio', 'playerkill');
	unassignedPlayers.push(victim);
	removeFromTeam(victim);

	// Red Team Dies
	if (redTeam.length <= 0) {
		resetRound();
		chat.broadcast(`Blue team has won the round.`);
		alt.emitClient(null, 'playAudio', 'bluewins');
	// Blue Team Dies
	} else if(blueTeam.length <= 0) {
		resetRound();
		chat.broadcast(`Red team has won the round.`);
		alt.emitClient(null, 'playAudio', 'redwins');
	}

	alt.emitClient(victim, 'enableSpectateMode');
	alt.emitClient(null, 'killFeed', victim, attacker, victim.team);
});

// ushort actualDamage = 65536 - damage;
alt.on('playerDamage', (victim, attacker, damage, weapon) => {
	const actualDamage = 65536 - damage;
	if (attacker.team === null || attacker.team === undefined) {
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
	if (player.pos !== undefined) {
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
			if(redMember === undefined || redMember === null)
				return;
	
			alt.emitClient(redMember, 'setTeamMembers', redTeam);
		});
	}

	if (blueTeam.length >= 1) {
		blueTeam.forEach((blueMember) => {
			if (blueMember === undefined || blueMember === null)
				return;
	
			alt.emitClient(blueMember, 'setTeamMembers', blueTeam);
		});
	}

	unassignedPlayers.forEach((player) => {
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
		alt.emitClient(player, 'aliveTeamMembers', blueTeam, 'blue');
	});

	redTeam.forEach((player) => {
		alt.emitClient(player, 'aliveTeamMembers', redTeam, 'red');
	});
}

// Called to reset the round; and start a new one.
function resetRound() {
	roundStartTime = undefined;
	alt.emitClient(null, 'setRoundTime', undefined);
	alt.emitClient(null, 'updateCaptureTime', undefined);
	alt.emitClient(null, 'disableControls', true);
	alt.emitClient(null, 'setupCamera', capturePoint);
	captureEnterTime = undefined;
	
	alt.Player.all.forEach((target) => {
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

	capturePointShape.destroy();
	capturePointShape = new alt.ColshapeCylinder(capturePoint.x, capturePoint.y, capturePoint.z - 1, 2, 5);

	// Update Local Point
	alt.emitClient(null, 'showCapturePoint', capturePoint);

	// Round Reset
	setTimeout(() => {
		roundStartTime = Date.now();
		alt.emitClient(null, 'setRoundTime', roundStartTime, roundTimeModifier);
		alt.Player.all.forEach((target) => {
			addToTeam(target);
		});

		unassignedPlayers = [];
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
	alt.emitClient(null, 'playAudio', 'redwins');
	chat.broadcast(`Red team has won the round.`);
}, 500);

// Weather / Date Updater
setInterval(() => {
	alt.Player.all.forEach((player) => {
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
}, 5000);


chat.registerCmd('pos', (player) => {
	console.log(player.pos);
});

chat.registerCmd('veh', (player) => {
	new alt.Vehicle('infernus', player.pos.x, player.pos.y, player.pos.z, 0, 0, 0);
});