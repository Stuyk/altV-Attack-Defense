var ready = false;

window.addEventListener('DOMContentLoaded', (e) => {
	ready = true;
	document.getElementById('clickMe').click();
});

function playAudio(name) {
	if (!ready)
		return;

	var audio = new Audio(`./audio/${name}.ogg`);
	audio.loop = false;
	audio.volume = 0.35;
	audio.autoplay = true;
	audio.play();
}

if ('alt' in window) {
	alt.on('playAudio', playAudio);
}