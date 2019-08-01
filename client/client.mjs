import * as alt from 'alt';
import * as native from 'natives';

var chooseWeaponView = undefined;
var capturePointCoords = undefined;
var capturePointBlip = undefined;
var disableControls = false;
var roundTime = undefined;
var roundTimeModifier = 0;
var captureTime = undefined;
var specialCam = undefined;
var hideHud = false;
var aliveTeamMembers = [];
var aliveTeamBlips = [];
var currentlySpectating = false;
var killFeedList = [];
var updatingTeamMembers = false;
var currentTeamColor = 'red';

const screenRes = native.getActiveScreenResolution(0, 0);

// Audio Booleans
var captureAudioPlayed = false;

// Audio Player Webview
// Required to focus/unfocus.
const audioPlayer = new alt.WebView('http://resources/attack-defend/client/html/audioplayer.html');
audioPlayer.focus();
audioPlayer.unfocus();

alt.onServer('loadModels', loadModels); // Called to load models before game join.
alt.onServer('chooseWeapons', chooseWeapons); // Called to select weapons.
alt.onServer('showCapturePoint', showCapturePoint); // Called to set the capture point position.
alt.onServer('disableControls', disablePlayerControls); // Called to disable player controls.
alt.onServer('setRoundTime', setRoundTime); // Called to set the current round time until finished.
alt.onServer('updateCaptureTime', currentCaptureTime); // Called to update the capture time when a player is inside.
alt.onServer('playAudio', playAudio); // Called to play an audio by name.
alt.onServer('setupCamera', setupCamera); // Called to setup the player camera for weapon selection.
alt.onServer('setBlueClothes', setBlueClothes); // Set the blue player team clothes.
alt.onServer('setRedClothes', setRedClothes); // Set the red player team clothes.
alt.onServer('aliveTeamMembers', setAliveTeamMembers); // Set the alive players for a team.
alt.onServer('enableSpectateMode', enableSpectateMode); // Enable spectator mode.
alt.onServer('killFeed', killFeed); // Push kills and deaths to the kill feed.

// Disconnect Event
alt.on('disconnect', () => {
	if (capturePointBlip !== undefined) {
		capturePointBlip.destroy();
	}

	native.destroyAllCams(false);
	native.renderScriptCams(false, false, 0, false, 0);
});

// Constantly Called Drawables and Functions.
alt.on('update', () => {
	// Restore Stamina
	native.restorePlayerStamina(alt.Player.local.scriptID, 100);

	// Draw a marker at the position of the capture point.
	if (capturePointCoords !== undefined) {
		drawMarker(1, capturePointCoords, 2, 2, 0.5, 0, 128, 255, 100);
	}

	// Disable player controls.
	if (disableControls) {
		for(var i = 0; i < 3; i++) {
			native.disableAllControlActions(i);
		}
	}

	// Display Round Time to the user.
	if (roundTime !== undefined && !hideHud) {
		drawText(`Time Left: ${millisToMinutesAndSeconds((roundTime + roundTimeModifier) - Date.now())}`, 0.5, 0.01, 0.5, 255, 255, 255, 100);
	}

	// Display Capture Time to the user
	if (captureTime !== undefined && !hideHud) {
		drawText(`~r~Time Until Captured ~y~${millisToMinutesAndSeconds(captureTime - Date.now())}s`, 0.5, 0.05, 0.5, 255, 255, 255, 100);
	}

	// Switch Players While Spectating
	if (currentlySpectating !== false) {
		if (native.isControlJustPressed(0, 24)) {
			let firstPlayer = aliveTeamMembers.shift();
			aliveTeamMembers.push(firstPlayer);

			if (aliveTeamMembers.length >= 1) {
				native.requestCollisionAtCoord(alt.Player.local.pos.x, alt.Player.local.pos.y, alt.Player.local.pos.z)
				native.networkSetInSpectatorMode(true, aliveTeamMembers[0].scriptID);
			}
		}

		if (aliveTeamMembers[0] !== undefined) {
			drawText('Spectating', 0.5, 0.2, 0.5, 255, 255, 255, 100);
			drawText(`${aliveTeamMembers[0].name}`, 0.5, 0.25, 0.5, 255, 255, 255, 100);
		}
	}

	// Display Kill Feed
	if (killFeedList.length >= 1) {
		killFeedList.forEach((killDetails, index) => {
			if (killDetails.team === 'red') {
				drawText(`~r~${killDetails.victim.name}~w~ was killed by ~b~${killDetails.attacker.name}`, 0.85, 0.05 + (0.05 * index), 0.5, 255, 255, 255, 250 - (index * 50));
			} else {
				drawText(`~b~${killDetails.victim.name}~w~ was killed by ~r~${killDetails.attacker.name}`, 0.85, 0.05 + (0.05 * index), 0.5, 255, 255, 255, 250 - (index * 50));
			}
		});
	}

	// Draw Name Tags
	if (aliveTeamMembers.length >= 1) {
		aliveTeamMembers.forEach((member) => {
			if (member === alt.Player.local)
				return;

			const pos = alt.Player.local.pos;
			const targetPos = member.pos;

			if (Distance(pos, targetPos) <= 20) {
				let [_result, _x, _y] = native.getScreenCoordFromWorldCoord(targetPos.x, targetPos.y, targetPos.z + 1.25, undefined, undefined)
				
				if (_result) {
					_y -= 0.4 * (0.005 * (screenRes[2] / 1080));

					drawText(`${member.name}`, _x, _y, 0.4, 255, 255, 255, 150);
				}
			}
		});
	}

	// Update Blip Positions
	if (!updatingTeamMembers && aliveTeamBlips.length >= 1) {
		aliveTeamBlips.forEach((memberInfo) => {
			memberInfo.blip.position = [memberInfo.member.pos.x, memberInfo.member.pos.y, memberInfo.member.pos.z];
		});
	}
});

