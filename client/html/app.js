var weapons = [
	{
			"weaponName": "Pistol",
			"weaponHash": 453432689
	},
	{
			"weaponName": "CombatPistol",
			"weaponHash": 1593441988
	},
	{
			"weaponName": "APPistol",
			"weaponHash": 584646201
	},
	{
			"weaponName": "StunGun",
			"weaponHash": 911657153
	},
	{
			"weaponName": "Pistol50",
			"weaponHash": 2578377531
	},
	{
			"weaponName": "SNSPistol",
			"weaponHash": 3218215474
	},
	{
			"weaponName": "HeavyPistol",
			"weaponHash": 3523564046
	},
	{
			"weaponName": "VintagePistol",
			"weaponHash": 137902532
	},
	{
			"weaponName": "MarksmanPistol",
			"weaponHash": 3696079510
	},
	{
			"weaponName": "HeavyRevolver",
			"weaponHash": 3249783761
	},
	{
			"weaponName": "DoubleActionRevolver",
			"weaponHash": 25487034
	},
	{
			"weaponName": "MicroSMG",
			"weaponHash": 324215364
	},
	{
			"weaponName": "SMG",
			"weaponHash": 736523883
	},
	{
			"weaponName": "SMGMkII",
			"weaponHash": 2024373456
	},
	{
			"weaponName": "AssaultSMG",
			"weaponHash": 4024951519
	},
	{
			"weaponName": "CombatPDW",
			"weaponHash": 171789620
	},
	{
			"weaponName": "MachinePistol",
			"weaponHash": 3675956304
	},
	{
			"weaponName": "MiniSMG",
			"weaponHash": 3173288789
	},
	{
			"weaponName": "PumpShotgun",
			"weaponHash": 487013001
	},
	{
			"weaponName": "SawedOffShotgun",
			"weaponHash": 2017895192
	},
	{
			"weaponName": "AssaultShotgun",
			"weaponHash": 3800352039
	},
	{
			"weaponName": "BullpupShotgun",
			"weaponHash": 2640438543
	},
	{
			"weaponName": "HeavyShotgun",
			"weaponHash": 984333226
	},
	{
			"weaponName": "DoubleBarrelShotgun",
			"weaponHash": 401952761
	},
	{
			"weaponName": "SweeperShotgun",
			"weaponHash": 317205821
	},
	{
			"weaponName": "AssaultRifle",
			"weaponHash": 3220176749
	},
	{
			"weaponName": "CarbineRifle",
			"weaponHash": 2210333304
	},
	{
			"weaponName": "AdvancedRifle",
			"weaponHash": 2937143193
	},
	{
			"weaponName": "SpecialCarbine",
			"weaponHash": 3231910285
	},
	{
			"weaponName": "BullpupRifle",
			"weaponHash": 2132975508
	},
	{
			"weaponName": "CompactRifle",
			"weaponHash": 1649403952
	},
	{
			"weaponName": "MG",
			"weaponHash": 2634544996
	},
	{
			"weaponName": "CombatMG",
			"weaponHash": 2144741730
	},
	{
			"weaponName": "GusenbergSweeper",
			"weaponHash": 1627465347
	},
	{
			"weaponName": "SniperRifle",
			"weaponHash": 100416529
	},
	{
			"weaponName": "HeavySniper",
			"weaponHash": 205991906
	},
	{
			"weaponName": "MarksmanRifle",
			"weaponHash": 3342088282
	},
	{
			"weaponName": "GrenadeLauncherSmoke",
			"weaponHash": 13056645
	},
	{
			"weaponName": "Grenade",
			"weaponHash": 2481070269
	}
]

var weaponsSelected = [];
var grids = new Map();
var currentrow = 0;

$(document).ready(() => {
	loadWeapons();
});

function loadWeapons() {
	currentrow = 0;
	weaponsSelected = [];
	grids = new Map();

	$('#weapongrid').empty();

	for(var i = 0; i < weapons.length; i++) {
		if (!Array.isArray(grids.get(currentrow))) {
			grids.set(currentrow, new Array(0));
		}
		
		grids.get(currentrow).push(weapons[i]);
	
		if (grids.get(currentrow).length >= 5) {
			currentrow += 1;
		}
	}
	
	grids.forEach((element, key) => {
		$('#weapongrid').append(`
			<div class="row">
				<div class="col-md-12 mb-2">
					<div class="btn-group w-100 d-flex" role="group" id="grid-${key}">
	
					</div>
				</div>
			</div>
		`);
	
		element.forEach((wepData) => {
			$(`#grid-${key}`).append(`
				<button type="button" class="btn btn-sm btn-secondary w-100 hashButton" id="${wepData.weaponHash}">${wepData.weaponName}</button>
			`);
		});
	});

	$('#weapongrid').append(`
		<button class="btn btn-sm btn-danger clearButton">Clear Selection</button> 
	`);
}

$(document).on('click', '.hashButton', (e) => {
	weaponsSelected.push(e.target.id);

	$(`#${e.target.id}`).removeClass('btn-secondary');
	$(`#${e.target.id}`).addClass('btn-success');

	if (weaponsSelected.length >= 2) {
		alt.emit('loadWeapons', JSON.stringify(weaponsSelected));
	}
});

$(document).on('click', '.clearButton', () => {
	loadWeapons();
});
