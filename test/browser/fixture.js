await import('../../define.js');
document.querySelector('form').addEventListener('submit', (event) => {
	if (event.defaultPrevented) return;
	event.preventDefault();
	globalThis.submission = Object.fromEntries(
		new FormData(event.target, event.submitter),
	);
});
