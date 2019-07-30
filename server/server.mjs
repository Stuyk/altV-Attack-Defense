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
const redTeam = [];
const blueTeam = [];
const capturePoint = { x: 135.4681396484375, y: -3092.4130859375, z: 5.892333984375 };
const blueTeamSpawn = { x: 134.36044311523438, y: -2992.773681640625, z: 7.021240234375 }
const redTeamSpawn = { x: 284.05712890625, y: -3160.918701171875, z: 5.791259765625 };
var unassignedPlayers = [];
var captureEnterTime = undefined;
var roundStartTime = Date.now();
var roundTimeModifier = 300000; // 5 Minutes

new alt.ColshapeCylinder(capturePoint.x, capturePoint.y, capturePoint.z - 1, 2, 5);

alt.on('playerConnect', (player) => {
	chat.broadcast(`${player.name} has joined the server.`);
	player.setDateTime(1, 1, 1, 12, 0, 0);
	player.setWeather(8);
	player.model = 'mp_m_freemode_01';
	alt.emitClient(player, 'loadModels', modelsToUse);
	alt.emitClient(player, 'showCapturePoint', capturePoint);
	alt.emitClient(player, 'setRoundTime', roundStartTime, roundTimeModifier);
	addToTeam(player);
});

alt.on('playerDisconnect', (player) => {
	removeFromTeam(player);
});

alt.on('playerDeath', (victim, attacker, weapon) => {
	alt.emitClient(attacker, 'playAudio', 'playerkill');
	removeFromTeam(victim);
	unassignedPlayers.push(victim);
	alt.emitClient(victim, 'setupCamera', capturePoint);

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
	if (attacker.team === null || attacker.team === undefined) {
		return;
	}
	
	if (victim.team === attacker.team) {
		victim.health += actualDamage;
		return;
	}
});

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
			var pos = utility.RandomPosAround(blueTeamSpawn, 3);
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

function handleRedSpawn(player) {
	var pos = utility.RandomPosAround(redTeamSpawn, 5);
	player.spawn(pos.x, pos.y, pos.z, 100);
	player.model = modelsToUse[1]; // Ballas Model
	player.health = 200;
	alt.emitClient(player, 'chooseWeapons');
}

function handleBlueSpawn(player) {
	var pos = utility.RandomPosAround(blueTeamSpawn, 5);
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
}

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

chat.registerCmd('cap', (player) => {
	player.pos = capturePoint;
});

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
