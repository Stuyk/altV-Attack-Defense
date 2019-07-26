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

const modelsToUse = ['mp_m_famdd_01', 'g_m_y_ballasout_01'];
const redTeam = [];
const blueTeam = [];
const capturePoint = { x: -585.9033, y: -1600.66, z: 27.005 };
const unassignedPlayers = [];
const blueTeamSpawn = {x: -586.86, y: -1665.01, z: 19.355};
const redTeamSpawn = {x: -646.25, y: -1721.92, z: 24.511};

const captureColshape = new alt.ColshapeCylinder(capturePoint.x, capturePoint.y, capturePoint.z, 2, 2);

alt.on('playerConnect', (player) => {
	player.model = 'mp_m_freemode_01';
	alt.emitClient(player, 'loadModels', modelsToUse);
	addToTeam(player);
});

alt.on('playerDisconnect', (player) => {
	removeFromTeam(player);
});

alt.on('playerDeath', (victim, attacker, weapon) => {
	removeFromTeam(victim);
	unassignedPlayers.push(victim);
});

// ushort actualDamage = 65536 - damage;
alt.on('playerDamage', (victim, attacker, damage, weapon) => {
	const actualDamage = 65536 - damage;
	if (victim.team === attacker.team) {
		victim.health += actualDamage;
		return;
	}
});

// load weapons for a player
alt.onClient('loadWeapons', (player, weaponHashes) => {
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
	if (redTeam.includes(x => x === player)) {
		let index = redTeam.findIndex(x => x === player);

		if (index !== -1) {
			redTeam.splice(index, 1);
			updateTeams();
		}
	}

	if (blueTeam.includes(x => x === player)) {
		let index = blueTeam.findIndex(x => x === player);

		if (index !== -1) {
			blueTeam.splice(index, 1);
			updateTeams();
		}
	}
}

function handleRedSpawn(player) {
	var pos = utility.RandomPosAround(redTeamSpawn, 10);
	player.spawn(pos.x, pos.y, pos.z, 100);
	player.model = modelsToUse[1]; // Ballas Model
	alt.emitClient(player, 'chooseWeapons');
}

function handleBlueSpawn(player) {
	var pos = utility.RandomPosAround(blueTeamSpawn, 10);
	player.spawn(pos.x, pos.y, pos.z, 100);
	player.model = modelsToUse[0]; // Grove Model
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

chat.registerCmd('pos', (player) => {
	console.log(player.pos);
});

chat.registerCmd('veh', (player, args) => {
	new alt.Vehicle(args[0], player.pos.x, player.pos.y, player.pos.z, 0, 0, 0);
});

