var weaponsSelected = [];

$(() => {
	weaponsSelected = [];
});

$('button').click((e) => {
	weaponsSelected.push(e.target.id);

	$("#lastSelected").append(`<p>${e.target.id}</p>`)

	if (weaponsSelected.length >= 2) {
		alt.emit('loadWeapons', JSON.stringify(weaponsSelected));
		weaponsSelected = [];
	}
});