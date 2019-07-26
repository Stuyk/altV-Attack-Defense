import * as alt from 'alt';
import * as native from 'natives';

var chooseWeaponView = undefined;
var chooseWeaponEventCreated = false;

alt.onServer('loadModels', loadModels);
alt.onServer('chooseWeapons', chooseWeapons);

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
	if (chooseWeaponView === undefined) {
		chooseWeaponView = new alt.WebView('http://resources/attack-defend/client/html/index.html');
		chooseWeaponView.focus();
		alt.showCursor(true);

		// Create the new webview event once.
		if (!chooseWeaponEventCreated) {
			chooseWeaponEventCreated = true;
			chooseWeaponView.on('loadWeapons', (weaponHashes) => {
				alt.emitServer('loadWeapons', weaponHashes);
				chooseWeaponView.destroy();
				alt.showCursor(false);
				chooseWeaponView = undefined;
			});
		}
	}
}

alt.on('update', () => {
	native.restorePlayerStamina(alt.Player.local.scriptID, 100);
});


