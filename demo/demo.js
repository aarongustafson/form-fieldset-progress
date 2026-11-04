import './transitions.js';

document.addEventListener('form-fieldset-progress:error', (event) => {
	if (event.target.id === 'failure') {
		document.querySelector('#setup-error').textContent =
			`Enhancement unavailable: ${event.detail.error.message}`;
	} else {
		console.error('Form enhancement failed:', event.detail.error);
	}
});

await import('../define.js');

document
	.querySelector('#events')
	.addEventListener('form-fieldset-progress:change', ({ detail }) => {
		document.querySelector('#section-event').textContent = JSON.stringify(
			{
				previousIndex: detail.previousIndex,
				stepIndex: detail.stepIndex,
				stepCount: detail.stepCount,
				fieldset: detail.fieldset.id,
			},
			null,
			2,
		);
	});

for (const form of document.querySelectorAll('form')) {
	form.addEventListener('submit', (event) => {
		if (event.defaultPrevented) return;
		event.preventDefault();
		const result = form.querySelector('[data-result]');
		result.textContent =
			result.dataset.success || 'Demo complete. No data was sent.';
	});
	form.addEventListener('reset', () => {
		form.querySelector('[data-result]').textContent = '';
	});
}

document.querySelector('#repair').addEventListener('click', () => {
	const host = document.querySelector('#failure');
	host.removeAttribute('next-ref');
	if (host.refresh())
		document.querySelector('#setup-error').textContent =
			'Configuration repaired. Section navigation is ready.';
});
