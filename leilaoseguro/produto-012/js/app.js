document.querySelectorAll('[data-end]').forEach(el => {
	const end = Date.now() + (15 + Math.floor(Math.random() * 76)) * 60 * 1000;
	el.style.color = '#000';
	const tick = () => { const left = Math.max(0, end - Date.now()); el.textContent = `⏱ Termina em ${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m ${Math.floor((left % 60000) / 1000)}s`; };
	tick(); setInterval(tick, 1000);
});