// Requests player models if they're not available yet.
function loadModels(modelNames) {
	if (!Array.isArray(modelNames))
		return;

	modelNames.forEach((model) => {
		const modelHashKey = native.getHashKey(model);

		if (!native.hasModelLoaded(modelHashKey)) {
			alt.log(`Loading model: ${model}`);
			native.requestModel(modelHashKey);
		}
	});
}

// Show the choose weapon screen.
function chooseWeapons() {
	native.doScreenFadeIn(1000);
	currentlySpectating = false;
	native.networkSetInSpectatorMode(false, alt.Player.local.scriptID);
	disablePlayerControls(true);
	setupCamera(capturePointCoords);
	
	if (chooseWeaponView === undefined || chooseWeaponView === null) {
		native.transitionToBlurred(1000);
		native.displayRadar(false);

		chooseWeaponView = new alt.WebView('http://resources/attack-defend/client/html/index.html');
		chooseWeaponView.focus();
		chooseWeaponView.on('loadWeapons', selectWeapons);
		alt.showCursor(true);
	}
}

// Display a blip for the capture point.
function showCapturePoint(coords) {
	coords.z = coords.z - 1;
	capturePointCoords = coords;

	if (capturePointBlip !== undefined) {
		capturePointBlip.position = [coords.x, coords.y, coords.z]
		return;
	}

	capturePointBlip = new alt.PointBlip(coords.x, coords.y, coords.z);
	capturePointBlip.sprite = 38;
	capturePointBlip.color = 3;
}

// Weapons selected from the webview.
function selectWeapons(weaponHashes) {
	currentlySpectating = false;
	alt.emitServer('loadWeapons', weaponHashes);

	chooseWeaponView.off('loadWeapons', selectWeapons);
	chooseWeaponView.destroy();
	
	alt.showCursor(false);
	chooseWeaponView = undefined;
	disablePlayerControls(false);
	clearCamera();

	native.transitionFromBlurred(1000)
	native.displayRadar(true);
	hideHud = false;
}

// Disable the player's controls or enable.
function disablePlayerControls(state) {
	disableControls = state;
}

// Set the current round time left.
function setRoundTime(newRoundTime, newRoundModifier) {
	if (newRoundTime === null || newRoundTime === undefined) {
		roundTime = undefined;
		roundTimeModifier = 0;
		return;
	}

	roundTime = newRoundTime;
	roundTimeModifier = newRoundModifier;
	playAudio('roundstart');
}

// Set the end time for the capture point.
function currentCaptureTime(timeInMS) {
	if (timeInMS === undefined || timeInMS === null) {
		captureTime = undefined;
		captureAudioPlayed = false;
		return;
	}

	captureTime = timeInMS; // Considered the end time for the capture.

	if (!captureAudioPlayed) {
		captureAudioPlayed = true;
		playAudio('capturing');
	}
}

// Setup a camera that points at the capture point.
function setupCamera(camPos) {
	currentlySpectating = false;
	if (camPos === undefined)
		return;
	
	specialCam = native.createCamWithParams("DEFAULT_SCRIPTED_CAMERA", camPos.x + 3, camPos.y + 3, camPos.z + 5, 0, 0, 0, 90, true, 0);
	native.pointCamAtCoord(specialCam, camPos.x, camPos.y, camPos.z)
	native.renderScriptCams(true, false, 0, true, false);
}

// Clear any special cameras.
function clearCamera() {
	specialCam = undefined;
	native.destroyAllCams(false);
	native.renderScriptCams(false, false, 0, false, false);
}

// Play audio through the webview.
function playAudio(audioName) {
	audioPlayer.emit('playAudio', audioName);
}

