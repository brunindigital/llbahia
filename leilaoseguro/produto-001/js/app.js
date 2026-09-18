document.querySelectorAll('[data-end]').forEach(el => {
	const end = Date.now() + (15 + Math.floor(Math.random() * 76)) * 60 * 1000;
	el.style.color = '#000';
	const tick = () => {
		const left = Math.max(0, end - Date.now());
		const h = Math.floor(left / 3600000);
		const m = Math.floor((left % 3600000) / 60000);
		const s = Math.floor((left % 60000) / 1000);
		el.textContent = `⏱ Termina em ${h}h ${m}m ${s}s`;
	};
	tick();
	setInterval(tick, 1000);
});
