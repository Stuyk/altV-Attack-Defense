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

// Audio Booleans
var captureAudioPlayed = false;

const audioPlayer = new alt.WebView('http://resources/attack-defend/client/html/audioplayer.html');

audioPlayer.focus();
audioPlayer.unfocus();

// [{"model":812467272,"coords":{"x":-589.5238037109375,"y":-1621.549560546875,"z":33.160587310791016}}]

alt.onServer('loadModels', loadModels);
alt.onServer('chooseWeapons', chooseWeapons);
alt.onServer('showCapturePoint', showCapturePoint);
alt.onServer('disableControls', disablePlayerControls);
alt.onServer('setRoundTime', setRoundTime);
alt.onServer('updateCaptureTime', currentCaptureTime);
alt.onServer('playAudio', playAudio);
alt.onServer('setupCamera', setupCamera);
alt.onServer('setBlueClothes', setBlueClothes);
alt.onServer('setRedClothes', setRedClothes);

alt.on('disconnect', () => {
	if (capturePointBlip !== undefined) {
		capturePointBlip.destroy();
	}

	native.destroyAllCams(false);
	native.renderScriptCams(false, false, 0, false, 0);
});

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
});

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

function chooseWeapons() {
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

	if (capturePointBlip !== undefined)
		return;

	capturePointBlip = new alt.PointBlip(coords.x, coords.y, coords.z);
	capturePointBlip.sprite = 38;
	capturePointBlip.color = 3;
}

// Weapons selected from the webview.
function selectWeapons(weaponHashes) {
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

function setupCamera(camPos) {
	if (camPos === undefined)
		return;
	
	specialCam = native.createCamWithParams("DEFAULT_SCRIPTED_CAMERA", camPos.x + 3, camPos.y + 3, camPos.z + 5, 0, 0, 0, 90, true, 0);
	native.pointCamAtCoord(specialCam, camPos.x, camPos.y, camPos.z)
	native.renderScriptCams(true, false, 0, true, false);
}

function clearCamera() {
	specialCam = undefined;
	native.destroyAllCams(false);
	native.renderScriptCams(false, false, 0, false, false);
}

function playAudio(audioName) {
	audioPlayer.emit('playAudio', audioName);
}

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

function Distance(vector1, vector2) {
	if (vector1 === undefined || vector2 === undefined) {
		throw new Error('AddVector => vector1 or vector2 is undefined');
	}
	return Math.sqrt(Math.pow(vector1.x - vector2.x, 2) + Math.pow(vector1.y - vector2.y, 2) + Math.pow(vector1.z - vector2.z, 2));
}

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

function millisToMinutesAndSeconds(millis) {
	var minutes = Math.floor(millis / 60000);
	var seconds = ((millis % 60000) / 1000).toFixed(0);
	return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

function vehicleDoesSomething() {
	
}