// Update alive team members for nametags, and blips.
function setAliveTeamMembers(players, teamColor) {
	aliveTeamMembers = players;
	currentTeamColor = teamColor;

	if (updatingTeamMembers)
		return;

	updatingTeamMembers = true;
	if (aliveTeamBlips.length >= 1) {
		while(aliveTeamBlips.length >= 1) {
			var data = aliveTeamBlips.pop();

			if (data.blip !== undefined) {
				data.blip.destroy();
			}
		}
	}
 
	alt.log('created first round of blips.');

	aliveTeamMembers.forEach((member) => {
		let newBlip = new alt.PointBlip(member.pos.x, member.pos.y, member.pos.z);
		newBlip.sprite = 1;

		if (teamColor === 'red') {
			newBlip.color = 1;
		} else {
			newBlip.color = 3;
		}
		
		aliveTeamBlips.push({member, blip: newBlip});
	});
	updatingTeamMembers = false;
}

// Enabled spectator mode.
function enableSpectateMode() {
	currentlySpectating = true;
	native.doScreenFadeOut(1000);

	alt.setTimeout(() => {
		// Requires request collision at coord; to show the players.
		native.requestCollisionAtCoord(alt.Player.local.pos.x, alt.Player.local.pos.y, alt.Player.local.pos.z)
		native.doScreenFadeIn(1000);

		if (aliveTeamMembers[0] !== undefined) {
			native.networkSetInSpectatorMode(true, aliveTeamMembers[0].scriptID);
		}
	}, 3000);
}

// Display 4 Kills / Deaths
function killFeed(victim, attacker, team) {
	killFeedList.unshift({victim, attacker, team});

	if (killFeedList.length >= 5) {
		killFeedList.pop();
	}
}

// Update freemode models to specific colors for blue team.
function setBlueClothes() {
	native.setPedComponentVariation(alt.Player.local.scriptID, 0, 0, 0, 0); // Face
	native.setPedComponentVariation(alt.Player.local.scriptID, 1, 21, 0, 0); // Head
	native.setPedComponentVariation(alt.Player.local.scriptID, 2, 0, 0, 0); // Hair
	native.setPedComponentVariation(alt.Player.local.scriptID, 3, 1, 0, 0); // Torso
	native.setPedComponentVariation(alt.Player.local.scriptID, 4, 13, 0, 0); // Legs
	native.setPedComponentVariation(alt.Player.local.scriptID, 6, 1, 0, 0); // Shoes
	native.setPedComponentVariation(alt.Player.local.scriptID, 8, 15, 0, 0); // Undershirt
	native.setPedComponentVariation(alt.Player.local.scriptID, 11, 14, 0, 0); // Top
}

// Update freemode models to specific colors for red team.
function setRedClothes() {
	native.setPedComponentVariation(alt.Player.local.scriptID, 0, 0, 0, 0); // Face
	native.setPedComponentVariation(alt.Player.local.scriptID, 1, 26, 0, 0); // Head
	native.setPedComponentVariation(alt.Player.local.scriptID, 2, 0, 0, 0); // Hair
	native.setPedComponentVariation(alt.Player.local.scriptID, 3, 1, 0, 0); // Torso
	native.setPedComponentVariation(alt.Player.local.scriptID, 4, 13, 0, 0); // Legs
	native.setPedComponentVariation(alt.Player.local.scriptID, 6, 1, 0, 0); // Shoes
	native.setPedComponentVariation(alt.Player.local.scriptID, 8, 15, 0, 0); // Undershirt
	native.setPedComponentVariation(alt.Player.local.scriptID, 11, 79, 0, 0); // Top
}

// Draw marker function; must be called in update function.
function drawMarker(type, pos, scaleX, scaleY, scaleZ, r, g, b, a) {
	native.drawMarker(
		type, // type
		pos.x, //x
		pos.y, //y
		pos.z, //z
		0, //dir.x
		0, //dir.y
		0, //dir.z
		0, //rot.x
		0, //rot.y
		0, //rot.z
		scaleX, //scale.x
		scaleY, //scale.y
		scaleZ, //scale.z
		r, //r
		g, //g
		b, //b
		a, //alpha
		false, // ?
		false, // ?
		2, // ?
		false, // ?
		undefined,
		undefined,
		false
	);
}

// Get distance between two points.
function Distance(vector1, vector2) {
	if (vector1 === undefined || vector2 === undefined) {
		throw new Error('AddVector => vector1 or vector2 is undefined');
	}
	return Math.sqrt(Math.pow(vector1.x - vector2.x, 2) + Math.pow(vector1.y - vector2.y, 2) + Math.pow(vector1.z - vector2.z, 2));
}

// Draw text; must be called in update function.
function drawText(msg, x, y, scale, r, g, b, a) {
	native.setUiLayer(50);
	native.beginTextCommandDisplayText('STRING');
	native.addTextComponentSubstringPlayerName(msg);
	native.setTextFont(4);
	native.setTextScale(1, scale);
	native.setTextWrap(0.0, 1.0);
	native.setTextCentre(true);
	native.setTextColour(r, g, b, a);
	native.setTextOutline();
	native.endTextCommandDisplayText(x, y)
}

// Calculate milliseconds to minutes; and display as string.
function millisToMinutesAndSeconds(millis) {
	var minutes = Math.floor(millis / 60000);
	var seconds = ((millis % 60000) / 1000).toFixed(0);
	return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}